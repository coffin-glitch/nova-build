# Highway.com Automation Options

## Overview
This document outlines different approaches to automate data extraction from Highway.com for carrier health checks.

## Current State
- ✅ Playwright setup with cookie storage
- ✅ Manual copy-paste process
- ❌ No automatic scraping

---

## Option 1: Tampermonkey Userscript (⭐ RECOMMENDED)

### Pros:
- ✅ Works with authenticated sessions (uses your logged-in browser)
- ✅ No server-side overhead
- ✅ Simple to use - just install extension and script
- ✅ Can extract data and send directly to your API
- ✅ Free and open-source
- ✅ Works on any browser (Chrome, Firefox, Edge)

### Cons:
- ⚠️ Requires user to be logged into Highway.com
- ⚠️ Requires one-click activation per carrier

### How It Works:
1. User installs Tampermonkey extension
2. User installs our custom userscript
3. User navigates to Highway.com carrier page
4. User clicks a button in the page → automatically extracts data
5. Data is sent to your API endpoint
6. Health console updates automatically

### Implementation Complexity: ⭐⭐ (Easy)

---

## Option 2: Enhanced Playwright with Persistent Browser

### Pros:
- ✅ Fully automated (no user interaction)
- ✅ Can run on schedule
- ✅ Server-side control
- ✅ Already have infrastructure

### Cons:
- ❌ Requires maintaining browser session
- ❌ More complex cookie management
- ❌ Higher server resource usage
- ❌ May need to handle re-authentication

### How It Works:
1. Keep Playwright browser context alive
2. Periodically refresh cookies from database
3. Navigate to carrier pages automatically
4. Extract data and store

### Implementation Complexity: ⭐⭐⭐⭐ (Complex)

---

## Option 3: Custom Chrome Extension

### Pros:
- ✅ Professional solution
- ✅ Can be published to Chrome Web Store
- ✅ Works with authenticated sessions
- ✅ Can add UI elements to Highway.com

### Cons:
- ❌ Requires Chrome Web Store approval
- ❌ More development time
- ❌ Need to maintain extension updates
- ❌ Users must install extension

### Implementation Complexity: ⭐⭐⭐⭐ (Complex)

---

## Option 4: Hybrid: Tampermonkey + Enhanced Playwright

### Pros:
- ✅ Best of both worlds
- ✅ Tampermonkey for manual/on-demand scraping
- ✅ Playwright for scheduled/automated scraping
- ✅ Fallback options

### Cons:
- ⚠️ Need to maintain both systems

### Implementation Complexity: ⭐⭐⭐ (Moderate)

---

## Recommendation: **Option 1 (Tampermonkey) + Option 2 (Enhanced Playwright)**

### Why This Hybrid Approach?

1. **Tampermonkey for Manual/On-Demand:**
   - When admin needs immediate data
   - One-click extraction from browser
   - Uses admin's authenticated session
   - No server resources needed

2. **Enhanced Playwright for Automated:**
   - Scheduled health checks
   - Bulk carrier updates
   - Background processing
   - No user interaction needed

### Implementation Plan:

#### Phase 1: Tampermonkey Userscript (Quick Win)
- Create userscript that extracts Overview + Directory data
- Add button to Highway.com pages
- Send data to `/api/admin/carrier-health/store`
- **Time: 2-3 hours**

#### Phase 2: Enhanced Playwright API
- Create `/api/admin/carrier-health/auto-scrape` endpoint
- Accept MC number or carrier URL
- Use stored cookies to authenticate
- Extract and parse data automatically
- **Time: 4-6 hours**

#### Phase 3: Scheduled Jobs (Optional)
- Set up cron job for periodic updates
- Update carriers on schedule
- **Time: 2-3 hours**

---

## Alternative: Third-Party Tools

### Web Scraper Extension
- **Web Scraper** (Chrome Extension)
  - Point-and-click interface
  - Can export to CSV/JSON
  - ⚠️ Still requires manual setup per carrier
  - ⚠️ Doesn't integrate directly with your API

### Data Miner
- Pre-built templates
- ⚠️ Limited customization
- ⚠️ No direct API integration

### Octoparse
- Desktop application
- More powerful but paid
- ⚠️ Overkill for this use case

---

## Final Recommendation

**Start with Tampermonkey Userscript** because:
1. ✅ Fastest to implement (2-3 hours)
2. ✅ Works immediately with existing auth
3. ✅ No server changes needed
4. ✅ Users can trigger on-demand
5. ✅ Can add Playwright automation later

Then add **Enhanced Playwright** for:
- Scheduled updates
- Bulk operations
- Background processing

---

## Next Steps

1. Implement Tampermonkey userscript
2. Test with real Highway.com data
3. Add "Auto-Scrape" button to health console
4. Implement Playwright auto-scrape endpoint
5. Add scheduled job (optional)

