import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

/**
 * Highway OAuth Token Endpoint
 * 
 * This endpoint can be used to exchange Highway credentials for an access token
 * if Highway supports OAuth for API access (separate from carrier sign-in OAuth)
 * 
 * Note: Highway's OAuth flow in their docs is for "Sign In with Highway" (carrier auth),
 * not for broker API access. This might not be applicable for API key authentication.
 */

const HIGHWAY_OAUTH_TOKEN_URL = "https://staging.highway.com/core/oauth/tokens";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin write operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'admin'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    const body = await request.json();
    const { client_id, client_secret, grant_type = "client_credentials" } = body;

    // Input validation
    const validation = validateInput(
      { client_id, client_secret, grant_type },
      {
        client_id: { required: true, type: 'string', minLength: 1, maxLength: 500 },
        client_secret: { required: true, type: 'string', minLength: 1, maxLength: 500 },
        grant_type: { type: 'string', enum: ['client_credentials', 'authorization_code'], required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_highway_oauth_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!client_id || !client_secret) {
      const response = NextResponse.json(
        { error: "Missing client_id or client_secret" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Try OAuth client credentials flow (if Highway supports it for API access)
    const response = await axios.post(
      HIGHWAY_OAUTH_TOKEN_URL,
      {
        grant_type: grant_type,
        client_id: client_id,
        client_secret: client_secret,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        validateStatus: (status) => true,
      }
    );

    logSecurityEvent('highway_oauth_attempted', userId, { 
      success: response.status === 200,
      status: response.status
    });
    
    const responseObj = NextResponse.json({
      success: response.status === 200,
      status: response.status,
      data: response.data,
      message: response.status === 200 
        ? "OAuth token obtained successfully" 
        : "OAuth token request failed - Highway may not support OAuth for API access",
    }, { status: response.status });
    
    return addSecurityHeaders(responseObj);

  } catch (error: any) {
    console.error("Highway OAuth error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('highway_oauth_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to get OAuth token",
        details: process.env.NODE_ENV === 'development' 
          ? error.message
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

