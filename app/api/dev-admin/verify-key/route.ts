import { NextRequest, NextResponse } from "next/server";

// You can change this dev key to whatever you want
const DEV_KEY = process.env.DEV_ADMIN_KEY || "nova-dev-2024-admin-key";

console.log("🔑 Dev Key API: DEV_ADMIN_KEY env var:", process.env.DEV_ADMIN_KEY);
console.log("🔑 Dev Key API: Final DEV_KEY:", DEV_KEY);

export async function POST(request: NextRequest) {
  try {
    const { key } = await request.json();
    
    console.log("🔑 Dev Key Verification: Received key:", key);
    console.log("🔑 Dev Key Verification: Expected key:", DEV_KEY);
    console.log("🔑 Dev Key Verification: Keys match:", key === DEV_KEY);
    
    if (key === DEV_KEY) {
      console.log("✅ Dev key verification successful");
      return NextResponse.json({ 
        success: true,
        valid: true, 
        message: "Dev key accepted" 
      });
    } else {
      console.log("❌ Dev key verification failed");
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
