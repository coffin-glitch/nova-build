import { getApiAuth } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

/**
 * API route to get current user's role
 * Used by client-side hooks when using Supabase auth
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getApiAuth(request);
    
    if (!auth || !auth.userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return NextResponse.json(
      {
        role: auth.userRole || "carrier",
        userId: auth.userId,
        provider: auth.authProvider,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('[API /user/role] Error:', error);
    return NextResponse.json(
      { 
        error: error.message || "Internal server error",
        role: "carrier", // Default fallback
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

