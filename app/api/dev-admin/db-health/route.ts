import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication for database health check
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin read operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'readOnly'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }
    
    logSecurityEvent('db_health_check_accessed', userId);
    
    // Check if user_roles table exists and what columns it has
    const tableInfo = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user_roles' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    
    console.log("📊 user_roles table columns:", tableInfo);
    
    // Check if table exists at all
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_roles'
      )
    `;
    
    console.log("📋 user_roles table exists:", Array.isArray(tableExists) ? tableExists[0]?.exists : false);
    
    // Get all tables in public schema
    const allTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    const allTablesArray = Array.isArray(allTables) ? allTables : [];
    
    const response = NextResponse.json({
      success: true,
      userRolesTableExists: Array.isArray(tableExists) ? (tableExists[0]?.exists || false) : false,
      userRolesColumns: tableInfo,
      allTables: allTablesArray.map((t: any) => t.table_name)
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    
  } catch (error: any) {
    console.error("❌ Database health check error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('db_health_check_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json({
      success: false,
      error: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : 'Database health check failed'
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}
