# DST Archive Impact Analysis

## Problem Summary

**Date:** November 2, 2025 - Daylight Saving Time ended (clocks rolled back 1 hour)

**Issue:** Archiving is off by 1 hour for bids archived after Nov 2, 2025

## Root Cause

The archiving system hardcodes `04:59:59 UTC` to represent `23:59:59` in Chicago time:

### During CDT (Before Nov 2, 2025):
- **CDT = UTC-5** (Daylight Saving Time)
- `04:59:59 UTC` = `23:59:59 CDT` ✅ **CORRECT**

### During CST (After Nov 2, 2025):
- **CST = UTC-6** (Standard Time)
- `04:59:59 UTC` = `22:59:59 CST` ❌ **WRONG (1 hour early!)**
- Should be: `05:59:59 UTC` = `23:59:59 CST` ✅

## Impact Assessment

### Affected Bids:
- Bids archived **after Nov 2, 2025** are archived 1 hour early
- Their `archived_at` shows `22:59:59 CST` instead of `23:59:59 CST`
- This may cause them to appear in the wrong day when filtering by date

### Existing Data:
- Bids archived **before Nov 2, 2025** are correct (using CDT)
- No data corruption - just incorrect timestamps for post-DST bids

## Current Hardcoded Values

Found in multiple places:
1. `app/api/archive-bids/end-of-day/route.ts` - Line 79, 93
2. `db/migrations/046_fix_archived_at_timestamps.sql` - Line 30, 42
3. Comments/documentation referencing `04:59:59 UTC`

## Solution: Dynamic Timezone-Aware Calculation

Instead of hardcoding the UTC offset, use PostgreSQL's timezone conversion:

```sql
-- Dynamically calculate UTC time that equals 23:59:59 in Chicago
(target_date AT TIME ZONE 'America/Chicago' + INTERVAL '23 hours 59 minutes 59 seconds') AT TIME ZONE 'UTC'
```

This automatically:
- ✅ Uses `04:59:59 UTC` during CDT (summer)
- ✅ Uses `05:59:59 UTC` during CST (winter)
- ✅ Handles DST transitions seamlessly
- ✅ Works for any date, past or future

## Migration Strategy

1. **Fix the database function** - Update `set_end_of_day_archived_timestamps()`
2. **Fix the API endpoint** - Update `/api/archive-bids/end-of-day`
3. **Fix the reset function** - Update `/api/archive-bids/reset-archived-at`
4. **Optional: Correct existing data** - Create a one-time migration to fix bids archived between Nov 2-5, 2025

## Future-Proofing

This fix will automatically handle:
- ✅ Spring forward (March 9, 2026) - DST starts again
- ✅ Fall back (November 1, 2026) - DST ends again
- ✅ All future DST transitions

