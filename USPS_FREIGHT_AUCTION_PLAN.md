# USPS Freight Auction Bid Collection System - Planning Document

## Executive Summary

This document outlines the plan to build a live bid collection system for USPS Freight Auction loads. The system will poll the BlueYonder/USPS endpoint, extract load data, store it in Supabase, and display it in a React UI. The existing Telegram bot system will remain unchanged during this implementation.

---

## System Architecture Overview

### High-Level Flow

```
┌─────────────────┐
│  USPS/BlueYonder │
│     Endpoint     │
└────────┬─────────┘
         │
         │ (POST with XML payload)
         │
┌────────▼─────────────────────────────────────────┐
│         Next.js API Route / Background Job         │
│  ┌──────────────────────────────────────────────┐ │
│  │  lib/uspsFreightAuctionClient.ts              │ │
│  │  - buildUspsXml()                             │ │
│  │  - fetchPageHtml()                            │ │
│  │  - getTotalPagesFromHtml()                    │ │
│  │  - fetchAllPagesHtml()                         │ │
│  └──────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────┐ │
│  │  lib/uspsFreightAuctionParser.ts              │ │
│  │  - parseLoadsFromHtml()                      │ │
│  └──────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────┐ │
│  │  lib/uspsFreightAuctionDb.ts                  │ │
│  │  - upsertLoads()                             │ │
│  └──────────────────────────────────────────────┘ │
└────────┬──────────────────────────────────────────┘
         │
         │ (Upsert to Supabase)
         │
┌────────▼─────────┐
│    Supabase      │
│ usps_available_  │
│     loads        │
└────────┬─────────┘
         │
         │ (Read via SWR/React Query)
         │
┌────────▼─────────┐
│   React UI Page   │
│  /admin/usps-     │
│   freight-auction│
└───────────────────┘
```

---

## Component Breakdown

### 1. Database Layer (`lib/uspsFreightAuctionDb.ts`)

**Purpose**: Handle all Supabase database operations for USPS loads, mapping them to `telegram_bids` format.

**Key Functions**:
- `mapParsedLoadToTelegramBid(load: ParsedLoad): MappedTelegramBid`
  - Converts `ParsedLoad` to `telegram_bids` format
  - Parses distance string ("1,244.9 MILES" → 1244.9)
  - Parses start datetime to `pickup_timestamp`
  - Creates `stops` array: `[origin, destination]`
  - Calculates `expires_at` from `roundEndsMinutes`
  - Sets `source_channel = 'usps_freight_auction'`

- `upsertLoads(loads: ParsedLoad[]): Promise<{ inserted: number; updated: number; errors: string[] }>`
  - Takes array of parsed loads
  - Maps each to `telegram_bids` format
  - Uses Supabase upsert with `bid_number` as unique key
  - **Important**: On conflict, updates all fields EXCEPT `received_at` (preserves original discovery time)
  - Returns summary: inserted count, updated count, errors

**Dependencies**:
- `@/lib/db` (existing Supabase client)
- Type definitions from parser
- Date parsing utilities

**Error Handling**:
- Log database errors
- Continue processing other loads if one fails
- Return partial success status with error details

---

### 2. Client Layer (`lib/uspsFreightAuctionClient.ts`)

**Purpose**: Handle HTTP communication with USPS/BlueYonder endpoint.

**Key Functions**:

#### `buildUspsXml(page: number, startCount: number): string`
- **Input**: Page number (1-based), start count (offset)
- **Output**: Complete XML request string
- **Logic**:
  - Load base XML template (from env or hardcoded constant)
  - Replace `START_COUNT Value="0"` with `START_COUNT Value="${startCount}"`
  - Replace `pagenum Value="1"` with `pagenum Value="${page}"`
  - Replace `AvailableLoadsCount_N0` if needed (or leave as-is for first page)
- **Error Handling**: Validate inputs, throw on invalid page/startCount

#### `fetchPageHtml(page: number, pageSize: number = 16): Promise<string>`
- **Input**: Page number, page size (default 16)
- **Output**: Raw HTML response string
- **Logic**:
  - Calculate `startCount = (page - 1) * pageSize`
  - Build XML using `buildUspsXml(page, startCount)`
  - Make POST request with:
    - URL from `USPS_FA_BASE_URL`
    - Headers: Cookie, User-Agent, Referer, Content-Type (from env)
    - Body: XML string
  - Handle HTTP errors (404, 500, etc.)
  - Return HTML string
- **Error Handling**:
  - Retry logic (3 attempts with exponential backoff)
  - Log failed requests
  - Throw descriptive errors

#### `getTotalPagesFromHtml(html: string): { totalPages: number; totalItems: number; pageSize: number }`
- **Input**: HTML string from first page
- **Output**: Object with pagination metadata
- **Logic**:
  - Use `cheerio` to parse HTML
  - Find `<input name="AvailableLoadsCount_N0" value="...">` → totalItems
  - Find `<input name="MAX_ROWS" value="...">` → pageSize
  - Calculate: `totalPages = Math.ceil(totalItems / pageSize)`
- **Error Handling**:
  - Return defaults if inputs not found
  - Log warnings for missing data

#### `fetchAllPagesHtml(): Promise<string[]>`
- **Input**: None (uses env config)
- **Output**: Array of HTML strings (one per page)
- **Logic**:
  1. Fetch page 1
  2. Parse total pages from page 1 HTML
  3. If totalPages > 1:
     - Create array of page numbers [2, 3, ..., totalPages]
     - Fetch pages in parallel (with concurrency limit, e.g., 3 at a time)
  4. Return array of all HTML strings
- **Error Handling**:
  - Continue if one page fails (log and skip)
  - Return partial results if some pages fail
  - Implement rate limiting to avoid overwhelming server

---

### 3. Parser Layer (`lib/uspsFreightAuctionParser.ts`)

**Purpose**: Extract structured data from HTML responses.

**Key Functions**:

#### `parseLoadsFromHtml(html: string): ParsedLoad[]`
- **Input**: HTML string (single page)
- **Output**: Array of `ParsedLoad` objects
- **Logic**:
  1. Use `cheerio` to load HTML
  2. Find table with `id="availableLoadsTable"`
  3. Find all `<tr>` rows (skip header row)
  4. For each row:
     - Extract `<td>` cells in order:
       - Column 0: Load ID (text content)
       - Column 1: Round Ends [Minutes] (parse integer, handle null)
       - Column 2: Distance (text, e.g., "1,244.9 MILES")
       - Column 3: Start Date/Time (text)
       - Column 4: Origin City
       - Column 5: Origin State
       - Column 6: Destination City
       - Column 7: Destination State
     - Store raw `<tr>` HTML for debugging (optional)
     - Create `ParsedLoad` object
  5. Return array
- **Error Handling**:
  - Skip malformed rows (log warning)
  - Return partial results if some rows fail
  - Validate required fields (loadId must exist)

**Type Definition**:
```typescript
export interface ParsedLoad {
  loadId: string;              // Maps to bid_number
  roundEndsMinutes: number | null;
  distance: string;            // e.g., "1,244.9 MILES"
  startDateTimeText: string;   // Raw datetime string
  originCity: string;
  originState: string;
  destinationCity: string;
  destinationState: string;
  rawHtmlRow?: string;         // Optional for debugging
}

// Mapped to TelegramBid format:
export interface MappedTelegramBid {
  bid_number: string;          // From loadId
  distance_miles: number | null;  // Parsed from distance string
  pickup_timestamp: string | null; // Parsed from startDateTimeText
  delivery_timestamp: string | null; // Calculated (pickup + estimated)
  stops: string[];             // [origin, destination]
  tag: string | null;          // State tag if available
  source_channel: string;      // 'usps_freight_auction'
  received_at: string;         // Current timestamp
  expires_at: string | null;   // received_at + roundEndsMinutes
  raw_text?: string;           // Original HTML row
}
```

---

### 4. API Route (`app/api/usps-freight-auction/sync/route.ts`)

**Purpose**: Expose endpoint to trigger manual sync or be called by cron job.

**Key Functions**:

#### `POST /api/usps-freight-auction/sync`
- **Logic**:
  1. Authenticate request (admin-only or service key)
  2. Call `fetchAllPagesHtml()` from client
  3. For each HTML page:
     - Call `parseLoadsFromHtml()` to extract loads
     - Collect all loads into single array
  4. Call `upsertLoads()` to save to `telegram_bids` table
  5. Return summary:
     ```json
     {
       "success": true,
       "totalPages": 3,
       "totalLoads": 40,
       "newLoads": 5,        // Loads with new bid_number (inserted)
       "updatedLoads": 35,   // Existing bid_numbers that were updated
       "errors": []
     }
     ```
- **Error Handling**:
  - Return 500 with error details if critical failure
  - Log all errors
  - Return partial success if some pages fail
- **Note**: All loads are inserted into `telegram_bids` with `source_channel = 'usps_freight_auction'`

---

### 5. Background Job / Cron Job

**Options for Continuous Polling**:

#### Option A: Next.js API Route + External Cron (Recommended)
- Use Vercel Cron, GitHub Actions, or external service
- Call `/api/usps-freight-auction/sync` every 5 seconds
- **Pros**: Simple, no server needed, works with serverless
- **Cons**: External dependency, 5-second interval might be aggressive

#### Option B: Next.js API Route + Internal Interval (Not Recommended)
- Create a long-running API route that polls internally
- **Pros**: Self-contained
- **Cons**: Doesn't work well with serverless, can timeout, resource intensive

#### Option C: Separate Node.js Service (Future Consideration)
- Run a dedicated service/container
- **Pros**: More control, better for high-frequency polling
- **Cons**: Additional infrastructure, more complex

**Recommendation**: Start with **Option A** using Vercel Cron (if on Vercel) or a lightweight external cron service. If 5-second interval is too aggressive, consider 15-30 seconds initially.

---

### 6. React UI Integration

**Purpose**: USPS loads will appear in existing bid board UI automatically.

**Key Points**:
- **No new UI page needed** - USPS loads will appear in existing `/admin/bids` and `/bid-board` pages
- Existing `TelegramBid` interface already supports all needed fields
- Filter by `source_channel = 'usps_freight_auction'` to see only USPS loads
- Or show all bids together (Telegram + USPS) by not filtering

**Implementation**:
- Existing `/api/telegram-bids` endpoint already queries `telegram_bids` table
- Add optional filter: `?sourceChannel=usps_freight_auction` to show only USPS loads
- Or show all: `?sourceChannel=` (empty) shows all sources
- Existing `BidBoardClient` and `AdminBiddingConsole` components will work as-is

**Optional Enhancement**: Add source badge/chip to distinguish Telegram vs USPS loads
- Show "📱 Telegram" or "🚚 USPS" badge on each bid card
- Filter toggle: "All Sources" / "Telegram Only" / "USPS Only"

---

## Data Model

### ✅ **CRITICAL: Use Existing `telegram_bids` Table**

**We will NOT create a new table.** Instead, we'll insert into the existing `telegram_bids` table with a new `source_channel` value to distinguish USPS loads from Telegram bids.

### Existing Table: `telegram_bids`

```sql
-- Table already exists with these columns:
CREATE TABLE IF NOT EXISTS telegram_bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bid_number TEXT NOT NULL UNIQUE,  -- ← USPS Load ID maps here
  distance_miles NUMERIC,           -- ← Parse from "1,244.9 MILES"
  pickup_timestamp TIMESTAMPTZ,     -- ← From start_datetime_text
  delivery_timestamp TIMESTAMPTZ,   -- ← Calculate from pickup + estimated
  stops JSONB,                      -- ← Array: [origin, destination]
  tag TEXT,                         -- ← State tag (if available)
  source_channel TEXT NOT NULL,     -- ← Set to 'usps_freight_auction'
  forwarded_to TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,           -- ← Calculate from round_ends_minutes
  published BOOLEAN DEFAULT true,
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  raw_text TEXT                     -- ← Store original HTML row for debugging
);
```

**Data Mapping Strategy**:
- **USPS Load ID** → `bid_number` (unique key)
- **Distance** → `distance_miles` (parse "1,244.9 MILES" → 1244.9)
- **Start Date/Time** → `pickup_timestamp`
- **Origin/Destination** → `stops` JSONB array: `["Origin City, State", "Destination City, State"]`
- **Round Ends Minutes** → Calculate `expires_at = received_at + round_ends_minutes`
- **Source** → `source_channel = 'usps_freight_auction'`
- **Tag** → Extract from origin/destination state if needed
- **Raw HTML** → Store in `raw_text` for debugging

**Upsert Strategy**:
- Use `bid_number` (Load ID) as unique key
- On conflict, update all fields EXCEPT `received_at` (preserve original discovery time)
- This ensures we can track when a load was first seen vs. when it was last updated

---

## Environment Variables

Add to `.env.local`:

```bash
# USPS Freight Auction API
USPS_FA_BASE_URL="https://usps-aztms-fa-pr1.jdadelivers.com/base/view.x2ps"
USPS_FA_COOKIE="JSESSIONID=...; other_cookies_here=..."
USPS_FA_USER_AGENT="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
USPS_FA_REFERER="https://usps-aztms-sso-pr1.jdadelivers.com/tm/framework/Frame.jsp"
USPS_FA_CONTENT_TYPE="text/xml" # or "application/xml" - verify from DevTools

# Supabase (if not already set)
SUPABASE_URL="..."
SUPABASE_SERVICE_ROLE_KEY="..." # For server-side writes
```

**Security Notes**:
- Never commit cookies to git
- Use `.env.local` (already in `.gitignore`)
- Consider rotating cookies periodically
- Store sensitive values in Vercel/env secrets if deploying

---

## Error Handling Strategy

### 1. Network Errors
- **Retry Logic**: 3 attempts with exponential backoff (1s, 2s, 4s)
- **Logging**: Log all failed requests with context
- **Graceful Degradation**: Continue with partial data if some pages fail

### 2. Parsing Errors
- **Skip Malformed Rows**: Log warning, continue processing
- **Validate Required Fields**: Throw error if critical fields missing
- **Store Raw HTML**: Keep `raw_html_row` for debugging

### 3. Database Errors
- **Upsert Conflicts**: Handle gracefully (expected behavior)
- **Connection Issues**: Retry with backoff
- **Partial Failures**: Continue processing other loads

### 4. Rate Limiting
- **Respect Server Limits**: Add delays between requests
- **Concurrent Requests**: Limit to 3-5 parallel page fetches
- **429 Responses**: Implement exponential backoff

---

## Testing Strategy

### Unit Tests
- `buildUspsXml()`: Test XML generation with various page numbers
- `getTotalPagesFromHtml()`: Test with sample HTML
- `parseLoadsFromHtml()`: Test with sample table HTML
- `upsertLoads()`: Test database operations

### Integration Tests
- End-to-end: Fetch → Parse → Store → Retrieve
- Mock HTTP responses for predictable testing
- Test error scenarios (network failures, malformed HTML)

### Manual Testing
- Run sync endpoint manually
- Verify data in Supabase
- Check UI displays correctly
- Test with real endpoint (carefully, to avoid rate limits)

---

## Deployment Considerations

### 1. Cron Job Setup
- **Vercel**: Use `vercel.json` cron configuration
- **Other Platforms**: Use external cron service (cron-job.org, etc.)
- **Frequency**: Start with 30 seconds, adjust based on needs

### 2. Monitoring
- Log all sync operations
- Track success/failure rates
- Monitor database growth
- Alert on consecutive failures

### 3. Performance
- Database indexes (already planned)
- Limit query results in UI (pagination)
- Cache frequently accessed data if needed

---

## Potential Risks & Mitigations

### Risk 1: USPS Changes HTML Structure
- **Mitigation**: Store `raw_html_row` for debugging, add comprehensive logging
- **Detection**: Monitor parsing success rate, alert on drops

### Risk 2: Rate Limiting / IP Blocking
- **Mitigation**: Respect rate limits, add delays, use proxy if needed
- **Detection**: Monitor 429 responses, track request frequency

### Risk 3: Cookie Expiration
- **Mitigation**: Monitor 401/403 responses, implement cookie refresh mechanism
- **Detection**: Alert on authentication errors

### Risk 4: Database Growth
- **Mitigation**: Implement cleanup job for old loads (e.g., delete loads older than 30 days)
- **Detection**: Monitor table size, set alerts

### Risk 5: Concurrent Syncs
- **Mitigation**: Use database locks or flag-based approach to prevent overlapping syncs
- **Detection**: Log sync start/end times, detect overlaps

---

## Integration with Existing System

### Telegram Bot
- **No Changes Required**: Keep existing bot system as-is
- **Coexistence**: Both systems write to same `telegram_bids` table
- **Source Differentiation**: Use `source_channel` to distinguish:
  - `source_channel = 'telegram'` → From Telegram bot
  - `source_channel = 'usps_freight_auction'` → From USPS robot
- **Future**: Can disable Telegram bot once USPS robot is proven stable

### Existing Database
- **Same Table**: Both systems use `telegram_bids` table
- **No Conflicts**: `bid_number` is unique, so no duplicate bid numbers
- **Preserved History**: All existing Telegram bids remain unchanged
- **Archive System**: USPS loads will use same archival system (is_archived, archived_at)

### Admin UI
- **No New Routes**: USPS loads appear in existing `/admin/bids` page
- **Existing Components**: `BidBoardClient`, `AdminBiddingConsole` work as-is
- **Optional Enhancement**: Add source filter/badge to distinguish sources
- **Backward Compatible**: All existing queries/filters work unchanged

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
1. ✅ **No database migration needed** - Use existing `telegram_bids` table
2. Implement `uspsFreightAuctionClient.ts` (basic functions)
3. Implement `uspsFreightAuctionParser.ts`
4. Implement `uspsFreightAuctionDb.ts` (maps to `telegram_bids` format)
5. Create sync API route (`/api/usps-freight-auction/sync`)
6. Manual testing with real endpoint
7. Verify data appears in existing `/admin/bids` page

### Phase 2: Background Job (Week 1-2)
1. Set up cron job (Vercel or external)
2. Test continuous polling (start with 30 seconds, adjust to 5 seconds)
3. Monitor for errors
4. Verify no conflicts with Telegram bot
5. Test archival system works with USPS loads

### Phase 3: UI Integration & Testing (Week 2)
1. ✅ **No new UI needed** - Verify existing UI works
2. Optional: Add source badge/chip to distinguish sources
3. Optional: Add source filter toggle
4. Test real-time updates (existing `useRealtimeBids` hook)
5. Test archival flow (existing archive system)

### Phase 4: Seamless Switchover (Week 2-3)
1. Run both systems in parallel for 1-2 weeks
2. Monitor data quality and consistency
3. Add admin toggle to enable/disable USPS robot
4. Once proven stable, disable Telegram bot
5. Update documentation
6. Performance optimization

---

## Success Criteria

1. ✅ System successfully polls USPS endpoint every 5 seconds (or configured interval)
2. ✅ All pages are fetched and parsed correctly
3. ✅ New loads are detected and stored in `telegram_bids` table
4. ✅ No duplicate loads (idempotent upserts using `bid_number`)
5. ✅ USPS loads appear in existing `/admin/bids` and `/bid-board` pages
6. ✅ System handles errors gracefully without crashing
7. ✅ Existing Telegram bot continues to work unchanged (both systems coexist)
8. ✅ USPS loads use same archival system (is_archived, archived_at)
9. ✅ All existing queries/filters work with USPS loads
10. ✅ Can seamlessly switch from Telegram bot to USPS robot when ready

---

## Open Questions / Decisions Needed

1. **Polling Frequency**: Start with 30 seconds, adjust to 5 seconds once stable? ✅ **Recommendation: Start 30s, move to 5s**
2. **Data Retention**: Use existing archival system (archives at end of day) ✅ **No changes needed**
3. **UI Location**: Use existing `/admin/bids` page ✅ **No new UI needed**
4. **Authentication**: Should sync endpoint require admin auth or service key? ✅ **Recommendation: Service key for cron, admin auth for manual**
5. **Notification**: Should we notify admins when new loads are detected? (email, in-app, etc.) ✅ **Recommendation: Use existing notification system**
6. **Historical Tracking**: Use existing archival system ✅ **No changes needed**
7. **Source Differentiation**: Add visual badge to distinguish Telegram vs USPS? ✅ **Recommendation: Yes, optional enhancement**
8. **Switchover Strategy**: How long to run both systems in parallel? ✅ **Recommendation: 1-2 weeks**

---

## Next Steps

1. **Review this plan** with team/stakeholders
2. **Answer open questions** above
3. **Gather sample HTML** from real USPS endpoint for testing
4. **Set up environment variables** (cookies, etc.)
5. **Begin Phase 1 implementation** once plan is approved

---

## Notes

- This system is designed to be **non-intrusive** to existing functionality
- All new code is **isolated** in new files/routes
- **Backward compatible**: Existing Telegram bot remains unchanged
- **Extensible**: Easy to add features (notifications, alerts, etc.) later

