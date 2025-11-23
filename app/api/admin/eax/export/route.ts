import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Fire-and-forget local run:
    const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "eax:export"], {
      cwd: process.cwd(),
      stdio: "ignore",
      detached: true,
    });
    child.unref();

    logSecurityEvent('eax_export_started', userId);
    
    const response = NextResponse.json({ 
      ok: true, 
      message: "Exporter started. Check the Chromium window." 
    });
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("EAX export error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('eax_export_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        ok: false,
        error: "Failed to start EAX export",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
