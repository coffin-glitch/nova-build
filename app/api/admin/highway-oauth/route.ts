import { requireApiAdmin } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

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
    await requireApiAdmin(request);

    const body = await request.json();
    const { client_id, client_secret, grant_type = "client_credentials" } = body;

    if (!client_id || !client_secret) {
      return NextResponse.json(
        { error: "Missing client_id or client_secret" },
        { status: 400 }
      );
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

    return NextResponse.json({
      success: response.status === 200,
      status: response.status,
      data: response.data,
      message: response.status === 200 
        ? "OAuth token obtained successfully" 
        : "OAuth token request failed - Highway may not support OAuth for API access",
    }, { status: response.status });

  } catch (error: any) {
    console.error("Highway OAuth error:", error);
    return NextResponse.json(
      { 
        error: "Failed to get OAuth token",
        details: error.message 
      },
      { status: 500 }
    );
  }
}

