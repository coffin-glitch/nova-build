import { requireApiAdmin } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    await requireApiAdmin(request);

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

      return NextResponse.json({
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
    } catch (error: any) {
      console.error('[Test] Fetch error:', error);
      return NextResponse.json({
        error: error.message,
        stack: error.stack
      }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

