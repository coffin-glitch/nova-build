-- Migration: Audit and fix all archived_at timestamps
-- Description: Check for mismatches and fix all archived_at values to follow UTC best practices

-- Step 1: Show current state of archived_at vs received_at
-- This will help identify mismatches
SELECT 
  'Current State' as status,
  COUNT(*) FILTER (WHERE archived_at IS NOT NULL) as total_archived,
  COUNT(*) FILTER (WHERE archived_at::date != (received_at::date + 1)) as mismatched_dates,
  MIN(received_at::date) as earliest_received,
  MAX(received_at::date) as latest_received,
  MIN(archived_at::date) as earliest_archived,
  MAX(archived_at::date) as latest_archived
FROM telegram_bids
WHERE archived_at IS NOT NULL;

-- Step 2: Fix all archived_at values to be (received_at + 1 day + 04:59:59 UTC)
-- This represents the end of day in CDT timezone
UPDATE telegram_bids
SET archived_at = (received_at::date + INTERVAL '1 day' + INTERVAL '4 hours 59 minutes 59 seconds')
WHERE archived_at IS NOT NULL
  AND is_archived = true;

-- Step 3: Verify the fix
SELECT 
  'After Fix' as status,
  COUNT(*) FILTER (WHERE archived_at IS NOT NULL) as total_archived,
  COUNT(*) FILTER (WHERE archived_at::date != (received_at::date + 1)) as mismatched_dates,
  MIN(received_at::date) as earliest_received,
  MAX(received_at::date) as latest_received,
  MIN(archived_at::date) as earliest_archived,
  MAX(archived_at::date) as latest_archived
FROM telegram_bids
WHERE archived_at IS NOT NULL;

-- Step 4: Show some examples of the corrected dates
SELECT 
  received_at::date as received_date,
  archived_at::date as archived_date,
  archived_at,
  DATE(archived_at AT TIME ZONE 'America/Chicago') as archived_date_cdt,
  COUNT(*) as bid_count
FROM telegram_bids
WHERE archived_at IS NOT NULL
GROUP BY received_at::date, archived_at::date, archived_at
ORDER BY received_at::date DESC
LIMIT 10;

