import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin read operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'readOnly'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }

    const apiKey = process.env.HIGHWAY_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not found" }, { status: 500 });
    }

    // Test with a simple endpoint first
    const testUrl = "https://staging.highway.com/core/connect/external_api/v1/carriers";
    
    const headers = {
      "Accept": "application/json",
      "Authorization": `Bearer ${apiKey.replace(/\s/g, "")}`,
      "User-Agent": "HighwayScorecard/1.7"
    };

    console.log('[Test] Making direct request to:', testUrl);
    console.log('[Test] Headers:', {
      Accept: headers.Accept,
      Authorization: headers.Authorization.substring(0, 30) + '...',
      'User-Agent': headers['User-Agent']
    });

    try {
      const response = await fetch(testUrl + "?q[s]=id desc&limit=1", {
        headers: headers as HeadersInit,
        method: "GET",
      });

      const responseText = await response.text();
      
      console.log('[Test] Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseText.substring(0, 500)
      });

      logSecurityEvent('highway_direct_test_accessed', userId);
      
      const responseObj = NextResponse.json({
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseText.substring(0, 1000),
        requestHeaders: {
          Accept: headers.Accept,
          AuthorizationPrefix: headers.Authorization.substring(0, 30) + '...',
          UserAgent: headers['User-Agent']
        }
      });
      
      return addSecurityHeaders(responseObj);
      
    } catch (error: any) {
      console.error('[Test] Fetch error:', error);
      
      logSecurityEvent('highway_direct_test_error', userId, { 
        error: error.message || 'Fetch error' 
      });
      
      const responseObj = NextResponse.json({
        error: process.env.NODE_ENV === 'development' 
          ? error.message
          : 'Failed to test Highway API',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, { status: 500 });
      
      return addSecurityHeaders(responseObj);
    }
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('highway_direct_test_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: process.env.NODE_ENV === 'development' 
          ? error.message
          : "Failed to test Highway API"
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

