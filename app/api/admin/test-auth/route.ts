import { requireApiAdmin } from '@/lib/auth-api-helper';
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    console.log("Testing authentication...");
    
    // Test the requireApiAdmin function (Supabase-only)
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;
    const role = auth.userRole;
    
    console.log("Authentication successful:", { userId, role });
    
    return NextResponse.json({
      success: true,
      userId,
      role,
      message: "Authentication test successful"
    });

  } catch (error) {
    console.error("Authentication test error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Authentication test failed",
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
