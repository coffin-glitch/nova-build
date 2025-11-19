# Mapbox 403 Forbidden Error Fix

## Issue
You're seeing 403 Forbidden errors for Mapbox tile requests:
```
GET https://api.mapbox.com/v4/mapbox.mapbox-streets-v8,...vector.pbf?... 403 (Forbidden)
```

## Root Cause
This is caused by **URL restrictions** on your Mapbox access token in the Mapbox dashboard. The token is configured to only work with specific URLs, and `http://localhost:3000` is not included in the allowed list.

## Solution

### Step 1: Go to Mapbox Dashboard
1. Log in to [Mapbox Account](https://account.mapbox.com/)
2. Navigate to **Access Tokens** section
3. Find your token (the one starting with `pk.eyJ1IjoiZHVrZTEyNDY4IiwiYSI6ImNtaTJyc2huMjB2dWoya3ExbGlvejA5ZWEifQ...`)

### Step 2: Update URL Restrictions
1. Click on your token to edit it
2. In the **URL restrictions** section, make sure you have:
   - `http://localhost:3000` (for local development)
   - `https://your-production-domain.com` (for production)
   
   **Important:** 
   - Use `http://` (not `https://`) for localhost
   - Do NOT include `https://localhost:3000` or just `localhost:3000` without the protocol
   - You can add multiple URLs, one per line

### Step 3: Verify Token Scopes
Ensure your token has the following scopes enabled:
- ✅ `styles:read` - Required for loading map styles
- ✅ `tiles:read` - Required for loading vector tiles
- ✅ `fonts:read` - Required for map fonts
- ✅ `datasets:read` - Required if using custom datasets

### Step 4: Save and Test
1. Click **Save** in the Mapbox dashboard
2. Wait a few seconds for changes to propagate
3. Refresh your browser (hard refresh: Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
4. The 403 errors should be resolved

## Alternative: Remove URL Restrictions (Not Recommended for Production)
If you're in development and want to test quickly, you can temporarily remove all URL restrictions. However, **this is not recommended for production** as it makes your token less secure.

## Verification
After updating the token, you should see:
- ✅ No more 403 errors in the browser console
- ✅ Map tiles loading successfully
- ✅ Maps displaying correctly

## Notes
- Token changes can take a few seconds to propagate
- Make sure you're using the correct token in your `.env.local` file
- The token should be set as `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` or `NEXT_PUBLIC_MAPBOX_TOKEN`

