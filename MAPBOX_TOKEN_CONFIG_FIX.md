# Mapbox Token Configuration Fix

## Issue Found

Your token has URL restrictions, but there's a problem with the localhost URL format.

## Current URL Restrictions (Incorrect)
- ❌ `https://localhost:3000` - Wrong protocol (localhost doesn't use HTTPS)
- ❌ `localhost:3000` - Missing protocol

## Correct URL Restrictions

For local development, you need:
- ✅ `http://localhost:3000` - Correct format for local dev
- ✅ `http://localhost:*` - Or use wildcard for any port

## Recommended URL Restrictions

Update your token restrictions to:

```
http://localhost:3000
http://localhost:*
https://*.vercel.app
https://novafreight.io
https://www.novafreight.io
```

## How to Fix

1. Go to your Mapbox token settings
2. In the "URLs" section, remove:
   - `https://localhost:3000`
   - `localhost:3000`
3. Add:
   - `http://localhost:3000` (for specific port)
   - OR `http://localhost:*` (for any port - more flexible)
4. Save the token

## Token Scopes

Also verify these scopes are enabled (they should be by default for public tokens):
- ✅ `styles:read` - To load map styles
- ✅ `tiles:read` - To load vector/raster tiles (CRITICAL)
- ✅ `fonts:read` - To load map fonts
- ✅ `datasets:read` - For custom data (if used)

## Why This Matters

The 403 Forbidden errors you're seeing are likely because:
1. The URL restriction `https://localhost:3000` doesn't match `http://localhost:3000`
2. Mapbox checks the origin URL of requests
3. If the origin doesn't match any restriction, the request is blocked

## After Fixing

1. Update the URL restrictions as shown above
2. Save the token
3. Restart your development server
4. The maps should now load without 403 errors

## Alternative: Remove URL Restrictions (Less Secure)

If you want to test without restrictions:
- Remove all URL restrictions temporarily
- This allows the token to work from any origin
- **Not recommended for production** but fine for development/testing

