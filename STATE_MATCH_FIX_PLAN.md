# State Match Query Fix - Methodical Plan

## Problem Statement

**Error**: `PostgresError: cannot get array length of a scalar` (code 22023)
**Location**: WHERE clause at line 816: `AND jsonb_array_length(tb.stops) >= 2`
**Root Cause**: PostgreSQL may evaluate `jsonb_array_length()` even when `jsonb_typeof()` check fails, or query optimizer reorders conditions.

## Research Findings

### PostgreSQL WHERE Clause Evaluation
- PostgreSQL does NOT guarantee short-circuit evaluation
- Query optimizer may reorder conditions for performance
- `jsonb_array_length()` will fail if called on non-array values
- Type checking must happen in a way that prevents array operations on scalars

### Best Practices for Conditional JSONB Operations

1. **Two-Stage CTE Approach** (Recommended)
   - Stage 1: Filter to only array types
   - Stage 2: Perform array operations on filtered data
   - Ensures array operations never run on scalars

2. **CASE Expression in WHERE Clause**
   - Use CASE to conditionally evaluate array length
   - Only check length when type is confirmed array
   - More complex but works

3. **Subquery Pre-filtering**
   - Use subquery to filter arrays first
   - Then perform operations in outer query
   - Similar to CTE approach

## Recommended Solution: Two-Stage CTE

### Approach
1. **First CTE**: Filter to only rows where `stops` is a JSONB array
2. **Second CTE**: Perform array operations (length check, element extraction)
3. **Main Query**: Apply state matching logic

### Benefits
- Guarantees array operations only run on arrays
- Clear separation of concerns
- Easy to understand and maintain
- Performance: Filtering happens early

### Implementation

```sql
WITH array_bids AS (
  -- Stage 1: Filter to only array types
  SELECT 
    tb.bid_number,
    tb.stops,
    tb.distance_miles,
    tb.tag,
    tb.pickup_timestamp,
    tb.delivery_timestamp,
    tb.received_at
  FROM telegram_bids tb
  WHERE tb.is_archived = false
    AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes')
    AND tb.bid_number != ${favorite.favorite_bid}
    AND tb.distance_miles >= ${favoriteDistanceRange.minDistance}
    AND tb.distance_miles <= ${favoriteDistanceRange.maxDistance}
    AND tb.stops IS NOT NULL
    AND jsonb_typeof(tb.stops) = 'array'
),
bid_stops AS (
  -- Stage 2: Extract stops from confirmed arrays
  SELECT 
    ab.bid_number,
    ab.stops,
    ab.distance_miles,
    ab.tag,
    ab.pickup_timestamp,
    ab.delivery_timestamp,
    ab.received_at,
    ab.stops->>0 as origin_stop,
    (SELECT stop_text 
     FROM jsonb_array_elements_text(ab.stops) WITH ORDINALITY AS t(stop_text, idx)
     ORDER BY idx DESC
     LIMIT 1) as dest_stop
  FROM array_bids ab
  WHERE jsonb_array_length(ab.stops) >= 2  -- Safe: we know it's an array
)
SELECT ... FROM bid_stops WHERE ...
```

## Alternative: CASE in WHERE Clause

If CTE approach is too complex, use CASE:

```sql
WHERE ...
  AND tb.stops IS NOT NULL
  AND jsonb_typeof(tb.stops) = 'array'
  AND CASE 
    WHEN jsonb_typeof(tb.stops) = 'array' 
    THEN jsonb_array_length(tb.stops) >= 2
    ELSE false
  END
```

## Implementation Steps

1. ✅ Research best practices
2. ⏳ Implement two-stage CTE approach
3. ⏳ Test with sample data
4. ⏳ Verify no more scalar errors
5. ⏳ Deploy and monitor

