# Fixing Mapbox 403 Forbidden Errors

## Current Issue

You're getting `403 Forbidden` errors when trying to load Mapbox vector tiles:
```
GET https://api.mapbox.com/v4/mapbox.mapbox-streets-v8,.../vector.pbf?... 403 (Forbidden)
```

## Root Cause

The 403 errors are caused by **token URL restrictions** that don't match your local development URL.

## The Problem

Your token has these URL restrictions:
- ❌ `https://localhost:3000` - **WRONG** (localhost doesn't use HTTPS)
- ❌ `localhost:3000` - **WRONG** (missing protocol)
- ✅ `https://*.vercel.app` - Correct
- ✅ `https://novafreight.io` - Correct
- ✅ `https://www.novafreight.io` - Correct

Your app runs on: `http://localhost:3000` (HTTP, not HTTPS)

## Solution

### Step 1: Fix URL Restrictions in Mapbox Dashboard

1. Go to https://account.mapbox.com/access-tokens/
2. Click on your token to edit it
3. In the "URLs" section:
   - **Remove:**
     - `https://localhost:3000`
     - `localhost:3000`
   - **Add:**
     - `http://localhost:3000` (with `http://`, not `https://`)
     - OR `http://localhost:*` (for any port - more flexible)
4. **Save** the token

### Step 2: Verify Token Scopes

Make sure your token has these scopes enabled (they should be by default):
- ✅ `styles:read` - To load map styles
- ✅ `tiles:read` - **CRITICAL** - To load vector/raster tiles
- ✅ `fonts:read` - To load map fonts
- ✅ `datasets:read` - For custom data (if used)

### Step 3: Test

1. **No need to restart server** - token is checked on each request
2. **Hard refresh** your browser (Cmd+Shift+R / Ctrl+Shift+R)
3. Check Network tab - 403 errors should be gone
4. Maps should now load properly

## Alternative: Remove URL Restrictions (For Testing)

If you want to test without restrictions temporarily:

1. Go to token settings
2. **Remove all URL restrictions**
3. Save token
4. Test maps
5. **Re-add restrictions** before deploying to production

⚠️ **Warning:** Removing restrictions is less secure but fine for local development/testing.

## Why This Happens

Mapbox checks the **origin URL** (where the request comes from) against your token's URL restrictions. If they don't match exactly, the request is blocked with a 403 error.

- Your app: `http://localhost:3000`
- Token allows: `https://localhost:3000` ❌ (doesn't match)
- Token allows: `localhost:3000` ❌ (doesn't match)
- Token allows: `http://localhost:3000` ✅ (matches!)

## After Fixing

Once you update the URL restrictions:
- ✅ Vector tiles will load (no more 403 errors)
- ✅ Maps will display properly
- ✅ Route visualization will work
- ✅ Live map console will show bids

## CSS Warning Fix

I've also added the Mapbox CSS import globally in `globals.css` to fix the "missing CSS" warning.

