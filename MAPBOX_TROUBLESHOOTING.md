# Mapbox Troubleshooting Guide

## "Failed to fetch" Error

If you're seeing `Failed to fetch https://api.mapbox.com/styles/v1/mapbox/light-v11?...` errors:

### Common Causes

1. **Network/Timing Issues**
   - The error may be transient and the map may still load
   - Check if the map actually displays despite the error
   - Our code includes automatic retry logic (up to 2 retries)

2. **Token Issues**
   - Verify your token is set in `.env.local`:
     ```
     NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_token_here
     # OR
     NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here
     ```
   - Restart the server after adding/changing the token
   - Ensure the token has proper scopes (Styles API access)

3. **Browser Extensions**
   - Ad blockers or privacy extensions may block Mapbox requests
   - Try disabling extensions or using incognito mode

4. **CORS Issues**
   - Mapbox allows CORS by default, but check browser console for CORS errors
   - Our code includes `transformRequest` to handle this

5. **Next.js Environment Variables**
   - Variables must be prefixed with `NEXT_PUBLIC_` to be available client-side
   - Server must be restarted after adding/changing env vars

### Solutions Implemented

1. **Error Handling**: Added comprehensive error logging
2. **Retry Logic**: Automatic retry (up to 2 attempts) with exponential backoff
3. **Container Check**: Verifies map container is ready before initialization
4. **Transform Request**: Handles CORS and request transformation

### Testing

1. Check browser console for detailed error messages
2. Verify the map actually displays (error may be non-blocking)
3. Check Network tab to see if the request succeeds on retry
4. Try hard refresh (Cmd+Shift+R / Ctrl+Shift+R) to clear cache

### If Error Persists

1. **Verify Token**: Test token directly:
   ```bash
   curl "https://api.mapbox.com/styles/v1/mapbox/light-v11?access_token=YOUR_TOKEN" -I
   ```
   Should return HTTP 200

2. **Check Token Scopes**: Ensure token has:
   - `styles:read` scope
   - Public token (starts with `pk.`)

3. **Update Mapbox GL JS**: Try updating to latest version:
   ```bash
   npm install mapbox-gl@latest
   ```

4. **Use Alternative Style**: If v11 styles fail, we can fallback to older styles

### Current Implementation

- Uses `mapbox://styles/mapbox/light-v11` (light theme)
- Uses `mapbox://styles/mapbox/dark-v11` (dark theme)
- Includes error handling and retry logic
- Verifies container readiness before initialization

The error may be non-critical - check if maps actually display!

