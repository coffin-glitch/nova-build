# Telegram Bids Database Wiring Scheme

## Overview
The `telegram_bids` table is the **single source of truth** for all bids in the system. All data is stored in one table with different states managed through flags and timestamps.

---

## Database Schema

### Table: `telegram_bids`

**Key Columns:**
- `bid_number` (text) - Unique identifier for each bid
- `received_at` (timestamp) - UTC timestamp when bid was received
- `archived_at` (timestamp, nullable) - UTC timestamp when bid was archived (04:59:59 UTC on next day)
- `is_archived` (boolean) - Archive status flag
- `distance_miles`, `pickup_timestamp`, `delivery_timestamp`, `stops`, `tag`, etc.

**Important:** All timestamps are stored in **UTC** in the database.

---

## Bid States & Lifecycle

### 1. **Active Bid** (Countdown Running)
**State:**
- `received_at` = UTC timestamp
- `is_archived = false`
- `archived_at = NULL`
- Countdown: `< 25 minutes`

**When:** Bids received and countdown is still active

---

### 2. **Expired Bid** (Pending End-of-Day Archive)
**State:**
- `received_at` = UTC timestamp
- `is_archived = false`
- `archived_at = NULL`
- Countdown: `>= 25 minutes`

**When:** Bids that expired today but haven't been end-of-day archived yet

---

### 3. **Archived Bid** (End-of-Day Processed)
**State:**
- `received_at` = UTC timestamp (original receive time)
- `is_archived = true`
- `archived_at = NEXT_DAY + 04:59:59 UTC`
- Example: Received `2025-10-25 15:22:05 UTC` → Archived `2025-10-26 04:59:59 UTC`

**When:** Bids that have been processed by the end-of-day cron job (runs at 04:59 UTC = 11:59 PM CDT previous day)

---

## Admin/Bids Page Wiring

### Endpoint
```
GET /api/telegram-bids?showExpired={true|false}&isAdmin=true
```

### Active Bids Filter (`showExpired=false`)
**Query Logic:**
```sql
WHERE received_at::date = CURRENT_DATE 
  AND is_archived = false
```

**Shows:** Today's bids with active countdown (countdown < 25 minutes)

---

### Expired Bids Filter (`showExpired=true`)
**Query Logic:**
```sql
WHERE is_archived = false 
  AND archived_at IS NULL
```

**Shows:** Today's expired bids (countdown expired, but not yet end-of-day archived)

---

### Frontend Component
**File:** `app/admin/bids/AdminBiddingConsole.tsx`

**Key Features:**
- Toggle between active/expired with `showExpired` state
- Filters by bid number (`q`) and state tag (`tag`)
- Real-time updates (5 second refresh interval)
- Displays countdown for active bids
- Shows "Expired" badge for expired bids

---

## Archive-Bids Page Wiring

### Endpoint
```
GET /api/archive-bids/history?{filters}
```

### Filters Available:
- `bidNumber` - Search by bid number
- `dateFrom` / `dateTo` - Filter by archive date range
- `city` - Filter by city name
- `tag` - Filter by state tag
- `milesMin` / `milesMax` - Filter by distance
- `sourceChannel` - Filter by source
- `sortBy` - Sort field (archived_at, received_at, distance_miles, bids_count)
- `sortOrder` - Sort direction (asc/desc)

### Query Logic:
```sql
WHERE archived_at IS NOT NULL
```

**Shows:** All bids that have been end-of-day archived (have `archived_at` timestamp)

---

### Frontend Component
**File:** `app/admin/archive-bids/ArchiveBidsTimeline.tsx`

**Key Features:**
- Advanced filters panel
- Timeline/Grid/Analytics view modes
- Sort by Archive Date, Received Date, Distance, or Bid Count
- Group by local date (timezone-aware)
- Pagination support

---

## Views

### 1. `active_telegram_bids`
**Purpose:** Show bids with active countdown
```sql
SELECT * FROM telegram_bids
WHERE NOW() <= (received_at::timestamp + INTERVAL '25 minutes')
  AND (is_archived = false OR archived_at IS NULL OR archived_at > NOW() AT TIME ZONE 'America/Chicago')
```

---

### 2. `expired_bids`
**Purpose:** Show expired bids pending archive
```sql
SELECT * FROM telegram_bids
WHERE archived_at IS NULL
  AND NOW() > (received_at::timestamp + INTERVAL '25 minutes')
ORDER BY received_at DESC
```

---

## Automatic Functions

### 1. `archive_expired_bids()`
**Purpose:** Mark old expired bids as archived (runs periodically)

**Logic:**
```sql
UPDATE telegram_bids
SET is_archived = true
WHERE is_archived = false
  AND NOW() > (received_at::timestamp + INTERVAL '25 minutes')
  AND (NOW() AT TIME ZONE 'America/Chicago')::date < CURRENT_DATE
```

**Runs:** Periodically to keep database clean
**Effect:** Only archives bids from **previous days** (not today)

---

### 2. `set_end_of_day_archived_timestamps()`
**Purpose:** Set `archived_at` timestamp at end of day (04:59 UTC = 11:59 PM CDT)

**Schedule:** Cron job at `59 4 * * *` (04:59 UTC daily)

**Logic:**
```sql
UPDATE telegram_bids
SET archived_at = CURRENT_DATE + INTERVAL '4 hours 59 minutes 59 seconds'
WHERE DATE(received_at AT TIME ZONE 'America/Chicago') = CURRENT_DATE - INTERVAL '1 day'
  AND archived_at IS NULL
  AND is_archived = true
```

**Effect:** 
- Bids received on Oct 25 (CDT) get `archived_at = 2025-10-26 04:59:59 UTC`
- This equals `2025-10-25 23:59:59 CDT`

---

## Timezone Handling

### Storage
- All timestamps stored in **UTC** in database

### Display
- Use `lib/timezone.ts` utilities to convert UTC to user's local timezone
- Functions: `toLocalTime()`, `toLocalDate()`, `formatArchiveDate()`

### Example:
```typescript
import { toLocalTime } from '@/lib/timezone';

// Display in user's local timezone
<span>{toLocalTime(bid.received_at)}</span>
```

---

## Carrier Side Wiring (Future)

### Carrier/Bids Page
**Similar to Admin/Bids but with carrier-specific filters:**

**Active Bids:**
```sql
WHERE received_at::date = CURRENT_DATE 
  AND is_archived = false
  AND [carrier hasn't placed bid]
```

**My Bids (Carrier placed):**
- Filter by `clerk_user_id` in `carrier_bids` table
- Join with `telegram_bids` on `bid_number`

---

## Key Principles

### ✅ DO:
1. Store all data in `telegram_bids` table
2. Use UTC timestamps in database
3. Convert to local timezone for display
4. Query by `is_archived` and `archived_at` flags
5. Use views for common queries

### ❌ DON'T:
1. Duplicate data in separate tables
2. Store timestamps in local timezone
3. Manually set `archived_at` (let cron handle it)
4. Archive today's bids during the day
5. Mix UTC and local time in queries

---

## Query Patterns

### Get Today's Active Bids:
```sql
SELECT * FROM telegram_bids
WHERE received_at::date = CURRENT_DATE
  AND is_archived = false
ORDER BY received_at DESC
```

### Get Today's Expired Bids:
```sql
SELECT * FROM telegram_bids
WHERE received_at::date = CURRENT_DATE
  AND is_archived = false
  AND archived_at IS NULL
  AND NOW() > (received_at::timestamp + INTERVAL '25 minutes')
ORDER BY received_at DESC
```

### Get Archived Bids:
```sql
SELECT * FROM telegram_bids
WHERE archived_at IS NOT NULL
ORDER BY archived_at DESC
```

---

## Migration History

1. **Dropped `archived_bids` table** - All data now in `telegram_bids`
2. **Created timezone utilities** - `lib/timezone.ts`
3. **Fixed archive timestamps** - Set to 04:59:59 UTC for end-of-day archiving
4. **Updated views** - `active_telegram_bids` and `expired_bids`
5. **Fixed archive functions** - Only archive previous day's bids

---

## Testing

### Test Active Bids:
```bash
curl "http://localhost:3000/api/telegram-bids?showExpired=false&isAdmin=true"
```

### Test Expired Bids:
```bash
curl "http://localhost:3000/api/telegram-bids?showExpired=true&isAdmin=true"
```

### Test Archived Bids:
```bash
curl "http://localhost:3000/api/archive-bids/history?dateFrom=2025-10-25&dateTo=2025-10-25"
```

---

## Summary

**Three States:**
1. **Active** - `is_archived=false`, `archived_at=NULL`, countdown active
2. **Expired** - `is_archived=false`, `archived_at=NULL`, countdown expired
3. **Archived** - `is_archived=true`, `archived_at=timestamp`

**Two Pages:**
1. **Admin/Bids** - Today's active and expired bids
2. **Archive-Bids** - All end-of-day archived bids

**One Database:** `telegram_bids` - Single source of truth

