import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://staging.highway.com/core/connect/external_api/v1";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const body = await request.json();
    const { apiKey } = body;

    // Input validation
    const validation = validateInput(
      { apiKey },
      {
        apiKey: { required: true, type: 'string', minLength: 10, maxLength: 500 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_highway_key_test_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { success: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!apiKey) {
      const response = NextResponse.json(
        { success: false, error: "API key is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Clean the API key
    const cleanKey = apiKey.replace(/\s/g, "");

    // Test with a simple endpoint - try to get carrier by MC number
    const testUrl = `${API_BASE}/carriers/MC/203507/by_identifier`;

    try {
      const response = await axios.get(testUrl, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${cleanKey}`,
          'User-Agent': 'HighwayScorecard/1.7',
        },
        validateStatus: (status) => true,
        timeout: 10000,
      });

      if (response.status === 200) {
        logSecurityEvent('highway_key_test_success', userId);
        
        const responseObj = NextResponse.json({
          success: true,
          message: "API key is valid and working!",
          testMc: "203507",
          carrierId: response.data?.id,
        });
        
        return addSecurityHeaders(responseObj);
      } else if (response.status === 401) {
        logSecurityEvent('highway_key_test_invalid', userId);
        
        const responseObj = NextResponse.json({
          success: false,
          error: "401 Unauthorized - API key is invalid or rejected",
          details: process.env.NODE_ENV === 'development' ? response.data : undefined,
          suggestion: "Check if the API key is correct, or if there are IP/device restrictions",
        });
        
        return addSecurityHeaders(responseObj);
      } else {
        logSecurityEvent('highway_key_test_error', userId, { status: response.status });
        
        const responseObj = NextResponse.json({
          success: false,
          error: `API returned status ${response.status}`,
          details: process.env.NODE_ENV === 'development' ? response.data : undefined,
        });
        
        return addSecurityHeaders(responseObj);
      }
    } catch (error: any) {
      logSecurityEvent('highway_key_test_connection_error', userId, { 
        error: error.message || "Connection error" 
      });
      
      const responseObj = NextResponse.json({
        success: false,
        error: process.env.NODE_ENV === 'development' 
          ? (error.message || "Failed to test API key")
          : "Failed to test API key",
        details: process.env.NODE_ENV === 'development' 
          ? (error.response?.data || error.message)
          : undefined,
      });
      
      return addSecurityHeaders(responseObj);
    }
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('highway_key_test_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        success: false, 
        error: process.env.NODE_ENV === 'development' 
          ? (error.message || "Failed to test API key")
          : "Failed to test API key"
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

