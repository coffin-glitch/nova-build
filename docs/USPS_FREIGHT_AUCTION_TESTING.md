# USPS Freight Auction Testing Guide

## Quick Test Methods

### Method 1: Browser Test (Easiest)

1. Make sure you're logged in as admin in your browser
2. Navigate to:
   ```
   http://localhost:3000/api/usps-freight-auction/sync
   ```
3. You should see a JSON response with sync results

### Method 2: Test Script (Recommended)

```bash
# Run the test script
tsx scripts/test-usps-sync.ts
```

The script will:
- Use service key if `USPS_FA_SERVICE_KEY` is set in `.env.local`
- Otherwise, show instructions for getting session cookie
- Display detailed results

### Method 3: curl with Service Key

```bash
# Add to .env.local first:
# USPS_FA_SERVICE_KEY="your-secret-key-here"

curl -X POST http://localhost:3000/api/usps-freight-auction/sync \
  -H "x-service-key: your-secret-key-here"
```

### Method 4: curl with Session Cookie

1. **Get your Supabase session cookie:**
   - Open browser DevTools (F12)
   - Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
   - Click **Cookies** → your domain (localhost:3000)
   - Find cookie starting with `sb-` (Supabase session cookie)
   - Copy the **name** and **value**

2. **Use in curl:**
   ```bash
   curl -X POST http://localhost:3000/api/usps-freight-auction/sync \
     -H "Cookie: sb-xxxxx-auth-token=your-cookie-value-here"
   ```

## Expected Response

### Success Response:
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

### Error Response:
```json
{
  "success": false,
  "error": "Error message here",
  "details": "Detailed error (dev mode only)"
}
```

## Verify Data in Database

After a successful sync, check the database:

```sql
-- View recent USPS loads
SELECT 
  bid_number,
  distance_miles,
  origin_city || ', ' || origin_state as origin,
  destination_city || ', ' || destination_state as destination,
  pickup_timestamp,
  expires_at,
  received_at
FROM telegram_bids 
WHERE source_channel = 'usps_freight_auction' 
ORDER BY received_at DESC 
LIMIT 10;

-- Count by source
SELECT 
  source_channel,
  COUNT(*) as count,
  MAX(received_at) as latest
FROM telegram_bids 
GROUP BY source_channel;
```

## Troubleshooting

### Error: "USPS_FA_BASE_URL environment variable is not set"
- Make sure `.env.local` exists and contains all required variables
- Restart your dev server after adding env vars

### Error: "USPS_FA_COOKIE environment variable is not set"
- Get fresh cookies from browser (see setup guide)
- Cookies expire, so refresh them periodically

### Error: "HTTP error! status: 401"
- Cookie expired - get fresh cookies from browser
- Or use service key authentication

### Error: "Could not find table with id='availableLoadsTable'"
- HTML structure may have changed
- Check the actual HTML response in logs
- Parser will try to use first table as fallback

### No loads appearing in database
- Check sync endpoint response for errors
- Verify HTML structure matches expected format
- Check database logs for constraint violations

## Testing Checklist

- [ ] Environment variables set in `.env.local`
- [ ] Test script runs without errors
- [ ] Sync endpoint returns success response
- [ ] Data appears in `telegram_bids` table
- [ ] `source_channel = 'usps_freight_auction'` is set
- [ ] Loads appear in `/admin/bids` page
- [ ] No duplicate `bid_number` entries

