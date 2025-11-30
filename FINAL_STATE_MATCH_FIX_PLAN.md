# Final State Match Fix - Comprehensive Plan

## Problem Analysis

### Root Cause Identified:
The subquery in the SELECT clause:
```sql
(SELECT stop_text 
 FROM jsonb_array_elements_text(ab.stops) WITH ORDINALITY AS t(stop_text, idx)
 ORDER BY idx DESC
 LIMIT 1) as dest_stop
```

**Issue**: PostgreSQL may evaluate SELECT clause expressions (including subqueries) before WHERE clause filtering completes, or the query optimizer may reorder operations.

### Why Previous Fixes Didn't Work:
1. Two-stage CTE filters in WHERE, but SELECT subquery might still execute
2. CASE statements can't wrap set-returning functions like `jsonb_array_elements_text`
3. Query optimizer might reorder CTE evaluation

## Research Findings

### PostgreSQL Best Practices:
1. **LATERAL Joins** - Provide explicit evaluation order guarantees
2. **Subquery in FROM** - More predictable than SELECT subquery
3. **Array Indexing** - Use `->(jsonb_array_length()-1)` with proper type checking

### Recommended Solution: LATERAL Join

**Benefits:**
- Explicit evaluation order (LATERAL is evaluated row-by-row)
- Can use WHERE clause to filter before extraction
- More predictable query execution
- Works with set-returning functions

## Implementation Plan

### Approach: Use LATERAL Join for Last Stop Extraction

**Before (Problematic):**
```sql
SELECT 
  ...,
  (SELECT stop_text FROM jsonb_array_elements_text(ab.stops) ...) as dest_stop
FROM array_bids ab
WHERE jsonb_array_length(ab.stops) >= 2
```

**After (Fixed):**
```sql
SELECT 
  ab.*,
  last_stop.stop_text as dest_stop
FROM array_bids ab
CROSS JOIN LATERAL (
  SELECT stop_text
  FROM jsonb_array_elements_text(ab.stops) WITH ORDINALITY AS t(stop_text, idx)
  WHERE jsonb_typeof(ab.stops) = 'array'  -- Safety check
  ORDER BY idx DESC
  LIMIT 1
) last_stop
WHERE jsonb_array_length(ab.stops) >= 2
```

This ensures:
- LATERAL join only executes for rows that pass WHERE clause
- Type check happens inside LATERAL subquery
- More explicit and predictable execution order

