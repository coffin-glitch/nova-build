# Comprehensive System Fix Plan

## Executive Summary

This document outlines the complete plan to fix address display, notification system bugs, and ensure proper email configuration for the NOVA Build bidding system.

---

## 1. Address Display System Overhaul

### Current State
- Bids now contain full addresses: `street_number`, `street_name`, `city`, `state`, `zipcode`, `USA`
- Currently stored in `stops` field as JSONB array of strings
- Display functions (`formatStops`, `formatStopsDetailed`) show full addresses everywhere

### Required Changes

#### 1.1 Database Schema Enhancement
**File**: `lib/schema.ts`

Add address parsing utilities and update `telegramBids` schema to support structured address data:

```typescript
// New address parsing interface
interface ParsedAddress {
  streetNumber?: string;
  streetName?: string;
  city: string;
  state: string;
  zipcode?: string;
  country?: string; // Usually "USA"
  fullAddress: string; // Original string
}

// Helper function to parse address string
function parseAddress(addressString: string): ParsedAddress {
  // Parse "123 Main St, Atlanta, GA 30309, USA" format
  // Extract: street number, street name, city, state, zipcode
}
```

#### 1.2 Formatting Functions Update
**File**: `lib/format.ts`

**New Functions:**
- `formatAddressForCard(address: string | ParsedAddress): string`
  - Returns: `"City, State ZIP"` (e.g., "Atlanta, GA 30309")
  - Used on bid cards before clicking "View Details"

- `formatAddressForDetails(address: string | ParsedAddress): string`
  - Returns: Full address with all components
  - Used in "View Details" dialogs

- `parseAddress(addressString: string): ParsedAddress`
  - Parses full address string into structured components
  - Handles various address formats gracefully

**Updated Functions:**
- `formatStops(stops: string[] | null): string`
  - For cards: Use `formatAddressForCard` for each stop
  - Show: `"City, State ZIP → City, State ZIP"`

- `formatStopsDetailed(stops: string[] | null): ParsedAddress[]`
  - Returns parsed addresses for detailed view
  - Used in "View Details" dialogs

#### 1.3 Component Updates

**Files to Update:**
1. `app/bid-board/BidBoardClient.tsx`
   - Card display: Use `formatAddressForCard` for route info
   - View Details: Show full addresses with all components

2. `app/admin/bids/AdminBiddingConsole.tsx`
   - Same updates as bid-board

3. `components/carrier/FavoritesConsole.tsx`
   - Card display: Show city, state, zip only
   - Details view: Show full address

4. `components/carrier/ManageBidsConsole.tsx`
   - Update address display

5. `app/admin/archive-bids/ArchiveBidsTimeline.tsx`
   - Update address display

**Implementation Pattern:**
```typescript
// In card view:
<div className="route-info">
  {formatStops(parseStops(bid.stops))} // Shows "City, State ZIP → City, State ZIP"
</div>

// In details view:
{formatStopsDetailed(parseStops(bid.stops)).map((address, index) => (
  <div key={index}>
    <p className="font-medium">{address.fullAddress}</p>
    <div className="text-sm text-muted-foreground">
      <p>Street: {address.streetNumber} {address.streetName}</p>
      <p>City: {address.city}</p>
      <p>State: {address.state}</p>
      <p>ZIP: {address.zipcode}</p>
    </div>
  </div>
))}
```

---

## 2. Notification Trigger Bug Fix

### Problem Identified
**File**: `app/api/carrier/notification-triggers/route.ts` (Lines 71-89)

When creating an exact/state match trigger, the GET endpoint finds the **FIRST** favorite within the distance range, not the specific bid that was selected. This causes wrong bid information to display.

### Root Cause
In `handleCreateExactMatchTrigger` and `handleCreateStateMatchTrigger` (FavoritesConsole.tsx):
- The trigger is created with `favoriteDistanceRange` based on the selected bid's distance
- But the GET endpoint queries for ANY favorite within that range
- If multiple favorites exist in the same distance range, it returns the first one (most recent)

### Solution

#### 2.1 Store Specific Bid Number in Trigger Config
**File**: `components/carrier/FavoritesConsole.tsx`

Update trigger creation to include the specific `bidNumber`:

```typescript
const handleCreateExactMatchTrigger = async (bidNumber: string) => {
  // ... existing code ...
  
  const response = await fetch('/api/carrier/notification-triggers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      triggerType: 'exact_match',
      triggerConfig: {
        favoriteDistanceRange: {
          minDistance,
          maxDistance
        },
        matchType: 'exact',
        favoriteBidNumber: bidNumber, // ADD THIS: Store specific bid number
        favoriteStops: favorite.stops, // ADD THIS: Store stops for reference
      },
      isActive: true
    })
  });
  
  // Same for handleCreateStateMatchTrigger
};
```

#### 2.2 Update API GET Endpoint
**File**: `app/api/carrier/notification-triggers/route.ts`

Prioritize specific bid number over distance range lookup:

```typescript
// In GET endpoint, for exact_match triggers:
if (config?.favoriteBidNumber) {
  // Use specific bid number first
  const favoriteResult = await sql`
    SELECT cf.bid_number, tb.stops, tb.distance_miles
    FROM carrier_favorites cf
    JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
    WHERE cf.supabase_carrier_user_id = ${userId}
      AND cf.bid_number = ${config.favoriteBidNumber}
    LIMIT 1
  `;
  
  return {
    ...trigger,
    trigger_config: config,
    bid_number: favoriteResult[0]?.bid_number || null,
    route: favoriteResult[0]?.stops || null,
    distance_range: config.favoriteDistanceRange
  };
} else if (config?.favoriteDistanceRange) {
  // Fallback to distance range lookup (existing code)
  // ...
}
```

#### 2.3 Update Worker to Use Specific Bid
**File**: `workers/notification-worker.ts`

When processing triggers, prioritize specific bid number:

```typescript
async function processExactMatchTrigger(...) {
  // ... existing code ...
  
  // Check for specific bid number first
  if (config.favoriteBidNumber) {
    favoriteRoutes = await sql`
      SELECT 
        cf.bid_number as favorite_bid,
        tb.stops as favorite_stops,
        tb.tag as favorite_tag,
        tb.distance_miles as favorite_distance
      FROM carrier_favorites cf
      JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
      WHERE cf.supabase_carrier_user_id = ${userId}
        AND cf.bid_number = ${config.favoriteBidNumber}
    `;
  } else if (config.favoriteDistanceRange) {
    // Fallback to distance range (existing code)
    // ...
  }
  
  // ... rest of function
}
```

---

## 3. Backhaul Logic Verification & Fix

### Current Implementation
**File**: `workers/notification-worker.ts` (Lines 708-726)

Backhaul matching is implemented but needs verification:

1. **Exact Match Backhaul** (Lines 709-712):
   - Checks if match origin = favorite destination AND match destination = favorite origin
   - ✅ Logic appears correct

2. **State Match Backhaul** (Lines 714-726):
   - Checks if match origin state = favorite destination state AND match destination state = favorite origin state
   - ✅ Logic appears correct

### Issues to Fix

#### 3.1 Backhaul Preference Check
**Problem**: Backhaul is checked from `preferences` OR `config`, but should prioritize trigger-specific setting.

**Fix**: Update logic to check trigger config first, then preferences:

```typescript
// Current (Line 729):
const backhaulEnabled = preferences?.prioritize_backhaul || 
                       preferences?.prioritizeBackhaul || 
                       config.backhaulEnabled || 
                       false;

// Fixed:
const backhaulEnabled = config.backhaulEnabled !== undefined 
  ? config.backhaulEnabled 
  : (preferences?.prioritize_backhaul || 
     preferences?.prioritizeBackhaul || 
     false);
```

#### 3.2 Backhaul State Match Logic
**Problem**: State match backhaul uses `originState` and `destinationState` from config, but these might not be set for distance-range-based triggers.

**Fix**: Always extract states from favorite stops:

```typescript
// Ensure we always have favorite states
const favoriteOriginState = extractStateFromStop(origin);
const favoriteDestState = extractStateFromStop(destination);

// Use config states only if favorite states are unavailable
const checkOriginState = originState || favoriteOriginState;
const checkDestState = destinationState || favoriteDestState;

// Then use these in backhaul check
const isBackhaulStateMatch = (
  matchType === 'state' &&
  matchOriginState && matchDestState &&
  checkOriginState && checkDestState &&
  matchOriginState === checkDestState &&
  matchDestState === checkOriginState
);
```

---

## 4. Email Notification System Audit

### 4.1 Railway Worker Configuration

**Files to Check:**
- `railway-worker/package.json` - Verify scripts
- `railway-worker/railway.toml` - Verify Railway config
- `workers/notification-worker.ts` - Verify email sending

**Current Setup:**
- Worker script: `npm run worker:notifications`
- Uses BullMQ + Redis (Upstash)
- Processes jobs from queue

**Verification Checklist:**
- [ ] Railway worker service is running
- [ ] Environment variables are set (DATABASE_URL, REDIS_URL, etc.)
- [ ] Email service (Resend/SMTP) is configured
- [ ] Worker connects to database successfully
- [ ] Worker processes queue jobs
- [ ] Email sending function is called correctly

### 4.2 Email Sending Function
**File**: `workers/notification-worker.ts` (Lines 960-1166)

**Current Implementation:**
- `sendNotification()` function handles email sending
- Uses `sendEmail()` helper (needs verification)
- Sends different templates based on notification type

**Issues to Check:**
1. **Email Service Configuration**
   - Verify Resend API key or SMTP credentials
   - Check email templates are properly imported
   - Verify `sendEmail()` function exists and works

2. **Email Preference Check**
   - Verify `preferences.emailNotifications` is checked before sending
   - Ensure email is only sent when enabled

3. **Error Handling**
   - Verify email failures don't crash the worker
   - Check error logging

**Fix Required:**
```typescript
// In sendNotification function, verify:
if (preferences?.emailNotifications !== false) {
  // Send email
  try {
    await sendEmail({...});
  } catch (error) {
    console.error('Email send failed:', error);
    // Don't throw - log and continue
  }
}
```

### 4.3 Notification Worker Entry Point
**File**: `workers/notification-worker.ts`

**Verify:**
- Worker starts correctly
- Connects to database
- Connects to Redis queue
- Processes jobs in correct order
- Handles errors gracefully

---

## 5. Database Migration for Address Support

### 5.1 Schema Update (Optional)
If we want to store parsed addresses separately:

```sql
-- Add columns to telegram_bids (optional - can parse on-the-fly)
ALTER TABLE telegram_bids 
ADD COLUMN IF NOT EXISTS parsed_stops JSONB;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_telegram_bids_parsed_stops 
ON telegram_bids USING GIN (parsed_stops);
```

**Note**: This is optional. We can parse addresses on-the-fly from the `stops` field.

---

## 6. Implementation Order

### Phase 1: Address Display (High Priority)
1. Create address parsing utilities (`lib/format.ts`)
2. Update formatting functions
3. Update all component displays (cards → city/state/zip, details → full address)
4. Test across all pages

### Phase 2: Notification Bug Fix (High Priority)
1. Update trigger creation to store specific bid number
2. Update API GET endpoint to prioritize specific bid
3. Update worker to use specific bid
4. Test trigger creation and display

### Phase 3: Backhaul Logic (Medium Priority)
1. Fix backhaul preference check
2. Fix state match backhaul logic
3. Test backhaul matching

### Phase 4: Email System Audit (High Priority)
1. Verify Railway worker configuration
2. Verify email service setup
3. Test email sending
4. Fix any issues found

---

## 7. Testing Checklist

### Address Display
- [ ] Bid cards show "City, State ZIP" format
- [ ] View Details shows full address with all components
- [ ] Works on bid-board page
- [ ] Works on admin console
- [ ] Works in favorites console
- [ ] Works in archive views

### Notification Triggers
- [ ] Creating exact match trigger shows correct bid info
- [ ] Creating state match trigger shows correct bid info
- [ ] Trigger list displays correct bid for each trigger
- [ ] Worker processes triggers with correct bid data

### Backhaul Matching
- [ ] Backhaul exact match works
- [ ] Backhaul state match works
- [ ] Backhaul preference is respected
- [ ] Backhaul notifications are sent correctly

### Email Notifications
- [ ] Emails are sent when matches are found
- [ ] Email preference is respected
- [ ] Email templates render correctly
- [ ] Email contains correct bid information
- [ ] Email failures are logged but don't crash worker

---

## 8. Files to Modify

### Core Files
1. `lib/format.ts` - Address parsing and formatting
2. `lib/schema.ts` - (Optional) Address schema updates
3. `app/api/carrier/notification-triggers/route.ts` - Fix trigger GET endpoint
4. `workers/notification-worker.ts` - Fix trigger processing and backhaul logic

### Component Files
1. `app/bid-board/BidBoardClient.tsx`
2. `app/admin/bids/AdminBiddingConsole.tsx`
3. `components/carrier/FavoritesConsole.tsx`
4. `components/carrier/ManageBidsConsole.tsx`
5. `app/admin/archive-bids/ArchiveBidsTimeline.tsx`

### Configuration Files
1. `railway-worker/package.json` - Verify scripts
2. `railway-worker/railway.toml` - Verify config
3. Environment variables - Verify email service config

---

## 9. Risk Assessment

### Low Risk
- Address display updates (UI only)
- Formatting function changes (backward compatible)

### Medium Risk
- Notification trigger bug fix (affects existing triggers)
- Backhaul logic changes (may change matching behavior)

### High Risk
- Email system changes (could break notifications)
- Database schema changes (if implemented)

**Mitigation:**
- Test thoroughly in development
- Deploy to staging first
- Monitor production logs after deployment
- Have rollback plan ready

---

## 10. Success Criteria

1. ✅ Bid cards show city, state, zip only
2. ✅ View Details shows full addresses
3. ✅ Notification triggers show correct bid information
4. ✅ Backhaul matching works correctly
5. ✅ Email notifications are sent properly
6. ✅ Railway worker processes jobs correctly
7. ✅ All existing functionality continues to work

---

## Next Steps

1. Review and approve this plan
2. Create implementation branches
3. Implement Phase 1 (Address Display)
4. Test Phase 1
5. Implement Phase 2 (Notification Bug Fix)
6. Test Phase 2
7. Continue with remaining phases
8. Final integration testing
9. Deploy to production

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Author**: AI Assistant  
**Status**: Draft - Awaiting Approval

