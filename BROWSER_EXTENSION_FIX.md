# Fixing Browser Extension Interference with Supabase

## Problem
The "Failed to fetch" error is being caused by a Chrome extension (`chrome-extension://dbjbempljhcmhlfpfacalomonjpalpko`) intercepting fetch requests. This can cause Supabase API calls to fail.

## Solution Options

### Option 1: Test in Incognito Mode (Quick Fix)
1. Open Chrome in incognito mode (Cmd+Shift+N on Mac, Ctrl+Shift+N on Windows)
2. Navigate to `http://localhost:3000/sign-up`
3. Try signing up - it should work without extension interference

### Option 2: Disable Problematic Extensions
1. Go to `chrome://extensions/`
2. Disable extensions one by one to identify the problematic one
3. The extension ID `dbjbempljhcmhlfpfacalomonjpalpko` might be a CORS or network inspector

### Option 3: Configure Custom Fetch (Implemented)
- Added custom fetch wrapper to Supabase client
- Ensures proper headers are set
- Catches and logs fetch errors for debugging

## Technical Details

The Chrome extension is intercepting `window.fetch`, which causes all fetch requests (including Supabase) to fail. Our custom fetch wrapper helps by:
- Setting proper headers (apikey, Content-Type)
- Catching errors for better debugging
- Ensuring requests go through correctly

## Next Steps

1. **Immediate**: Try signing up in incognito mode to confirm it's extension-related
2. **Short-term**: Disable or configure the problematic extension
3. **Long-term**: The custom fetch wrapper should help, but browser extensions can still interfere

## Debug Checklist

- [ ] Test in incognito mode
- [ ] Check browser console for CSP violations
- [ ] Verify Supabase URL is accessible (test with curl)
- [ ] Check Network tab to see actual requests/responses
- [ ] Look for extension-related errors in console



