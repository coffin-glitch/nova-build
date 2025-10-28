import { requireAdmin } from "@/lib/auth-server";
import sql from "@/lib/db.server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // SECURITY FIX: Require admin authentication
    await requireAdmin();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    
    console.log("🔍 Check Admin API: Received request");
    console.log("👤 User ID:", userId);
    
    if (!userId) {
      console.log("❌ No userId provided");
      return NextResponse.json({ isAdmin: false }, { status: 400 });
    }
    
    console.log("📡 Checking admin status directly...");
    
    // Direct database query with proper authentication
    const result = await sql`
      SELECT role FROM user_roles WHERE clerk_user_id = ${userId}
    `;
    
    console.log("🔍 Direct DB query result:", result);
    
    const isAdmin = result.length > 0 && result[0].role === "admin";
    console.log("🎯 Admin status result:", isAdmin);
    
    return NextResponse.json({ isAdmin });
  } catch (error: any) {
    console.error("❌ Check admin API error:", error);
    return NextResponse.json(
      { isAdmin: false, error: error.message },
      { status: 500 }
    );
  }
}
