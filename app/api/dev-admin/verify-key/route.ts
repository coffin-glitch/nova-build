import { requireApiAdmin } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

// SECURITY FIX: Remove key logging and add authentication
const DEV_KEY = process.env.DEV_ADMIN_KEY || "nova-dev-2024-admin-key";

export async function POST(request: NextRequest) {
  try {
    // SECURITY FIX: Require admin authentication
    await requireApiAdmin(request);
    
    const { key } = await request.json();
    
    // SECURITY FIX: Remove sensitive logging
    if (key === DEV_KEY) {
      return NextResponse.json({ 
        success: true,
        valid: true, 
        message: "Dev key accepted" 
      });
    } else {
      return NextResponse.json({ 
        success: false,
        valid: false, 
        error: "Invalid dev key" 
      });
    }
  } catch (error: any) {
    console.error("❌ Dev key verification error:", error);
    return NextResponse.json(
      { success: false, valid: false, error: error.message },
      { status: 500 }
    );
  }
}
