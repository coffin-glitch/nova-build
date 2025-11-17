import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;
    
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
      
      return NextResponse.json({
        ok: true,
        storageState: storageState,
        cookies: storageState.cookies, // Backward compatibility
        extractedAt: cookieData.extracted_at,
        sourceUrl: cookieData.source_url,
        cookieCount: storageState.cookies.length
      });
    } else if (Array.isArray(storageState)) {
      // Old format: just cookies array
      if (storageState.length === 0) {
        console.warn('Cookies array is empty');
        return NextResponse.json({
          ok: false,
          error: "Cookies data is empty",
          cookies: null,
        });
      }
      
      console.log('✅ Returning cookies (legacy format):', {
        cookieCount: storageState.length,
        extractedAt: cookieData.extracted_at
      });
      
      return NextResponse.json({
        ok: true,
        cookies: storageState,
        extractedAt: cookieData.extracted_at,
        sourceUrl: cookieData.source_url,
        cookieCount: storageState.length
      });
    } else {
      console.warn('Cookies data is invalid format');
      return NextResponse.json({
        ok: false,
        error: "Cookies data is invalid format",
        cookies: null,
      });
    }
  } catch (error: any) {
    console.error("Error retrieving Highway cookies:", error);
    console.error("Error stack:", error.stack);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to retrieve cookies",
      },
      { status: 500 }
    );
  }
}

