import { NextRequest, NextResponse } from "next/server";
import { setUserRole } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { userId, role } = await request.json();
    
    if (!userId || !role) {
      return NextResponse.json({ error: "Missing userId or role" }, { status: 400 });
    }
    
    await setUserRole(userId, role);
    
    return NextResponse.json({ success: true, message: `User ${userId} set as ${role}` });
  } catch (error) {
    console.error("Error setting user role:", error);
    return NextResponse.json({ error: "Failed to set user role" }, { status: 500 });
  }
}
