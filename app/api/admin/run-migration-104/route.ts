import { NextRequest, NextResponse } from "next/server";
import sql from '@/lib/db';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Admin endpoint to run migration 104: Fix find_similar_loads function
 * This updates the function to use supabase_carrier_user_id instead of carrier_user_id
 */
export async function POST(request: NextRequest) {
  try {
    // Basic security check - in production, add proper admin authentication
    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.ADMIN_API_KEY || process.env.WEBHOOK_API_KEY;
    
    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Admin Migration] Running migration 104: Fix find_similar_loads function...');
    
    const migrationPath = join(process.cwd(), 'db/migrations/104_fix_find_similar_loads_supabase_user_id.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('[Admin Migration] Executing migration SQL...');
    await sql.unsafe(migrationSQL);
    
    console.log('[Admin Migration] Migration 104 completed successfully!');
    
    return NextResponse.json({
      ok: true,
      message: 'Migration 104 completed successfully',
      details: 'The find_similar_loads function now uses supabase_carrier_user_id',
    });
    
  } catch (error: any) {
    console.error('[Admin Migration] Migration failed:', error);
    return NextResponse.json(
      { 
        error: 'Migration failed',
        details: process.env.NODE_ENV === 'development' 
          ? error.message 
          : 'Check server logs for details',
        code: error.code,
      },
      { status: 500 }
    );
  }
}

