import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/notification-analytics - Get trigger analytics for admin
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const adminUserId = auth.userId;

    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days') || '30';
    const userId = searchParams.get('userId'); // Optional: filter by specific user

    // Input validation
    const days = parseInt(daysParam);
    const validation = validateInput(
      { daysParam, userId },
      {
        daysParam: { type: 'string', pattern: /^\d+$/, maxLength: 10, required: false },
        userId: { type: 'string', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, maxLength: 50, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_notification_analytics_input', adminUserId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const validDays = isNaN(days) || days < 1 || days > 365 ? 30 : days;

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
        AND nl.sent_at >= NOW() - make_interval(days => ${validDays})
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
        AVG(CASE WHEN nl.sent_at >= NOW() - make_interval(days => ${days}) THEN 1 ELSE 0 END) as avg_notifications_per_trigger
      FROM notification_triggers nt
      LEFT JOIN notification_logs nl ON nt.id = nl.trigger_id
        AND nl.sent_at >= NOW() - make_interval(days => ${validDays})
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
        AND nl.sent_at >= NOW() - make_interval(days => ${validDays})
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
        AND nl.sent_at >= NOW() - make_interval(days => ${validDays})
      LEFT JOIN auth.users u ON nt.supabase_carrier_user_id = u.id::text
      ${userId ? sql`WHERE nt.supabase_carrier_user_id = ${userId}` : sql``}
      GROUP BY nt.id, nt.trigger_type, nt.is_active, u.email
      ORDER BY notification_count DESC
      LIMIT 20
    `;

    // Get delivery status breakdown
    const deliveryStatusBreakdown = await sql`
      SELECT 
        nl.delivery_status,
        COUNT(*) as count,
        COUNT(DISTINCT COALESCE(nl.supabase_carrier_user_id, nt.supabase_carrier_user_id)) as unique_users,
        COUNT(DISTINCT nl.bid_number) as unique_bids
      FROM notification_logs nl
      LEFT JOIN notification_triggers nt ON nl.trigger_id = nt.id
      WHERE nl.sent_at >= NOW() - make_interval(days => ${days})
      ${userId ? sql`AND COALESCE(nl.supabase_carrier_user_id, nt.supabase_carrier_user_id) = ${userId}` : sql``}
      GROUP BY nl.delivery_status
      ORDER BY count DESC
    `;

    // Get daily notification trends
    const dailyTrends = await sql`
      SELECT 
        DATE(nl.sent_at) as date,
        COUNT(*) as notification_count,
        COUNT(DISTINCT COALESCE(nl.supabase_carrier_user_id, nt.supabase_carrier_user_id)) as unique_users,
        COUNT(DISTINCT nl.bid_number) as unique_bids,
        COUNT(DISTINCT nl.notification_type) as notification_types
      FROM notification_logs nl
      LEFT JOIN notification_triggers nt ON nl.trigger_id = nt.id
      WHERE nl.sent_at >= NOW() - make_interval(days => ${days})
      ${userId ? sql`AND COALESCE(nl.supabase_carrier_user_id, nt.supabase_carrier_user_id) = ${userId}` : sql``}
      GROUP BY DATE(nl.sent_at)
      ORDER BY date DESC
    `;

    // Get notification type breakdown
    const notificationTypeBreakdown = await sql`
      SELECT 
        nl.notification_type,
        COUNT(*) as count,
        COUNT(DISTINCT COALESCE(nl.supabase_carrier_user_id, nt.supabase_carrier_user_id)) as unique_users,
        COUNT(DISTINCT nl.bid_number) as unique_bids,
        AVG(EXTRACT(EPOCH FROM (NOW() - nl.sent_at))/3600) as avg_hours_ago
      FROM notification_logs nl
      LEFT JOIN notification_triggers nt ON nl.trigger_id = nt.id
      WHERE nl.sent_at >= NOW() - make_interval(days => ${days})
      ${userId ? sql`AND COALESCE(nl.supabase_carrier_user_id, nt.supabase_carrier_user_id) = ${userId}` : sql``}
      GROUP BY nl.notification_type
      ORDER BY count DESC
    `;

    // Get inactive triggers (no notifications in period)
    const inactiveTriggers = await sql`
      SELECT 
        nt.id,
        nt.trigger_type,
        nt.is_active,
        nt.created_at,
        nt.updated_at,
        u.email as carrier_email,
        (NOW() - nt.updated_at) as time_since_update,
        (NOW() - nt.created_at) as age
      FROM notification_triggers nt
      LEFT JOIN auth.users u ON nt.supabase_carrier_user_id = u.id::text
      WHERE nt.id NOT IN (
        SELECT DISTINCT trigger_id 
        FROM notification_logs 
        WHERE sent_at >= NOW() - make_interval(days => ${days})
        AND trigger_id IS NOT NULL
      )
      ${userId ? sql`AND nt.supabase_carrier_user_id = ${userId}` : sql``}
      ORDER BY nt.updated_at DESC
      LIMIT 50
    `;

    // Get trigger configuration summary (extract common config fields)
    const triggerConfigSummary = await sql`
      SELECT 
        nt.trigger_type,
        COUNT(*) as trigger_count,
        COUNT(CASE WHEN nt.trigger_config->>'matchType' IS NOT NULL THEN 1 END) as has_match_type,
        COUNT(CASE WHEN nt.trigger_config->>'favoriteDistanceRange' IS NOT NULL THEN 1 END) as has_distance_range,
        COUNT(CASE WHEN nt.trigger_config->>'backhaulEnabled' = 'true' THEN 1 END) as backhaul_enabled_count
      FROM notification_triggers nt
      ${userId ? sql`WHERE nt.supabase_carrier_user_id = ${userId}` : sql``}
      GROUP BY nt.trigger_type
      ORDER BY trigger_count DESC
    `;

    // Get hourly distribution (most active hours)
    const hourlyDistribution = await sql`
      SELECT 
        EXTRACT(HOUR FROM nl.sent_at) as hour,
        COUNT(*) as notification_count,
        COUNT(DISTINCT COALESCE(nl.supabase_carrier_user_id, nt.supabase_carrier_user_id)) as unique_users
      FROM notification_logs nl
      LEFT JOIN notification_triggers nt ON nl.trigger_id = nt.id
      WHERE nl.sent_at >= NOW() - make_interval(days => ${days})
      ${userId ? sql`AND COALESCE(nl.supabase_carrier_user_id, nt.supabase_carrier_user_id) = ${userId}` : sql``}
      GROUP BY EXTRACT(HOUR FROM nl.sent_at)
      ORDER BY hour
    `;

    // Get carrier profile information for top users
    const topCarriers = await sql`
      SELECT 
        nt.supabase_carrier_user_id,
        u.email as carrier_email,
        cp.legal_name as carrier_name,
        COUNT(DISTINCT nt.id) as trigger_count,
        COUNT(DISTINCT nl.id) as notification_count,
        COUNT(DISTINCT nl.bid_number) as unique_bids_notified,
        MAX(nl.sent_at) as last_notification
      FROM notification_triggers nt
      LEFT JOIN notification_logs nl ON nt.id = nl.trigger_id
        AND nl.sent_at >= NOW() - make_interval(days => ${validDays})
      LEFT JOIN auth.users u ON nt.supabase_carrier_user_id = u.id::text
      LEFT JOIN carrier_profiles cp ON nt.supabase_carrier_user_id = cp.supabase_user_id
      ${userId ? sql`WHERE nt.supabase_carrier_user_id = ${userId}` : sql``}
      GROUP BY nt.supabase_carrier_user_id, u.email, cp.legal_name
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
        deliveryStatus: deliveryStatusBreakdown,
        dailyTrends,
        notificationTypes: notificationTypeBreakdown,
        inactiveTriggers,
        triggerConfigs: triggerConfigSummary,
        hourlyDistribution,
        topCarriers,
        period: `${validDays} days`
      }
    });
    
    logSecurityEvent('notification_analytics_accessed', adminUserId, { days: validDays, userId: userId || null });
    
    const response = NextResponse.json({
      ok: true,
      data: {
        overall: overallStats[0] || {},
        triggers: triggerStats,
        typeBreakdown,
        topTriggers,
        deliveryStatus: deliveryStatusBreakdown,
        dailyTrends,
        notificationTypes: notificationTypeBreakdown,
        inactiveTriggers,
        triggerConfigs: triggerConfigSummary,
        hourlyDistribution,
        topCarriers,
        period: `${validDays} days`
      }
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error('Error fetching notification analytics:', error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('notification_analytics_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch analytics",
        details: process.env.NODE_ENV === 'development' 
          ? (error?.message || 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

