# Caching and Fallback Logic Explanation

## Overview

The bid-board page has **three layers** of data fetching that can cause inconsistencies:

1. **Server-side initial data** (`initialBids`) - Limited to 50 bids (now fixed to 1000)
2. **API route caching** - 30-second TTL cache with separate keys for admin vs non-admin
3. **Client-side fallback logic** - Uses `initialBids` when SWR data hasn't loaded yet

---

## 1. Server-Side Initial Data (SSR)

### Location: `app/bid-board/page.tsx`

```typescript
// BEFORE (limit 50):
const initialBids = await listActiveTelegramBids({ limit: 50 });

// AFTER (limit 1000):
const initialBids = await listActiveTelegramBids({ limit: 1000 });
```

### What It Does:
- Fetches data **server-side** during page load
- Passes to `BidBoardClient` as props
- Used as **fallback** when SWR hasn't loaded client-side data yet

### The Problem:
- **Before**: Only 50 bids were fetched, so when showing expired bids, you'd only see 50 instead of 303
- **After**: Now fetches 1000 bids to match API limit

---

## 2. API Route Caching (Server-Side Cache)

### Location: `app/api/telegram-bids/route.ts`

```typescript
// Cache for frequently accessed data
const cache = new Map();
const CACHE_TTL = 30 * 1000; // 30 seconds

// Create cache key
const cacheKey = `telegram-bids-${q}-${tag}-${limit}-${offset}-${showExpired}-${isAdmin}`;

// Check cache first
const cached = cache.get(cacheKey);
if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
  return NextResponse.json({
    ok: true,
    data: cached.data,
    cached: true
  });
}
```

### How It Works:

1. **Cache Key Structure**:
   ```
   telegram-bids-{q}-{tag}-{limit}-{offset}-{showExpired}-{isAdmin}
   ```

2. **Separate Cache Keys for Admin vs Non-Admin**:
   - Admin: `telegram-bids---1000-0-true-true`
   - Carrier: `telegram-bids---1000-0-true-false`
   - **Different cache keys = different cached data!**

3. **Cache TTL**: 30 seconds
   - If data is less than 30 seconds old, return cached version
   - After 30 seconds, fetch fresh data from database

### The Problem:

#### Issue #1: Different Cache Keys
```typescript
// Admin request:
cacheKey = `telegram-bids---1000-0-true-true`  // isAdmin=true

// Carrier request:
cacheKey = `telegram-bids---1000-0-true-false` // isAdmin=false
```

**Result**: Even though `isAdmin` doesn't affect the SQL query, it creates **separate cache entries**:
- Admin might get cached data from 10 seconds ago (303 bids)
- Carrier might get cached data from 25 seconds ago (50 bids)
- They're **not sharing the same cache**, so they can see different data!

#### Issue #2: Cache Timing
- If admin loads page first, their cache gets populated
- If carrier loads page 5 seconds later, they get **different cache entry**
- After 30 seconds, both refresh, but timing differences can cause inconsistencies

#### Issue #3: Stale Cache
- If database has 303 expired bids, but cache was created when there were only 50
- Cache won't update until TTL expires (30 seconds)
- Users see stale data during this window

---

## 3. Client-Side Fallback Logic (SWR)

### Location: `app/bid-board/BidBoardClient.tsx`

```typescript
// SWR hook with fallback
const { data, mutate, isLoading } = useSWR(
  `/api/telegram-bids?q=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}&limit=1000&showExpired=${showExpired}&isAdmin=false`,
  swrFetcher,
  { 
    refreshInterval: 5000,
    fallbackData: { ok: true, data: initialBids }  // ← FALLBACK HERE
  }
);

// Use bids with fallback logic
const bids = useMemo(() => {
  if (showExpired) {
    // When showing expired, use expiredBidsAll (from dedicated API call)
    return expiredBidsAll.length > 0 ? expiredBidsAll : (data?.data || []);
  } else {
    // When showing active, use main data (from API call with showExpired=false)
    return data?.data || initialBids;  // ← FALLBACK TO initialBids
  }
}, [showExpired, expiredBidsAll, data?.data, initialBids]);
```

### How It Works:

1. **SWR Data Flow**:
   ```
   Component Mount
   ↓
   SWR starts fetching from API
   ↓
   While loading: Use fallbackData (initialBids)
   ↓
   API returns: Use data?.data
   ↓
   Every 5 seconds: Refresh data
   ```

2. **Fallback Chain**:
   ```typescript
   // For active bids:
   data?.data || initialBids
   
   // For expired bids:
   expiredBidsAll.length > 0 ? expiredBidsAll : (data?.data || [])
   ```

### The Problem:

#### Issue #1: Initial Load Window
- When page first loads, `data` is `undefined`
- SWR uses `fallbackData: { ok: true, data: initialBids }`
- If `initialBids` only has 50 bids, user sees 50 bids until API call completes
- **Window of inconsistency**: First few seconds show wrong count

#### Issue #2: Race Condition
```typescript
// Timeline:
T=0ms:   Component mounts, shows initialBids (50 bids)
T=100ms: SWR starts API call
T=500ms: API returns with 303 bids
T=500ms: Component updates to show 303 bids
```

**Problem**: User might click "Show Expired" during the 0-500ms window and see 50 bids instead of 303

#### Issue #3: Multiple Data Sources
```typescript
const bids = useMemo(() => {
  if (showExpired) {
    // Source 1: expiredBidsAll (from dedicated API call)
    // Source 2: data?.data (from main API call)
    // Source 3: [] (empty array fallback)
    return expiredBidsAll.length > 0 ? expiredBidsAll : (data?.data || []);
  } else {
    // Source 1: data?.data (from main API call)
    // Source 2: initialBids (from SSR)
    return data?.data || initialBids;
  }
}, [showExpired, expiredBidsAll, data?.data, initialBids]);
```

**Problem**: Three different data sources can have different data:
- `expiredBidsAll` might have 303 bids (from dedicated API call)
- `data?.data` might have 50 bids (from main API call with different filters)
- `initialBids` might have 50 bids (from SSR)

---

## How These Issues Combine

### Scenario: User Shows Expired Bids

1. **Page Load** (T=0s):
   - `initialBids` = 50 bids (from SSR)
   - `data` = undefined (SWR loading)
   - `expiredBidsAll` = undefined (SWR loading)
   - **User sees**: 50 bids (from `initialBids` fallback)

2. **API Calls Start** (T=0.1s):
   - Main API call: `/api/telegram-bids?showExpired=true&isAdmin=false`
   - Stats API call: `/api/telegram-bids?showExpired=true&isAdmin=false` (for `expiredBidsAll`)

3. **Cache Check** (T=0.1s):
   - API route checks cache: `telegram-bids---1000-0-true-false`
   - Cache might be empty or stale
   - Fetches from database

4. **Data Returns** (T=0.5s):
   - Main API: Returns 303 bids
   - Stats API: Returns 303 bids
   - But `expiredBidsAll.length > 0` check might use wrong source

5. **Component Updates** (T=0.5s):
   - `bids` useMemo recalculates
   - Should show 303 bids now

### Why It Fails:

```typescript
// If expiredBidsAll hasn't loaded yet:
expiredBidsAll.length > 0  // false (expiredBidsAll is [])
? expiredBidsAll           // not used
: (data?.data || [])       // might still be undefined or have wrong data

// Result: User sees wrong count!
```

---

## Solutions Applied

### ✅ Solution 1: Increase initialBids Limit
```typescript
// Changed from limit: 50 to limit: 1000
const initialBids = await listActiveTelegramBids({ limit: 1000 });
```

**Impact**: SSR now fetches same amount as API, reducing initial load inconsistency

### ✅ Solution 2: Use Dedicated Expired API Call
```typescript
// Separate API call for expired bids
const { data: expiredData } = useSWR(
  `/api/telegram-bids?showExpired=true&limit=1000&isAdmin=false`,
  swrFetcher,
  { refreshInterval: 30000 }
);

// Use expiredBidsAll when showing expired
const bids = useMemo(() => {
  if (showExpired) {
    return expiredBidsAll.length > 0 ? expiredBidsAll : (data?.data || []);
  } else {
    return data?.data || initialBids;
  }
}, [showExpired, expiredBidsAll, data?.data, initialBids]);
```

**Impact**: Ensures expired bids always come from dedicated API call with full limit

### ✅ Solution 3: Track Data Loaded State
```typescript
const expiredDataLoaded = expiredData !== undefined;

// Use expiredBidsAll when it's been loaded (even if empty)
const expiredBidsSource = expiredDataLoaded 
  ? expiredBidsAll 
  : (showExpired ? bids.filter((b: TelegramBid) => b.is_expired) : []);
```

**Impact**: Prevents using stale fallback data when fresh data is available

---

## Remaining Issues

### ⚠️ Cache Key Separation
The `isAdmin` parameter in cache key creates separate caches:
- **Fix**: Remove `isAdmin` from cache key (it doesn't affect query)
- **Or**: Share cache between admin and non-admin requests

### ⚠️ Cache TTL Timing
30-second cache can cause stale data:
- **Fix**: Reduce TTL to 5-10 seconds for bid data
- **Or**: Implement cache invalidation on bid updates

### ⚠️ Multiple SWR Hooks
Three separate SWR hooks can have different refresh timings:
- **Fix**: Use single SWR hook with conditional fetching
- **Or**: Ensure all hooks refresh at same intervals

---

## Recommendations

1. **Remove `isAdmin` from cache key** - It doesn't affect the query, so cache should be shared
2. **Reduce cache TTL** - 30 seconds is too long for live bid data
3. **Unify data sources** - Use single source of truth for expired bids
4. **Add loading states** - Show loading indicator instead of stale data
5. **Consider Realtime** - For instant updates without polling/caching issues


