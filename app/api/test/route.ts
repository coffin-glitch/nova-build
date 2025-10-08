import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({ success: true, message: "Test API is working" });
  } catch (error) {
    console.error("Test API error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
