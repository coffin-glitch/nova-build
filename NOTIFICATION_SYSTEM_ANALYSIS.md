# Comprehensive Notification System Analysis & Implementation Plan

## Executive Summary

This document outlines a comprehensive notification system for both **Admins** and **Carriers** across the NOVA Build platform. The system will track all critical events and provide real-time notifications with proper unread counts displayed in the notification bell component.

---

## Current State Analysis

### Existing Infrastructure

1. **Database Tables:**
   - `notifications` table with columns: `id`, `supabase_user_id`, `type`, `title`, `message`, `read`, `data`, `created_at`
   - Currently supports: `bid_won`, `bid_lost`, `bid_expired`, `load_assigned`, `bid_received`, `system`, `info`
   - Uses `supabase_user_id` for user identification

2. **UI Components:**
   - `NotificationBell.tsx` - Main notification bell component (currently carrier-focused)
   - Located in `components/ui/NotificationBell.tsx`
   - Displays unread count badge
   - Shows notification preview on hover
   - Full dialog for viewing all notifications

3. **API Endpoints:**
   - `/api/notifications` - GET (fetch), POST (create), PUT (mark read)
   - `/api/carrier/notifications` - Carrier-specific notifications
   - Notification creation already exists in `lib/auctions.ts` (`createAdminBidNotifications`)

---

## Notification Triggers & Implementation Points

### 1. ADMIN NOTIFICATIONS

#### A. New Lowest Bid Notifications
**Trigger Point:** When a carrier places a bid that becomes the new lowest bid for that auction

**Location:**
- `lib/auctions.ts` - `upsertCarrierBid()` function (line ~280)
- Currently has `createAdminBidNotifications()` but only notifies on ANY bid, not specifically lowest bids

**Implementation:**
1. After bid is placed, check if it's the new lowest bid
2. Compare with existing lowest bid for that `bid_number`
3. If new lowest, create notification for ALL admins
4. Include: bid number, carrier name, MC number, new lowest amount, previous lowest amount

**Notification Type:** `new_lowest_bid`
**Recipients:** All admin users (from `user_roles_cache` where `role = 'admin'`)

---

#### B. Carrier Message Notifications (Floating Chat Bubble)
**Trigger Point:** When a carrier sends a message through the floating admin chat bubble

**Location:**
- `app/api/carrier/conversations/[conversationId]/route.ts` - POST handler (line ~60)
- After message is successfully inserted into `conversation_messages` table

**Implementation:**
1. After message insert (line ~228), get the conversation details
2. Find the admin user associated with this conversation (`conversations.admin_user_id`)
3. Create notification for that specific admin
4. Include: carrier name, message preview (first 100 chars), conversation link

**Notification Type:** `carrier_message`
**Recipients:** The admin user in the conversation (`conversations.admin_user_id`)

---

#### C. Carrier Message Notifications (My-Bids Messages)
**Trigger Point:** When a carrier sends a message through the bid-specific messaging system

**Location:**
- `app/api/bid-messages/[bidNumber]/route.ts` - POST handler
- Need to verify this endpoint exists and how it works

**Implementation:**
1. After bid message is created, identify which admins should be notified
2. Likely all admins, or admins monitoring that specific bid
3. Create notification with bid context

**Notification Type:** `bid_message`
**Recipients:** All admin users (or bid-specific admins if tracking exists)

---

#### D. Profile Submission for Approval
**Trigger Point:** When a carrier submits their profile for approval

**Location:**
- `app/api/carrier/profile/route.ts` - POST handler (line ~83)
- When `submit_for_approval = true` and profile status changes to `'pending'` (line ~197)

**Implementation:**
1. After profile status is set to `'pending'` (line ~197)
2. Create notification for ALL admins
3. Include: carrier name, MC number, company name, submission timestamp
4. Link to admin carrier approval page

**Notification Type:** `profile_submission`
**Recipients:** All admin users

---

### 2. CARRIER NOTIFICATIONS

#### A. Bid Award Notifications
**Status:** ✅ Already implemented in `lib/auctions.ts` - `awardAuction()` function
- Creates `bid_won` for winner
- Creates `bid_lost` for other bidders

#### B. Admin Message Notifications
**Trigger Point:** When an admin sends a message to a carrier

**Location:**
- `app/api/admin/conversations/[conversationId]/route.ts` - POST handler (line ~69)
- After message is successfully inserted (line ~245)

**Implementation:**
1. After message insert, get conversation details
2. Find carrier user (`conversations.supabase_carrier_user_id`)
3. Create notification for that carrier
4. Include: admin name, message preview, conversation link

**Notification Type:** `admin_message`
**Recipients:** The carrier user in the conversation

---

## Database Schema Updates Needed

### Current `notifications` Table Structure:
```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  supabase_user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Required Updates:

1. **Update `type` CHECK constraint** to include new notification types:
   ```sql
   ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
   ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
   CHECK (type IN (
     'bid_won', 'bid_lost', 'bid_expired', 'load_assigned', 
     'bid_received', 'system', 'info',
     'new_lowest_bid',        -- NEW: Admin - new lowest bid
     'carrier_message',       -- NEW: Admin - carrier sent message (chat)
     'bid_message',           -- NEW: Admin - carrier sent bid message
     'profile_submission',     -- NEW: Admin - profile submitted
     'admin_message'          -- NEW: Carrier - admin sent message
   ));
   ```

2. **Add index for unread count queries:**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_notifications_unread 
   ON notifications(supabase_user_id, read) 
   WHERE read = false;
   ```

---

## Implementation Plan

### Phase 1: Database Migration
**File:** `db/migrations/086_update_notification_types.sql`

1. Update `type` CHECK constraint
2. Add index for unread count optimization
3. Verify `supabase_user_id` column exists (should already exist)

---

### Phase 2: Admin Notification Functions

#### A. Create Helper Function for Admin Notifications
**File:** `lib/notifications.ts` (new file)

```typescript
// Helper to get all admin user IDs
async function getAllAdminUserIds(): Promise<string[]>

// Helper to create notification for single user
async function createNotification(userId, type, title, message, data?)

// Helper to create notifications for all admins
async function notifyAllAdmins(type, title, message, data?)

// Helper to check if bid is new lowest bid
async function isNewLowestBid(bidNumber, amountCents): Promise<boolean>
```

---

#### B. Update Bid Placement Logic
**File:** `lib/auctions.ts`

**Function:** `upsertCarrierBid()` (line ~280)

**Changes:**
1. After bid is successfully inserted (line ~330)
2. Check if this is a new lowest bid using helper function
3. If yes, call `notifyAllAdmins()` with `new_lowest_bid` type
4. Keep existing `createAdminBidNotifications()` for general bid notifications (or replace it)

**Notification Details:**
- **Type:** `new_lowest_bid`
- **Title:** "🎯 New Lowest Bid"
- **Message:** `"${carrierName} (MC: ${mcNumber}) placed a new lowest bid of $${amount} on Bid #${bidNumber}"`
- **Data:** `{ bid_number, carrier_user_id, carrier_name, mc_number, amount_cents, amount_dollars, previous_lowest_cents }`

---

#### C. Update Carrier Message Sending (Floating Chat)
**File:** `app/api/carrier/conversations/[conversationId]/route.ts`

**Function:** POST handler (line ~60)

**Changes:**
1. After message is successfully inserted (line ~228)
2. Get conversation details to find admin user:
   ```sql
   SELECT admin_user_id FROM conversations WHERE id = ${conversationId}
   ```
3. Get carrier profile for name
4. Create notification for that admin user
5. Include message preview (first 100 chars, truncate if longer)

**Notification Details:**
- **Type:** `carrier_message`
- **Title:** "💬 New Message from Carrier"
- **Message:** `"${carrierName} sent: ${messagePreview}"`
- **Data:** `{ conversation_id, carrier_user_id, carrier_name, message_id, has_attachment }`

---

#### D. Update Bid Message Sending
**File:** `app/api/bid-messages/[bidNumber]/route.ts` (verify this exists)

**Changes:**
1. After bid message is created
2. Notify all admins about the message
3. Include bid context

**Notification Details:**
- **Type:** `bid_message`
- **Title:** "📨 New Bid Message"
- **Message:** `"${carrierName} sent a message about Bid #${bidNumber}"`
- **Data:** `{ bid_number, carrier_user_id, carrier_name, message_id }`

---

#### E. Update Profile Submission
**File:** `app/api/carrier/profile/route.ts`

**Function:** POST handler (line ~83)

**Changes:**
1. After profile status is set to `'pending'` (line ~197)
2. Before returning success response (line ~215)
3. Call `notifyAllAdmins()` with profile submission details

**Notification Details:**
- **Type:** `profile_submission`
- **Title:** "📋 New Profile Submission"
- **Message:** `"${companyName} (MC: ${mcNumber}) submitted their profile for approval"`
- **Data:** `{ carrier_user_id, company_name, legal_name, mc_number, dot_number, submitted_at }`

---

### Phase 3: Carrier Notification Functions

#### A. Update Admin Message Sending
**File:** `app/api/admin/conversations/[conversationId]/route.ts`

**Function:** POST handler (line ~69)

**Changes:**
1. After message is successfully inserted (line ~245)
2. Get conversation details to find carrier user:
   ```sql
   SELECT supabase_carrier_user_id FROM conversations WHERE id = ${conversationId}
   ```
3. Create notification for that carrier user
4. Include message preview

**Notification Details:**
- **Type:** `admin_message`
- **Title:** "💬 New Message from Admin"
- **Message:** `"Admin sent: ${messagePreview}"`
- **Data:** `{ conversation_id, admin_user_id, message_id, has_attachment }`

---

### Phase 4: Update Notification Bell Component

**File:** `components/ui/NotificationBell.tsx`

**Current State:**
- Uses `/api/carrier/notifications` endpoint
- Only shows carrier notifications

**Changes Needed:**
1. Detect if user is admin or carrier
2. Use appropriate endpoint:
   - Carriers: `/api/carrier/notifications`
   - Admins: `/api/admin/notifications` (needs to be created)
3. Update notification type icons/colors for new types
4. Ensure unread count is properly calculated

**New Notification Types to Add:**
- `new_lowest_bid` - Blue bell icon
- `carrier_message` - Message icon (blue)
- `bid_message` - Message icon (blue)
- `profile_submission` - File icon (orange)
- `admin_message` - Message icon (green)

---

### Phase 5: Create Admin Notifications API Endpoint

**File:** `app/api/admin/notifications/route.ts` (new file)

**Endpoints:**
- `GET` - Fetch admin notifications (similar to carrier endpoint)
- `POST /read` - Mark notification as read
- `POST /read-all` - Mark all as read

**Implementation:**
- Similar structure to `/api/carrier/notifications`
- Filter by `supabase_user_id` and `role = 'admin'`
- Return unread count

---

## Notification Count Tracking

### Current Implementation:
- `NotificationBell.tsx` calculates unread count from fetched notifications
- Uses `notifications.filter(n => !n.read).length`

### Optimization:
1. **Database Index:** Already planned in migration (Phase 1)
2. **API Response:** Include `unreadCount` in API response (already done in `/api/notifications`)
3. **Real-time Updates:** Use SWR with `refreshInterval: 10000` (already implemented)

### Verification:
- Ensure `read` column defaults to `false`
- Ensure API properly filters unread notifications
- Test unread count badge updates correctly

---

## File Structure Summary

### New Files to Create:
1. `db/migrations/086_update_notification_types.sql`
2. `lib/notifications.ts` - Notification helper functions
3. `app/api/admin/notifications/route.ts` - Admin notifications API

### Files to Modify:
1. `lib/auctions.ts` - Update `upsertCarrierBid()` for lowest bid notifications
2. `app/api/carrier/conversations/[conversationId]/route.ts` - Add admin notification on message
3. `app/api/admin/conversations/[conversationId]/route.ts` - Add carrier notification on message
4. `app/api/carrier/profile/route.ts` - Add admin notification on profile submission
5. `app/api/bid-messages/[bidNumber]/route.ts` - Add admin notification (if exists)
6. `components/ui/NotificationBell.tsx` - Support both admin and carrier, add new types

---

## Testing Checklist

### Admin Notifications:
- [ ] New lowest bid notification appears when carrier places lowest bid
- [ ] Carrier message notification appears when carrier sends chat message
- [ ] Bid message notification appears when carrier sends bid message
- [ ] Profile submission notification appears when carrier submits profile
- [ ] Unread count increments correctly
- [ ] Notification badge shows correct count
- [ ] Marking as read updates count

### Carrier Notifications:
- [ ] Admin message notification appears when admin sends message
- [ ] Bid award notifications still work (already implemented)
- [ ] Unread count increments correctly
- [ ] Notification badge shows correct count

### General:
- [ ] Notifications persist in database
- [ ] Notification types are valid
- [ ] API endpoints return correct data
- [ ] UI displays notifications correctly
- [ ] Performance is acceptable (indexes working)

---

## Priority Order

1. **High Priority:**
   - Profile submission notifications (admins need to know immediately)
   - New lowest bid notifications (critical for auction management)
   - Carrier message notifications (admin responsiveness)

2. **Medium Priority:**
   - Admin message notifications (carrier engagement)
   - Bid message notifications (if bid messaging system exists)

3. **Low Priority:**
   - UI polish and additional notification types
   - Notification preferences/settings

---

## Notes & Considerations

1. **Performance:**
   - Batch notification creation where possible
   - Use database transactions for consistency
   - Index on `(supabase_user_id, read)` for fast unread counts

2. **User Experience:**
   - Keep notification messages concise but informative
   - Include actionable data (bid numbers, conversation IDs) in `data` field
   - Consider notification grouping/aggregation for high-frequency events

3. **Scalability:**
   - If many admins, consider notification preferences
   - Consider rate limiting for notification creation
   - Monitor database query performance

4. **Error Handling:**
   - Notification creation should not block main operations
   - Log notification creation errors but don't fail the main operation
   - Use try-catch blocks around notification creation

---

## Next Steps

1. Review this analysis document
2. Approve implementation plan
3. Begin Phase 1 (Database Migration)
4. Implement helper functions (Phase 2A)
5. Wire up notification triggers (Phases 2B-3)
6. Update UI components (Phase 4)
7. Create admin API endpoint (Phase 5)
8. Test thoroughly
9. Deploy

---

**Document Version:** 1.0  
**Created:** 2025-01-06  
**Last Updated:** 2025-01-06

