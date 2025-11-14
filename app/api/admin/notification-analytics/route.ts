import { requireAdmin } from "@/lib/auth";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/notification-analytics - Get trigger analytics for admin
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const userId = searchParams.get('userId'); // Optional: filter by specific user

    // Get trigger statistics
    const triggerStats = await sql`
      SELECT 
        nt.id,
        nt.trigger_type,
        nt.is_active,
        nt.created_at,
        nt.updated_at,
        nt.supabase_carrier_user_id,
        u.email as carrier_email,
        COUNT(DISTINCT nl.id) as notification_count,
        COUNT(DISTINCT nl.bid_number) as unique_bids_notified,
        MIN(nl.sent_at) as first_notification,
        MAX(nl.sent_at) as last_notification
      FROM notification_triggers nt
      LEFT JOIN notification_logs nl ON nt.id = nl.trigger_id
        AND nl.sent_at >= NOW() - INTERVAL '${days} days'
      LEFT JOIN auth.users u ON nt.supabase_carrier_user_id = u.id::text
      ${userId ? sql`WHERE nt.supabase_carrier_user_id = ${userId}` : sql``}
      GROUP BY nt.id, nt.trigger_type, nt.is_active, nt.created_at, nt.updated_at, nt.supabase_carrier_user_id, u.email
      ORDER BY notification_count DESC, nt.created_at DESC
    `;

    // Get overall statistics
    const overallStats = await sql`
      SELECT 
        COUNT(DISTINCT nt.id) as total_triggers,
        COUNT(DISTINCT CASE WHEN nt.is_active THEN nt.id END) as active_triggers,
        COUNT(DISTINCT nt.supabase_carrier_user_id) as total_users_with_triggers,
        COUNT(DISTINCT nl.id) as total_notifications_sent,
        COUNT(DISTINCT nl.bid_number) as unique_bids_notified,
        AVG(CASE WHEN nl.sent_at >= NOW() - INTERVAL '${days} days' THEN 1 ELSE 0 END) as avg_notifications_per_trigger
      FROM notification_triggers nt
      LEFT JOIN notification_logs nl ON nt.id = nl.trigger_id
        AND nl.sent_at >= NOW() - INTERVAL '${days} days'
      ${userId ? sql`WHERE nt.supabase_carrier_user_id = ${userId}` : sql``}
    `;

    // Get trigger type breakdown
    const typeBreakdown = await sql`
      SELECT 
        nt.trigger_type,
        COUNT(DISTINCT nt.id) as trigger_count,
        COUNT(DISTINCT nl.id) as notification_count,
        COUNT(DISTINCT nl.bid_number) as unique_bids
      FROM notification_triggers nt
      LEFT JOIN notification_logs nl ON nt.id = nl.trigger_id
        AND nl.sent_at >= NOW() - INTERVAL '${days} days'
      ${userId ? sql`WHERE nt.supabase_carrier_user_id = ${userId}` : sql``}
      GROUP BY nt.trigger_type
      ORDER BY notification_count DESC
    `;

    // Get top performing triggers (by notification count)
    const topTriggers = await sql`
      SELECT 
        nt.id,
        nt.trigger_type,
        nt.is_active,
        u.email as carrier_email,
        COUNT(DISTINCT nl.id) as notification_count,
        COUNT(DISTINCT nl.bid_number) as unique_bids,
        MAX(nl.sent_at) as last_notification
      FROM notification_triggers nt
      LEFT JOIN notification_logs nl ON nt.id = nl.trigger_id
        AND nl.sent_at >= NOW() - INTERVAL '${days} days'
      LEFT JOIN auth.users u ON nt.supabase_carrier_user_id = u.id::text
      ${userId ? sql`WHERE nt.supabase_carrier_user_id = ${userId}` : sql``}
      GROUP BY nt.id, nt.trigger_type, nt.is_active, u.email
      ORDER BY notification_count DESC
      LIMIT 20
    `;

    return NextResponse.json({
      ok: true,
      data: {
        overall: overallStats[0] || {},
        triggers: triggerStats,
        typeBreakdown,
        topTriggers,
        period: `${days} days`
      }
    });

  } catch (error: any) {
    console.error('Error fetching notification analytics:', error);
    return NextResponse.json(
      { error: "Failed to fetch analytics", details: error?.message },
      { status: 500 }
    );
  }
}

