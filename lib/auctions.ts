import sql from './db';
import { formatCountdown } from './format';
import { isNewLowestBid, notifyAllAdmins, getCarrierProfileInfo } from './notifications';

// Types
export interface TelegramBid {
  bid_number: string;
  distance_miles: number | null;
  pickup_timestamp: string | null;
  delivery_timestamp: string | null;
  stops: string[] | null;
  tag: string | null;
  source_channel: string | null;
  forwarded_to: string | null;
  received_at: string;
  expires_at: string | null;
  // Derived fields
  expires_at_25: string;
  is_expired: boolean;
  stops_count: number;
  time_left_seconds: number;
  // Bidding fields
  bids_count?: number;
  lowest_amount_cents?: number;
  lowest_user_id?: string | null;
}

export interface CarrierBid {
  id: number;
  bid_number: string;
  supabase_user_id: string; // Supabase-only: replaced clerk_user_id
  amount_cents: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  carrier_legal_name?: string;
  carrier_mc_number?: string;
}

export interface BidSummary {
  telegram_bid: TelegramBid;
  carrier_bids: CarrierBid[];
  lowest_amount_cents: number | null;
  lowest_user_id: string | null;
  bids_count: number;
  user_bid: CarrierBid | null;
}

export interface AuctionAward {
  id: number;
  bid_number: string;
  winner_user_id: string; // Still uses winner_user_id for compatibility, but populated with supabase_user_id
  winner_amount_cents: number;
  awarded_by: string;
  awarded_at: string;
  // Joined fields
  winner_legal_name?: string;
  winner_mc_number?: string;
}

export interface CarrierProfile {
  supabase_user_id: string; // Supabase-only: replaced clerk_user_id
  legal_name: string;
  mc_number: string;
  dot_number: string | null;
  phone: string | null;
  contact_name: string | null;
  created_at: string;
}

// Query functions
export async function listActiveTelegramBids({
  q,
  tag,
  limit = 50,
  offset = 0,
}: {
  q?: string;
  tag?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<TelegramBid[]> {
  try {
    // Create telegram_bids table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS telegram_bids (
        id SERIAL PRIMARY KEY,
        bid_number TEXT NOT NULL UNIQUE,
        distance_miles INTEGER,
        pickup_timestamp TEXT,
        delivery_timestamp TEXT,
        stops TEXT, -- JSON string
        tag TEXT,
        source_channel TEXT,
        forwarded_to TEXT,
        received_at TEXT NOT NULL,
        expires_at TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Insert some sample data if none exists
    const count = await sql`SELECT COUNT(*) as count FROM telegram_bids`;
    if (count[0].count === 0) {
      const sampleBids = [
        ['BID001', 250, '2025-01-15T08:00:00Z', '2025-01-15T18:00:00Z', '["Chicago, IL", "Detroit, MI"]', 'URGENT', 'telegram', 'admin', '2025-01-15T07:30:00Z'],
        ['BID002', 400, '2025-01-15T10:00:00Z', '2025-01-16T08:00:00Z', '["Los Angeles, CA", "Phoenix, AZ"]', 'STANDARD', 'telegram', 'admin', '2025-01-15T09:30:00Z'],
        ['BID003', 150, '2025-01-15T12:00:00Z', '2025-01-15T20:00:00Z', '["Miami, FL", "Orlando, FL"]', 'HOT', 'telegram', 'admin', '2025-01-15T11:30:00Z'],
      ];

      for (const bid of sampleBids) {
        await sql`
          INSERT INTO telegram_bids (bid_number, distance_miles, pickup_timestamp, delivery_timestamp, stops, tag, source_channel, forwarded_to, received_at)
          VALUES (${bid[0]}, ${bid[1]}, ${bid[2]}, ${bid[3]}, ${bid[4]}, ${bid[5]}, ${bid[6]}, ${bid[7]}, ${bid[8]})
        `;
      }
    }

    // Build query with PostgreSQL template literals
    let query;
    if (q && tag) {
      query = sql`
        SELECT 
          id,
          bid_number,
          distance_miles,
          pickup_timestamp,
          delivery_timestamp,
          tag,
          source_channel,
          forwarded_to,
          received_at,
          expires_at,
          (received_at::timestamp + INTERVAL '25 minutes')::text as expires_at_25,
          NOW() > (received_at::timestamp + INTERVAL '25 minutes') as is_expired,
          0 as stops_count
        FROM telegram_bids 
        WHERE bid_number LIKE ${`%${q}%`} AND tag = ${tag.toUpperCase()}
        ORDER BY received_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (q) {
      query = sql`
        SELECT 
          id,
          bid_number,
          distance_miles,
          pickup_timestamp,
          delivery_timestamp,
          tag,
          source_channel,
          forwarded_to,
          received_at,
          expires_at,
          (received_at::timestamp + INTERVAL '25 minutes')::text as expires_at_25,
          NOW() > (received_at::timestamp + INTERVAL '25 minutes') as is_expired,
          0 as stops_count
        FROM telegram_bids 
        WHERE bid_number LIKE ${`%${q}%`}
        ORDER BY received_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (tag) {
      query = sql`
        SELECT 
          id,
          bid_number,
          distance_miles,
          pickup_timestamp,
          delivery_timestamp,
          tag,
          source_channel,
          forwarded_to,
          received_at,
          expires_at,
          (received_at::timestamp + INTERVAL '25 minutes')::text as expires_at_25,
          NOW() > (received_at::timestamp + INTERVAL '25 minutes') as is_expired,
          0 as stops_count
        FROM telegram_bids 
        WHERE tag = ${tag.toUpperCase()}
        ORDER BY received_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      query = sql`
        SELECT 
          id,
          bid_number,
          distance_miles,
          pickup_timestamp,
          delivery_timestamp,
          tag,
          source_channel,
          forwarded_to,
          received_at,
          expires_at,
          (received_at::timestamp + INTERVAL '25 minutes')::text as expires_at_25,
          NOW() > (received_at::timestamp + INTERVAL '25 minutes') as is_expired,
          0 as stops_count
        FROM telegram_bids 
        ORDER BY received_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const rows = await query;
    
    // Add time_left_seconds to each row
    return rows.map(row => {
      const countdown = formatCountdown(row.expires_at_25);
      return {
        ...row,
        time_left_seconds: countdown.secondsLeft,
      };
    });
  } catch (error) {
    console.error('Database error in listActiveTelegramBids:', error);
    
    // Return empty array on database errors to prevent page crashes
    // In production, you might want to implement retry logic or fallback data
    return [];
  }
}

export async function getBidSummary(bid_number: string, userId?: string): Promise<BidSummary | null> {
  try {
    // Get the telegram bid
    const telegramBid = await sql`
      SELECT 
        tb.*,
        tb.received_at + INTERVAL '25 minutes' as expires_at_25,
        NOW() > (tb.received_at + INTERVAL '25 minutes') as is_expired,
        0 as stops_count
      FROM public.telegram_bids tb
      WHERE tb.bid_number = ${bid_number}
    `;

    if (telegramBid.length === 0) {
      return null;
    }

    const bid = telegramBid[0];
    const countdown = formatCountdown(bid.expires_at_25);

    // Get all carrier bids with carrier info (Supabase-only)
    const carrierBids = await sql`
      SELECT 
        cb.*,
        cp.legal_name as carrier_legal_name,
        cp.mc_number as carrier_mc_number
      FROM public.carrier_bids cb
      LEFT JOIN public.carrier_profiles cp ON cb.supabase_user_id = cp.supabase_user_id
      WHERE cb.bid_number = ${bid_number}
      ORDER BY cb.amount_cents ASC
    `;

    // Get lowest bid info
    const lowestBid = carrierBids.length > 0 ? carrierBids[0] : null;

    // Get user's bid if userId provided (Supabase-only)
    const userBid = userId ? carrierBids.find(bid => bid.supabase_user_id === userId) || null : null;

    return {
      telegram_bid: {
        ...bid,
        time_left_seconds: countdown.secondsLeft,
      },
      carrier_bids: carrierBids,
      lowest_amount_cents: lowestBid?.amount_cents || null,
      lowest_user_id: lowestBid?.supabase_user_id || null,
      bids_count: carrierBids.length,
      user_bid: userBid,
    };
  } catch (error) {
    console.error('Database error in getBidSummary:', error);
    return null;
  }
}

export async function upsertCarrierBid({
  bid_number,
  userId,
  amount_cents,
  notes,
}: {
  bid_number: string;
  userId: string;
  amount_cents: number;
  notes?: string;
}): Promise<CarrierBid> {
  try {
    // First check if the auction is still active
    const bidCheck = await sql`
      SELECT 
        (tb.received_at::timestamp + INTERVAL '25 minutes')::text as expires_at_25,
        NOW() > (tb.received_at::timestamp + INTERVAL '25 minutes') as is_expired
      FROM public.telegram_bids tb
      WHERE tb.bid_number = ${bid_number}
    `;

    if (bidCheck.length === 0) {
      throw new Error('Bid not found');
    }

    if (bidCheck[0].is_expired) {
      throw new Error('Auction closed - bidding period has expired');
    }

    // Ensure carrier profile exists
    await ensureCarrierProfile(userId);

    // Validate that carrier profile is 100% complete before allowing bidding
    const profileValidation = await validateCarrierProfileComplete(userId);
    if (!profileValidation.isComplete) {
      const missingFieldsText = profileValidation.missingFields.join(', ');
      throw new Error(`Profile incomplete. Please complete the following required fields: ${missingFieldsText}. Go to your profile page to update your information.`);
    }

    // Upsert the bid (Supabase-only)
    // Use the unique constraint name explicitly for ON CONFLICT
    const result = await sql`
      INSERT INTO public.carrier_bids (bid_number, supabase_user_id, amount_cents, notes)
      VALUES (${bid_number}, ${userId}, ${amount_cents}, ${notes || null})
      ON CONFLICT (bid_number, supabase_user_id)
      DO UPDATE SET 
        amount_cents = EXCLUDED.amount_cents,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *
    `;

    // Create admin notifications for new bids and new lowest bids
    try {
      // Check if this is a new lowest bid
      const { isNewLowest, previousLowestCents } = await isNewLowestBid(bid_number, amount_cents);
      
      if (isNewLowest) {
        // Get carrier profile info
        const carrierProfile = await getCarrierProfileInfo(userId);
        const carrierName = carrierProfile?.legalName || carrierProfile?.companyName || 'Unknown Carrier';
        const mcNumber = carrierProfile?.mcNumber || 'N/A';
        const amountDollars = (amount_cents / 100).toFixed(2);
        const previousLowestDollars = previousLowestCents ? (previousLowestCents / 100).toFixed(2) : null;

        // Notify all admins about new lowest bid
        await notifyAllAdmins(
          'new_lowest_bid',
          '🎯 New Lowest Bid',
          `${carrierName} (MC: ${mcNumber}) placed a new lowest bid of $${amountDollars} on Bid #${bid_number}${previousLowestDollars ? ` (previous: $${previousLowestDollars})` : ''}`,
          {
            bid_number,
            carrier_user_id: userId,
            carrier_name: carrierName,
            mc_number: mcNumber,
            amount_cents,
            amount_dollars: amountDollars,
            previous_lowest_cents: previousLowestCents,
            previous_lowest_dollars: previousLowestDollars
          }
        );
      }

      // Also create general bid notification (existing behavior)
      await createAdminBidNotifications(bid_number, userId, amount_cents);
    } catch (notificationError) {
      console.error('Failed to create admin notifications:', notificationError);
      // Don't throw error - bid creation should still succeed
    }

    return result[0];
  } catch (error) {
    console.error('Database error in upsertCarrierBid:', error);
    throw error; // Re-throw to maintain API contract
  }
}

async function createAdminBidNotifications(bid_number: string, carrier_user_id: string, amount_cents: number) {
  try {
    // Get all admin users from user_roles_cache table (Supabase-only)
    const admins = await sql`
      SELECT supabase_user_id 
      FROM user_roles_cache 
      WHERE role = 'admin' AND supabase_user_id IS NOT NULL
    `;

    if (admins.length === 0) {
      console.log('No admin users found for notifications');
      return;
    }

    // Get carrier profile info for the notification (Supabase-only)
    const carrierProfile = await sql`
      SELECT legal_name, mc_number, company_name
      FROM carrier_profiles
      WHERE supabase_user_id = ${carrier_user_id}
      LIMIT 1
    `;

    const carrierName = carrierProfile[0]?.legal_name || carrierProfile[0]?.company_name || 'Unknown Carrier';
    const mcNumber = carrierProfile[0]?.mc_number || 'N/A';
    const amountDollars = (amount_cents / 100).toFixed(2);

    // Create notifications for all admins (Supabase-only)
    const notifications = admins.map(admin => ({
      user_id: admin.supabase_user_id,
      type: 'bid_received',
      title: '📨 New Bid Received',
      message: `${carrierName} (MC: ${mcNumber}) placed a bid of $${amountDollars} on Bid #${bid_number}`,
      data: {
        bid_number,
        carrier_user_id,
        carrier_name: carrierName,
        mc_number: mcNumber,
        amount_cents,
        amount_dollars: amountDollars
      },
      read: false,
      created_at: new Date()
    }));

    // Insert all notifications
    for (const notification of notifications) {
      await sql`
        INSERT INTO notifications (user_id, type, title, message, data, read, created_at)
        VALUES (${notification.user_id}, ${notification.type}, ${notification.title}, ${notification.message}, ${JSON.stringify(notification.data)}, ${notification.read}, ${notification.created_at})
      `;
    }

    console.log(`Created ${notifications.length} admin notifications for bid #${bid_number}`);
  } catch (error) {
    console.error('Error creating admin bid notifications:', error);
    throw error;
  }
}

export async function awardAuction({
  bid_number,
  winner_user_id,
  awarded_by,
  admin_notes,
}: {
  bid_number: string;
  winner_user_id: string;
  awarded_by: string;
  admin_notes?: string;
}): Promise<AuctionAward> {
  try {
    // Verify the winner has a bid for this auction (Supabase-only)
    const winnerBid = await sql`
      SELECT amount_cents
      FROM public.carrier_bids
      WHERE bid_number = ${bid_number} AND supabase_user_id = ${winner_user_id}
    `;

    if (winnerBid.length === 0) {
      throw new Error('Winner must have an existing bid for this auction');
    }

    // Check if already awarded
    const existingAward = await sql`
      SELECT id FROM public.auction_awards WHERE bid_number = ${bid_number}
    `;

    if (existingAward.length > 0) {
      throw new Error('Auction already awarded');
    }

    // Create the award with admin notes if provided
    // Note: Uses supabase_winner_user_id and supabase_awarded_by (migration 078 removed winner_user_id and awarded_by)
    const award = await sql`
      INSERT INTO public.auction_awards (bid_number, supabase_winner_user_id, winner_amount_cents, supabase_awarded_by, admin_notes)
      VALUES (${bid_number}, ${winner_user_id}, ${winnerBid[0].amount_cents}, ${awarded_by}, ${admin_notes || null})
      RETURNING *
    `;

    // Create notification for winner
    const winnerMessage = `Congratulations! You won Bid #${bid_number} for ${formatMoney(winnerBid[0].amount_cents)}. Check your My Loads for next steps.`;
    await sql`
      INSERT INTO public.notifications (user_id, type, title, message, data, read)
      VALUES (
        ${winner_user_id}, 
        'bid_won', 
        '🎉 Bid Won!', 
        ${winnerMessage},
        ${JSON.stringify({ bid_number, amount_cents: winnerBid[0].amount_cents, amount_dollars: formatMoney(winnerBid[0].amount_cents) })},
        false
      )
    `;

    // Create notifications for other bidders (Supabase-only)
    const otherBidders = await sql`
      SELECT DISTINCT supabase_user_id 
      FROM public.carrier_bids 
      WHERE bid_number = ${bid_number} AND supabase_user_id != ${winner_user_id}
    `;

    for (const bidder of otherBidders) {
      const lostMessage = `Bid #${bid_number} was awarded to another carrier.`;
      await sql`
        INSERT INTO public.notifications (user_id, type, title, message, data, read)
        VALUES (
          ${bidder.supabase_user_id}, 
          'bid_lost', 
          'Bid Lost', 
          ${lostMessage},
          ${JSON.stringify({ bid_number })},
          false
        )
      `;
    }

    // Create a load assignment for the winner
    // Note: loads table doesn't have carrier_user_id or meta columns
    // Just store in status_code for now
    await sql`
      INSERT INTO public.loads (rr_number, status_code)
      VALUES (${bid_number}, 'awarded')
      ON CONFLICT (rr_number) DO NOTHING
    `;

    return award[0];
  } catch (error) {
    console.error('Database error in awardAuction:', error);
    throw error; // Re-throw to maintain API contract
  }
}

export async function reAwardAuction({
  bid_number,
  winner_user_id,
  awarded_by,
  admin_notes,
}: {
  bid_number: string;
  winner_user_id: string;
  awarded_by: string;
  admin_notes?: string;
}): Promise<AuctionAward> {
  try {
    // Verify the winner has a bid for this auction (Supabase-only)
    const winnerBid = await sql`
      SELECT amount_cents
      FROM public.carrier_bids
      WHERE bid_number = ${bid_number} AND supabase_user_id = ${winner_user_id}
    `;

    if (winnerBid.length === 0) {
      throw new Error('Winner must have an existing bid for this auction');
    }

    // Get existing award to find the old winner
    const existingAward = await sql`
      SELECT id, supabase_winner_user_id, winner_amount_cents
      FROM public.auction_awards 
      WHERE bid_number = ${bid_number}
    `;

    if (existingAward.length === 0) {
      throw new Error('No existing award found to re-award');
    }

    const oldWinnerUserId = existingAward[0].supabase_winner_user_id;

    // Delete the existing award
    await sql`
      DELETE FROM public.auction_awards 
      WHERE bid_number = ${bid_number}
    `;

    // Reset carrier_bid status for the old winner (if it exists)
    await sql`
      UPDATE public.carrier_bids
      SET status = 'pending', bid_outcome = 'pending'
      WHERE bid_number = ${bid_number} AND supabase_user_id = ${oldWinnerUserId}
    `;

    // Delete notifications related to the old award (optional - can be done via cleanup)
    // We'll create new notifications below

    // Create the new award with admin notes if provided
    const award = await sql`
      INSERT INTO public.auction_awards (bid_number, supabase_winner_user_id, winner_amount_cents, supabase_awarded_by, admin_notes)
      VALUES (${bid_number}, ${winner_user_id}, ${winnerBid[0].amount_cents}, ${awarded_by}, ${admin_notes || null})
      RETURNING *
    `;

    // Create notification for new winner
    const winnerMessage = `Congratulations! You won Bid #${bid_number} for ${formatMoney(winnerBid[0].amount_cents)}. Check your My Loads for next steps.`;
    await sql`
      INSERT INTO public.notifications (user_id, type, title, message, data, read)
      VALUES (
        ${winner_user_id}, 
        'bid_won', 
        '🎉 Bid Won!', 
        ${winnerMessage},
        ${JSON.stringify({ bid_number, amount_cents: winnerBid[0].amount_cents, amount_dollars: formatMoney(winnerBid[0].amount_cents) })},
        false
      )
    `;

    // Create notification for old winner that award was removed
    const removedMessage = `Bid #${bid_number} has been re-awarded to another carrier.`;
    await sql`
      INSERT INTO public.notifications (user_id, type, title, message, data, read)
      VALUES (
        ${oldWinnerUserId}, 
        'bid_lost', 
        'Award Removed', 
        ${removedMessage},
        ${JSON.stringify({ bid_number, re_awarded: true })},
        false
      )
    `;

    // Create notifications for other bidders (excluding old and new winners)
    const otherBidders = await sql`
      SELECT DISTINCT supabase_user_id 
      FROM public.carrier_bids 
      WHERE bid_number = ${bid_number} 
        AND supabase_user_id != ${winner_user_id}
        AND supabase_user_id != ${oldWinnerUserId}
    `;

    for (const bidder of otherBidders) {
      const lostMessage = `Bid #${bid_number} was awarded to another carrier.`;
      await sql`
        INSERT INTO public.notifications (user_id, type, title, message, data, read)
        VALUES (
          ${bidder.supabase_user_id}, 
          'bid_lost', 
          'Bid Lost', 
          ${lostMessage},
          ${JSON.stringify({ bid_number })},
          false
        )
      `;
    }

    // Update load assignment for the new winner
    await sql`
      UPDATE public.loads 
      SET status_code = 'awarded'
      WHERE rr_number = ${bid_number}
    `;

    return award[0];
  } catch (error) {
    console.error('Database error in reAwardAuction:', error);
    throw error; // Re-throw to maintain API contract
  }
}

export async function markBidAsNoContest({
  bid_number,
  awarded_by,
  admin_notes,
}: {
  bid_number: string;
  awarded_by: string;
  admin_notes?: string;
}): Promise<void> {
  try {
    // Check if already awarded - if so, remove the award first
    const existingAward = await sql`
      SELECT id, supabase_winner_user_id 
      FROM public.auction_awards 
      WHERE bid_number = ${bid_number}
    `;

    if (existingAward.length > 0) {
      const oldWinnerUserId = existingAward[0].supabase_winner_user_id;
      
      // Delete the existing award
      await sql`
        DELETE FROM public.auction_awards 
        WHERE bid_number = ${bid_number}
      `;

      // Notify the old winner that the award was removed
      // Use the same message as when a bid is awarded to another carrier (don't mention "no contest")
      if (oldWinnerUserId) {
        const removedMessage = `Bid #${bid_number} was awarded to another carrier.`;
        await sql`
          INSERT INTO public.notifications (user_id, type, title, message, data, read)
          VALUES (
            ${oldWinnerUserId}, 
            'bid_lost', 
            'Bid Lost', 
            ${removedMessage},
            ${JSON.stringify({ bid_number })},
            false
          )
        `;
      }
    }

    // Get all carriers who bid on this auction
    const allBidders = await sql`
      SELECT DISTINCT supabase_user_id 
      FROM public.carrier_bids 
      WHERE bid_number = ${bid_number}
    `;

    if (allBidders.length === 0) {
      throw new Error('No carriers have bid on this auction');
    }

    // Send bid_lost notifications to all bidders
    // Use the same message as when a bid is awarded to another carrier (don't mention "no contest")
    const lostMessage = `Bid #${bid_number} was awarded to another carrier.`;
    for (const bidder of allBidders) {
      // Skip if we already notified this bidder (the old winner)
      if (existingAward.length > 0 && existingAward[0].supabase_winner_user_id === bidder.supabase_user_id) {
        continue;
      }
      
      await sql`
        INSERT INTO public.notifications (user_id, type, title, message, data, read)
        VALUES (
          ${bidder.supabase_user_id}, 
          'bid_lost', 
          'Bid Lost', 
          ${lostMessage},
          ${JSON.stringify({ bid_number })},
          false
        )
      `;
    }

    // Create a special award record to finalize the auction
    // This prevents the notification system from sending "award needed" notifications
    // Use NULL for winner_user_id to indicate "no contest" (no actual winner)
    // Use 0 for winner_amount_cents since there's no actual winner
    // Note: We already deleted any existing award above, so we can safely INSERT
    const noContestNotes = admin_notes || 'No Contest - Bid finalized without award';
    await sql`
      INSERT INTO public.auction_awards (
        bid_number, 
        supabase_winner_user_id, 
        winner_amount_cents, 
        supabase_awarded_by, 
        admin_notes
      )
      VALUES (
        ${bid_number}, 
        NULL, 
        0, 
        ${awarded_by}, 
        ${noContestNotes}
      )
    `;

    // Update load status if it exists
    await sql`
      UPDATE public.loads 
      SET status_code = 'no_contest'
      WHERE rr_number = ${bid_number}
    `;
  } catch (error) {
    console.error('Database error in markBidAsNoContest:', error);
    throw error; // Re-throw to maintain API contract
  }
}

export async function listAwardsForUser(userId: string): Promise<AuctionAward[]> {
  try {
    // Supabase-only: Use supabase_winner_user_id if available, fallback to winner_user_id for compatibility
    const awards = await sql`
      SELECT 
        aa.*,
        cp.legal_name as winner_legal_name,
        cp.mc_number as winner_mc_number
      FROM public.auction_awards aa
      LEFT JOIN public.carrier_profiles cp ON (
        (aa.supabase_winner_user_id IS NOT NULL AND aa.supabase_winner_user_id = cp.supabase_user_id)
        OR (aa.supabase_winner_user_id IS NULL AND aa.winner_user_id = cp.supabase_user_id)
      )
      WHERE aa.supabase_winner_user_id = ${userId} OR aa.winner_user_id = ${userId}
      ORDER BY aa.awarded_at DESC
    `;

    return awards;
  } catch (error) {
    console.error('Database error in listAwardsForUser:', error);
    return [];
  }
}

export async function ensureCarrierProfile(userId: string): Promise<CarrierProfile> {
  try {
    // Check if profile exists (Supabase-only)
    const existing = await sql`
      SELECT * FROM public.carrier_profiles 
      WHERE supabase_user_id = ${userId}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return existing[0];
    }

    // Create a basic profile with a unique MC number (Supabase-only)
    const uniqueMcNumber = `TBD-${userId.slice(-8)}-${Date.now()}`;
    const profile = await sql`
      INSERT INTO public.carrier_profiles (supabase_user_id, legal_name, mc_number, profile_status)
      VALUES (${userId}, 'Pending Setup', ${uniqueMcNumber}, 'open')
      RETURNING *
    `;

    return profile[0];
  } catch (error) {
    console.error('Database error in ensureCarrierProfile:', error);
    throw error; // Re-throw to maintain API contract
  }
}

export async function validateCarrierProfileComplete(userId: string): Promise<{ isComplete: boolean; missingFields: string[] }> {
  try {
    // Supabase-only: Query by supabase_user_id only
    const profile = await sql`
      SELECT company_name, legal_name, mc_number, contact_name, phone
      FROM public.carrier_profiles 
      WHERE supabase_user_id = ${userId}
    `;

    if (profile.length === 0) {
      return { isComplete: false, missingFields: ['company_name', 'mc_number', 'contact_name', 'phone'] };
    }

    const p = profile[0];
    const missingFields: string[] = [];

    // Check required fields (use legal_name or company_name)
    const companyName = p.legal_name || p.company_name;
    if (!companyName || companyName === 'Pending Setup') {
      missingFields.push('company_name');
    }
    if (!p.mc_number || p.mc_number.startsWith('TBD-')) {
      missingFields.push('mc_number');
    }
    if (!p.contact_name) {
      missingFields.push('contact_name');
    }
    if (!p.phone) {
      missingFields.push('phone');
    }

    return {
      isComplete: missingFields.length === 0,
      missingFields
    };
  } catch (error) {
    console.error('Database error in validateCarrierProfileComplete:', error);
    return { isComplete: false, missingFields: ['company_name', 'mc_number', 'contact_name', 'phone'] };
  }
}

export async function getCarrierProfile(userId: string): Promise<CarrierProfile | null> {
  try {
    // Supabase-only: Query by supabase_user_id only
    const profiles = await sql`
      SELECT * FROM public.carrier_profiles 
      WHERE supabase_user_id = ${userId}
      LIMIT 1
    `;

    return profiles.length > 0 ? profiles[0] : null;
  } catch (error) {
    console.error('Database error in getCarrierProfile:', error);
    return null;
  }
}

export async function updateCarrierProfile({
  userId,
  legal_name,
  mc_number,
  dot_number,
  phone,
  contact_name,
}: {
  userId: string;
  legal_name?: string;
  mc_number?: string;
  dot_number?: string;
  phone?: string;
  contact_name?: string;
}): Promise<CarrierProfile> {
  try {
    const updates: any = {};
    if (legal_name) {
      updates.legal_name = legal_name;
      updates.company_name = legal_name; // Keep company_name in sync with legal_name
    }
    if (mc_number) updates.mc_number = mc_number;
    if (dot_number !== undefined) updates.dot_number = dot_number;
    if (phone !== undefined) updates.phone = phone;
    if (contact_name !== undefined) updates.contact_name = contact_name;
    updates.updated_at = new Date();

    const setClause = Object.keys(updates)
      .map(key => `${key} = $${key}`)
      .join(', ');

    const result = await sql`
      UPDATE public.carrier_profiles 
      SET ${sql(setClause, ...Object.values(updates))}
      WHERE supabase_user_id = ${userId}
      RETURNING *
    `;

    // Clear caches to ensure updated data appears immediately
    try {
      const { clearCarrierRelatedCaches } = await import('@/lib/cache-invalidation');
      clearCarrierRelatedCaches(userId);
    } catch (cacheError) {
      console.error('Error clearing caches:', cacheError);
      // Don't throw - cache clearing is best effort
    }

    return result[0];
  } catch (error) {
    console.error('Database error in updateCarrierProfile:', error);
    throw error; // Re-throw to maintain API contract
  }
}

// Helper function for money formatting (imported from format.ts)
function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
