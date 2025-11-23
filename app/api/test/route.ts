import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    logSecurityEvent('test_api_accessed', undefined);
    const response = NextResponse.json({ success: true, message: "Test API is working" });
    return addSecurityHeaders(response);
  } catch (error: any) {
    console.error("Test API error:", error);
    logSecurityEvent('test_api_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    const response = NextResponse.json(
      { 
        error: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'Test API error'
      },
      { status: 500 }
    );
    return addSecurityHeaders(response);
  }
}
