# Adjudicate Button & Bid Adjudication Console - Complete System Documentation

## Overview
The **Adjudicate Button** on `/admin/bids` page allows admin users to award bids to winning carriers. The system involves multiple database tables, API endpoints, and a comprehensive UI console for managing the award process.

---

## How It Works

### 1. **Button Click Flow**
```
User clicks "Adjudicate" button on a bid card
    ↓
setAdjudicationBid(bid) - Opens BidAdjudicationConsole dialog
    ↓
Fetch bid details from API: GET /api/admin/bids/{bidNumber}/award
    ↓
Console displays: Auction overview + All carrier bids + Award status
    ↓
Admin selects winner + adds notes + clicks "Award Bid"
    ↓
POST /api/admin/bids/{bidNumber}/award - Award the auction
    ↓
Notifications created for all bidders
    ↓
Dialog closes + Main bids list refreshes
```

### 2. **Database Tables Involved**

#### **`telegram_bids`** (Auction Data)
- **Purpose**: Stores the original bid/auction from Telegram
- **Key Columns**:
  - `bid_number` (TEXT) - Unique bid identifier
  - `distance_miles` - Route distance
  - `stops` - Pickup/delivery locations
  - `pickup_timestamp` - When load needs to be picked up
  - `delivery_timestamp` - When load needs to be delivered
  - `received_at` - When bid was received from Telegram
- **Relationship**: Referenced by `carrier_bids` and `auction_awards`

#### **`carrier_bids`** (Carrier Offers)
- **Purpose**: Stores individual carrier bids/offers on auctions
- **Key Columns**:
  - `id` (BIGSERIAL) - Primary key
  - `bid_number` (TEXT) - References `telegram_bids`
  - `clerk_user_id` (TEXT) - References `carrier_profiles`
  - `amount_cents` (INTEGER) - Bid amount in cents
  - `notes` (TEXT) - Optional notes from carrier
  - `created_at` (TIMESTAMPTZ) - When bid was placed
  - `updated_at` (TIMESTAMPTZ) - Last update
  - `status` (TEXT) - Bid status: 'awarded', 'active', 'completed', 'cancelled'
  - `lifecycle_notes` (TEXT) - Notes about bid lifecycle
  - Driver info columns (driver_name, driver_phone, truck_number, etc.)
- **Indexes**:
  - `idx_carrier_bids_bid_amount` - For sorting bids by amount
  - `idx_carrier_bids_user_id` - For querying user's bids
- **Constraint**: UNIQUE(bid_number, clerk_user_id) - One bid per carrier per auction
- **Query in Adjudication Console**:
  ```sql
  SELECT cb.*, cp.legal_name, cp.mc_number, cp.phone, ...
  FROM carrier_bids cb
  LEFT JOIN carrier_profiles cp ON cb.clerk_user_id = cp.clerk_user_id
  WHERE cb.bid_number = {bidNumber}
  ORDER BY cb.amount_cents ASC  -- Lowest bid first
  ```

#### **`carrier_profiles`** (Carrier Info)
- **Purpose**: Stores carrier company information
- **Key Columns**:
  - `clerk_user_id` (TEXT) - Primary key, references Clerk user
  - `legal_name` - Company legal name
  - `mc_number` - DOT/MC number
  - `dot_number` - DOT number
  - `phone` - Contact phone
  - `email` - Contact email
  - `company_name` - Company name
  - `contact_name` - Primary contact
- **Relationship**: Joined with `carrier_bids` to show carrier details in adjudication console

#### **`auction_awards`** (Award Record)
- **Purpose**: Stores the final award decision when an auction is adjudicated
- **Key Columns**:
  - `id` (BIGSERIAL) - Primary key
  - `bid_number` (TEXT UNIQUE) - References `telegram_bids`
  - `winner_user_id` (TEXT) - References `carrier_profiles` (the winning carrier)
  - `winner_amount_cents` (INTEGER) - The winning bid amount
  - `awarded_by` (TEXT) - Admin user ID who adjudicated
  - `awarded_at` (TIMESTAMPTZ) - When award was created
  - **Note**: `admin_notes` column may not exist - needs to be added
- **Constraint**: UNIQUE(bid_number) - Only one award per auction
- **Award Process**:
  1. Admin clicks "Adjudicate" button
  2. Console fetches all carrier bids for that auction
  3. Admin selects winner from list of bids
  4. Admin adds optional notes
  5. POST request creates `auction_awards` record
  6. Notifications sent to all bidders

#### **`loads`** (Load Assignment)
- **Purpose**: Creates a load record for the winning carrier
- **Created Automatically** when auction is awarded:
  ```sql
  INSERT INTO loads (rr_number, carrier_user_id, status, meta)
  VALUES ({bidNumber}, {winnerUserId}, 'awarded', ...)
  ```
- **Relationship**: Links awarded bids to load management system

#### **`notifications`** (User Notifications)
- **Purpose**: Sends notifications to carriers about award results
- **Created When**:
  - Winner: "You won Bid #XXX for $XXX"
  - Other bidders: "Bid #XXX was awarded to another carrier"
- **Columns**:
  - `id` (BIGSERIAL)
  - `recipient_user_id` (TEXT) - Clerk user ID
  - `type` (TEXT) - 'success', 'info', etc.
  - `title` (TEXT)
  - `body` (TEXT)

---

## 3. API Endpoints

### **GET `/api/admin/bids/{bidNumber}/award`**
- **Purpose**: Fetch complete bid details for adjudication console
- **Returns**:
  ```json
  {
    "success": true,
    "data": {
      "auction": { /* telegram_bids record */ },
      "bids": [ /* array of carrier_bids with carrier_profiles joined */ ],
      "award": { /* existing award if already adjudicated */ },
      "timeLeftSeconds": 1234,
      "totalBids": 5,
      "lowestBid": { /* lowest carrier_bid */ },
      "highestBid": { /* highest carrier_bid */ }
    }
  }
  ```
- **Queries**:
  1. Fetch carrier bids with carrier profile details (ordered by amount ASC)
  2. Fetch auction details from `telegram_bids`
  3. Fetch existing award (if already adjudicated)
  4. Calculate time left until auction expires (25 minutes)

### **POST `/api/admin/bids/{bidNumber}/award`**
- **Purpose**: Award auction to winning carrier
- **Request Body**:
  ```json
  {
    "winnerUserId": "user_abc123",
    "adminNotes": "Selected for reliability and competitive pricing"
  }
  ```
- **Process**:
  1. Verify winner has a bid for this auction (query `carrier_bids`)
  2. Check if already awarded (query `auction_awards`)
  3. Create `auction_awards` record
  4. Add admin notes (requires `admin_notes` column in `auction_awards`)
  5. Create winner notification
  6. Create notifications for other bidders
  7. Create load assignment in `loads` table
  8. Return success with award details
- **Returns**:
  ```json
  {
    "success": true,
    "data": { /* full award details with winner info */ },
    "message": "Auction 89789692 awarded successfully to ACME Logistics"
  }
  ```

---

## 4. Bid Adjudication Console UI

### **Components** (from `AdminBiddingConsole.tsx`)

#### **Auction Overview Card**
- Displays route (stops), distance, status (Active/Expired/Awarded)
- Badge shows auction status

#### **Carrier Bids List**
- Shows all bids sorted by amount (lowest first)
- **Columns**:
  - Checkbox to select winner
  - Carrier legal name
  - MC/DOT numbers
  - Bid amount (formatted as $)
  - Notes (if provided)
  - Contact info (phone, email)

#### **Pagination**
- Shows 5 bids per page (if many bidders)
- Navigate with page numbers
- Clear selection when changing pages

#### **Admin Notes Textarea**
- Optional notes to add to the award record
- Stored in `auction_awards.admin_notes` (needs column)

#### **Action Buttons**
- "Award Bid" - Creates award and sends notifications
- "Cancel" - Closes dialog without saving

#### **Status Badges**
- Active: Blue "ACTIVE" badge
- Expired: Red "EXPIRED" badge
- Awarded: Green "AWARDED" badge

---

## 5. Award Process (from `lib/auctions.ts`)

### **`awardAuction()` Function**
```typescript
export async function awardAuction({
  bid_number,
  winner_user_id,
  awarded_by,
}: {
  bid_number: string;
  winner_user_id: string;
  awarded_by: string;
}): Promise<AuctionAward>
```

**Steps**:
1. **Verify Winner Has Bid**:
   ```sql
   SELECT amount_cents FROM carrier_bids
   WHERE bid_number = {bid_number} AND clerk_user_id = {winner_user_id}
   ```
   - Throws error if winner doesn't have a bid

2. **Check If Already Awarded**:
   ```sql
   SELECT id FROM auction_awards WHERE bid_number = {bid_number}
   ```
   - Throws error if already awarded

3. **Create Award Record**:
   ```sql
   INSERT INTO auction_awards (bid_number, winner_user_id, winner_amount_cents, awarded_by)
   VALUES ({bid_number}, {winner_user_id}, {amount_cents}, {awarded_by})
   RETURNING *
   ```

4. **Create Winner Notification**:
   ```sql
   INSERT INTO notifications (recipient_user_id, type, title, body)
   VALUES ({winner_user_id}, 'success', 'Auction Won!', 'You won Bid #{bid_number}...')
   ```

5. **Create Notifications for Other Bidders**:
   ```sql
   SELECT DISTINCT clerk_user_id FROM carrier_bids
   WHERE bid_number = {bid_number} AND clerk_user_id != {winner_user_id}
   ```
   Then create info notifications for each

6. **Create Load Assignment**:
   ```sql
   INSERT INTO loads (rr_number, carrier_user_id, status, meta)
   VALUES ({bid_number}, {winner_user_id}, 'awarded', {jsonb_meta})
   ON CONFLICT (rr_number) DO NOTHING
   ```

7. **Return Award Record**

---

## 6. Missing Column Issue

### **Problem**: `admin_notes` Column Doesn't Exist

The POST endpoint tries to update `auction_awards.admin_notes`, but this column doesn't exist in the database.

**Current Schema** (from `006_auctions_and_bidding.sql`):
```sql
CREATE TABLE IF NOT EXISTS public.auction_awards (
    id BIGSERIAL PRIMARY KEY,
    bid_number TEXT NOT NULL UNIQUE,
    winner_user_id TEXT NOT NULL,
    winner_amount_cents INTEGER NOT NULL,
    awarded_by TEXT NOT NULL,
    awarded_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Fix Needed**: Add `admin_notes` column

```sql
ALTER TABLE auction_awards 
ADD COLUMN IF NOT EXISTS admin_notes TEXT;
```

---

## 7. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Admin clicks "Adjudicate" button on bid card                │
└────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  BidAdjudicationConsole opens                              │
│  - Fetch: GET /api/admin/bids/{bidNumber}/award           │
└────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Console Displays:                                          │
│  ✅ Auction Overview (route, distance, status)             │
│  ✅ Carrier Bids (sorted by amount, lowest first)          │
│  ✅ Winner Selection (checkbox per bid)                    │
│  ✅ Admin Notes (textarea)                                 │
└────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Admin selects winner + adds notes + clicks "Award Bid"     │
└────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  POST /api/admin/bids/{bidNumber}/award                    │
│  Body: { winnerUserId, adminNotes }                         │
└────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  awardAuction() function:                                   │
│  1. Verify winner has bid (carrier_bids)                   │
│  2. Check if already awarded (auction_awards)              │
│  3. INSERT INTO auction_awards                              │
│  4. UPDATE auction_awards SET admin_notes                  │
│  5. INSERT notifications for winner & bidders               │
│  6. INSERT INTO loads (load assignment)                    │
└────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Dialog closes + Main bids list refreshes                  │
│  Winner shows "Awarded" status                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Summary

**Database Tables**:
- `telegram_bids` - Original auction/bid data
- `carrier_bids` - Carrier offers on auctions (with carrier profile joined)
- `carrier_profiles` - Carrier company information
- `auction_awards` - Final award record (needs `admin_notes` column added)
- `loads` - Load assignment for winners
- `notifications` - User notifications about awards

**Key Features**:
- ✅ Admin-only access (verified via Clerk)
- ✅ Real-time bid display (sorted by amount)
- ✅ Winner selection with checkbox
- ✅ Admin notes (needs database column)
- ✅ Automatic notifications for all bidders
- ✅ Load assignment creation
- ✅ Prevents duplicate awards
- ✅ Validates winner has bid

**Missing**: `admin_notes` column in `auction_awards` table needs to be added.

---

## 9. Testing the System

**To Test**:
1. Go to `/admin/bids` page
2. Click "Adjudicate" on any bid
3. Console should display:
   - Auction details
   - All carrier bids (ordered lowest to highest)
   - Winner selection checkboxes
   - Admin notes textarea
4. Select a winner, add notes, click "Award Bid"
5. Console closes, bid shows "Awarded" status
6. Winner and other bidders receive notifications

**Database Query to Check**:
```sql
-- See all awards
SELECT aa.*, cp.legal_name as winner_name
FROM auction_awards aa
LEFT JOIN carrier_profiles cp ON aa.winner_user_id = cp.clerk_user_id
ORDER BY aa.awarded_at DESC;

-- See all bids for a specific auction
SELECT cb.*, cp.legal_name
FROM carrier_bids cb
LEFT JOIN carrier_profiles cp ON cb.clerk_user_id = cp.clerk_user_id
WHERE cb.bid_number = '89789692'
ORDER BY cb.amount_cents ASC;
```

