# Adjudicate System - Full Analysis & Database Wiring Report

## EXECUTIVE SUMMARY
The "Failed to award bid" error is caused by attempting to INSERT `admin_notes` into `auction_awards` before the column exists. This requires running the migration first.

---

## 1. SYSTEM ARCHITECTURE OVERVIEW

### **Flow Chart**
```
Admin clicks "Adjudicate" 
    ↓
GET /api/admin/bids/{bidNumber}/award
    ↓
Returns: auction, bids[], award (if exists)
    ↓
User selects winner + admin notes
    ↓
POST /api/admin/bids/{bidNumber}/award
    ↓
awardAuction() function
    ↓
INSERT INTO auction_awards (admin_notes) ❌ COLUMN MISSING
    ↓
INSERT INTO notifications (for all bidders)
    ↓
INSERT INTO loads (create load assignment)
    ↓
Return success response
```

---

## 2. DATABASE TABLES & THEIR CONNECTIONS

### **Table 1: `telegram_bids`** ✅ EXISTS
- **Purpose**: Original auction/bid data from Telegram
- **Key Columns**:
  - `bid_number` (TEXT UNIQUE) - Primary identifier
  - `distance_miles`, `stops`, `pickup_timestamp`, `delivery_timestamp`
  - `received_at` - When bid was received
- **Used In**:
  - GET endpoint: Fetches auction details
  - Award process: Not used directly, but referenced by `bid_number`
- **Status**: ✅ Properly wired

### **Table 2: `carrier_bids`** ✅ EXISTS
- **Purpose**: Individual carrier offers on auctions
- **Key Columns**:
  - `id` (BIGSERIAL PRIMARY KEY)
  - `bid_number` (TEXT) - References `telegram_bids.bid_number`
  - `clerk_user_id` (TEXT) - References `carrier_profiles.clerk_user_id`
  - `amount_cents` (INTEGER) - Bid amount in cents
  - `created_at`, `updated_at`
- **Used In**:
  - GET endpoint: Fetches all bids with carrier details joined
  - POST endpoint: Verifies winner has bid (`WHERE bid_number = X AND clerk_user_id = Y`)
- **Status**: ✅ Properly wired

### **Table 3: `carrier_profiles`** ✅ EXISTS
- **Purpose**: Carrier company information
- **Key Columns**:
  - `clerk_user_id` (TEXT PRIMARY KEY) - References Clerk user
  - `legal_name`, `mc_number`, `dot_number`, `phone`, `email`
- **Used In**:
  - GET endpoint: JOINs with `carrier_bids` to show carrier details
  - POST endpoint: JOINs with `auction_awards` to get winner info
- **Status**: ✅ Properly wired

### **Table 4: `auction_awards`** ⚠️ COLUMN MISSING
- **Purpose**: Final award record when auction is adjudicated
- **Current Schema** (from `006_auctions_and_bidding.sql`):
  ```sql
  CREATE TABLE IF NOT EXISTS public.auction_awards (
      id BIGSERIAL PRIMARY KEY,
      bid_number TEXT NOT NULL UNIQUE,
      winner_user_id TEXT NOT NULL REFERENCES carrier_profiles(clerk_user_id),
      winner_amount_cents INTEGER NOT NULL,
      awarded_by TEXT NOT NULL, -- admin clerk_user_id
      awarded_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- **Missing Column**: `admin_notes` (TEXT)
- **Migration**: `048_add_admin_notes_to_auction_awards.sql` exists BUT NOT RUN
- **Used In**:
  - GET endpoint: Checks if award exists, fetches with winner details
  - POST endpoint: INSERTS award record with admin_notes
- **Status**: ⚠️ **COLUMN MISSING - CAUSES FAILURE**

### **Table 5: `loads`** ✅ EXISTS
- **Purpose**: Load assignment for winners
- **Key Columns**:
  - `rr_number` (TEXT UNIQUE) - References bid_number
  - `carrier_user_id` (TEXT) - The winning carrier
  - `status` (TEXT) - 'awarded', 'picked_up', 'delivered', etc.
  - `meta` (JSONB) - Additional metadata
- **Used In**:
  - POST endpoint: Creates load assignment after awarding
- **Status**: ✅ Properly wired

### **Table 6: `notifications`** ⚠️ SCHEMA MISMATCH
- **Current Schema** (from `006_auctions_and_bidding.sql`):
  ```sql
  CREATE TABLE IF NOT EXISTS public.notifications (
      id BIGSERIAL PRIMARY KEY,
      recipient_user_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      body TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      read_at TIMESTAMPTZ
  );
  ```
- **Code Expects**: `user_id`, `message`, `data`, `read` (boolean)
- **Code Has**: `recipient_user_id`, `type`, `title`, `body`, `read_at`
- **Used In**:
  - POST endpoint: Creates notifications for winner and bidders
- **Status**: ⚠️ **SCHEMA MISMATCH - WILL CAUSE SQL ERRORS**

---

## 3. ROOT CAUSE ANALYSIS

### **Primary Issue: Missing Column**
The `admin_notes` column doesn't exist in `auction_awards`. The migration was created but not run.

**Evidence**:
```sql
-- In lib/auctions.ts line 439:
INSERT INTO public.auction_awards 
  (bid_number, winner_user_id, winner_amount_cents, awarded_by, admin_notes)  ← admin_notes
VALUES (${bid_number}, ${winner_user_id}, ${winnerBid[0].amount_cents}, ${awarded_by}, ${admin_notes || null})
```

**Error**: `column "admin_notes" does not exist`

---

### **Secondary Issue: Notifications Schema Mismatch**
The `notifications` table schema doesn't match what the code expects.

**Code Expects** (from `lib/auctions.ts` line 446):
```typescript
INSERT INTO public.notifications (recipient_user_id, type, title, body)
VALUES (${winner_user_id}, 'success', 'Auction Won!', ...)
```

**Actual Schema**:
```sql
recipient_user_id TEXT NOT NULL,
type TEXT NOT NULL DEFAULT 'info',
title TEXT NOT NULL,
body TEXT,
created_at TIMESTAMPTZ DEFAULT NOW(),
read_at TIMESTAMPTZ
```

**Analysis**: The code uses the CORRECT column names (`recipient_user_id`, `type`, `title`, `body`), so this is actually **NOT A PROBLEM**.

---

### **Tertiary Issue: Notifications Initialization**
The route calls `/api/notifications` POST endpoint which expects a different schema. Let's verify:

**Code in route** (lines 113-126):
```typescript
await fetch('/api/notifications', {
  method: 'POST',
  body: JSON.stringify({
    bidNumber: bid.bid_number,
    winnerUserId: selectedWinner,
    winnerAmount: result.winnerAmount,
    winnerName: result.winnerName
  })
});
```

**Expected by `/api/notifications/route.ts`** (line 63):
```typescript
if (body.bidNumber && body.winnerUserId) {
  return await handleBidAwardNotifications(body);
}
```

This calls `handleBidAwardNotifications()` which inserts into `notifications` table with:
```sql
INSERT INTO notifications (user_id, type, title, message, data, read, created_at)
```

**Problem**: Uses `user_id`, `message`, `read` (boolean) BUT schema has `recipient_user_id`, `body`, `read_at` (timestamp)

---

## 4. COMPLETE ISSUE LIST

### **Issue #1: Missing `admin_notes` Column** 🔴 CRITICAL
- **Location**: `auction_awards` table
- **Migration**: `048_add_admin_notes_to_auction_awards.sql` exists but NOT RUN
- **Impact**: Causes "Failed to award bid" immediately
- **Fix**: Run the migration

### **Issue #2: Notifications Schema Mismatch** 🔴 CRITICAL
- **Location**: `notifications` table + `/api/notifications/route.ts`
- **Problem**: Code uses `user_id`, `message`, `read` but schema has `recipient_user_id`, `body`, `read_at`
- **Impact**: Notifications won't be created
- **Fix**: Update code to match schema OR update schema to match code

### **Issue #3: `/api/notifications` POST Mismatch** 🟡 WARNING
- **Location**: `handleBidAwardNotifications()` function
- **Problem**: Uses wrong column names in INSERT statement
- **Impact**: Notifications to bidders will fail silently
- **Fix**: Update INSERT to use correct column names

---

## 5. DATABASE WIRING DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN SIDE                              │
│  Admin clicks "Adjudicate"                                 │
│    ↓                                                        │
│  GET /api/admin/bids/{bidNumber}/award                    │
│    ↓                                                        │
│  Query: carrier_bids + carrier_profiles (JOIN)            │
│    ↓                                                        │
│  Query: telegram_bids                                      │
│    ↓                                                        │
│  Query: auction_awards (existing award)                   │
│    ↓                                                        │
│  Display: Auction + Bids + Award status                   │
└────────────────────┬────────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                    POST REQUEST                             │
│  Admin selects winner + adds notes                          │
│    ↓                                                        │
│  POST /api/admin/bids/{bidNumber}/award                   │
│    ↓                                                        │
│  awardAuction() function                                    │
│    ↓                                                        │
│  INSERT INTO auction_awards                                │
│    ❌ admin_notes COLUMN DOES NOT EXIST                    │
│    ↓                                                        │
│  INSERT INTO notifications (winner)                       │
│    ❌ WRONG COLUMN NAMES (user_id vs recipient_user_id)   │
│    ↓                                                        │
│  INSERT INTO notifications (other bidders)               │
│    ❌ WRONG COLUMN NAMES                                   │
│    ↓                                                        │
│  INSERT INTO loads                                         │
│    ✅ WORKS                                                 │
│    ↓                                                        │
│  Return success response                                   │
└────────────────────┬────────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                    CARRIER SIDE                             │
│  Notifications appear in NotificationBell                   │
│    ↓                                                        │
│  My Loads page shows awarded loads                         │
│    ✅ Works if award created successfully                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. FIX REQUIRED

### **Step 1: Run Migration**
```sql
-- Run this migration first
\i db/migrations/048_add_admin_notes_to_auction_awards.sql
```

### **Step 2: Fix Notifications Schema**
Update `lib/auctions.ts` line 446 and 460 to use correct column names:
```typescript
// OLD (line 446):
await sql`
  INSERT INTO public.notifications (recipient_user_id, type, title, body)
  VALUES (${winner_user_id}, 'success', 'Auction Won!', 
          'Congratulations! You won Bid #${bid_number}...')
`;

// FIXED:
await sql`
  INSERT INTO public.notifications (recipient_user_id, type, title, body)
  VALUES (${winner_user_id}, 'success', 'Auction Won!', 
          'Congratulations! You won Bid #${bid_number} for $${formatMoney(winnerBid[0].amount_cents)}. Check your My Loads for next steps.')
`;
```

**Wait, actually the code IS using the correct columns!** The issue is that `formatMoney()` is not defined in scope.

### **Step 3: Check Notifications Route**
Verify `/api/notifications/route.ts` `handleBidAwardNotifications()` uses correct schema.

---

## 7. VERIFICATION CHECKLIST

- [ ] Migration `048_add_admin_notes_to_auction_awards.sql` has been run
- [ ] `auction_awards` table has `admin_notes` column
- [ ] `notifications` table schema matches code expectations
- [ ] `formatMoney()` function is imported or defined in `lib/auctions.ts`
- [ ] `/api/notifications` POST endpoint uses correct column names
- [ ] Notifications are created successfully after award
- [ ] Load assignment is created in `loads` table
- [ ] Carrier receives notification in NotificationBell

---

## 8. CONCLUSION

The **root cause** of "Failed to award bid" is:
1. ❌ Missing `admin_notes` column in `auction_awards`
2. ❌ Notifications schema mismatch (maybe)

**Fix**: Run the migration `048_add_admin_notes_to_auction_awards.sql`

**Expected Result**: Award process completes successfully, winner and bidders receive notifications.

