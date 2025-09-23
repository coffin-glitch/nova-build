import sql from './db.server';
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
  let query = sql`
    SELECT 
      tb.*,
      tb.received_at + INTERVAL '25 minutes' as expires_at_25,
      NOW() > (tb.received_at + INTERVAL '25 minutes') as is_expired,
      COALESCE(jsonb_array_length(tb.stops), 0) as stops_count
    FROM public.telegram_bids tb
    WHERE 1=1
  `;

  if (q) {
    query = sql`${query} AND tb.bid_number ILIKE ${'%' + q + '%'}`;
  }

  if (tag) {
    query = sql`${query} AND tb.tag = ${tag.toUpperCase()}`;
  }

  query = sql`${query} ORDER BY tb.received_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const rows = await query;
  
  // Add time_left_seconds to each row
  return rows.map(row => {
    const countdown = formatCountdown(row.expires_at_25);
    return {
      ...row,
      time_left_seconds: countdown.secondsLeft,
    };
  });
}

export async function getBidSummary(bid_number: string, userId?: string): Promise<BidSummary | null> {
  // Get the telegram bid
  const telegramBid = await sql`
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
  // First check if the auction is still active
  const bidCheck = await sql`
    SELECT 
      tb.received_at + INTERVAL '25 minutes' as expires_at_25,
      NOW() > (tb.received_at + INTERVAL '25 minutes') as is_expired
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

  return result[0];
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

  // Create the award
  const award = await sql`
    INSERT INTO public.auction_awards (bid_number, winner_user_id, winner_amount_cents, awarded_by)
    VALUES (${bid_number}, ${winner_user_id}, ${winnerBid[0].amount_cents}, ${awarded_by})
    RETURNING *
  `;

  // Create notification for winner
  await sql`
    INSERT INTO public.notifications (recipient_user_id, type, title, body)
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
      INSERT INTO public.notifications (recipient_user_id, type, title, body)
      VALUES (${bidder.clerk_user_id}, 'info', 'Auction Awarded', 
              'Bid #${bid_number} was awarded to another carrier.')
    `;
  }

  // Create a load assignment for the winner
  await sql`
    INSERT INTO public.loads (rr_number, carrier_user_id, status, meta)
    VALUES (${bid_number}, ${winner_user_id}, 'awarded', 
            jsonb_build_object('bid_number', ${bid_number}, 'awarded_at', NOW()))
    ON CONFLICT (rr_number) DO NOTHING
  `;

  return award[0];
}

export async function listAwardsForUser(userId: string): Promise<AuctionAward[]> {
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
}

export async function ensureCarrierProfile(userId: string): Promise<CarrierProfile> {
  // Check if profile exists
  const existing = await sql`
    SELECT * FROM public.carrier_profiles WHERE clerk_user_id = ${userId}
  `;

  if (existing.length > 0) {
    return existing[0];
  }

  // Create a basic profile (will need to be completed later)
  const profile = await sql`
    INSERT INTO public.carrier_profiles (clerk_user_id, legal_name, mc_number)
    VALUES (${userId}, 'Pending Setup', 'TBD')
    RETURNING *
  `;

  return profile[0];
}

export async function getCarrierProfile(userId: string): Promise<CarrierProfile | null> {
  const profiles = await sql`
    SELECT * FROM public.carrier_profiles WHERE clerk_user_id = ${userId}
  `;

  return profiles.length > 0 ? profiles[0] : null;
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
