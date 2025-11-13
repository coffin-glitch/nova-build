import sql from "@/lib/db.server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    console.log("🔍 Checking database schema...");
    
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
    console.log("📚 All tables:", allTablesArray.map((t: any) => t.table_name));
    
    return NextResponse.json({
      success: true,
      userRolesTableExists: Array.isArray(tableExists) ? (tableExists[0]?.exists || false) : false,
      userRolesColumns: tableInfo,
      allTables: allTablesArray.map((t: any) => t.table_name)
    });
    
  } catch (error: any) {
    console.error("❌ Database health check error:", error);
    return NextResponse.json({
      success: false,
      error: error.message
    });
  }
}
