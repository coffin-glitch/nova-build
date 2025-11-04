# Bid-Board vs Admin/Bids - Full Data Flow Audit

## Overview
This document provides a comprehensive comparison of how the bid-board page and admin/bids page fetch, filter, sort, and display active and expired bids.

---

## 1. DATA FETCHING

### Admin/Bids Page (`app/admin/bids/AdminBiddingConsole.tsx`)

**Main Data Fetch:**
```typescript
const { data, mutate, isLoading } = useSWR(
  `/api/telegram-bids?q=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}&limit=1000&showExpired=${showExpired}&isAdmin=true`,
  fetcher,
  { refreshInterval: 5000 }
);
const bids = data?.data || [];
```

**Stats Data Fetches:**
```typescript
// Active bids for stats (always fetched)
const { data: activeData } = useSWR(
  `/api/telegram-bids?q=&tag=&limit=1000&showExpired=false&isAdmin=true`,
  fetcher,
  { refreshInterval: 30000 }
);

// Expired bids for stats (always fetched)
const { data: expiredData } = useSWR(
  `/api/telegram-bids?q=&tag=&limit=1000&showExpired=true&isAdmin=true`,
  fetcher,
  { refreshInterval: 30000 }
);

const activeBidsAll = activeData?.data || [];
const expiredBidsAll = expiredData?.data || [];
```

**Key Points:**
- Default `showExpired = true` (shows expired by default)
- Main fetch URL includes `showExpired` parameter
- Separate fetches for stats (30s refresh)
- Uses `fetcher` function

---

### Bid-Board Page (`app/bid-board/BidBoardClient.tsx`)

**Main Data Fetch:**
```typescript
const { data, mutate, isLoading } = useSWR(
  `/api/telegram-bids?q=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}&limit=1000&showExpired=${showExpired}&isAdmin=false`,
  swrFetcher,
  { 
    refreshInterval: 5000,
    fallbackData: { ok: true, data: initialBids }
  }
);
const bids = data?.data || initialBids;
```

**Stats Data Fetches:**
```typescript
// Active bids for stats (always fetched)
const { data: activeData } = useSWR(
  `/api/telegram-bids?q=&tag=&limit=1000&showExpired=false&isAdmin=false`,
  swrFetcher,
  { refreshInterval: 30000 }
);

// Expired bids for stats (always fetched)
const { data: expiredData } = useSWR(
  `/api/telegram-bids?q=&tag=&limit=1000&showExpired=true&isAdmin=false`,
  swrFetcher,
  { 
    refreshInterval: 30000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true
  }
);

const activeBidsAll = activeData?.data || [];
const expiredBidsAll = expiredData?.data || [];
```

**Key Points:**
- Default `showExpired = false` (shows active by default)
- Main fetch URL includes `showExpired` parameter
- Uses `swrFetcher` (with credentials)
- Has `fallbackData` for initial render
- Separate fetches for stats (30s refresh)

---

## 2. API ROUTE (`app/api/telegram-bids/route.ts`)

### Active Bids (`showExpired=false`)
```sql
WHERE tb.archived_at IS NULL 
  AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes')
ORDER BY tb.received_at DESC
```

### Expired Bids (`showExpired=true`)
```sql
WHERE tb.archived_at IS NULL 
  AND NOW() > (tb.received_at::timestamp + INTERVAL '25 minutes')
ORDER BY (tb.received_at::timestamp + INTERVAL '25 minutes') DESC
```

**Key Points:**
- Active: `received_at DESC` (most recent first)
- Expired: `expires_at_25 DESC` (most recently expired first)
- Both filter out archived bids (`archived_at IS NULL`)
- Returns `is_expired` boolean field

---

## 3. CLIENT-SIDE FILTERING

### Admin/Bids Page

```typescript
const filteredBids = bids.filter((bid: TelegramBid) => {
  const bidDate = new Date(bid.received_at).toISOString().split('T')[0];
  
  // If showing active bids, only show today's bids
  if (!showExpired) {
    if (bidDate !== today) return false;
  }
  // If showing expired bids, show all expired bids (API already filtered)
  
  // Apply search and tag filters
  if (q && !bid.bid_number.toLowerCase().includes(q.toLowerCase())) return false;
  if (tag && !bid.tag?.toLowerCase().includes(tag.toLowerCase())) return false;
  
  // Apply status filter
  if (statusFilter === 'active' && bid.is_expired) return false;
  if (statusFilter === 'expired' && !bid.is_expired) return false;
  
  return true;
});
```

**Key Points:**
- When `showExpired=false`: Filters by today's date only
- When `showExpired=true`: Shows ALL expired bids (no date filtering)
- No additional `is_expired` check when showing expired (relies on API)

---

### Bid-Board Page

```typescript
const filteredBids = useMemo(() => {
  const today = new Date().toISOString().split('T')[0];
  
  let filtered = bids.filter((bid: TelegramBid) => {
    const bidDate = new Date(bid.received_at).toISOString().split('T')[0];
    
    // If showing active bids, only show today's bids (exactly like admin page)
    if (!showExpired) {
      if (bidDate !== today) return false;
      // Also filter out expired bids when showing active
      if (bid.is_expired) return false;
    }
    // If showing expired bids, only show expired bids (filter out any active bids)
    if (showExpired) {
      if (!bid.is_expired) return false;
    }
    
    // Apply search and tag filters
    if (q && !bid.bid_number.toLowerCase().includes(q.toLowerCase())) return false;
    if (tag && !bid.tag?.toLowerCase().includes(tag.toLowerCase())) return false;
    
    // Apply status filter
    if (statusFilter === 'active' && bid.is_expired) return false;
    if (statusFilter === 'expired' && !bid.is_expired) return false;
    
    return true;
  });
  
  // Apply sorting...
  
  return filtered;
}, [bids, showExpired, sortBy, sortDirection, q, tag, statusFilter]);
```

**Key Points:**
- When `showExpired=false`: Filters by today's date AND excludes expired bids
- When `showExpired=true`: Explicitly filters out active bids (`if (!bid.is_expired) return false`)
- Uses `useMemo` for performance
- Additional safety check to ensure no active bids show when `showExpired=true`

---

## 4. SORTING

### Admin/Bids Page
**No client-side sorting** - relies on API sorting:
- Active: API returns `received_at DESC`
- Expired: API returns `expires_at_25 DESC`

### Bid-Board Page
**Has client-side sorting** with multiple options:
```typescript
filtered.sort((a: TelegramBid, b: TelegramBid) => {
  let comparison = 0;
  
  switch (sortBy) {
    case "time-remaining": comparison = a.time_left_seconds - b.time_left_seconds; break;
    case "bid-count": comparison = (a.bids_count || 0) - (b.bids_count || 0); break;
    case "distance": comparison = (a.distance_miles || 0) - (b.distance_miles || 0); break;
    case "pickup-time": comparison = new Date(a.pickup_timestamp || 0).getTime() - new Date(b.pickup_timestamp || 0).getTime(); break;
    case "delivery-time": comparison = new Date(a.delivery_timestamp || 0).getTime() - new Date(b.delivery_timestamp || 0).getTime(); break;
    case "bid-number": comparison = a.bid_number.localeCompare(b.bid_number); break;
    case "received-time": comparison = new Date(a.received_at).getTime() - new Date(b.received_at).getTime(); break;
    case "stops-count": comparison = aStops - bStops; break;
    case "state": comparison = (a.tag || "").localeCompare(b.tag || ""); break;
    default: comparison = a.time_left_seconds - b.time_left_seconds;
  }
  
  return sortDirection === "desc" ? -comparison : comparison;
});
```

**Default Sort:**
- `sortBy = "received-time"`
- `sortDirection = "desc"`

---

## 5. STATS CALCULATION

### Admin/Bids Page

```typescript
const todaysActiveBids = activeBidsAll.filter((b: TelegramBid) => {
  const bidDate = new Date(b.received_at).toISOString().split('T')[0];
  return bidDate === today && !b.is_expired;
});

const todaysExpiredBids = expiredBidsAll.filter((b: TelegramBid) => {
  const bidDate = new Date(b.received_at).toISOString().split('T')[0];
  return bidDate === today;
});

const analytics = showExpired ? {
  totalBids: expiredBidsAll.length, // All expired bids
  activeBids: todaysActiveBids.length, // Today's active bids
  expiredBids: expiredBidsAll.length, // All expired bids
  ...
} : {
  totalBids: todaysActiveBids.length, // Only today's active bids
  activeBids: todaysActiveBids.length, // Only today's active bids
  expiredBids: 0, // Don't show expired count when viewing active bids
  ...
};
```

**Key Points:**
- When `showExpired=true`: Shows all expired bids count (from `expiredBidsAll`)
- When `showExpired=false`: Shows only today's active bids count
- Expired count is always from `expiredBidsAll.length` (all expired, not just today)

---

### Bid-Board Page

```typescript
const stats = useMemo(() => {
  const today = new Date().toISOString().split('T')[0];
  
  // Use the main bids data (which is already loaded) for stats calculation
  const allBidsForStats = [...(bids || []), ...(activeBidsAll || []), ...(expiredBidsAll || [])];
  
  // Filter active bids by today's date and ensure they're not expired
  const todaysActiveBids = allBidsForStats.filter((b: TelegramBid) => {
    const bidDate = new Date(b.received_at).toISOString().split('T')[0];
    return bidDate === today && !b.is_expired;
  });
  
  // Get unique bid numbers to avoid duplicates
  const uniqueActiveBids = new Set(todaysActiveBids.map(b => b.bid_number));
  const uniqueExpiredBids = new Set(expiredBidsAll.map(b => b.bid_number));
  
  // ... calculate states and other stats ...
  
  return {
    activeCount: uniqueActiveBids.size,
    expiredCount: uniqueExpiredBids.size, // All expired bids
    statesCount: uniqueStates,
    totalValue: filteredBids.length > 0 ? "Live" : "0"
  };
}, [bids, activeBidsAll, expiredBidsAll, showExpired, filteredBids]);
```

**Key Points:**
- Combines data from multiple sources to avoid duplicates
- Uses `expiredBidsAll.length` for expired count (all expired)
- Uses unique bid numbers to avoid double-counting

---

## 6. DISPLAY LOGIC

### Admin/Bids Page
- Shows `filteredBids` directly (no additional sorting)
- Relies on API sorting
- Active/Expired badge based on `bid.is_expired`

### Bid-Board Page
- Shows `filteredBids` (after client-side sorting)
- Has sorting controls (Sort By, Direction, Quick Sort)
- Active/Expired badge based on `bid.is_expired`
- Has carrier-specific buttons (Bid, Favorites)

---

## 7. ISSUES IDENTIFIED

### Issue 1: Bid-Board Client-Side Filtering
**Problem:** When `showExpired=true`, the bid-board explicitly filters out active bids:
```typescript
if (showExpired) {
  if (!bid.is_expired) return false;
}
```

**Why this is redundant but safe:**
- The API already returns only expired bids when `showExpired=true`
- This is a safety check, but shouldn't be necessary

### Issue 2: Admin Page No Active Bid Filter When Showing Expired
**Problem:** Admin page doesn't explicitly filter out active bids when `showExpired=true`:
```typescript
// If showing expired bids, we'll show all expired bids (the API already filtered)
// No additional filtering
```

**Why this works:**
- Relies entirely on API filtering
- Works because API correctly returns only expired bids

### Issue 3: Sorting Mismatch
**Problem:** 
- Admin page: No client-side sorting, relies on API
- Bid-board: Client-side sorting, but default sort is `received-time DESC`

**For expired bids:**
- API sorts by `expires_at_25 DESC` (most recently expired first)
- Bid-board client-side sort by `received-time DESC` would override this
- This could cause expired bids to appear in wrong order

### Issue 4: Stats Calculation
**Problem:** Both pages use `expiredBidsAll.length` for expired count, which is correct, but the bid-board combines data sources which might cause inconsistencies.

---

## 8. RECOMMENDATIONS

### Fix 1: Remove Redundant Filtering
Remove the explicit `is_expired` check in bid-board when `showExpired=true` since API already handles this.

### Fix 2: Match Admin Page Logic Exactly
For expired bids, bid-board should:
- Remove client-side sorting when showing expired (or sort by `expires_at_25` instead of `received_at`)
- Trust the API sorting for expired bids
- Only apply client-side sorting when showing active bids

### Fix 3: Ensure API Sorting is Correct
Verify that expired bids API returns are sorted by `expires_at_25 DESC` (most recently expired first).

### Fix 4: Simplify Stats Calculation
Bid-board should match admin page exactly - use `expiredBidsAll.length` directly without combining sources.

---

## 9. DATA FLOW DIAGRAM

```
API Route (/api/telegram-bids)
├── showExpired=false
│   ├── SQL: WHERE archived_at IS NULL AND NOW() <= expires_at_25
│   └── ORDER BY: received_at DESC
│
└── showExpired=true
    ├── SQL: WHERE archived_at IS NULL AND NOW() > expires_at_25
    └── ORDER BY: expires_at_25 DESC

Admin/Bids Page
├── Main Fetch: /api/telegram-bids?showExpired={showExpired}&isAdmin=true
├── Stats Fetch (Active): /api/telegram-bids?showExpired=false&isAdmin=true
├── Stats Fetch (Expired): /api/telegram-bids?showExpired=true&isAdmin=true
├── Client Filter: Date filter for active, no filter for expired
└── Display: filteredBids (no client-side sort)

Bid-Board Page
├── Main Fetch: /api/telegram-bids?showExpired={showExpired}&isAdmin=false
├── Stats Fetch (Active): /api/telegram-bids?showExpired=false&isAdmin=false
├── Stats Fetch (Expired): /api/telegram-bids?showExpired=true&isAdmin=false
├── Client Filter: Date filter for active, is_expired filter for expired
├── Client Sort: Multiple sort options (default: received-time DESC)
└── Display: filteredBids (after client-side sort)
```

---

## 10. SUMMARY

**Key Differences:**
1. **Default View:** Admin shows expired by default, Bid-board shows active by default
2. **Client-Side Sorting:** Admin has none, Bid-board has full sorting controls
3. **Filtering Safety:** Bid-board has extra `is_expired` check when showing expired
4. **Stats Source:** Both use same logic but bid-board combines data sources

**Main Issue:**
The bid-board client-side sorting by `received-time DESC` overrides the API's `expires_at_25 DESC` sorting for expired bids, causing incorrect ordering.


