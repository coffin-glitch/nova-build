# Mapbox 403 Forbidden Error - Troubleshooting

## Issue
Getting `403 Forbidden` errors when loading Mapbox vector tiles:
```
https://api.mapbox.com/v4/mapbox.mapbox-streets-v8,.../vector.pbf?...
Status: 403 Forbidden
```

## Possible Causes

### 1. Token Scopes/Permissions
Your Mapbox token might not have the required scopes for vector tiles.

**Solution:**
1. Go to [Mapbox Account Tokens](https://account.mapbox.com/access-tokens/)
2. Check your token's scopes - it should have:
   - `styles:read`
   - `fonts:read`
   - `datasets:read`
   - `tiles:read` (for vector tiles)
3. If missing, create a new token with all required scopes

### 2. Account Restrictions
Your Mapbox account might have restrictions or be on a free tier with limits.

**Check:**
- Account status in Mapbox dashboard
- Usage limits
- Billing status

### 3. CSP Configuration
Content Security Policy might be blocking vector tile requests.

**Fixed in middleware.ts:**
- Added `https://*.tiles.mapbox.com` to `connect-src`
- Added Mapbox domains to `img-src` for tile images
- Added Mapbox to `script-src` and `worker-src`

### 4. Token Type
Make sure you're using a **public token** (starts with `pk.`) not a secret token.

**Current token:** `pk.eyJ1IjoiZHVrZTEyNDY4IiwiYSI6ImNtaTJyc2huMjB2dWoya3ExbGlvejA5ZWEifQ.r_HE1yvq_w5ggZHFMKNdIw`
✅ This is a public token (correct)

## Verification Steps

1. **Test token directly:**
   ```bash
   curl "https://api.mapbox.com/tokens/v2?access_token=YOUR_TOKEN"
   ```
   Should return token info

2. **Test style access:**
   ```bash
   curl "https://api.mapbox.com/styles/v1/mapbox/light-v11?access_token=YOUR_TOKEN" -I
   ```
   Should return HTTP 200

3. **Check token in Mapbox dashboard:**
   - Go to https://account.mapbox.com/access-tokens/
   - Verify token is active
   - Check scopes/permissions
   - Verify no restrictions

## Solutions Applied

✅ Updated CSP to allow:
- `https://api.mapbox.com`
- `https://*.mapbox.com`
- `https://*.tiles.mapbox.com` (for vector tiles)

✅ Added Mapbox to:
- `connect-src` (for API calls and vector tiles)
- `img-src` (for tile images)
- `script-src` (for Mapbox GL JS)
- `worker-src` (for Web Workers)

## Next Steps

1. **Restart server** to apply CSP changes
2. **Check Mapbox dashboard** for token scopes
3. **Create new token** if current one lacks required scopes:
   - Go to https://account.mapbox.com/access-tokens/
   - Click "Create a token"
   - Select all scopes (or at minimum: styles:read, tiles:read)
   - Update `.env.local` with new token
   - Restart server

4. **Verify account status:**
   - Check if account is active
   - Verify billing/payment method
   - Check usage limits

## If Issue Persists

1. Create a new token with full permissions
2. Verify account isn't restricted
3. Check Mapbox status page: https://status.mapbox.com/
4. Contact Mapbox support if needed

## Token Requirements for Maps

Minimum required scopes:
- ✅ `styles:read` - To load map styles
- ✅ `tiles:read` - To load vector/raster tiles
- ✅ `fonts:read` - To load map fonts
- ✅ `datasets:read` - For custom data (if used)

Your token appears valid, but may need additional scopes for vector tiles.

