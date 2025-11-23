import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // SECURITY FIX: Require admin authentication (Supabase-only)
    await requireApiAdmin(request);
    
    const auth = await requireApiAdmin(request);
    const adminUserId = auth.userId;

    // Check rate limit for admin read operation
    const rateLimit = await checkApiRateLimit(request, {
      userId: adminUserId,
      routeType: 'readOnly'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          isAdmin: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    
    // Input validation
    const validation = validateInput(
      { userId },
      {
        userId: { required: true, type: 'string', maxLength: 200 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_check_admin_input', adminUserId, { errors: validation.errors });
      const response = NextResponse.json(
        { isAdmin: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }
    
    console.log("🔍 Check Admin API: Received request");
    console.log("👤 User ID:", userId);
    
    if (!userId) {
      console.log("❌ No userId provided");
      const response = NextResponse.json(
        { isAdmin: false, error: "userId is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }
    
    console.log("📡 Checking admin status directly...");
    
    // Direct database query with proper authentication (Supabase-only)
    const result = await sql`
      SELECT role FROM user_roles_cache WHERE supabase_user_id = ${userId}
    `;
    
    console.log("🔍 Direct DB query result:", result);
    
    const isAdmin = result.length > 0 && result[0].role === "admin";
    console.log("🎯 Admin status result:", isAdmin);
    
    logSecurityEvent('admin_status_checked', adminUserId, { checkedUserId: userId, isAdmin });
    
    const response = NextResponse.json({ isAdmin });
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("❌ Check admin API error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('check_admin_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        isAdmin: false,
        error: process.env.NODE_ENV === 'development' 
          ? error.message
          : "Failed to check admin status"
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
