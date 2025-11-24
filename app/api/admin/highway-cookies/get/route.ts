import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
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
          ok: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }
    
    console.log('Getting cookies for userId:', userId);
    
    if (!userId) {
      console.error('No userId found in auth');
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get stored cookies for this user
    const result = await sql`
      SELECT 
        cookies_data,
        extracted_at,
        source_url,
        user_id
      FROM highway_user_cookies
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    // Also check if there are ANY cookies stored (for debugging)
    const allCookies = await sql`
      SELECT user_id, extracted_at, updated_at
      FROM highway_user_cookies
      ORDER BY updated_at DESC
      LIMIT 5
    `;
    
    console.log('Database query result:', {
      found: result.length > 0,
      userId: result[0]?.user_id,
      cookieCount: result[0]?.cookies_data?.cookies?.length || result[0]?.cookies_data?.length || 0,
      queryingForUserId: userId,
      allStoredUserIds: allCookies.map(r => r.user_id)
    });

    if (result.length === 0) {
      console.log('No cookies found in database for userId:', userId);
      return NextResponse.json({
        ok: false,
        error: "No cookies found. Please extract cookies from Highway first.",
        cookies: null,
        userId: userId
      });
    }

    const cookieData = result[0];
    const storageState = cookieData.cookies_data;
    
    // Support both new storageState format and old cookie-only format
    if (storageState.cookies && Array.isArray(storageState.cookies)) {
      // New format: Playwright storageState
      if (storageState.cookies.length === 0) {
        console.warn('StorageState has no cookies');
        return NextResponse.json({
          ok: false,
          error: "StorageState is empty",
          cookies: null,
        });
      }
      
      console.log('✅ Returning storageState:', {
        cookieCount: storageState.cookies.length,
        originsCount: storageState.origins?.length || 0,
        extractedAt: cookieData.extracted_at
      });
      
      logSecurityEvent('highway_cookies_retrieved', userId);
      
      const response = NextResponse.json({
        ok: true,
        storageState: storageState,
        cookies: storageState.cookies, // Backward compatibility
        extractedAt: cookieData.extracted_at,
        sourceUrl: cookieData.source_url,
        cookieCount: storageState.cookies.length
      });
      
      return addSecurityHeaders(response);
      
    } else if (Array.isArray(storageState)) {
      // Old format: just cookies array
      if (storageState.length === 0) {
        console.warn('Cookies array is empty');
        const response = NextResponse.json({
          ok: false,
          error: "Cookies data is empty",
          cookies: null,
        });
        return addSecurityHeaders(response);
      }
      
      console.log('✅ Returning cookies (legacy format):', {
        cookieCount: storageState.length,
        extractedAt: cookieData.extracted_at
      });
      
      logSecurityEvent('highway_cookies_retrieved', userId);
      
      const response = NextResponse.json({
        ok: true,
        cookies: storageState,
        extractedAt: cookieData.extracted_at,
        sourceUrl: cookieData.source_url,
        cookieCount: storageState.length
      });
      
      return addSecurityHeaders(response);
      
    } else {
      console.warn('Cookies data is invalid format');
      const response = NextResponse.json({
        ok: false,
        error: "Cookies data is invalid format",
        cookies: null,
      });
      return addSecurityHeaders(response);
    }
  } catch (error: any) {
    console.error("Error retrieving Highway cookies:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('highway_cookies_retrieve_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        ok: false,
        error: process.env.NODE_ENV === 'development' 
          ? (error.message || "Failed to retrieve cookies")
          : "Failed to retrieve cookies",
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

