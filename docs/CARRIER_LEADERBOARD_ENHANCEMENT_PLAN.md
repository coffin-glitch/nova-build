# Carrier Leaderboard System - Enhancement Plan & Documentation

## Executive Summary

This document outlines the comprehensive enhancement of the Carrier Leaderboard system for the NOVA Build freight marketplace. The leaderboard provides administrators with critical insights into carrier performance, bidding behavior, and platform engagement metrics.

## Current State Analysis

### Existing Tables & Their Usage

1. **`carrier_profiles`** ✅
   - Stores carrier company information
   - Key fields: `clerk_user_id`, `company_name`, `legal_name`, `mc_number`, `dot_number`, `fleet_size`, `is_verified`

2. **`carrier_bids`** ✅
   - Tracks individual carrier bids on auctions
   - Key fields: `bid_number`, `clerk_user_id`, `amount_cents`, `created_at`, `status`, `bid_outcome`

3. **`auction_awards`** ⚠️ **UNDERUTILIZED**
   - Stores actual auction winners (admin adjudication results)
   - Key fields: `bid_number`, `winner_user_id`, `winner_amount_cents`, `awarded_by`, `awarded_at`
   - **CRITICAL**: Current API infers winners from lowest bids instead of using this authoritative table

4. **`carrier_bid_history`** ⚠️ **NOT USED**
   - Designed for historical bid tracking
   - Currently not populated or queried by leaderboard

5. **`telegram_bids`** ✅
   - Source auction data
   - Used for bid context and expiration tracking

### Current Issues

1. **Incorrect Win Calculation**: Uses heuristic (lowest bid) instead of `auction_awards` table
2. **Missing Schema Definition**: `auction_awards` not in `lib/schema.ts`
3. **Performance**: Complex CTEs computed on every request
4. **Limited Metrics**: Missing response time, competitiveness, completion rates
5. **No Historical Tracking**: `carrier_bid_history` exists but unused

## Enhancement Plan

### Phase 1: Database Schema & Foundation
1. Add `auction_awards` to Drizzle schema
2. Create materialized view for carrier statistics (performance optimization)
3. Ensure proper indexing

### Phase 2: API Enhancements
1. Fix win calculation to use `auction_awards`
2. Add advanced metrics:
   - Average bid response time
   - Bid competitiveness (position vs lowest)
   - Completion rates (for awarded bids)
   - Revenue generated
   - Geographic performance
3. Add filtering by equipment type, state, date ranges

### Phase 3: UI Enhancements
1. Enhanced filtering controls
2. Export functionality (CSV/JSON)
3. Detailed carrier profile modals
4. Trend charts (bid volume over time)
5. Performance badges/indicators

### Phase 4: Documentation
1. Schema documentation
2. API documentation
3. Developer setup guide

## Database Schema

### Core Tables

my_app/carrier_profiles (existing)
- Primary carrier company information

my_app/carrier_bids (existing)
- Individual bids placed by carriers

my_app/auction_awards (existing - needs schema definition)
- **Authoritative source for winners**
- Columns: `id`, `bid_number本身的 UNIQUE`, `winner_user_id`, `winner_amount_cents`, `awarded_by`, `awarded_at`, `admin_notes`

my_app/carrier_bid_history (existing - underutilized)
- Historical bid tracking (can be populated via triggers)

### New Materialized View (Performance)

```sql
CREATE MATERIALIZED VIEW carrier_statistics_cache AS
SELECT 
  -- Performance optimized aggregated statistics
  -- Refreshed periodically or on-demand
```

## API Endpoint Enhancements

### Enhanced Metrics

1. **Win Rate**: Based on `auction_awards` (authoritative)
2. **Response Time**: Time between auction posted and bid placed
3. **Bid Competitiveness**: How often carrier's bid is within X% of lowest
4. **Completion Rate**: Of awarded bids, how many completed lifecycle
5. **Revenue Generated**: Sum of awarded bid amounts
6. **Geographic Performance**: Performance by state/route type
7. **Equipment Specialization**: Performance by equipment type

### New Query Parameters

- `equipmentType`: Filter by equipment tag
- `state`: Filter by state/region
- `minBids`: Minimum bids for inclusion
- `dateFrom` / `dateTo`: Custom date ranges
- `statusFilter`: All, Active, Verified only
- `export`: csv/json export format

## Implementation Priority

1. **HIGH**: Fix win calculation (use auction_awards)
2. **HIGH**: Add auction_awards to schema
3. **MEDIUM**: Add materialized view for performance
4. **MEDIUM**: Enhance API with new metrics
5. **LOW**: UI enhancements and visualizations

