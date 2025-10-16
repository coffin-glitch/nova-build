import sql from '@/lib/db';
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Get PostgreSQL version and basic info
    const versionResult = await sql`SELECT version()`;
    const version = versionResult[0]?.version || 'Unknown';

    // Check database connection
    const connectionTest = await sql`SELECT 1 as test`;
    
    // Get database size
    const sizeResult = await sql`
      SELECT pg_size_pretty(pg_database_size(current_database())) as database_size
    `;
    const databaseSize = sizeResult[0]?.database_size || 'Unknown';

    // Check if JSONB functions are available (PostgreSQL 9.4+)
    const jsonbTest = await sql`
      SELECT jsonb_array_length('["test"]'::jsonb) as jsonb_test
    `;
    const jsonbSupported = jsonbTest[0]?.jsonb_test === 1;

    // Check if we have the required tables
    const tablesResult = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('telegram_bids', 'carrier_bids', 'user_roles_cache', 'user_roles')
      ORDER BY table_name
    `;
    const existingTables = tablesResult.map(row => row.table_name);

    // Check table row counts
    const counts: Record<string, number> = {};
    for (const table of existingTables) {
      try {
        const countResult = await sql`SELECT COUNT(*) as count FROM ${sql(table)}`;
        counts[table] = parseInt(countResult[0]?.count || '0');
      } catch (error) {
        counts[table] = -1; // Error accessing table
      }
    }

    // Check PostgreSQL extensions
    const extensionsResult = await sql`
      SELECT extname, extversion 
      FROM pg_extension 
      WHERE extname IN ('uuid-ossp', 'pgcrypto', 'pg_stat_statements')
      ORDER BY extname
    `;
    const extensions = extensionsResult.map(row => ({
      name: row.extname,
      version: row.extversion
    }));

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      database: {
        version: version,
        size: databaseSize,
        jsonb_supported: jsonbSupported,
        tables: {
          existing: existingTables,
          counts: counts
        },
        extensions: extensions
      },
      features: {
        jsonb_operations: jsonbSupported,
        uuid_support: extensions.some(ext => ext.name === 'uuid-ossp'),
        crypto_support: extensions.some(ext => ext.name === 'pgcrypto'),
        query_stats: extensions.some(ext => ext.name === 'pg_stat_statements')
      }
    });
  } catch (error) {
    console.error('Database health check error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
