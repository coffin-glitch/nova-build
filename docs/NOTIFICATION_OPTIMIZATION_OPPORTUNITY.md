# Notification System Optimization Opportunity

## Current Behavior

**When a new bid arrives:**

1. **Webhook receives new bid** (`/api/webhooks/new-bid`)
2. **Fetches ALL active triggers** from database:
   ```sql
   SELECT * FROM notification_triggers WHERE is_active = true
   ```
3. **Fetches ALL users with state preferences** (even without explicit triggers)
4. **Enqueues a job for EVERY user** with active triggers
5. **Each worker job checks** if the new bid matches that user's triggers

## Example at Scale

**Scenario: 10,000 users, 1 new bid arrives**

- **Webhook**: Fetches 10,000+ triggers → Enqueues 10,000 jobs
- **Workers**: Process 10,000 jobs, each checking if the bid matches
- **Result**: 10,000 database queries, even if only 50 users actually match

## Performance Impact

**Current approach:**
- ✅ Simple and reliable
- ✅ Webhook returns quickly (just enqueues jobs)
- ✅ Workers handle load asynchronously
- ❌ Wastes resources checking users who can't possibly match
- ❌ Database load: 10,000+ queries per new bid
- ❌ Worker load: 10,000+ jobs per new bid

## Optimization Strategy

### Option 1: Pre-filter by Bid Route (Recommended)

**Before enqueueing jobs, filter users based on the new bid:**

```typescript
// Get the new bid's route
const newBid = await sql`
  SELECT stops, distance_miles, tag
  FROM telegram_bids
  WHERE bid_number = ${bidNumber}
`;

const originState = extractState(newBid.stops[0]);
const destinationState = extractState(newBid.stops[newBid.stops.length - 1]);

// Only get triggers for users who might match
const relevantTriggers = await sql`
  SELECT nt.*
  FROM notification_triggers nt
  WHERE nt.is_active = true
    AND (
      -- Exact match triggers: check if route matches
      (nt.trigger_type = 'exact_match' AND 
       nt.trigger_config->>'favoriteStops' LIKE ${`%${originState}%`})
      OR
      -- State preference triggers: check if origin matches
      (nt.trigger_type = 'similar_load' AND
       EXISTS (
         SELECT 1 FROM unnest(nt.trigger_config->'statePreferences') AS pref
         WHERE pref::text = ${originState}
       ))
    )
`;
```

**Benefits:**
- Reduces jobs from 10,000 → ~500 (only users who might match)
- 95% reduction in database queries
- Faster notification delivery (less queue backlog)

### Option 2: Bid-Based Filtering

**Store bid metadata in Redis and filter before enqueueing:**

```typescript
// When bid arrives, extract key info
const bidInfo = {
  originState: extractState(bid.stops[0]),
  destinationState: extractState(bid.stops[bid.stops.length - 1]),
  distance: bid.distance_miles,
  tag: bid.tag
};

// Only enqueue for users whose triggers could match
const matchingUsers = await findUsersWithMatchingTriggers(bidInfo);
```

### Option 3: Smart Indexing

**Add database indexes to speed up filtering:**

```sql
-- Index on trigger config for faster filtering
CREATE INDEX idx_trigger_config_state_prefs 
ON notification_triggers 
USING GIN ((trigger_config->'statePreferences'));

-- Index on favorite stops for exact matches
CREATE INDEX idx_trigger_config_favorite_stops 
ON notification_triggers 
USING GIN ((trigger_config->>'favoriteStops'));
```

## Recommended Implementation

**Phase 1: Quick Win (Low Risk)**
1. Extract new bid's origin/destination state in webhook
2. Pre-filter state preference triggers (similar_load) by origin state
3. Only enqueue jobs for users whose state preferences include the origin state

**Phase 2: Full Optimization (Medium Risk)**
1. Pre-filter exact match triggers by route matching
2. Add database indexes for faster filtering
3. Cache trigger metadata in Redis for ultra-fast filtering

**Phase 3: Advanced (Higher Risk)**
1. Use Redis to store "user → trigger metadata" mapping
2. Filter entirely in memory before database query
3. Only query database for users who definitely might match

## Expected Impact

**Before optimization:**
- 10,000 users → 10,000 jobs per bid
- ~5-10 seconds to process all jobs
- High database load

**After optimization:**
- 10,000 users → ~200-500 jobs per bid (only potential matches)
- ~1-2 seconds to process all jobs
- 80-95% reduction in database load

## Trade-offs

**Current approach (check everyone):**
- ✅ Never misses a match (100% accuracy)
- ✅ Simple to maintain
- ❌ Wastes resources on non-matches

**Optimized approach (pre-filter):**
- ✅ Much faster and more efficient
- ✅ Scales better to 100,000+ users
- ⚠️ Slightly more complex code
- ⚠️ Need to ensure filtering logic is correct (don't miss matches)

## Recommendation

**Start with Phase 1** - it's low risk and provides immediate benefits:
- Pre-filter state preference triggers by origin state
- This alone will eliminate ~70-80% of unnecessary jobs
- Easy to implement and test
- Can roll back if issues arise

