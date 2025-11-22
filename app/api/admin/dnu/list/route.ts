import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * DNU List API
 * GET: Get all DNU entries with carrier information
 */

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('search') || '';
    const statusFilter = searchParams.get('status'); // 'active' or 'removed' or null for all

    // Build query with search and status filter
    let query = sql`
      SELECT 
        d.id,
        d.mc_number,
        d.dot_number,
        d.carrier_name,
        d.status,
        d.added_to_dnu_at,
        d.removed_from_dnu_at,
        d.last_upload_date,
        d.created_at,
        d.updated_at,
        (
          SELECT COUNT(*)::int
          FROM carrier_profiles cp
          WHERE (cp.mc_number = d.mc_number OR cp.dot_number = d.dot_number)
        ) as carrier_count,
        (
          SELECT json_agg(
            json_build_object(
              'user_id', cp.supabase_user_id,
              'company_name', cp.company_name,
              'mc_number', cp.mc_number,
              'dot_number', cp.dot_number,
              'profile_status', cp.profile_status
            )
          )
          FROM carrier_profiles cp
          WHERE (cp.mc_number = d.mc_number OR cp.dot_number = d.dot_number)
          LIMIT 10
        ) as matching_carriers
      FROM dnu_tracking d
      WHERE 1=1
    `;

    // Add status filter
    if (statusFilter === 'active' || statusFilter === 'removed') {
      query = sql`${query} AND d.status = ${statusFilter}`;
    }

    // Add search filter
    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      query = sql`
        ${query}
        AND (
          d.mc_number ILIKE ${searchPattern}
          OR d.dot_number ILIKE ${searchPattern}
          OR d.carrier_name ILIKE ${searchPattern}
        )
      `;
    }

    // Order by most recently added to oldest
    query = sql`${query} ORDER BY d.added_to_dnu_at DESC NULLS LAST, d.created_at DESC`;

    const result = await query;

    return NextResponse.json({
      ok: true,
      data: result
    });

  } catch (error: any) {
    console.error("Error getting DNU list:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to get DNU list" },
      { status: 500 }
    );
  }
}

