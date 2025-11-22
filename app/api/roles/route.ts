import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";
import { getUserRole, isAdmin, isCarrier, syncAllUsers, getRoleStats } from "@/lib/role-manager";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const action = searchParams.get("action") || "check";
    
    // Input validation
    const validation = validateInput(
      { userId, action },
      {
        userId: { type: 'string', maxLength: 200, required: false },
        action: { type: 'string', enum: ['check', 'admin', 'carrier', 'sync', 'stats'], required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_roles_input', undefined, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Require admin auth for sensitive actions
    if (action === 'sync' || action === 'stats') {
      const auth = await requireApiAdmin(request);
      logSecurityEvent('roles_admin_action', auth.userId, { action });
    }
    
    console.log("🔍 RoleManager API: Received request");
    console.log("👤 User ID:", userId);
    console.log("🎯 Action:", action);
    
    switch (action) {
      case "check":
        if (!userId) {
          const response = NextResponse.json(
            { error: "userId is required for check action" },
            { status: 400 }
          );
          return addSecurityHeaders(response);
        }
        const role = await getUserRole(userId);
        console.log("🎯 Role result:", role);
        const checkResponse = NextResponse.json({ 
          role,
          isAdmin: role === "admin",
          isCarrier: role === "carrier" || role === "admin"
        });
        return addSecurityHeaders(checkResponse);

      case "admin":
        if (!userId) {
          const response = NextResponse.json(
            { error: "userId is required for admin action" },
            { status: 400 }
          );
          return addSecurityHeaders(response);
        }
        const adminStatus = await isAdmin(userId);
        console.log("🎯 Admin status:", adminStatus);
        const adminResponse = NextResponse.json({ isAdmin: adminStatus });
        return addSecurityHeaders(adminResponse);

      case "carrier":
        if (!userId) {
          const response = NextResponse.json(
            { error: "userId is required for carrier action" },
            { status: 400 }
          );
          return addSecurityHeaders(response);
        }
        const carrierStatus = await isCarrier(userId);
        console.log("🎯 Carrier status:", carrierStatus);
        const carrierResponse = NextResponse.json({ isCarrier: carrierStatus });
        return addSecurityHeaders(carrierResponse);

      case "sync":
        console.log("🔄 Starting manual sync...");
        await syncAllUsers();
        console.log("✅ Manual sync completed");
        const syncResponse = NextResponse.json({ success: true, message: "Sync completed" });
        return addSecurityHeaders(syncResponse);

      case "stats":
        const stats = await getRoleStats();
        console.log("📊 Role stats:", stats);
        const statsResponse = NextResponse.json(stats);
        return addSecurityHeaders(statsResponse);

      default:
        const defaultResponse = NextResponse.json({ error: "Invalid action" }, { status: 400 });
        return addSecurityHeaders(defaultResponse);
    }
  } catch (error: any) {
    console.error("❌ RoleManager API error:", error);
    
    // Handle auth errors
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      const response = NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
      return addSecurityHeaders(response);
    }
    
    logSecurityEvent('roles_api_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Internal server error",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
