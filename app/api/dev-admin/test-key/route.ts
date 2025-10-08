import { NextRequest, NextResponse } from "next/server";

// You can change this dev key to whatever you want
const DEV_KEY = process.env.DEV_ADMIN_KEY || "nova-dev-2024-admin-key";

export async function GET(request: NextRequest) {
  try {
    console.log("🔑 Dev Key Test API: DEV_ADMIN_KEY env var:", process.env.DEV_ADMIN_KEY);
    console.log("🔑 Dev Key Test API: Final DEV_KEY:", DEV_KEY);
    
    return NextResponse.json({ 
      success: true,
      expectedKey: DEV_KEY,
      envVar: process.env.DEV_ADMIN_KEY || "not set",
      message: "Dev key test endpoint"
    });
  } catch (error: any) {
    console.error("❌ Dev key test error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
