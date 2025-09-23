import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET() {
  try {
    // Test database connection with a simple query
    const result = await sql`SELECT 1 as ok`;
    
    if (result && result.length > 0 && result[0].ok === 1) {
      return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
    } else {
      return NextResponse.json(
        { ok: false, error: "Unexpected query result" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Database health check failed:", error);
    return NextResponse.json(
      { 
        ok: false, 
        error: error.message || "Database connection failed",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
