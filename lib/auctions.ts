import sqlTemplate from './db';
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
    await sqlTemplate`
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
    const count = await sqlTemplate`SELECT COUNT(*) as count FROM telegram_bids`;
    if (count[0].count === 0) {
      const sampleBids = [
        ['BID001', 250, '2025-01-15T08:00:00Z', '2025-01-15T18:00:00Z', '["Chicago, IL", "Detroit, MI"]', 'URGENT', 'telegram', 'admin', '2025-01-15T07:30:00Z'],
        ['BID002', 400, '2025-01-15T10:00:00Z', '2025-01-16T08:00:00Z', '["Los Angeles, CA", "Phoenix, AZ"]', 'STANDARD', 'telegram', 'admin', '2025-01-15T09:30:00Z'],
        ['BID003', 150, '2025-01-15T12:00:00Z', '2025-01-15T20:00:00Z', '["Miami, FL", "Orlando, FL"]', 'HOT', 'telegram', 'admin', '2025-01-15T11:30:00Z'],
      ];

      for (const bid of sampleBids) {
        await sqlTemplate`
          INSERT INTO telegram_bids (bid_number, distance_miles, pickup_timestamp, delivery_timestamp, stops, tag, source_channel, forwarded_to, received_at)
          VALUES (${bid[0]}, ${bid[1]}, ${bid[2]}, ${bid[3]}, ${bid[4]}, ${bid[5]}, ${bid[6]}, ${bid[7]}, ${bid[8]})
        `;
      }
    }

    // Build query with PostgreSQL template literals
    let query;
    if (q && tag) {
      query = sqlTemplate`
        SELECT 
          *,
          (received_at::timestamp + INTERVAL '25 minutes')::text as expires_at_25,
          NOW() > (received_at::timestamp + INTERVAL '25 minutes') as is_expired,
          CASE 
            WHEN stops IS NOT NULL AND stops != '' 
            THEN jsonb_array_length(stops::jsonb)
            ELSE 0 
          END as stops_count
        FROM telegram_bids 
        WHERE bid_number LIKE ${`%${q}%`} AND tag = ${tag.toUpperCase()}
        ORDER BY received_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (q) {
      query = sqlTemplate`
        SELECT 
          *,
          (received_at::timestamp + INTERVAL '25 minutes')::text as expires_at_25,
          NOW() > (received_at::timestamp + INTERVAL '25 minutes') as is_expired,
          CASE 
            WHEN stops IS NOT NULL AND stops != '' 
            THEN jsonb_array_length(stops::jsonb)
            ELSE 0 
          END as stops_count
        FROM telegram_bids 
        WHERE bid_number LIKE ${`%${q}%`}
        ORDER BY received_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (tag) {
      query = sqlTemplate`
        SELECT 
          *,
          (received_at::timestamp + INTERVAL '25 minutes')::text as expires_at_25,
          NOW() > (received_at::timestamp + INTERVAL '25 minutes') as is_expired,
          CASE 
            WHEN stops IS NOT NULL AND stops != '' 
            THEN jsonb_array_length(stops::jsonb)
            ELSE 0 
          END as stops_count
        FROM telegram_bids 
        WHERE tag = ${tag.toUpperCase()}
        ORDER BY received_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      query = sqlTemplate`
        SELECT 
          *,
          (received_at::timestamp + INTERVAL '25 minutes')::text as expires_at_25,
          NOW() > (received_at::timestamp + INTERVAL '25 minutes') as is_expired,
          CASE 
            WHEN stops IS NOT NULL AND stops != '' 
            THEN jsonb_array_length(stops::jsonb)
            ELSE 0 
          END as stops_count
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
    const telegramBid = await sqlTemplate`
      SELECT 
        tb.*,
        tb.received_at + INTERVAL '25 minutes' as expires_at_25,
        NOW() > (tb.received_at + INTERVAL '25 minutes') as is_expired,
        COALESCE(jsonb_array_length(tb.stops), 0) as stops_count
      FROM public.telegram_bids tb
      WHERE tb.bid_number = ${bid_number}
    `;

    if (telegramBid.length === 0) {
      return null;
    }

    const bid = telegramBid[0];
    const countdown = formatCountdown(bid.expires_at_25);

    // Get all carrier bids with carrier info
    const carrierBids = await sqlTemplate`
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
    const bidCheck = await sqlTemplate`
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

    // Upsert the bid
    const result = await sqlTemplate`
      INSERT INTO public.carrier_bids (bid_number, clerk_user_id, amount_cents, notes)
      VALUES (${bid_number}, ${userId}, ${amount_cents}, ${notes || null})
      ON CONFLICT (bid_number, clerk_user_id)
      DO UPDATE SET 
        amount_cents = EXCLUDED.amount_cents,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *
    `;

    return result[0];
  } catch (error) {
    console.error('Database error in upsertCarrierBid:', error);
    throw error; // Re-throw to maintain API contract
  }
}

export async function awardAuction({
  bid_number,
  winner_user_id,
  awarded_by,
}: {
  bid_number: string;
  winner_user_id: string;
  awarded_by: string;
}): Promise<AuctionAward> {
  try {
    // Verify the winner has a bid for this auction
    const winnerBid = await sqlTemplate`
      SELECT amount_cents
      FROM public.carrier_bids
      WHERE bid_number = ${bid_number} AND clerk_user_id = ${winner_user_id}
    `;

    if (winnerBid.length === 0) {
      throw new Error('Winner must have an existing bid for this auction');
    }

    // Check if already awarded
    const existingAward = await sqlTemplate`
      SELECT id FROM public.auction_awards WHERE bid_number = ${bid_number}
    `;

    if (existingAward.length > 0) {
      throw new Error('Auction already awarded');
    }

    // Create the award
    const award = await sqlTemplate`
      INSERT INTO public.auction_awards (bid_number, winner_user_id, winner_amount_cents, awarded_by)
      VALUES (${bid_number}, ${winner_user_id}, ${winnerBid[0].amount_cents}, ${awarded_by})
      RETURNING *
    `;

    // Create notification for winner
    await sqlTemplate`
      INSERT INTO public.notifications (recipient_user_id, type, title, body)
      VALUES (${winner_user_id}, 'success', 'Auction Won!', 
              'Congratulations! You won Bid #${bid_number} for ${formatMoney(winnerBid[0].amount_cents)}. Check your My Loads for next steps.')
    `;

    // Create notifications for other bidders
    const otherBidders = await sqlTemplate`
      SELECT DISTINCT clerk_user_id 
      FROM public.carrier_bids 
      WHERE bid_number = ${bid_number} AND clerk_user_id != ${winner_user_id}
    `;

    for (const bidder of otherBidders) {
      await sqlTemplate`
        INSERT INTO public.notifications (recipient_user_id, type, title, body)
        VALUES (${bidder.clerk_user_id}, 'info', 'Auction Awarded', 
                'Bid #${bid_number} was awarded to another carrier.')
      `;
    }

    // Create a load assignment for the winner
    await sqlTemplate`
      INSERT INTO public.loads (rr_number, carrier_user_id, status, meta)
      VALUES (${bid_number}, ${winner_user_id}, 'awarded', 
              jsonb_build_object('bid_number', ${bid_number}, 'awarded_at', NOW()))
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
    const awards = await sqlTemplate`
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
    const existing = await sqlTemplate`
      SELECT * FROM public.carrier_profiles WHERE clerk_user_id = ${userId}
    `;

    if (existing.length > 0) {
      return existing[0];
    }

    // Create a basic profile (will need to be completed later)
    const profile = await sqlTemplate`
      INSERT INTO public.carrier_profiles (clerk_user_id, legal_name, mc_number)
      VALUES (${userId}, 'Pending Setup', 'TBD')
      RETURNING *
    `;

    return profile[0];
  } catch (error) {
    console.error('Database error in ensureCarrierProfile:', error);
    throw error; // Re-throw to maintain API contract
  }
}

export async function getCarrierProfile(userId: string): Promise<CarrierProfile | null> {
  try {
    const profiles = await sqlTemplate`
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

    const result = await sqlTemplate`
      UPDATE public.carrier_profiles 
      SET ${sqlTemplate(setClause, ...Object.values(updates))}
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
