import sql from './db';
import { formatCountdown } from './format';

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
  clerk_user_id: string;
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
  winner_user_id: string;
  winner_amount_cents: number;
  awarded_by: string;
  awarded_at: string;
  // Joined fields
  winner_legal_name?: string;
  winner_mc_number?: string;
}

export interface CarrierProfile {
  clerk_user_id: string;
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

    // Get all carrier bids with carrier info
    const carrierBids = await sql`
      SELECT 
        cb.*,
        cp.legal_name as carrier_legal_name,
        cp.mc_number as carrier_mc_number
      FROM public.carrier_bids cb
      LEFT JOIN public.carrier_profiles cp ON cb.clerk_user_id = cp.clerk_user_id
      WHERE cb.bid_number = ${bid_number}
      ORDER BY cb.amount_cents ASC
    `;

    // Get lowest bid info
    const lowestBid = carrierBids.length > 0 ? carrierBids[0] : null;

    // Get user's bid if userId provided
    const userBid = userId ? carrierBids.find(bid => bid.clerk_user_id === userId) || null : null;

    return {
      telegram_bid: {
        ...bid,
        time_left_seconds: countdown.secondsLeft,
      },
      carrier_bids: carrierBids,
      lowest_amount_cents: lowestBid?.amount_cents || null,
      lowest_user_id: lowestBid?.clerk_user_id || null,
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

    // Upsert the bid
    const result = await sql`
      INSERT INTO public.carrier_bids (bid_number, clerk_user_id, amount_cents, notes)
      VALUES (${bid_number}, ${userId}, ${amount_cents}, ${notes || null})
      ON CONFLICT (bid_number, clerk_user_id)
      DO UPDATE SET 
        amount_cents = EXCLUDED.amount_cents,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *
    `;

    // Create admin notifications for new bids
    try {
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
    // Get all admin users from user_roles table
    const admins = await sql`
      SELECT clerk_user_id 
      FROM user_roles 
      WHERE role = 'admin'
    `;

    if (admins.length === 0) {
      console.log('No admin users found for notifications');
      return;
    }

    // Get carrier profile info for the notification
    const carrierProfile = await sql`
      SELECT legal_name, mc_number, company_name
      FROM carrier_profiles
      WHERE clerk_user_id = ${carrier_user_id}
      LIMIT 1
    `;

    const carrierName = carrierProfile[0]?.legal_name || carrierProfile[0]?.company_name || 'Unknown Carrier';
    const mcNumber = carrierProfile[0]?.mc_number || 'N/A';
    const amountDollars = (amount_cents / 100).toFixed(2);

    // Create notifications for all admins
    const notifications = admins.map(admin => ({
      user_id: admin.clerk_user_id,
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
    // Verify the winner has a bid for this auction
    const winnerBid = await sql`
      SELECT amount_cents
      FROM public.carrier_bids
      WHERE bid_number = ${bid_number} AND clerk_user_id = ${winner_user_id}
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
    // Note: admin_notes column must exist (migration 048_add_admin_notes_to_auction_awards.sql)
    const award = await sql`
      INSERT INTO public.auction_awards (bid_number, winner_user_id, winner_amount_cents, awarded_by, admin_notes)
      VALUES (${bid_number}, ${winner_user_id}, ${winnerBid[0].amount_cents}, ${awarded_by}, ${admin_notes || null})
      RETURNING *
    `;

    // Create notification for winner
    await sql`
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (${winner_user_id}, 'success', 'Auction Won!', 
              'Congratulations! You won Bid #${bid_number} for ${formatMoney(winnerBid[0].amount_cents)}. Check your My Loads for next steps.')
    `;

    // Create notifications for other bidders
    const otherBidders = await sql`
      SELECT DISTINCT clerk_user_id 
      FROM public.carrier_bids 
      WHERE bid_number = ${bid_number} AND clerk_user_id != ${winner_user_id}
    `;

    for (const bidder of otherBidders) {
      await sql`
        INSERT INTO public.notifications (user_id, type, title, message)
        VALUES (${bidder.clerk_user_id}, 'info', 'Auction Awarded', 
                'Bid #${bid_number} was awarded to another carrier.')
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

export async function listAwardsForUser(userId: string): Promise<AuctionAward[]> {
  try {
    const awards = await sql`
      SELECT 
        aa.*,
        cp.legal_name as winner_legal_name,
        cp.mc_number as winner_mc_number
      FROM public.auction_awards aa
      LEFT JOIN public.carrier_profiles cp ON aa.winner_user_id = cp.clerk_user_id
      WHERE aa.winner_user_id = ${userId}
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
    // Check if profile exists
    const existing = await sql`
      SELECT * FROM public.carrier_profiles WHERE clerk_user_id = ${userId}
    `;

    if (existing.length > 0) {
      return existing[0];
    }

    // Create a basic profile with a unique MC number
    const uniqueMcNumber = `TBD-${userId.slice(-8)}-${Date.now()}`;
    const profile = await sql`
      INSERT INTO public.carrier_profiles (clerk_user_id, legal_name, mc_number)
      VALUES (${userId}, 'Pending Setup', ${uniqueMcNumber})
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
    const profile = await sql`
      SELECT company_name, mc_number, contact_name, phone
      FROM public.carrier_profiles 
      WHERE clerk_user_id = ${userId}
    `;

    if (profile.length === 0) {
      return { isComplete: false, missingFields: ['company_name', 'mc_number', 'contact_name', 'phone'] };
    }

    const p = profile[0];
    const missingFields: string[] = [];

    // Check required fields
    if (!p.company_name || p.company_name === 'Pending Setup') {
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
    const profiles = await sql`
      SELECT * FROM public.carrier_profiles WHERE clerk_user_id = ${userId}
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
    if (legal_name) updates.legal_name = legal_name;
    if (mc_number) updates.mc_number = mc_number;
    if (dot_number !== undefined) updates.dot_number = dot_number;
    if (phone !== undefined) updates.phone = phone;
    if (contact_name !== undefined) updates.contact_name = contact_name;

    const setClause = Object.keys(updates)
      .map(key => `${key} = $${key}`)
      .join(', ');

    const result = await sql`
      UPDATE public.carrier_profiles 
      SET ${sql(setClause, ...Object.values(updates))}
      WHERE clerk_user_id = ${userId}
      RETURNING *
    `;

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
