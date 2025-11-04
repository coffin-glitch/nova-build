import { requireApiAdmin } from "@/lib/auth-api-helper";
import { getAuthMetricsForAPI } from "@/lib/auth-monitoring";
import { getAuthConfig } from "@/lib/auth-config";
import { NextResponse } from "next/server";

/**
 * Admin Auth Metrics Endpoint
 * 
 * Provides auth metrics and monitoring data for the migration.
 * Requires admin access.
 */
export async function GET() {
  try {
    await requireApiAdmin();
    
    const metrics = getAuthMetricsForAPI();
    const config = getAuthConfig();
    
    return NextResponse.json({
      config: {
        provider: config.provider,
        allowDualAuth: config.allowDualAuth,
        enableMonitoring: config.enableMonitoring,
        enableRollback: config.enableRollback,
      },
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unauthorized" },
      { status: error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}



