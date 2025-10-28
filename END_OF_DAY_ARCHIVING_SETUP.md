# End of Day Archiving Setup Guide

## Current Status
- ✅ Function created: `set_end_of_day_archived_timestamps()`
- ✅ API endpoint: `/api/archive-bids/end-of-day`
- ✅ Manual button: "Archive End of Day" in admin panel
- ❌ Automated scheduling: Not yet configured

## Option 1: Supabase pg_cron (Recommended if available)

If your Supabase instance has pg_cron enabled:

1. Run the migration:
```bash
psql "YOUR_SUPABASE_CONNECTION_STRING" -f db/migrations/039_schedule_end_of_day_archiving.sql
```

2. Verify the job was created:
```sql
SELECT * FROM cron.job WHERE jobname = 'end-of-day-archive';
```

3. Check if pg_cron is enabled:
```sql
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_cron';
```

If you get no results, pg_cron is not available on your Supabase plan.

## Option 2: Railway Cron Job

Since your Telegram forwarder is running on Railway, you can add a cron job there:

1. In your Railway service, add a new service or modify `railway-service/package.json`:
```json
{
  "scripts": {
    "end-of-day-cron": "node -e \"require('https').request('https://YOUR-VERCEL-URL.vercel.app/api/archive-bids/end-of-day', {method:'POST', headers: {'Authorization': 'Bearer YOUR_SECRET_TOKEN'}}, (r) => r.on('data', d => process.stdout.write(d))).end()\""
  }
}
```

2. Add a cron schedule to your `railway.toml`:
```toml
[[cron]]
command = "npm run end-of-day-cron"
schedule = "59 23 * * *"  # Run at 23:59 daily
```

## Option 3: Vercel Cron Jobs

If you're using Vercel, create a `vercel.json` cron configuration:

```json
{
  "crons": [{
    "path": "/api/archive-bids/end-of-day",
    "schedule": "59 23 * * *"
  }]
}
```

## Option 4: Manual Trigger (Current Setup)

The "Archive End of Day" button in the admin panel (`/admin/archive-bids`) can be clicked manually at the end of each day to archive today's bids.

## How It Works

1. **During the day (2025-10-26)**: Bids are received and stored in `telegram_bids`
2. **After 25 minutes**: Bids expire and are moved to `archived_bids` with `archived_at = NULL`
3. **At 23:59:59**: The `set_end_of_day_archived_timestamps()` function runs:
   - Sets `archived_at = current_date + 23:59:59`
   - Only for bids where `archived_at IS NULL` and `received_at` is today
4. **Next day**: Archived bids appear in the archive timeline with proper dates

## Function Details

The function `set_end_of_day_archived_timestamps()`:
- Finds all bids in `archived_bids` where `archived_at IS NULL`
- Sets `archived_at` to 23:59:59 of the received date
- Returns the count of updated bids

This ensures:
- Bids are visible in "expired bids" during the day
- At end of day, they get a proper archival timestamp
- Archive timeline groups bids by received date

## Testing

To test manually:
```bash
curl -X POST http://localhost:3000/api/archive-bids/end-of-day
```

Or click the "Archive End of Day" button in the admin panel.

