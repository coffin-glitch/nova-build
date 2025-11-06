import sql from '@/lib/db';

/**
 * Notification helper functions for creating and managing notifications
 * across the NOVA Build platform for both admins and carriers.
 */

export interface NotificationData {
  [key: string]: any;
}

/**
 * Get all admin user IDs from the user_roles_cache table
 */
export async function getAllAdminUserIds(): Promise<string[]> {
  try {
    const admins = await sql`
      SELECT supabase_user_id 
      FROM user_roles_cache 
      WHERE role = 'admin' AND supabase_user_id IS NOT NULL
    `;
    
    return admins.map(admin => admin.supabase_user_id).filter(Boolean);
  } catch (error) {
    console.error('Error fetching admin user IDs:', error);
    return [];
  }
}

/**
 * Create a notification for a single user
 */
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  data?: NotificationData
): Promise<void> {
  try {
    await sql`
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        data,
        read,
        created_at
      ) VALUES (
        ${userId},
        ${type},
        ${title},
        ${message},
        ${data ? JSON.stringify(data) : null},
        false,
        CURRENT_TIMESTAMP
      )
    `;
  } catch (error) {
    console.error(`Error creating notification for user ${userId}:`, error);
    // Don't throw - notification creation should not block main operations
  }
}

/**
 * Create notifications for all admin users
 */
export async function notifyAllAdmins(
  type: string,
  title: string,
  message: string,
  data?: NotificationData
): Promise<void> {
  try {
    const adminIds = await getAllAdminUserIds();
    
    if (adminIds.length === 0) {
      console.log('No admin users found for notifications');
      return;
    }

    // Create notifications for all admins
    for (const adminId of adminIds) {
      await createNotification(adminId, type, title, message, data);
    }

    console.log(`Created ${adminIds.length} admin notifications for type: ${type}`);
  } catch (error) {
    console.error('Error notifying all admins:', error);
    // Don't throw - notification creation should not block main operations
  }
}

/**
 * Check if a bid amount is a new lowest bid for that bid number
 */
export async function isNewLowestBid(
  bidNumber: string,
  amountCents: number
): Promise<{ isNewLowest: boolean; previousLowestCents: number | null }> {
  try {
    // Get current lowest bid for this bid number
    const currentLowest = await sql`
      SELECT MIN(amount_cents) as lowest_cents
      FROM carrier_bids
      WHERE bid_number = ${bidNumber}
        AND amount_cents < ${amountCents}
    `;

    const previousLowestCents = currentLowest[0]?.lowest_cents 
      ? parseInt(currentLowest[0].lowest_cents) 
      : null;

    // If there's no lower bid, this is the new lowest
    const isNewLowest = previousLowestCents === null;

    return {
      isNewLowest,
      previousLowestCents
    };
  } catch (error) {
    console.error('Error checking if new lowest bid:', error);
    // Default to not being new lowest if we can't determine
    return {
      isNewLowest: false,
      previousLowestCents: null
    };
  }
}

/**
 * Get conversation details including admin and carrier user IDs
 */
export async function getConversationDetails(conversationId: string): Promise<{
  adminUserId: string | null;
  carrierUserId: string | null;
} | null> {
  try {
    const conversation = await sql`
      SELECT 
        admin_user_id,
        supabase_carrier_user_id as carrier_user_id
      FROM conversations
      WHERE id = ${conversationId}
      LIMIT 1
    `;

    if (conversation.length === 0) {
      return null;
    }

    return {
      adminUserId: conversation[0].admin_user_id || null,
      carrierUserId: conversation[0].carrier_user_id || null
    };
  } catch (error) {
    console.error('Error fetching conversation details:', error);
    return null;
  }
}

/**
 * Get carrier profile information for notifications
 */
export async function getCarrierProfileInfo(carrierUserId: string): Promise<{
  legalName: string;
  companyName: string;
  mcNumber: string;
} | null> {
  try {
    const profile = await sql`
      SELECT 
        legal_name,
        company_name,
        mc_number
      FROM carrier_profiles
      WHERE supabase_user_id = ${carrierUserId}
      LIMIT 1
    `;

    if (profile.length === 0) {
      return null;
    }

    return {
      legalName: profile[0].legal_name || '',
      companyName: profile[0].company_name || '',
      mcNumber: profile[0].mc_number || 'N/A'
    };
  } catch (error) {
    console.error('Error fetching carrier profile:', error);
    return null;
  }
}

/**
 * Check for expired bids with carrier bids that need a winner selected
 * and notify all admins about them
 */
export async function notifyAdminsAboutExpiredBidsNeedingAward(): Promise<void> {
  try {
    // Find expired bids that:
    // 1. Have expired (NOW() > received_at + 25 minutes)
    // 2. Have carrier bids
    // 3. Haven't been awarded yet
    // 4. Haven't been notified about in the last 5 minutes (sends every 5 min until awarded)
    const expiredBidsNeedingAward = await sql`
      SELECT DISTINCT
        tb.bid_number,
        tb.received_at,
        COUNT(DISTINCT cb.id) as bid_count,
        MIN(cb.amount_cents) as lowest_bid_cents
      FROM telegram_bids tb
      INNER JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
      LEFT JOIN auction_awards aa ON tb.bid_number = aa.bid_number
      WHERE 
        NOW() > (tb.received_at::timestamp + INTERVAL '25 minutes')
        AND aa.id IS NULL
        AND tb.is_archived = false
        AND tb.archived_at IS NULL
        -- Check if we've already notified about this bid in the last 5 minutes
        -- This allows notifications every 5 minutes until the bid is awarded
        AND NOT EXISTS (
          SELECT 1 
          FROM notifications n
          WHERE n.type = 'bid_expired_needs_award'
            AND n.data->>'bid_number' = tb.bid_number
            AND n.created_at > NOW() - INTERVAL '5 minutes'
        )
      GROUP BY tb.bid_number, tb.received_at
      ORDER BY tb.received_at DESC
    `;

    if (expiredBidsNeedingAward.length === 0) {
      return;
    }

    // Notify all admins about each expired bid
    const adminIds = await getAllAdminUserIds();
    
    if (adminIds.length === 0) {
      console.log('No admin users found for expired bid notifications');
      return;
    }

    for (const bid of expiredBidsNeedingAward) {
      const bidNumber = bid.bid_number;
      const bidCount = parseInt(bid.bid_count) || 0;
      const lowestBidDollars = bid.lowest_bid_cents ? (parseInt(bid.lowest_bid_cents) / 100).toFixed(2) : 'N/A';
      
      const message = `Bid #${bidNumber} has expired with ${bidCount} ${bidCount === 1 ? 'bid' : 'bids'} (lowest: $${lowestBidDollars}). Please select a winner.`;

      // Create notification for each admin
      for (const adminId of adminIds) {
        await createNotification(
          adminId,
          'bid_expired_needs_award',
          '⏰ Bid Expired - Award Needed',
          message,
          {
            bid_number: bidNumber,
            bid_count: bidCount,
            lowest_bid_cents: bid.lowest_bid_cents,
            lowest_bid_dollars: lowestBidDollars,
            expired_at: bid.received_at
          }
        );
      }
    }

    console.log(`Notified ${adminIds.length} admins about ${expiredBidsNeedingAward.length} expired bid(s) needing awards`);
  } catch (error) {
    console.error('Error notifying admins about expired bids:', error);
    // Don't throw - notification creation should not block main operations
  }
}

