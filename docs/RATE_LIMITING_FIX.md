# Rate Limiting Fix - Reduce Refresh Intervals

## Problem
Supabase is returning "ThrottlerException: Too Many Requests" errors because the application has **39 different SWR refresh intervals** polling the database aggressively:

### Current Intervals:
- **5 seconds**: 8 instances (admin/bids, bid-board live data, conversation messages)
- **10 seconds**: 10 instances (admin users, carrier favorites, my-loads, etc.)
- **30 seconds**: 8 instances
- **60 seconds**: 3 instances

**Problem**: Multiple pages open simultaneously = hundreds of requests per minute

---

## Recommended Fixes

### 1. **Keep 5 seconds ONLY for truly live data**
- ✅ `/bid-board` page (live auctions)
- ❌ All others → Increase to 30+ seconds

### 2. **Increase intervals for background data**
- **Stats/Analytics**: 60-120 seconds (not critical real-time)
- **Archive data**: 60+ seconds (historical data)
- **User lists**: 60+ seconds (doesn't change often)
- **Notifications**: 30-60 seconds (sufficient for alerts)

### 3. **Add conditional refresh**
- Only refresh when tab is active
- Stop refreshing when tab is background
- Use `refreshInterval: isVisible ? interval : 0`

---

## Implementation Strategy

### Priority 1: High-frequency Pages (5s → 30s)
**Files to fix**:
- `app/admin/bids/AdminBiddingConsole.tsx` - Line 80, 1242, 1250, 1256
- `app/admin/users/AdminUsersConsole.tsx` - Line 131
- `app/admin/messages/AdminMessagesClient.tsx` - Line 68

### Priority 2: Medium-frequency Pages (10s → 60s)
**Files to fix**:
- `app/carrier/my-bids/CarrierBidsConsole.tsx` - Line 154, 161
- `app/admin/archive-bids/AdminArchiveBidsClient.tsx` - Line 63
- `app/admin/auctions/AdminAuctionsClient.tsx` - Line 53
- `app/carrier/favorites/CarrierFavoritesClient.tsx` - Line 111

### Priority 3: Background Data (30s → 120s)
**Files to fix**:
- `app/admin/bids/AdminBiddingConsole.tsx` - Analytics (line 497)
- `app/carrier/my-loads/LoadAnalytics.tsx` - Already 60s

---

## Changes to Make

### Admin Bids Page
```typescript
// Current: refreshInterval: 5000
// New: refreshInterval: 30000 (30s for main data)
// Keep 5s only for bid adjudication dialog
```

### Carrier My Bids
```typescript
// Current: refreshInterval: 30000
// New: refreshInterval: 60000 (60s - doesn't need to be super fresh)
```

### Bid Board (Live Auctions)
```typescript
// Keep: refreshInterval: 5000 (needs real-time for countdown)
```

### Admin Users/Archive
```typescript
// Current: refreshInterval: 5000-10000
// New: refreshInterval: 60000 (background data)
```

---

## Expected Results

**Before**: 
- Multiple 5s + 10s intervals = ~200+ requests/minute
- Supabase rate limit: 50-100 requests/minute
- ❌ **Throttled**

**After**:
- Mostly 30s + 60s intervals = ~50 requests/minute
- Well under Supabase limit
- ✅ **No throttling**

---

## Quick Win Script

Run this to find all high-frequency intervals:
```bash
grep -r "refreshInterval: [0-9]*000" app/ --include="*.tsx" | grep -E "(5|10)000"
```

This shows all 5-10 second intervals to fix.

