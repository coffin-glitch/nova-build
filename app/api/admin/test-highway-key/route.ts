import { requireApiAdmin } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const API_BASE = "https://staging.highway.com/core/connect/external_api/v1";

export async function POST(request: NextRequest) {
  try {
    await requireApiAdmin(request);

    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "API key is required" },
        { status: 400 }
      );
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
        return NextResponse.json({
          success: true,
          message: "API key is valid and working!",
          testMc: "203507",
          carrierId: response.data?.id,
        });
      } else if (response.status === 401) {
        return NextResponse.json({
          success: false,
          error: "401 Unauthorized - API key is invalid or rejected",
          details: response.data,
          suggestion: "Check if the API key is correct, or if there are IP/device restrictions",
        });
      } else {
        return NextResponse.json({
          success: false,
          error: `API returned status ${response.status}`,
          details: response.data,
        });
      }
    } catch (error: any) {
      return NextResponse.json({
        success: false,
        error: error.message || "Failed to test API key",
        details: error.response?.data || error.message,
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to test API key" },
      { status: 500 }
    );
  }
}

