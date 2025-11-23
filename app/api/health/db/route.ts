import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import sql from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Test database connection with a simple query
    const result = await sql`SELECT 1 as ok`;
    
    if (result && result.length > 0 && result[0].ok === 1) {
      logSecurityEvent('health_check_db_accessed', undefined);
      const response = NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
      return addSecurityHeaders(response);
    } else {
      logSecurityEvent('health_check_db_unexpected_result', undefined);
      const response = NextResponse.json(
        { ok: false, error: "Unexpected query result" },
        { status: 500 }
      );
      return addSecurityHeaders(response);
    }
  } catch (error: any) {
    console.error("Database health check failed:", error);
    logSecurityEvent('health_check_db_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    const response = NextResponse.json(
      { 
        ok: false, 
        error: process.env.NODE_ENV === 'development' 
          ? (error.message || "Database connection failed")
          : "Database connection failed",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
    return addSecurityHeaders(response);
  }
}
