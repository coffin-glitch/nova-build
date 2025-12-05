# USPS Freight Auction Setup Guide

## Overview

This system automatically polls the USPS Freight Auction endpoint and stores loads in the `telegram_bids` table with `source_channel = 'usps_freight_auction'`.

## Environment Variables

Add these to your `.env.local` file:

```bash
# USPS Freight Auction API Configuration
USPS_FA_BASE_URL="https://usps-aztms-fa-pr1.jdadelivers.com/base/view.x2ps"
USPS_FA_COOKIE="tmsprd293834=!TnlnFD8fUleOnGj6DR+gxaZBCtquKNKl28Nqw9dl7O0J857174NK/Gj455pcfwBltj2Y24rmrHl+kw==; JSESSIONID=BA34A39FF8C9492839AA861C7A024D5D; __cf_bm=P0LK0XaJevT37z64W0gTE_fQk0OT8oMCi8bI_l9tAXM-1764950120-1.0.1.1-cx8vvneDmPEtoiupqnPw26XN2WM8v.GUmUN8xZySqJTMfWXu5h3lp2cBw6KALP4.7Wwennolm_lAfUVmxS2fTD3_PK2fXLRx2Muvw4RlMxs; xsd-i2-cis-xsd=5532a357-e9c0-4915-ae27-be0124f205ce; xsd-by-liam-xsd=eyJlbmMiOiJBMTI4Q0JDLUhTMjU2IiwiYWxnIjoiZGlyIn0..tuyMduGFy-58VM_MMIrGjQ.wa1qSxa-JChemRvmVBAx5D_EU_8InAbXVm09_kSjq0Y-u7hWP4ew0uWXx7_ZphonLuSmsVuJfe_B-HqMazyWKa8QG9JwI-MRs1ZDVNhYPS2ABznqXWfxkvC6K9Lfso_JOG_Bme7ayDXQgS82gCf63TWOFQzY2NHABjKj2-1ddahXBu9VMtBMuBa6kGReTOxWygRuphxagQgX0VjpDQ2cMixkkqpcWbYqXm2snB_osC9QQBfPbYgYKlKWGzvlpkRXBzdZBfDZgbe_G9hAI2mqpI2RcuCUNUOmA7mMYMYu5Jzr3AIZ2csybeM4MqVS0Pdk.VJZVXP-reHUrTyZH1jqNVw"
USPS_FA_USER_AGENT="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
USPS_FA_REFERER="https://usps-aztms-sso-pr1.jdadelivers.com/tm/framework/Frame.jsp"
USPS_FA_CONTENT_TYPE="text/xml"

# Optional: Service key for cron job authentication
# Generate a secure random string for this
USPS_FA_SERVICE_KEY="your-secret-service-key-here"
```

**Note**: The cookies above are example values. You'll need to get fresh cookies from your browser session. Cookies expire, so you may need to update them periodically.

## Getting the Cookie

1. Open your browser and navigate to the USPS Freight Auction page
2. Open Developer Tools (F12)
3. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
4. Click on **Cookies** in the left sidebar
5. Select `usps-aztms-fa-pr1.jdadelivers.com`
6. Copy all cookies in the format: `name1=value1; name2=value2; name3=value3`
7. Paste it into `USPS_FA_COOKIE` in `.env.local`

**Alternative Method (Network Tab)**:
1. Open Developer Tools (F12)
2. Go to **Network** tab
3. Make a request to the Freight Auction page
4. Find the request to `view.x2ps`
5. Click on it and go to **Headers** section
6. Find the `Cookie` header in Request Headers
7. Copy the entire cookie string
8. Paste it into `USPS_FA_COOKIE` in `.env.local`

**Cookie Format**:
The cookie string should look like:
```
tmsprd293834=value1; JSESSIONID=value2; __cf_bm=value3; xsd-i2-cis-xsd=value4; xsd-by-liam-xsd=value5
```

**Important**: Cookies expire! If you get 401 errors, refresh your browser session and get new cookies.

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

