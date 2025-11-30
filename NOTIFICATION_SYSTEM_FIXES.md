# Notification System Analysis & Fixes

## Test Results Analysis

### Expected Notifications:
1. **#888880001** - State Match (IL → MN) - CHICAGO, IL → MINNEAPOLIS, MN
2. **#888880002** - Exact Match (PA → KS) - HARRISBURG, PA → OLATHE, KS ✅
3. **#888880003** - State Match (OH → TX) - AKRON, OH → IRVING, TX ✅

### Actual Results:
- ✅ **#888880002** - Exact Match sent successfully
- ✅ **#888880003** - State Match sent successfully (as similar_load)
- ❌ **#888880001** - State Match NOT sent (missing notification)

### Issues Identified:

#### 1. Missing State Match Notification (#888880001)
**Problem**: Trigger 55 (bid 93514000: FOREST PARK, IL → MINNEAPOLIS, MN) did not find test bid #888880001 (CHICAGO, IL → MINNEAPOLIS, MN) even though both are IL → MN state matches.

**Root Cause**: 
- State match queries were using exact route matching (`LIKE %origin% AND LIKE %destination%`) instead of state-based matching
- When `matchType === 'state'`, the system should match by states (IL → MN), not exact cities

**Fix Applied**:
- Updated state match queries to use state-based regex matching
- Extract states from favorite route (origin state and destination state)
- Match new bids where:
  - First stop contains origin state
  - Last stop contains destination state
- Works for both distance-range and non-distance-range state matches

#### 2. Batch Email API Error
**Problem**: `TypeError: data?.filter is not a function` when processing batch emails

**Root Cause**: 
- Resend batch API response structure is not always an array
- Code assumed `data` was always an array and called `.filter()` directly
- Response might be an object with nested data or different structure

**Fix Applied**:
- Added type checking: `Array.isArray(data)` before using array methods
- Handle multiple response formats:
  - Direct array: `data = [...]`
  - Nested object: `data = { data: [...] }` or `data = { results: [...] }`
  - Object values: Convert to array if needed
- Better error handling and logging for unexpected formats
- Graceful fallback if response format is unexpected

## Code Changes

### 1. Fixed State Match Query (`workers/notification-worker.ts`)

**Before**:
```sql
-- Used exact route matching even for state matches
(tb.stops::text LIKE '%origin%' AND tb.stops::text LIKE '%destination%')
```

**After**:
```sql
-- State-based matching using regex
(
  (tb.stops->>0 ~* (',\s*' || ${favoriteOriginState} || '(\s|$)'))
  OR
  (tb.stops->>0 ~* ('\s+' || ${favoriteOriginState} || '$'))
)
AND
(
  (tb.stops->>jsonb_array_length(tb.stops)-1 ~* (',\s*' || ${favoriteDestState} || '(\s|$)'))
  OR
  (tb.stops->>jsonb_array_length(tb.stops)-1 ~* ('\s+' || ${favoriteDestState} || '$'))
)
```

### 2. Fixed Batch Email Response Handling (`lib/email/notify.ts`)

**Before**:
```typescript
const sent = data?.length || 0;
const failedEmails = data?.filter((result: any) => result.error) || [];
```

**After**:
```typescript
let sent = 0;
let failed = emails.length;
const failedEmails: any[] = [];

if (data) {
  if (Array.isArray(data)) {
    sent = data.length;
    // Process array...
  } else if (typeof data === 'object') {
    // Handle nested structures
    const dataArray = Array.isArray(data.data) ? data.data : 
                     Array.isArray(data.results) ? data.results :
                     Object.values(data);
    // Process...
  }
}
```

## Expected Behavior After Fixes

1. **State Matches Work Correctly**:
   - IL → MN routes will match regardless of specific cities
   - CHICAGO, IL → MINNEAPOLIS, MN will match FOREST PARK, IL → MINNEAPOLIS, MN
   - State-based matching works for both distance-range and non-distance-range triggers

2. **Batch Emails Work Reliably**:
   - No more `filter is not a function` errors
   - Handles various Resend API response formats
   - Better error logging for debugging

## Testing Recommendations

1. **Re-test with same bids** to verify #888880001 now triggers
2. **Monitor batch email logs** for improved error messages
3. **Test with various state combinations** to ensure state matching works correctly
4. **Verify batch email sending** with multiple notifications simultaneously

