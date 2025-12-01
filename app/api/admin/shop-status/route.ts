import { requireAdmin } from "@/lib/auth";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/shop-status
 * Get current shop status
 */
export async function GET() {
  try {
    await requireAdmin();
    
    const result = await sql`
      SELECT setting_value
      FROM system_settings
      WHERE setting_key = 'shop_status'
      LIMIT 1
    `;
    
    const status = result.length > 0 ? result[0].setting_value : 'open';
    
    return NextResponse.json({
      ok: true,
      status: status === 'open' ? 'open' : 'closed',
    });
  } catch (error: any) {
    console.error("[Shop Status] Error fetching shop status:", error);
    return NextResponse.json(
      { error: "Failed to fetch shop status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/shop-status
 * Update shop status
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const { status } = body;
    
    if (status !== 'open' && status !== 'closed') {
      return NextResponse.json(
        { error: "Status must be 'open' or 'closed'" },
        { status: 400 }
      );
    }
    
    await sql`
      INSERT INTO system_settings (setting_key, setting_value, updated_by, updated_at)
      VALUES ('shop_status', ${status}, ${admin.userId}, NOW())
      ON CONFLICT (setting_key) 
      DO UPDATE SET 
        setting_value = ${status},
        updated_by = ${admin.userId},
        updated_at = NOW()
    `;
    
    return NextResponse.json({
      ok: true,
      status: status,
      message: `Shop is now ${status === 'open' ? 'open' : 'closed'}`,
    });
  } catch (error: any) {
    console.error("[Shop Status] Error updating shop status:", error);
    return NextResponse.json(
      { error: "Failed to update shop status" },
      { status: 500 }
    );
  }
}

