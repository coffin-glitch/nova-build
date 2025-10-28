# Bid Message Button - Complete Analysis & Implementation Plan

## Current State
The "Message" button on `/carrier/my-bids` is currently a TODO placeholder that only logs to console.

```typescript
onClick={() => {
  // TODO: Connect to bid message console
  console.log('Open message console');
}}
```

---

## Requirements Analysis

### **What Should It Do?**
1. Open a messaging console/chat interface specific to that bid
2. Allow carrier and admin to communicate about the specific bid
3. Show message history for that bid
4. Send new messages
5. Track read/unread status
6. Display on both carrier side (`/carrier/my-bids`) and admin side (`/admin/bids`)

### **Why It's Needed?**
- Carrier needs to communicate questions about awarded bids (pickup time, delivery, etc.)
- Admin needs to provide guidance, answer questions, give updates
- Tracking communication history for each bid lifecycle
- Essential for managing bid lifecycle after acceptance

---

## Existing Messaging Systems in Codebase

### **System 1: `conversations` + `conversation_messages`** 
**Files**: 
- `db/migrations/023_create_proper_messaging_system.sql`
- Purpose: Generic carrier-admin conversations
- Tables:
  - `conversations` (id, carrier_user_id, admin_user_id)
  - `conversation_messages` (id, conversation_id, sender_id, message)
  - `message_reads` (tracks read status)
- **Issue**: Not bid-specific, general conversations

### **System 2: `admin_messages` + `carrier_responses`**
**Files**:
- `db/migrations/010_profile_locking.sql`
- Purpose: Admin-to-carrier messages with responses
- Tables:
  - `admin_messages` (id, carrier_user_id, admin_user_id, subject, message)
  - `carrier_responses` (id, message_id, carrier_user_id, response)
- **Issue**: Not bid-specific, general messaging

### **System 3: `offer_messages`**
**Files**:
- `db/migrations/021_offer_messages.sql`
- Purpose: Messages for load offers
- Tables:
  - `offer_messages` (id, offer_id, sender_id, sender_role, message)
- **Issue**: For load offers, not bids

### **System 4: `carrier_chat_messages`**
**Files**:
- `db/migrations/011_carrier_chat_messages.sql`
- Purpose: Nova chat floating messages
- Tables:
  - `carrier_chat_messages` (id, carrier_user_id, message)
- **Issue**: General chat, not bid-specific

---

## Recommended Solution: Create Bid-Specific Messaging

### **Option A: Use Existing `conversations` Table**
**Pros**:
- ✅ Already exists
- ✅ Has read tracking (`message_reads`)
- ✅ Supports multiple messages per conversation

**Cons**:
- ❌ Not bid-specific
- ❌ Would need to link bid_number to conversation somehow
- ❌ May create confusion between bid messages and general messages

### **Option B: Create New `bid_messages` Table** ⭐ **RECOMMENDED**
**Pros**:
- ✅ Bid-specific, clear purpose
- ✅ Matches pattern of `offer_messages`
- ✅ Can be linked directly to `bid_number`
- ✅ Keeps bid communication organized
- ✅ Easier to query and display

**Cons**:
- ❌ Need to create new table and API

---

## Recommended Implementation

### **Table Schema**
```sql
CREATE TABLE IF NOT EXISTS bid_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_number TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'carrier')),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_bid_messages_bid_number ON bid_messages(bid_number);
CREATE INDEX idx_bid_messages_sender_id ON bid_messages(sender_id);
CREATE INDEX idx_bid_messages_created_at ON bid_messages(created_at);
CREATE INDEX idx_bid_messages_read_at ON bid_messages(read_at);

-- Comments
COMMENT ON TABLE bid_messages IS 'Messages between carriers and admins about specific bids';
COMMENT ON COLUMN bid_messages.bid_number IS 'The bid number this message relates to';
COMMENT ON COLUMN bid_messages.sender_role IS 'Role of sender: admin or carrier';
```

### **API Endpoints**

#### **GET `/api/bid-messages/{bidNumber}`**
- Purpose: Fetch all messages for a specific bid
- Returns: Array of messages with sender info
- Auth: Carrier or admin
- Query:
```sql
SELECT 
  bm.*,
  CASE 
    WHEN bm.sender_role = 'admin' THEN (SELECT concat(first_name, ' ', last_name) FROM users WHERE clerk_user_id = bm.sender_id)
    ELSE (SELECT legal_name FROM carrier_profiles WHERE clerk_user_id = bm.sender_id)
  END as sender_name
FROM bid_messages bm
WHERE bm.bid_number = ${bidNumber}
ORDER BY bm.created_at ASC
```

#### **POST `/api/bid-messages/{bidNumber}`**
- Purpose: Send a new message about a specific bid
- Body: `{ message: string }`
- Auth: Carrier or admin (verify ownership/access)
- Insert:
```sql
INSERT INTO bid_messages (bid_number, sender_id, sender_role, message)
VALUES (${bidNumber}, ${userId}, ${userRole}, ${message})
RETURNING *
```

#### **PUT `/api/bid-messages/{messageId}/read`**
- Purpose: Mark message as read
- Auth: Carrier or admin
- Update:
```sql
UPDATE bid_messages 
SET read_at = CURRENT_TIMESTAMP 
WHERE id = ${messageId}
```

### **Frontend Components**

#### **BidMessageConsole Component**
```typescript
interface BidMessageConsoleProps {
  bidNumber: string;
  userRole: 'admin' | 'carrier';
  userId: string;
  onClose: () => void;
}

// Features:
// - Display message history
// - Input field for new message
// - Send button
// - Real-time updates (SWR)
// - Read indicators
// - Scroll to bottom on new messages
```

### **Button Wire-Up**
```typescript
// In CarrierBidsConsole.tsx
const [selectedMessageBid, setSelectedMessageBid] = useState<string | null>(null);

// Button onClick:
onClick={() => setSelectedMessageBid(bid.bid_number)}

// Render BidMessageConsole:
<BidMessageConsole
  bidNumber={selectedMessageBid}
  userRole="carrier"
  userId={userId}
  onClose={() => setSelectedMessageBid(null)}
/>
```

---

## Admin Side Implementation

### **Admin Bids Page**
- Add "Message" button to each bid card (similar to carrier side)
- Open same `BidMessageConsole` component
- Shows all messages between admin and the winning carrier for that bid
- Can send messages to help with bid execution

---

## Database Connections Summary

### **Tables Involved**
1. **`bid_messages`** (NEW) - Stores all messages for bids
   - Links to `bid_number`
   - Has `sender_id`, `sender_role`
   - Tracks read status
2. **`auction_awards`** - Verify bid ownership
   - GET: Check if user has access to bid
   - POST: Ensure only winner (carrier) or admin can message
3. **`carrier_profiles`** - Get carrier name for display
4. **Admin user info** - Get admin name for display

### **Access Control**
- **Carrier**: Can only message on bids they won (verified via `auction_awards`)
- **Admin**: Can message on any bid
- Both can see full message history

---

## Implementation Steps

1. ✅ Create migration: `050_create_bid_messages_table.sql`
2. ✅ Create API routes: `/api/bid-messages/[bidNumber]/route.ts`
3. ✅ Create frontend component: `BidMessageConsole.tsx`
4. ✅ Wire up button in `CarrierBidsConsole.tsx`
5. ✅ Wire up button in `AdminBiddingConsole.tsx`
6. ✅ Add unread badge counts
7. ✅ Test full flow: send, receive, read status

---

## Benefits

- **Bid-Specific**: Each bid has its own conversation
- **Organized**: Messages tied to specific bids
- **Tracked**: Full conversation history per bid
- **Admin Access**: Admin can help with any bid
- **Carrier Access**: Only for their own awarded bids
- **Clean Separation**: Not mixed with general messaging

