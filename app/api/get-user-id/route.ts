import { requireApiAuth } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Ensure user is authenticated (Supabase-only)
    const auth = await requireApiAuth(request);
    
    return NextResponse.json({ userId: auth.userId });
  } catch (error) {
    console.error("Error getting user ID:", error);
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
