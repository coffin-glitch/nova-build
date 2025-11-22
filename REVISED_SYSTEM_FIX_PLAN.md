# Revised Comprehensive System Fix Plan

## Executive Summary

This document outlines the complete plan to fix address display, notification system bugs, and ensure proper email configuration. **Critical**: The notification system must work with full addresses but match based on **city and state** extraction, not full address strings.

---

## 1. Address Display & Parsing System

### Current State
- Bids now contain full addresses: `street_number`, `street_name`, `city`, `state`, `zipcode`, `USA`
- Currently stored in `stops` field as JSONB array of strings
- Display functions show full addresses everywhere
- **Problem**: Notification matching needs to extract city/state from full addresses

### Required Changes

#### 1.1 Address Parsing Utilities
**File**: `lib/format.ts`

**New Interface:**
```typescript
export interface ParsedAddress {
  streetNumber?: string;
  streetName?: string;
  city: string;
  state: string;
  zipcode?: string;
  country?: string; // Usually "USA"
  fullAddress: string; // Original string
}

/**
 * Parse full address string into structured components
 * Handles formats like:
 * - "123 Main St, Atlanta, GA 30309, USA"
 * - "456 Oak Ave, Dallas, TX 75201"
 * - "789 Pine Rd, Chicago, IL"
 */
export function parseAddress(addressString: string): ParsedAddress {
  if (!addressString || typeof addressString !== 'string') {
    return {
      city: '',
      state: '',
      fullAddress: addressString || ''
    };
  }

  const trimmed = addressString.trim();
  
  // Pattern 1: "Street, City, State ZIP, Country"
  // e.g., "123 Main St, Atlanta, GA 30309, USA"
  let match = trimmed.match(/^(.+?),\s*(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)(?:,\s*(.+))?$/i);
  if (match) {
    const [, street, city, state, zipcode, country] = match;
    const streetMatch = street.match(/^(\d+)\s+(.+)$/);
    return {
      streetNumber: streetMatch ? streetMatch[1] : undefined,
      streetName: streetMatch ? streetMatch[2] : street,
      city: city.trim(),
      state: state.toUpperCase(),
      zipcode: zipcode,
      country: country || 'USA',
      fullAddress: trimmed
    };
  }

  // Pattern 2: "Street, City, State ZIP"
  // e.g., "123 Main St, Atlanta, GA 30309"
  match = trimmed.match(/^(.+?),\s*(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  if (match) {
    const [, street, city, state, zipcode] = match;
    const streetMatch = street.match(/^(\d+)\s+(.+)$/);
    return {
      streetNumber: streetMatch ? streetMatch[1] : undefined,
      streetName: streetMatch ? streetMatch[2] : street,
      city: city.trim(),
      state: state.toUpperCase(),
      zipcode: zipcode,
      country: 'USA',
      fullAddress: trimmed
    };
  }

  // Pattern 3: "City, State ZIP" (no street)
  // e.g., "Atlanta, GA 30309"
  match = trimmed.match(/^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  if (match) {
    const [, city, state, zipcode] = match;
    return {
      city: city.trim(),
      state: state.toUpperCase(),
      zipcode: zipcode,
      country: 'USA',
      fullAddress: trimmed
    };
  }

  // Pattern 4: "City, State" (no zip)
  // e.g., "Atlanta, GA"
  match = trimmed.match(/^(.+?),\s*([A-Z]{2})$/i);
  if (match) {
    const [, city, state] = match;
    return {
      city: city.trim(),
      state: state.toUpperCase(),
      country: 'USA',
      fullAddress: trimmed
    };
  }

  // Fallback: Try to extract city and state from any format
  const stateMatch = trimmed.match(/,\s*([A-Z]{2})(?:\s|$)/i);
  if (stateMatch) {
    const state = stateMatch[1].toUpperCase();
    const parts = trimmed.split(',').map(p => p.trim());
    const city = parts[0] || '';
    return {
      city: city,
      state: state,
      fullAddress: trimmed
    };
  }

  // Last resort: return as-is
  return {
    city: trimmed,
    state: '',
    fullAddress: trimmed
  };
}

/**
 * Extract city and state from address string (for matching)
 * Returns normalized format: "City, State"
 */
export function extractCityState(addressString: string): { city: string; state: string } | null {
  const parsed = parseAddress(addressString);
  if (parsed.city && parsed.state) {
    return {
      city: parsed.city.trim(),
      state: parsed.state.toUpperCase()
    };
  }
  return null;
}

/**
 * Format address for card display: "City, State ZIP"
 */
export function formatAddressForCard(address: string | ParsedAddress): string {
  const parsed = typeof address === 'string' ? parseAddress(address) : address;
  
  if (!parsed.city || !parsed.state) {
    return parsed.fullAddress; // Fallback to full address
  }
  
  if (parsed.zipcode) {
    return `${parsed.city}, ${parsed.state} ${parsed.zipcode}`;
  }
  
  return `${parsed.city}, ${parsed.state}`;
}

/**
 * Format address for details view: Full address with all components
 */
export function formatAddressForDetails(address: string | ParsedAddress): string {
  const parsed = typeof address === 'string' ? parseAddress(address) : address;
  return parsed.fullAddress;
}
```

**Updated Functions:**
```typescript
/**
 * Format stops for card display: "City, State ZIP → City, State ZIP"
 */
export function formatStops(stops: string[] | null): string {
  if (!stops || stops.length === 0) return 'N/A';
  
  const formatted = stops.map(stop => formatAddressForCard(stop));
  
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]} → ${formatted[1]}`;
  return `${formatted[0]} → ... → ${formatted[formatted.length - 1]}`;
}

/**
 * Format stops for details view: Returns parsed addresses
 */
export function formatStopsDetailed(stops: string[] | null): ParsedAddress[] {
  if (!stops || stops.length === 0) return [];
  return stops.map(stop => parseAddress(stop));
}
```

#### 1.2 Component Updates

**Files to Update:**
1. `app/bid-board/BidBoardClient.tsx`
2. `app/admin/bids/AdminBiddingConsole.tsx`
3. `components/carrier/FavoritesConsole.tsx`
4. `components/carrier/ManageBidsConsole.tsx`
5. `app/admin/archive-bids/ArchiveBidsTimeline.tsx`

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
      {address.streetNumber && address.streetName && (
        <p>Street: {address.streetNumber} {address.streetName}</p>
      )}
      <p>City: {address.city}</p>
      <p>State: {address.state}</p>
      {address.zipcode && <p>ZIP: {address.zipcode}</p>}
    </div>
  </div>
))}
```

---

## 2. Notification System: City/State Matching with Full Addresses

### Critical Requirement
**The notification system must:**
1. Accept full addresses in bid data
2. Extract city and state from full addresses
3. Match based on city/state, NOT full address strings
4. Work with existing exact match and state match logic

### 2.1 Enhanced Address Extraction for Matching
**File**: `lib/format.ts` (add to existing file)

```typescript
/**
 * Extract city and state from address for matching purposes
 * Used by notification worker for route matching
 */
export function extractCityStateForMatching(addressString: string): { city: string; state: string } | null {
  const parsed = parseAddress(addressString);
  
  if (parsed.city && parsed.state) {
    // Normalize: uppercase state, trim city
    return {
      city: parsed.city.trim(),
      state: parsed.state.toUpperCase()
    };
  }
  
  return null;
}

/**
 * Compare two addresses by city and state only
 * Returns true if cities and states match (case-insensitive)
 */
export function compareAddressesByCityState(address1: string, address2: string): boolean {
  const cityState1 = extractCityStateForMatching(address1);
  const cityState2 = extractCityStateForMatching(address2);
  
  if (!cityState1 || !cityState2) return false;
  
  return (
    cityState1.city.toUpperCase().trim() === cityState2.city.toUpperCase().trim() &&
    cityState1.state === cityState2.state
  );
}
```

### 2.2 Update Notification Worker Matching Logic
**File**: `workers/notification-worker.ts`

**Update `extractStateFromStop` function:**
```typescript
// Enhanced to work with full addresses
function extractStateFromStop(stop: string): string | null {
  if (!stop || typeof stop !== 'string') return null;
  
  // Use the new parseAddress function
  const { extractCityStateForMatching } = require('../lib/format');
  const cityState = extractCityStateForMatching(stop);
  
  if (cityState && cityState.state) {
    return cityState.state;
  }
  
  // Fallback to original regex-based extraction (for backward compatibility)
  const trimmed = stop.trim().toUpperCase();
  const validStates = new Set([
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ]);
  
  let match = trimmed.match(/,\s*([A-Z]{2})(?:\s|$)/);
  if (match && validStates.has(match[1])) return match[1];
  
  match = trimmed.match(/\s+([A-Z]{2})$/);
  if (match && validStates.has(match[1])) return match[1];
  
  match = trimmed.match(/([A-Z]{2})$/);
  if (match && validStates.has(match[1])) return match[1];
  
  return null;
}

// NEW: Extract city from stop (for exact matching)
function extractCityFromStop(stop: string): string | null {
  if (!stop || typeof stop !== 'string') return null;
  
  const { extractCityStateForMatching } = require('../lib/format');
  const cityState = extractCityStateForMatching(stop);
  
  return cityState ? cityState.city : null;
}
```

**Update `processExactMatchTrigger` function:**
```typescript
async function processExactMatchTrigger(...) {
  // ... existing code to get favoriteRoutes ...
  
  for (const favorite of favoriteRoutes) {
    const favoriteStops = parseStops(favorite.favorite_stops);
    if (favoriteStops.length === 0) continue;

    const origin = favoriteStops[0];
    const destination = favoriteStops[favoriteStops.length - 1];

    // Extract city and state from favorite stops (using new parsing)
    const favoriteOriginCityState = extractCityStateForMatching(origin);
    const favoriteDestCityState = extractCityStateForMatching(destination);
    
    if (!favoriteOriginCityState || !favoriteDestCityState) {
      console.warn(`[ExactMatch] Could not extract city/state from favorite stops`);
      continue;
    }

    // Extract states for state matching
    const favoriteOriginState = favoriteOriginCityState.state;
    const favoriteDestState = favoriteDestCityState.state;

    // Find active bids with route match
    // Query remains the same, but matching logic uses city/state extraction
    let routeMatches;
    if (matchType === 'exact') {
      routeMatches = await sql`
        SELECT 
          tb.bid_number,
          tb.stops,
          tb.distance_miles,
          tb.tag,
          tb.pickup_timestamp,
          tb.delivery_timestamp,
          tb.received_at
        FROM telegram_bids tb
        WHERE tb.is_archived = false
          AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes')
          AND tb.bid_number != ${favorite.favorite_bid}
        ORDER BY tb.received_at DESC
        LIMIT 50
      `;
    } else if (matchType === 'state' && favoriteDistanceRange) {
      routeMatches = await sql`
        SELECT 
          tb.bid_number,
          tb.stops,
          tb.distance_miles,
          tb.tag,
          tb.pickup_timestamp,
          tb.delivery_timestamp,
          tb.received_at
        FROM telegram_bids tb
        WHERE tb.is_archived = false
          AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes')
          AND tb.distance_miles >= ${favoriteDistanceRange.minDistance}
          AND tb.distance_miles <= ${favoriteDistanceRange.maxDistance}
        ORDER BY tb.received_at DESC
        LIMIT 50
      `;
    }

    for (const match of routeMatches) {
      // ... cooldown check ...
      
      const matchStops = parseStops(match.stops);
      if (matchStops.length === 0) continue;

      const matchOrigin = matchStops[0];
      const matchDest = matchStops[matchStops.length - 1];

      // Extract city and state from match stops (using new parsing)
      const matchOriginCityState = extractCityStateForMatching(matchOrigin);
      const matchDestCityState = extractCityStateForMatching(matchDest);
      
      if (!matchOriginCityState || !matchDestCityState) continue;

      // Extract states from match
      const matchOriginState = matchOriginCityState.state;
      const matchDestState = matchDestCityState.state;

      // Check for exact match (city-to-city) - NOW USES PARSED CITY/STATE
      const isExactMatch = (
        matchOriginCityState.city.toUpperCase().trim() === favoriteOriginCityState.city.toUpperCase().trim() &&
        matchDestCityState.city.toUpperCase().trim() === favoriteDestCityState.city.toUpperCase().trim()
      );

      // Check for state match (state-to-state)
      const isStateMatch = (
        matchType === 'state' &&
        matchOriginState === favoriteOriginState &&
        matchDestState === favoriteDestState
      );

      // Check for backhaul match (reverse route) - NOW USES PARSED CITY/STATE
      const isBackhaulMatch = (
        matchOriginCityState.city.toUpperCase().trim() === favoriteDestCityState.city.toUpperCase().trim() &&
        matchDestCityState.city.toUpperCase().trim() === favoriteOriginCityState.city.toUpperCase().trim()
      );

      // Check for backhaul state match
      const isBackhaulStateMatch = (
        matchType === 'state' &&
        matchOriginState === favoriteDestState &&
        matchDestState === favoriteOriginState
      );

      // ... rest of matching logic ...
    }
  }
}
```

### 2.3 Update FavoritesConsole Matching
**File**: `components/carrier/FavoritesConsole.tsx`

Update `extractStateFromStop` to use new parsing:
```typescript
const extractStateFromStop = (stop: string): string | null => {
  if (!stop) return null;
  
  // Use new parsing function
  const { extractCityStateForMatching } = require('@/lib/format');
  const cityState = extractCityStateForMatching(stop);
  
  return cityState ? cityState.state : null;
};
```

---

## 3. Notification Trigger Bug Fix

### Problem
When creating exact/state match triggers, the system shows wrong bid info (most recent favorite instead of selected bid).

### Solution

#### 3.1 Store Specific Bid Number
**File**: `components/carrier/FavoritesConsole.tsx`

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
        favoriteBidNumber: bidNumber, // Store specific bid
        favoriteStops: favorite.stops, // Store stops for reference
        favoriteOriginCityState: extractCityStateForMatching(favorite.stops[0]), // Store parsed origin
        favoriteDestCityState: extractCityStateForMatching(favorite.stops[favorite.stops.length - 1]), // Store parsed dest
      },
      isActive: true
    })
  });
  
  // Same for handleCreateStateMatchTrigger
};
```

#### 3.2 Update API GET Endpoint
**File**: `app/api/carrier/notification-triggers/route.ts`

Prioritize specific bid number:
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
}
```

#### 3.3 Update Worker to Use Specific Bid
**File**: `workers/notification-worker.ts`

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
    // Fallback to distance range
    // ...
  }
  
  // ... rest of function
}
```

---

## 4. Backhaul Logic Fix

### 4.1 Backhaul Preference Check
**File**: `workers/notification-worker.ts`

```typescript
// Fixed: Prioritize trigger-specific setting
const backhaulEnabled = config.backhaulEnabled !== undefined 
  ? config.backhaulEnabled 
  : (preferences?.prioritize_backhaul || 
     preferences?.prioritizeBackhaul || 
     false);
```

### 4.2 Backhaul State Match Logic
**File**: `workers/notification-worker.ts`

```typescript
// Always extract states from favorite stops (using new parsing)
const favoriteOriginCityState = extractCityStateForMatching(origin);
const favoriteDestCityState = extractCityStateForMatching(destination);

// Use config states only if favorite states are unavailable
const checkOriginState = config.originState || favoriteOriginCityState?.state;
const checkDestState = config.destinationState || favoriteDestCityState?.state;

// Backhaul state match
const isBackhaulStateMatch = (
  matchType === 'state' &&
  matchOriginState && matchDestState &&
  checkOriginState && checkDestState &&
  matchOriginState === checkDestState &&
  matchDestState === checkOriginState
);
```

---

## 5. Email Notification System Audit

### 5.1 Railway Worker Configuration
**Files to Check:**
- `railway-worker/package.json`
- `railway-worker/railway.toml`
- `workers/notification-worker.ts`

**Verification Checklist:**
- [ ] Railway worker service is running
- [ ] Environment variables are set (DATABASE_URL, REDIS_URL, RESEND_API_KEY, etc.)
- [ ] Email service (Resend/SMTP) is configured
- [ ] Worker connects to database successfully
- [ ] Worker processes queue jobs
- [ ] Email sending function is called correctly

### 5.2 Email Sending Function
**File**: `workers/notification-worker.ts`

**Verify:**
```typescript
// In sendNotification function:
if (preferences?.emailNotifications !== false) {
  try {
    await sendEmail({...});
  } catch (error) {
    console.error('Email send failed:', error);
    // Don't throw - log and continue
  }
}
```

### 5.3 Email Templates
**Verify email templates include:**
- Full address in email (for user reference)
- City and state prominently displayed
- Correct bid information
- Proper formatting

---

## 6. Implementation Order

### Phase 1: Address Parsing & Display (High Priority)
1. Create address parsing utilities (`lib/format.ts`)
2. Update formatting functions
3. Update all component displays (cards → city/state/zip, details → full address)
4. Test across all pages

### Phase 2: Notification Matching with Full Addresses (Critical)
1. Add city/state extraction functions
2. Update notification worker matching logic
3. Update FavoritesConsole matching
4. Test exact match with full addresses
5. Test state match with full addresses

### Phase 3: Notification Trigger Bug Fix (High Priority)
1. Update trigger creation to store specific bid number
2. Update API GET endpoint to prioritize specific bid
3. Update worker to use specific bid
4. Test trigger creation and display

### Phase 4: Backhaul Logic (Medium Priority)
1. Fix backhaul preference check
2. Fix state match backhaul logic
3. Test backhaul matching

### Phase 5: Email System Audit (High Priority)
1. Verify Railway worker configuration
2. Verify email service setup
3. Test email sending
4. Fix any issues found

---

## 7. Testing Checklist

### Address Display
- [ ] Bid cards show "City, State ZIP" format
- [ ] View Details shows full address with all components
- [ ] Address parsing handles various formats correctly
- [ ] Works on bid-board page
- [ ] Works on admin console
- [ ] Works in favorites console
- [ ] Works in archive views

### Notification Matching with Full Addresses
- [ ] Exact match works with full addresses (matches on city/state)
- [ ] State match works with full addresses (matches on state)
- [ ] Backhaul exact match works with full addresses
- [ ] Backhaul state match works with full addresses
- [ ] Matching ignores street address, zipcode differences
- [ ] Matching is case-insensitive for cities

### Notification Triggers
- [ ] Creating exact match trigger shows correct bid info
- [ ] Creating state match trigger shows correct bid info
- [ ] Trigger list displays correct bid for each trigger
- [ ] Worker processes triggers with correct bid data

### Email Notifications
- [ ] Emails are sent when matches are found
- [ ] Email preference is respected
- [ ] Email templates render correctly
- [ ] Email contains correct bid information (with full addresses)
- [ ] Email failures are logged but don't crash worker

---

## 8. Files to Modify

### Core Files
1. `lib/format.ts` - Address parsing, formatting, and city/state extraction
2. `app/api/carrier/notification-triggers/route.ts` - Fix trigger GET endpoint
3. `workers/notification-worker.ts` - Fix matching logic, backhaul, city/state extraction

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

## 9. Key Design Decisions

### 9.1 Address Parsing
- **Decision**: Parse addresses on-the-fly (no database changes)
- **Rationale**: Flexible, handles various formats, no migration needed
- **Trade-off**: Slight performance cost, but acceptable for notification frequency

### 9.2 Matching Logic
- **Decision**: Match on city/state only, ignore street address and zipcode
- **Rationale**: Users care about route (city-to-city), not specific addresses
- **Benefit**: More flexible matching, handles address variations

### 9.3 Backward Compatibility
- **Decision**: Support both old format (city, state) and new format (full address)
- **Rationale**: Existing data may have old format
- **Implementation**: Parsing function handles both gracefully

---

## 10. Success Criteria

1. ✅ Bid cards show city, state, zip only
2. ✅ View Details shows full addresses
3. ✅ Notification matching works with full addresses (matches on city/state)
4. ✅ Notification triggers show correct bid information
5. ✅ Backhaul matching works correctly
6. ✅ Email notifications are sent properly
7. ✅ Railway worker processes jobs correctly
8. ✅ All existing functionality continues to work
9. ✅ Matching is based on city/state, not full address strings

---

## Next Steps

1. Review and approve this plan
2. Create implementation branches
3. Implement Phase 1 (Address Parsing & Display)
4. Test Phase 1
5. Implement Phase 2 (Notification Matching)
6. Test Phase 2 (critical - ensure matching works)
7. Continue with remaining phases
8. Final integration testing
9. Deploy to production

---

**Document Version**: 2.0  
**Last Updated**: 2024  
**Author**: AI Assistant  
**Status**: Revised - Ready for Implementation

**Key Changes from v1.0:**
- Added comprehensive address parsing system
- Ensured notification matching works with full addresses but matches on city/state
- Enhanced city/state extraction for matching
- Updated all matching logic to use parsed city/state
- Maintained backward compatibility

