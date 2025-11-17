import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}

interface CookieData {
  storageState?: {
    cookies: Array<{
      name: string;
      value: string;
      domain: string;
      path: string;
      expires?: number;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: string;
    }>;
    origins?: Array<{
      origin: string;
      localStorage: Array<{
        name: string;
        value: string;
      }>;
    }>;
  };
  simplified?: {
    cookies: Array<any>;
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
    extractedAt: string;
    url: string;
  };
  // Backward compatibility
  cookies?: Array<any>;
  extractedAt?: string;
  url?: string;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    
    // Get user ID from auth
    const userId = auth.userId;
    console.log('Storing cookies for userId:', userId);
    
    if (!userId) {
      console.error('No userId found in auth');
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const data: CookieData = await request.json();
    
    // Support both new storageState format and old simplified format
    let cookies: any[] = [];
    let storageState: any = null;
    
    if (data.storageState) {
      // New format: Playwright storageState
      storageState = data.storageState;
      cookies = data.storageState.cookies || [];
      console.log('Received storageState format:', {
        cookieCount: cookies.length,
        origins: data.storageState.origins?.length || 0
      });
    } else if (data.simplified) {
      // Simplified format
      cookies = data.simplified.cookies || [];
      storageState = {
        cookies: cookies,
        origins: [{
          origin: data.simplified.url ? new URL(data.simplified.url).origin : 'https://highway.com',
          localStorage: Object.entries(data.simplified.localStorage || {}).map(([key, value]) => ({
            name: key,
            value: value
          }))
        }]
      };
      console.log('Received simplified format:', {
        cookieCount: cookies.length,
        localStorageCount: Object.keys(data.simplified.localStorage || {}).length
      });
    } else if (data.cookies) {
      // Backward compatibility: old format
      cookies = data.cookies;
      storageState = {
        cookies: cookies,
        origins: []
      };
      console.log('Received legacy format:', {
        cookieCount: cookies.length
      });
    }

    if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
      console.error('Invalid or empty cookie data:', data);
      return NextResponse.json(
        { ok: false, error: "No cookies provided" },
        { status: 400 }
      );
    }

    // Store storageState in database (Playwright format)
    // This includes cookies, localStorage, and sessionStorage
    const extractedAt = data.simplified?.extractedAt || data.extractedAt || new Date().toISOString();
    const sourceUrl = data.simplified?.url || data.url || 'https://highway.com';
    
    const result = await sql`
      INSERT INTO highway_user_cookies (
        user_id,
        cookies_data,
        extracted_at,
        source_url,
        created_at,
        updated_at
      ) VALUES (
        ${userId},
        ${JSON.stringify(storageState)}::jsonb,
        ${extractedAt}::timestamptz,
        ${sourceUrl},
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id) 
      DO UPDATE SET
        cookies_data = EXCLUDED.cookies_data,
        extracted_at = EXCLUDED.extracted_at,
        source_url = EXCLUDED.source_url,
        updated_at = NOW()
      RETURNING id, user_id, extracted_at
    `;

    console.log('✅ Cookies stored successfully:', {
      id: result[0]?.id,
      userId: result[0]?.user_id,
      storedUserId: userId,
      extractedAt: result[0]?.extracted_at,
      cookieCount: cookies.length
    });
    
    // Verify it was stored correctly
    const verify = await sql`
      SELECT user_id, LENGTH(cookies_data::text) as data_size
      FROM highway_user_cookies
      WHERE user_id = ${userId}
      LIMIT 1
    `;
    console.log('✅ Verification query:', {
      found: verify.length > 0,
      userId: verify[0]?.user_id,
      dataSize: verify[0]?.data_size
    });

    const response = NextResponse.json({
      ok: true,
      message: "Authentication state stored successfully",
      userId: userId,
      cookieCount: cookies.length,
      hasLocalStorage: storageState.origins && storageState.origins.length > 0
    });
    
    // Add CORS headers to allow requests from Highway.com
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    
    return response;
  } catch (error: any) {
    console.error("Error storing Highway cookies:", error);
    console.error("Error stack:", error.stack);
    const response = NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to store cookies",
      },
      { status: 500 }
    );
    
    // Add CORS headers even on error
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    
    return response;
  }
}

