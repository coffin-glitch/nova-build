# Comprehensive Notification System

## Overview

This system ensures that **ALL carriers' preferences are checked** when a new bid arrives, regardless of whether they have explicit triggers set up. This guarantees that every carrier receives notifications for bids that match their preferences.

## How It Works

### When a New Bid Arrives

1. **Webhook Trigger** (`/api/webhooks/new-bid`)
   - Called when a new bid is inserted into the database
   - Extracts bid information (origin, destination, states, distance, etc.)

2. **Comprehensive Matching** (`lib/comprehensive-carrier-matching.ts`)
   - Checks **ALL carriers' favorites** for matches:
     - **Exact matches**: Same city-to-city route
     - **State matches**: Same state-to-state route
     - **Backhaul matches**: Reverse route (if enabled)
   - Checks **ALL carriers' state preferences**
   - Uses efficient SQL pre-filtering to scale to thousands of carriers

3. **Virtual Triggers**
   - Creates virtual triggers for all matches
   - Excludes carriers who already have explicit triggers (prevents duplicates)
   - Ensures every matching carrier gets notified

4. **Worker Processing** (`workers/notification-worker.ts`)
   - Processes all triggers (explicit + virtual)
   - Sends in-app and email notifications
   - Handles all match types correctly

## Match Types

### 1. Exact Match (City-to-City)
- **Trigger Type**: `exact_match`
- **Config**: `matchType: 'exact'`
- **Example**: Favorite: "HARRISBURG, PA → OLATHE, KS", New Bid: "HARRISBURG, PA → OLATHE, KS"

### 2. State Match (State-to-State)
- **Trigger Type**: `exact_match` (uses exact_match trigger processor)
- **Config**: `matchType: 'state'`
- **Example**: Favorite: "HARRISBURG, PA → OLATHE, KS", New Bid: "PHILADELPHIA, PA → KANSAS CITY, KS"

### 3. Backhaul Match (Reverse Route)
- **Trigger Type**: `exact_match`
- **Config**: `matchType: 'exact'` or `'state'`, `backhaulEnabled: true`
- **Example**: Favorite: "HARRISBURG, PA → OLATHE, KS", New Bid: "OLATHE, KS → HARRISBURG, PA"

### 4. State Preference Match
- **Trigger Type**: `similar_load`
- **Config**: `statePreferences: ['IL', 'MN', ...]`
- **Example**: User has IL in state preferences, New Bid: "CHICAGO, IL → MINNEAPOLIS, MN"

### 5. Favorite Available
- **Trigger Type**: `favorite_available`
- **Config**: `favoriteBidNumbers: ['93721514']`
- **Example**: User has bid #93721514 favorited, same bid becomes available again

## Optimization Features

### SQL Pre-Filtering
- Uses SQL `LIKE` queries to pre-filter potential matches
- Reduces dataset before JavaScript processing
- Scales efficiently to thousands of carriers

### Duplicate Prevention
- Excludes carriers who already have explicit triggers
- Prevents duplicate notifications
- Ensures each carrier gets notified once per bid

### Efficient Processing
- Groups triggers by user for batch processing
- Uses priority queues (urgent vs normal)
- Processes all matches in parallel

## Database Queries

### Finding Matching Favorites
```sql
SELECT DISTINCT
  cf.supabase_carrier_user_id as user_id,
  cf.bid_number as favorite_bid_number,
  tb.stops as favorite_stops,
  ...
FROM carrier_favorites cf
JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
WHERE ...
  -- Exclude carriers with explicit triggers
  AND NOT EXISTS (
    SELECT 1 FROM notification_triggers nt
    WHERE nt.supabase_carrier_user_id = cf.supabase_carrier_user_id
      AND nt.is_active = true
      AND nt.trigger_config->>'favoriteBidNumber' = cf.bid_number
  )
  -- Pre-filter potential matches
  AND (
    (tb.stops::text LIKE '%ORIGIN%' AND tb.stops::text LIKE '%DESTINATION%')
    OR ...
  )
```

## Files Modified

1. **`lib/comprehensive-carrier-matching.ts`** (NEW)
   - Core matching logic
   - Finds all carriers with matching favorites
   - Finds all carriers with state preferences

2. **`app/api/webhooks/new-bid/route.ts`**
   - Integrated comprehensive matching
   - Creates virtual triggers for all matches
   - Ensures complete coverage

3. **`workers/notification-worker.ts`**
   - Already handles all match types correctly
   - Processes virtual triggers the same as explicit triggers

## Testing

To test the comprehensive system:

1. **Create test bids** that match various carrier preferences
2. **Verify notifications** are sent to all matching carriers
3. **Check logs** to ensure all matches are found
4. **Verify no duplicates** (carriers with explicit triggers don't get virtual triggers)

## Scalability

This system is designed to scale to **thousands of carriers**:

- **SQL pre-filtering** reduces dataset size
- **Efficient indexing** on `carrier_favorites` and `notification_triggers`
- **Batch processing** groups triggers by user
- **Priority queues** ensure urgent notifications are processed first

## Future Enhancements

1. **Caching**: Cache carrier preferences to reduce database queries
2. **Rate Limiting**: Prevent notification spam
3. **Analytics**: Track match rates and notification delivery
4. **A/B Testing**: Test different matching algorithms

