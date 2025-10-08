-- Performance optimization indexes for Nova Build
-- Run these SQL commands to improve database performance

-- Indexes for telegram_bids table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telegram_bids_published_received_at 
ON public.telegram_bids (published, received_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telegram_bids_bid_number 
ON public.telegram_bids (bid_number);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telegram_bids_tag 
ON public.telegram_bids (tag);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telegram_bids_expires_at 
ON public.telegram_bids (expires_at);

-- Indexes for carrier_bids table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_carrier_bids_bid_number_amount 
ON public.carrier_bids (bid_number, amount_cents ASC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_carrier_bids_user_id 
ON public.carrier_bids (clerk_user_id);

-- Indexes for loads table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loads_published_archived 
ON public.loads (published, archived);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loads_pickup_date 
ON public.loads (pickup_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loads_origin_city_state 
ON public.loads (origin_city, origin_state);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loads_destination_city_state 
ON public.loads (destination_city, destination_state);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loads_equipment 
ON public.loads (equipment);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loads_rr_number 
ON public.loads (rr_number);

-- Indexes for user_roles_cache table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_cache_user_id 
ON public.user_roles_cache (clerk_user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_cache_role 
ON public.user_roles_cache (role);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_cache_last_synced 
ON public.user_roles_cache (last_synced);

-- Indexes for load_offers table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_load_offers_load_rr_number 
ON public.load_offers (load_rr_number);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_load_offers_carrier_user_id 
ON public.load_offers (carrier_user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_load_offers_status 
ON public.load_offers (status);

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loads_published_pickup_date_rr 
ON public.loads (published, pickup_date, rr_number) 
WHERE published = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telegram_bids_active_bids 
ON public.telegram_bids (published, received_at DESC, bid_number) 
WHERE published = true;

-- Partial indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loads_published_only 
ON public.loads (pickup_date, rr_number) 
WHERE published = true AND archived = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telegram_bids_recent 
ON public.telegram_bids (received_at DESC, bid_number) 
WHERE received_at > NOW() - INTERVAL '7 days';

-- Analyze tables after creating indexes
ANALYZE public.telegram_bids;
ANALYZE public.carrier_bids;
ANALYZE public.loads;
ANALYZE public.user_roles_cache;
ANALYZE public.load_offers;

