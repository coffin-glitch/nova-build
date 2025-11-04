-- Indexes to improve leaderboard-related queries
CREATE INDEX IF NOT EXISTS idx_carrier_bids_user ON carrier_bids (clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_carrier_bids_created_at ON carrier_bids (created_at);
CREATE INDEX IF NOT EXISTS idx_carrier_bids_bid_number ON carrier_bids (bid_number);

CREATE INDEX IF NOT EXISTS idx_auction_awards_winner ON auction_awards (winner_user_id);
CREATE INDEX IF NOT EXISTS idx_auction_awards_awarded_at ON auction_awards (awarded_at);

CREATE INDEX IF NOT EXISTS idx_telegram_bids_number ON telegram_bids (bid_number);

CREATE INDEX IF NOT EXISTS idx_carrier_profiles_user ON carrier_profiles (clerk_user_id);



