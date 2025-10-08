import { NextRequest, NextResponse } from "next/server";
import { getUserRole, isAdmin, isCarrier, syncAllUsers, getRoleStats } from "@/lib/role-manager";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const action = searchParams.get("action") || "check";
    
    console.log("🔍 RoleManager API: Received request");
    console.log("👤 User ID:", userId);
    console.log("🎯 Action:", action);
    
    switch (action) {
      case "check":
        if (!userId) {
          return NextResponse.json({ error: "userId is required for check action" }, { status: 400 });
        }
        const role = await getUserRole(userId);
        console.log("🎯 Role result:", role);
        return NextResponse.json({ 
          role,
          isAdmin: role === "admin",
          isCarrier: role === "carrier" || role === "admin"
        });

      case "admin":
        if (!userId) {
          return NextResponse.json({ error: "userId is required for admin action" }, { status: 400 });
        }
        const adminStatus = await isAdmin(userId);
        console.log("🎯 Admin status:", adminStatus);
        return NextResponse.json({ isAdmin: adminStatus });

      case "carrier":
        if (!userId) {
          return NextResponse.json({ error: "userId is required for carrier action" }, { status: 400 });
        }
        const carrierStatus = await isCarrier(userId);
        console.log("🎯 Carrier status:", carrierStatus);
        return NextResponse.json({ isCarrier: carrierStatus });

      case "sync":
        console.log("🔄 Starting manual sync...");
        await syncAllUsers();
        console.log("✅ Manual sync completed");
        return NextResponse.json({ success: true, message: "Sync completed" });

      case "stats":
        const stats = await getRoleStats();
        console.log("📊 Role stats:", stats);
        return NextResponse.json(stats);

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("❌ RoleManager API error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
