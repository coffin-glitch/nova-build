import 'dotenv/config';
import postgres from 'postgres';

// Optimized database configuration
const sql = postgres(process.env.DATABASE_URL!, { 
  ssl: 'require',
  max: 10, // Increased connection pool
  idle_timeout: 120, // Keep connections alive longer
  connect_timeout: 10, // Faster connection timeout
  max_lifetime: 60 * 60, // 1 hour max lifetime
  onnotice: () => {}, // Suppress notices
  debug: false,
  // Add connection pooling optimizations
  prepare: false, // Disable prepared statements for better performance
  transform: {
    undefined: null, // Transform undefined to null
  },
});

// Add query optimization helpers
export const optimizedQueries = {
  // Optimized telegram bids query with proper indexing hints
  getActiveTelegramBids: (limit = 50, offset = 0) => sql`
    SELECT 
      tb.*,
      tb.received_at + INTERVAL '25 minutes' as expires_at_25,
      NOW() > (tb.received_at + INTERVAL '25 minutes') as is_expired,
      COALESCE(jsonb_array_length(tb.stops), 0) as stops_count,
      COALESCE(lowest_bid.amount_cents, 0) as lowest_amount_cents,
      lowest_bid.clerk_user_id as lowest_user_id,
      COALESCE(bid_counts.bids_count, 0) as bids_count
    FROM public.telegram_bids tb
    LEFT JOIN LATERAL (
      SELECT amount_cents, clerk_user_id
      FROM public.carrier_bids cb
      WHERE cb.bid_number = tb.bid_number
      ORDER BY amount_cents ASC
      LIMIT 1
    ) lowest_bid ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) as bids_count
      FROM public.carrier_bids cb
      WHERE cb.bid_number = tb.bid_number
    ) bid_counts ON true
    WHERE tb.published = true
    ORDER BY tb.received_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `,

  // Optimized loads query with better filtering
  getPublishedLoads: (filters: {
    origin?: string;
    destination?: string;
    equipment?: string;
    limit?: number;
    offset?: number;
  } = {}) => {
    const { origin, destination, equipment, limit = 50, offset = 0 } = filters;
    
    return sql`
      SELECT 
        rr_number, tm_number, status_code, pickup_date, pickup_window,
        delivery_date, delivery_window, revenue, purchase, net, margin,
        equipment, customer_name, driver_name, total_miles,
        origin_city, origin_state, destination_city, destination_state,
        vendor_name, dispatcher_name, updated_at, published
      FROM public.loads
      WHERE published = true AND archived = false
      ${origin ? sql`AND (LOWER(origin_city) LIKE LOWER(${'%' + origin + '%'}) OR LOWER(origin_state) LIKE LOWER(${'%' + origin + '%'}))` : sql``}
      ${destination ? sql`AND (LOWER(destination_city) LIKE LOWER(${'%' + destination + '%'}) OR LOWER(destination_state) LIKE LOWER(${'%' + destination + '%'}))` : sql``}
      ${equipment && equipment !== 'all' ? sql`AND LOWER(equipment) LIKE LOWER(${'%' + equipment + '%'})` : sql``}
      ORDER BY COALESCE(pickup_date, delivery_date) NULLS LAST, rr_number
      LIMIT ${limit} OFFSET ${offset}
    `;
  },

  // Optimized admin loads query
  getAdminLoads: (filters: {
    search?: string;
    published?: string;
    limit?: number;
    offset?: number;
  } = {}) => {
    const { search, published, limit = 100, offset = 0 } = filters;
    
    return sql`
      SELECT 
        rr_number, tm_number, status_code, pickup_date, pickup_window,
        delivery_date, delivery_window, revenue, purchase, net, margin,
        equipment, customer_name, driver_name, total_miles,
        origin_city, origin_state, destination_city, destination_state,
        vendor_name, dispatcher_name, updated_at, published
      FROM public.loads
      WHERE 1=1
      ${published === 'true' ? sql`AND published = true` : sql``}
      ${published === 'false' ? sql`AND published = false` : sql``}
      ${search ? sql`AND (
        UPPER(rr_number) LIKE UPPER(${'%' + search + '%'}) OR
        UPPER(tm_number) LIKE UPPER(${'%' + search + '%'}) OR
        UPPER(customer_name) LIKE UPPER(${'%' + search + '%'}) OR
        UPPER(origin_city) LIKE UPPER(${'%' + search + '%'}) OR
        UPPER(destination_city) LIKE UPPER(${'%' + search + '%'})
      )` : sql``}
      ORDER BY COALESCE(pickup_date, delivery_date) NULLS LAST, rr_number
      LIMIT ${limit} OFFSET ${offset}
    `;
  }
};

export default sql;

