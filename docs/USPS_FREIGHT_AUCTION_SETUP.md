# USPS Freight Auction Setup Guide

## Overview

This system automatically polls the USPS Freight Auction endpoint and stores loads in the `telegram_bids` table with `source_channel = 'usps_freight_auction'`.

## Environment Variables

Add these to your `.env.local` file:

```bash
# USPS Freight Auction API Configuration
USPS_FA_BASE_URL="https://usps-aztms-fa-pr1.jdadelivers.com/base/view.x2ps"
USPS_FA_COOKIE="JSESSIONID=...; other_cookies_here=..."
USPS_FA_USER_AGENT="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
USPS_FA_REFERER="https://usps-aztms-sso-pr1.jdadelivers.com/tm/framework/Frame.jsp"
USPS_FA_CONTENT_TYPE="text/xml"

# Optional: Service key for cron job authentication
USPS_FA_SERVICE_KEY="your-secret-service-key-here"
```

## Getting the Cookie

1. Open your browser and navigate to the USPS Freight Auction page
2. Open Developer Tools (F12)
3. Go to Network tab
4. Make a request to the Freight Auction page
5. Find the request to `view.x2ps`
6. Copy the `Cookie` header value
7. Paste it into `USPS_FA_COOKIE` in `.env.local`

## Manual Testing

### Test the Sync Endpoint

```bash
# Using curl (with admin authentication)
curl -X POST http://localhost:3000/api/usps-freight-auction/sync \
  -H "Cookie: your-admin-session-cookie"

# Or using GET (requires admin auth)
curl http://localhost:3000/api/usps-freight-auction/sync \
  -H "Cookie: your-admin-session-cookie"
```

### Verify Data in Database

```sql
-- Check USPS loads
SELECT * FROM telegram_bids 
WHERE source_channel = 'usps_freight_auction' 
ORDER BY received_at DESC 
LIMIT 10;

-- Count by source
SELECT source_channel, COUNT(*) 
FROM telegram_bids 
GROUP BY source_channel;
```

## Setting Up Cron Job

### Option 1: Vercel Cron (if deployed on Vercel)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/usps-freight-auction/sync",
      "schedule": "*/5 * * * * *"
    }
  ]
}
```

### Option 2: External Cron Service

Use a service like cron-job.org or GitHub Actions to call:
```
POST https://your-domain.com/api/usps-freight-auction/sync
Headers:
  x-service-key: your-secret-service-key-here
```

### Option 3: Node.js Script (for local/testing)

Create `scripts/usps-sync-cron.ts`:

```typescript
import { config } from 'dotenv';
config({ path: '.env.local' });

async function runSync() {
  const serviceKey = process.env.USPS_FA_SERVICE_KEY;
  const response = await fetch('http://localhost:3000/api/usps-freight-auction/sync', {
    method: 'POST',
    headers: {
      'x-service-key': serviceKey || '',
    },
  });
  
  const result = await response.json();
  console.log('Sync result:', result);
}

// Run every 5 seconds (for testing)
setInterval(runSync, 5000);
runSync(); // Run immediately
```

## Monitoring

### Check Sync Status

The sync endpoint returns:
```json
{
  "success": true,
  "totalPages": 3,
  "totalLoads": 40,
  "newLoads": 5,
  "updatedLoads": 35,
  "errors": [],
  "durationMs": 1234
}
```

### View Logs

Check console logs for:
- `[USPS Client]` - HTTP client operations
- `[USPS Parser]` - HTML parsing operations
- `[USPS DB]` - Database operations
- `[USPS Sync]` - Sync endpoint operations

## Troubleshooting

### Error: "USPS_FA_BASE_URL environment variable is not set"
- Make sure `.env.local` exists and contains `USPS_FA_BASE_URL`

### Error: "USPS_FA_COOKIE environment variable is not set"
- Get the cookie from browser DevTools (see "Getting the Cookie" above)

### Error: "HTTP error! status: 401"
- Cookie may have expired. Get a fresh cookie from the browser.

### Error: "Could not find table with id='availableLoadsTable'"
- The HTML structure may have changed. Check the actual HTML response.
- The parser will try to use the first table as fallback.

### No loads appearing in database
- Check that the sync endpoint is being called successfully
- Verify the HTML structure matches expected format
- Check database logs for errors

## Data Format

USPS loads are stored in `telegram_bids` with:
- `bid_number` = USPS Load ID
- `source_channel` = 'usps_freight_auction'
- `distance_miles` = Parsed from distance string
- `pickup_timestamp` = Parsed from start datetime
- `stops` = JSONB array: `["Origin City, State", "Destination City, State"]`
- `tag` = State tag (from origin/destination)
- `expires_at` = Calculated from `received_at + round_ends_minutes`

## Integration with Existing UI

USPS loads automatically appear in:
- `/admin/bids` - Admin bid board
- `/bid-board` - Carrier bid board

Filter by source:
- `?sourceChannel=usps_freight_auction` - Only USPS loads
- `?sourceChannel=telegram` - Only Telegram loads
- No filter - All loads

