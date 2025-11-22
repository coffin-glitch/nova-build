import { requireApiAuth } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { AnnouncementNotificationTemplate } from "@/lib/email-templates/notification-templates";
import { sendEmail } from "@/lib/email/notify";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/announcements
 * Get all announcements for the current user (carrier) or all announcements (admin)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAuth(request);
    const userId = auth.userId;
    const userRole = auth.userRole;

    const { searchParams } = new URL(request.url);
    const includeRead = searchParams.get('include_read') === 'true';
    const priority = searchParams.get('priority'); // Filter by priority
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Admin can see all announcements
    if (userRole === 'admin') {
      let query = sql`
        SELECT 
          a.id,
          a.title,
          a.message,
          a.priority,
          a.created_by,
          a.created_at,
          a.updated_at,
          a.expires_at,
          a.is_active,
          a.target_audience,
          a.metadata,
          COUNT(ar.id) as read_count,
          (SELECT COUNT(*) FROM announcement_reads WHERE announcement_id = a.id) as total_reads
        FROM announcements a
        LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id
        WHERE 1=1
      `;

      if (priority) {
        query = sql`${query} AND a.priority = ${priority}`;
      }

      const announcements = await sql`
        SELECT 
          a.id,
          a.title,
          a.message,
          a.priority,
          a.created_by,
          a.created_at,
          a.updated_at,
          a.expires_at,
          a.is_active,
          a.target_audience,
          a.metadata,
          COUNT(ar.id) as read_count,
          (SELECT COUNT(*) FROM announcement_reads WHERE announcement_id = a.id) as total_reads
        FROM announcements a
        LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id
        WHERE 1=1
          ${priority ? sql`AND a.priority = ${priority}` : sql``}
        GROUP BY a.id
        ORDER BY a.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const total = await sql`SELECT COUNT(*) as count FROM announcements ${priority ? sql`WHERE priority = ${priority}` : sql``}`;

      return NextResponse.json({
        success: true,
        data: announcements,
        pagination: {
          total: parseInt(total[0].count),
          limit,
          offset,
        },
      });
    }

    // Carrier sees only active announcements with read status
    const announcements = await sql`
      SELECT 
        a.id,
        a.title,
        a.message,
        a.priority,
        a.created_at,
        a.expires_at,
        a.metadata,
        CASE WHEN ar.id IS NOT NULL THEN true ELSE false END as is_read,
        ar.read_at
      FROM announcements a
      LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.carrier_user_id = ${userId}
      WHERE a.is_active = true
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
        ${priority ? sql`AND a.priority = ${priority}` : sql``}
        ${!includeRead ? sql`AND ar.id IS NULL` : sql``}
      ORDER BY 
        CASE a.priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END,
        a.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get unread count
    const unreadCount = await sql`
      SELECT COUNT(*) as count
      FROM announcements a
      LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.carrier_user_id = ${userId}
      WHERE a.is_active = true
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
        AND ar.id IS NULL
    `;

    return NextResponse.json({
      success: true,
      data: announcements,
      unreadCount: parseInt(unreadCount[0].count),
      pagination: {
        limit,
        offset,
      },
    });

  } catch (error) {
    console.error("Error fetching announcements:", error);
    return NextResponse.json({
      error: "Failed to fetch announcements"
    }, { status: 500 });
  }
}

/**
 * POST /api/announcements
 * Create a new announcement (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAuth(request);
    
    // Only admins can create announcements
    if (auth.userRole !== 'admin') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { title, message, priority = 'normal', expiresAt, targetAudience = 'all', metadata = {}, recipientUserIds } = body;

    if (!title || !message) {
      return NextResponse.json({ error: "Title and message are required" }, { status: 400 });
    }

    // Validate priority
    if (!['low', 'normal', 'high', 'urgent'].includes(priority)) {
      return NextResponse.json({ error: "Invalid priority level" }, { status: 400 });
    }

    // Validate recipientUserIds if provided
    if (recipientUserIds && (!Array.isArray(recipientUserIds) || recipientUserIds.length === 0)) {
      return NextResponse.json({ error: "recipientUserIds must be a non-empty array" }, { status: 400 });
    }

    // Create announcement
    const [announcement] = await sql`
      INSERT INTO announcements (title, message, priority, created_by, expires_at, target_audience, metadata)
      VALUES (${title}, ${message}, ${priority}, ${auth.userId}::uuid, ${expiresAt || null}, ${targetAudience}, ${JSON.stringify(metadata)})
      RETURNING *
    `;

    // Get selected carrier user IDs (or all if not specified)
    let carriers;
    if (recipientUserIds && recipientUserIds.length > 0) {
      // Only get the specified carriers
      // Cast supabase_user_id (TEXT) to UUID for comparison with UUID array
      carriers = await sql`
        SELECT DISTINCT supabase_user_id
        FROM carrier_profiles
        WHERE supabase_user_id::uuid = ANY(${recipientUserIds}::uuid[])
          AND supabase_user_id IS NOT NULL
          AND profile_status = 'approved'
      `;
    } else {
      // Get all active carriers (fallback to old behavior)
      carriers = await sql`
        SELECT DISTINCT supabase_user_id
        FROM carrier_profiles
        WHERE supabase_user_id IS NOT NULL
          AND profile_status = 'approved'
      `;
    }

    // Create notifications for all carriers
    const notificationPromises = carriers.map((carrier: any) => 
      sql`
        INSERT INTO notifications (user_id, type, title, message, data, read)
        VALUES (
          ${carrier.supabase_user_id},
          'announcement',
          ${title},
          ${message.length > 100 ? message.substring(0, 100) + '...' : message},
          ${JSON.stringify({ announcementId: announcement.id, priority })},
          false
        )
      `
    );

    await Promise.all(notificationPromises);

    // Send email notifications asynchronously (don't block response)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://novafreight.io';
    const viewUrl = `${baseUrl}/announcements/${announcement.id}`;
    
    // Queue email sending (fire and forget to avoid blocking)
    // Capture recipientUserIds in closure
    const selectedRecipients = recipientUserIds;
    (async () => {
      try {
        // Get carrier user IDs and preferences (only for selected recipients)
        let carrierDetails;
        if (selectedRecipients && selectedRecipients.length > 0) {
          carrierDetails = await sql`
            SELECT 
              cp.supabase_user_id,
              urc.email,
              cnp.email_notifications
            FROM carrier_profiles cp
            LEFT JOIN user_roles_cache urc ON cp.supabase_user_id = urc.supabase_user_id
            LEFT JOIN carrier_notification_preferences cnp ON cp.supabase_user_id = cnp.supabase_carrier_user_id
            WHERE cp.supabase_user_id::uuid = ANY(${selectedRecipients}::uuid[])
              AND cp.supabase_user_id IS NOT NULL
              AND cp.profile_status = 'approved'
          `;
        } else {
          carrierDetails = await sql`
            SELECT 
              cp.supabase_user_id,
              urc.email,
              cnp.email_notifications
            FROM carrier_profiles cp
            LEFT JOIN user_roles_cache urc ON cp.supabase_user_id = urc.supabase_user_id
            LEFT JOIN carrier_notification_preferences cnp ON cp.supabase_user_id = cnp.supabase_carrier_user_id
            WHERE cp.supabase_user_id IS NOT NULL
              AND cp.profile_status = 'approved'
          `;
        }

        // Get emails from Supabase Auth for carriers without email in cache
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        let supabase: any = null;
        
        if (supabaseUrl && supabaseKey) {
          const { createClient } = await import('@supabase/supabase-js');
          supabase = createClient(supabaseUrl, supabaseKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
        }

        let emailsSent = 0;
        let emailsFailed = 0;
        
        // Rate limit: Resend allows 2 requests per second
        // We'll send emails sequentially with a 500ms delay between each (2 per second)
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        
        for (const carrier of carrierDetails) {
          // Check if email notifications are enabled (default to true)
          const emailEnabled = carrier.email_notifications !== false;
          
          // Get email from cache or Supabase Auth
          let email = carrier.email;
          
          if (!email && supabase) {
            try {
              const { data: { user } } = await supabase.auth.admin.getUserById(carrier.supabase_user_id);
              email = user?.email || null;
            } catch (error) {
              console.error(`[Announcements] Error fetching email for ${carrier.supabase_user_id}:`, error);
            }
          }
          
          if (!emailEnabled || !email) {
            continue;
          }

          try {
            const priorityEmoji = {
              urgent: '🚨',
              high: '⚠️',
              normal: '📢',
              low: 'ℹ️',
            }[priority] || '📢';

            const result = await sendEmail({
              to: email,
              subject: `${priorityEmoji} ${title}`,
              react: AnnouncementNotificationTemplate({
                title,
                message,
                priority: priority as 'low' | 'normal' | 'high' | 'urgent',
                viewUrl,
                carrierName: email.split('@')[0], // Use email prefix as name fallback
              }),
            });

            if (result.success) {
              emailsSent++;
            } else {
              emailsFailed++;
              console.error(`[Announcements] Failed to send email to ${email}:`, result.error);
            }
          } catch (error: any) {
            emailsFailed++;
            console.error(`[Announcements] Failed to send email to ${email}:`, error);
            
            // If rate limited, wait longer before continuing
            if (error?.statusCode === 429 || error?.name === 'rate_limit_exceeded') {
              console.log(`[Announcements] Rate limit hit, waiting 2 seconds before continuing...`);
              await delay(2000);
            }
          }
          
          // Wait 500ms between emails to respect 2 requests/second limit
          // (This ensures we stay under the limit even if some emails fail)
          await delay(500);
        }
        
        console.log(`[Announcements] Sent ${emailsSent} emails (${emailsFailed} failed) for announcement ${announcement.id}`);
      } catch (error) {
        console.error('[Announcements] Error sending emails:', error);
      }
    })();

    return NextResponse.json({
      success: true,
      data: announcement,
      notificationsCreated: carriers.length,
      emailsQueued: true, // Emails are sent asynchronously
    });

  } catch (error) {
    console.error("Error creating announcement:", error);
    return NextResponse.json({
      error: "Failed to create announcement"
    }, { status: 500 });
  }
}

