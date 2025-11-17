# Tampermonkey Setup Guide

## Quick Start (5 minutes)

### Step 1: Install Tampermonkey
1. Go to [Tampermonkey Chrome Extension](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
2. Click "Add to Chrome"
3. Click "Add Extension"

### Step 2: Install Nova Highway Scraper Script
1. Open Tampermonkey dashboard (click extension icon → Dashboard)
2. Click "Create a new script"
3. Delete all existing code
4. Copy the entire contents of `/public/highway-auto-scraper.user.js`
5. Paste into the editor
6. **IMPORTANT**: Configure the `API_BASE_URL` (around line 29):
   ```javascript
   // For local development (server running on localhost:3000):
   const API_BASE_URL = 'http://localhost:3000';
   
   // OR for production (when deployed to novefreight.io):
   const API_BASE_URL = 'https://novefreight.io';
   ```
   - **If your server isn't deployed yet**: Use `http://localhost:3000` (make sure your dev server is running)
   - **If your server is deployed**: Use `https://novefreight.io`
   - **See `docs/API_ACCESS_SETUP.md` for detailed options**
7. Click "File" → "Save" (or Ctrl+S / Cmd+S)

### Step 3: Use It!
1. Go to Highway.com and log in
2. Navigate to any carrier page (e.g., `https://highway.com/broker/carriers/154445`)
3. You'll see a purple "🚀 Scrape to Nova" button in the top-right
4. Click it!
5. Wait 2-3 seconds
6. ✅ Done! Data is automatically sent to your Nova health console

## How It Works

1. **Extracts Data**: The script automatically extracts:
   - MC number
   - Carrier name
   - Overview tab content (HTML)
   - Directory tab content (HTML)

2. **Sends to API**: Data is sent to `/api/admin/carrier-health/auto-scrape`

3. **Processes & Stores**: Your API:
   - Parses the HTML
   - Calculates health score
   - Stores in database

4. **Updates Console**: The health console automatically shows the new data

## Troubleshooting

### Button doesn't appear
- Make sure you're on a Highway.com carrier page
- Check that Tampermonkey is enabled (green icon)
- Refresh the page

### "Could not find MC number"
- Make sure you're on a carrier detail page (not search results)
- The page should show "MC 1234567" somewhere

### "Error scraping data"
- Make sure you're logged into Nova admin
- Check that your API is running
- Verify the `API_BASE_URL` in the script matches your server

### CORS errors
- Make sure your API allows requests from Highway.com domain
- Check your Next.js CORS configuration

## Alternative: Playwright Auto-Scrape

If you prefer fully automated (no browser interaction):

1. Use the `/api/admin/carrier-health/playwright-scrape` endpoint
2. Requires stored cookies (use the bookmarklet method first)
3. Can be called programmatically or via API

## Security Notes

- The script only runs on Highway.com pages
- It only sends data to your specified API endpoint
- No data is stored locally
- Requires admin authentication on your API

