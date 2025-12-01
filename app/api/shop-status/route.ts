import sql from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * GET /api/shop-status
 * Get current shop status (public endpoint)
 */
export async function GET() {
  try {
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
    // Default to open if there's an error
    return NextResponse.json({
      ok: true,
      status: 'open',
    });
  }
}

