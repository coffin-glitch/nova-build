# Carrier Leaderboard System - Database Schema Documentation

## Overview

This document provides comprehensive schema documentation for the Carrier Leaderboard system in NOVA Build. This system tracks carrier performance, bidding behavior, and engagement metrics for administrative oversight and analytics.

## Database Tables

### Core Tables

#### `carrier_profiles`
Stores carrier company information and profile data.

**Columns:**
- `clerk_user_id` (TEXT PRIMARY KEY) - Clerk authentication user ID
- `company_name` (TEXT) - Company legal/display name
- `legal_name` (TEXT) - Legal business name
- `mc_number` (TEXT) - Motor carrier number (MC#)
- `dot_number` (TEXT) - Department of Transportation number
- `contact_name` (TEXT) - Primary contact name
- `phone` (TEXT) - Contact phone number
- `dispatch_email` (TEXT) - Dispatch email address
- `fleet_size` (INTEGER) - Number of trucks/fleet size
- `equipment_types` (JSONB) - Array of equipment types
- `is_verified` (BOOLEAN) - Profile verification status
- `created_at` (TIMESTAMPTZ) - Profile creation timestamp
- `updated_at` (TIMESTAMPTZ) - Last update timestamp

**Indexes:**
- Primary key on `clerk_user_id`
- Index on `mc_number`
- Index on `dot_number`
- Index on `is_verified`

---

#### `carrier_bids`
Tracks individual carrier bids placed on auctions.

**Columns:**
- `id` (UUID PRIMARY KEY) - Unique bid identifier
- `carrier_user_id` (TEXT) - References `carrier_profiles.clerk_user_id`
- `bid_number` (TEXT) - References `telegram_bids.bid_number`
- `bid_amount` (INTEGER) - Bid amount in cents
- `notes` (TEXT) - Optional carrier notes
- `status` (TEXT) - Bid status (pending, awarded, active, completed, cancelled)
- `bid_outcome` (TEXT) - Outcome (pending, won, lost, expired)
- `final_amount_cents` (INTEGER) - Final awarded amount (if different)
- `created_at` (TIMESTAMPTZ) - Bid creation timestamp
- `updated_at` (TIMESTAMPTZ) - Last update timestamp

**Indexes:**
- Index on `carrier_user_id`
- Index on `bid_number`
- Composite index on `(bid_number, bid_amount)` for efficient lowest bid queries
- Index on `status`
- Index on `bid_outcome`

**Constraints:**
- Unique constraint on `(bid_number, carrier_user_id)` - one bid per carrier per auction

---

#### `auction_awards` ⭐ **Authoritative Source for Wins**
Stores admin-adjudicated auction winners. **This is the authoritative source for determining wins** - NOT inferred from lowest bids.

**Columns:**
- `id` (INTEGER PRIMARY KEY) - Unique award identifier
- `bid_number` (TEXT UNIQUE) - References `telegram_bids.bid_number`
- `winner_user_id` (TEXT) - References `carrier_profiles.clerk_user_id`
- `winner_amount_cents` (INTEGER) - Final awarded amount in cents
- `awarded_by` (TEXT) - Admin Clerk user ID who awarded the auction
- `admin_notes` (TEXT) - Optional admin notes about the award
- `awarded_at` (TIMESTAMPTZ) - Award timestamp

**Indexes:**
- Primary key on `id`
- Unique constraint on `bid_number`
- Index on `winner_user_id` - Critical for leaderboard queries
- Index on `awarded_at` - For time-based filtering

**Relationship:**
- Foreign key reference to `carrier_profiles(clerk_user_id)`
- One award per `bid_number` (unique constraint)

---

#### `telegram_bids`
Source auction data from Telegram bot integration.

**Columns:**
- `id` (UUID PRIMARY KEY)
- `bid_number` (TEXT UNIQUE) - Primary identifier
- `distance_miles` (REAL) - Route distance
- `pickup_timestamp` (TIMESTAMPTZ) - Scheduled pickup time
- `delivery_timestamp` (TIMESTAMPTZ)onden - Scheduled delivery time
- `stops` (JSONB) - Array of stop locations
- `tag` (TEXT) - Equipment/state tag
- `source_channel` (TEXT) - Source Telegram channel
- `received_at` (TIMESTAMPTZ) - When auction was received
- `expires_at` (TIMESTAMPTZ) - Auction expiration time
- `published` (BOOLEAN) - Publication status
- `is_archived` (BOOLEAN) - Archival status
- `archived_at` (TIMESTAMPTZ) - Archival timestamp

**Indexes:**
- Unique constraint on `bid_number`
- Index on `received_at DESC` - For time-based queries
- Index on `is_archived` - For filtering active vs archived

---

#### `carrier_bid_history` (Underutilized)
Designed for historical bid tracking. Currently exists but not actively populated. Can be used for advanced analytics.

**Columns:**
- `id` (UUID PRIMARY KEY)
- `carrier_user_id` (TEXT)
- `bid_number` (TEXT)
- `bid_amount_cents` (INTEGER)
- `bid_status` (TEXT) - won, lost, pending, cancelled
- `bid_notes` (TEXT)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Future Use:**
Consider populating this table via triggers or background jobs for comprehensive historical analysis beyond the main `carrier_bids` table.

---

## Key Relationships

```
carrier_profiles (clerk_user_id)
    ↓
carrier_bids (carrier_user_id) → telegram_bids (bid_number)
    ↓
auction_awards (winner_user_id) ← References carrier_profiles
    ↓ (bid_number references telegram_bids)
```

## Performance Considerations

### Current Implementation
- Uses complex CTEs (Common Table Expressions) computed on every request
- Queries join multiple large tables
- No materialized views or caching

### Recommendations
1. **Materialized View**: Create `carrier_statistics_cache` materialized view for frequently accessed aggregations
2. **Index Optimization**: Ensure all foreign key columns and frequently filtered columns are indexed
3. **Query Optimization**: Consider pagination for large result sets
4. **Caching**: Implement Redis/application-level caching for summary statistics

## Metrics Calculation

### Win Rate
```
win_rate_percentage = (total_wins / total_bids) * 100
```
**Source**: `auction_awards` table (authoritative) divided by `carrier_bids` count

### Response Time
```
avg_response_time_minutes = AVG(bid.created_at - auction.received_at)
```
**Measures**: How quickly carriers respond to new auctions

### Competitiveness Score
```
competitiveness_score = (bids_within_5_percent_of_lowest / total_bids) * 100
```
**Measures**: How often carrier's bid is competitive (within 5% of winning bid)

### Revenue Generated
```
total_revenue_cents = SUM(auction_awards.winner_amount_cents WHERE winner_user_id = X)
```
**Source**: `auction_awards` table (sum of awarded amounts)

## API Endpoints

### GET `/api/admin/carrier-leaderboard`

**Query Parameters:**
- `timeframe` (default: 30) - Days to look back
- `sortBy` - Sort field: `total_bids`, `win_rate`, `avg_bid`, `total_value`, `recent_activity`, `wins`, `revenue`, `competitiveness`
- `limit` (default: 50, max: 100) - Max results
- `equipmentType` - Filter by equipment tag
- `minBids` - Minimum bids required for inclusion

**Response:**
```typescript
{
  success: boolean;
  data: {
    leaderboard: CarrierStats[];
    summary: SummaryStats;
    topPerformers: TopPerformer[];
    equipmentStats: EquipmentStats[];
    timeframe: { days: number; startDate: string; endDate: string };
    sortBy: string;
    limit: number;
    filters: { equipmentType?: string; minBids: number };
  };
}
```

## Migration Notes

### Schema Updates Required
1. ✅ `auction_awards` table exists and is populated
2. ✅ `admin_notes` column exists in `auction_awards`
3. ⚠️ Consider adding indexes on `auction_awards.winner_user_id` and `awarded_at` if not present
4. ⚠️ Consider populating `carrier_bid_history` for advanced historical analytics

### Breaking Changes
- **WIN CALCULATION**: Changed from heuristic (lowest bid) to authoritative (`auction_awards` table)
  - **Impact**: Win rates may differ if admin awards differ from lowest bids
  - **Action Required**: Ensure `auction_awards` table is properly maintained

## Developer Setup

1. **Database Connection**: Ensure `DATABASE_URL` environment variable is set
2. **Schema Sync**: Run migrations in `db/migrations/` directory
3. **Verify Tables**: Confirm all tables exist using schema inspection queries
4. **Test Data**: Use test carriers and bids to validate leaderboard calculations

## Future Enhancements

1. Materialized view for performance
2. Real-time updates via WebSocket/polling
3. Export functionality (CSV/JSON)
4. Advanced filtering (date ranges, geographic regions)
5. Trend analysis (bid volume over time)
6. Carrier comparison tools
7. Automated reporting and alerts

