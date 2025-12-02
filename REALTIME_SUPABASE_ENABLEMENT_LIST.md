# Realtime Tables to Enable in Supabase Dashboard

## ✅ Currently Enabled (16 tables)

These tables are **already enabled** in Supabase and have hooks/components implemented:

1. ✅ `telegram_bids` - Bid board data
2. ✅ `notifications` - In-app notifications
3. ✅ `conversations` - Chat conversations
4. ✅ `conversation_messages` - Chat messages
5. ✅ `carrier_chat_messages` - Carrier chat
6. ✅ `admin_messages` - Admin messages
7. ✅ `carrier_bids` - Bid submissions
8. ✅ `carrier_favorites` - Favorite bids
9. ✅ `announcements` - System announcements
10. ✅ `carrier_profiles` - Profile status
11. ✅ `system_settings` - Shop status/config
12. ✅ `loads` - Load data
13. ✅ `load_offers` - Load offers
14. ✅ `assignments` - Load assignments
15. ✅ `announcement_reads` - Announcement read status
16. ✅ `user_roles_cache` - User role cache (CRITICAL for admin/carrier access control)

**Status:** All critical and medium priority tables are enabled ✅

---

## 🟡 Recommended for Enablement (Phase 4 - Optional)

These tables are marked as "Consider enabling" in the comprehensive checklist. They would benefit from Realtime but are **lower priority** than the 15 already enabled.

### 1. `auction_awards` 
**Priority:** 🟡 Medium  
**Current Usage:** Award results, bid adjudication  
**Impact:** Carriers and admins would see award results instantly  
**Components that would benefit:**
- `app/carrier/my-bids/CarrierBidsConsole.tsx` (awarded bids section)
- `app/admin/bids/AdminBiddingConsole.tsx` (award adjudication)

**Recommendation:** Enable if you want instant award notifications

---

### 2. `bid_messages`
**Priority:** 🟡 Medium  
**Current Usage:** Bid-specific messages between carriers and admins  
**Impact:** Instant messaging for bid discussions  
**Components that would benefit:**
- `app/api/bid-messages/[bidNumber]/route.ts`
- Any bid message UI components

**Recommendation:** Enable if bid messaging is frequently used

---

### 3. `message_reads`
**Priority:** 🟡 Medium  
**Current Usage:** Read receipts for messages  
**Impact:** Instant read status updates  
**Components that would benefit:**
- Chat components
- Message conversation components

**Recommendation:** Enable if read receipts are important for UX

---

### 4. `offer_comments`
**Priority:** 🟡 Medium  
**Current Usage:** Comments on load offers  
**Impact:** Instant comment updates on offers  
**Components that would benefit:**
- `app/api/offers/[offerId]/comments/route.ts`
- Offer detail pages

**Recommendation:** Enable if offer comments are actively used

---

### 5. `carrier_responses`
**Priority:** 🟡 Medium  
**Current Usage:** Carrier responses to admin messages  
**Impact:** Instant response notifications  
**Components that would benefit:**
- `app/api/carrier/messages/responses/route.ts`
- Admin message management pages

**Recommendation:** Enable if carrier responses need instant updates

---

## 🟢 Low Priority (Probably Not Worth It)

These tables are marked as "Maybe" but are **low priority**:

- `load_lifecycle_events` - Event history (low priority)
- `bid_lifecycle_events` - Event history (low priority)
- `admin_profiles` - Admin profile data (rarely changes)
- `mc_access_control` - MC access control (low priority)
- `dnu_tracking` - DNU list (low priority)
- `driver_profiles` - Driver data (low priority)
- `ai_assistant_conversations` - AI conversations (low priority)
- `ai_assistant_messages` - AI messages (low priority)

**Recommendation:** Keep polling for these, not worth Realtime enablement

---

## ❌ Not Recommended

These tables should **NOT** have Realtime enabled:

- `user_roles` - Static role data
- `user_roles_cache` - Cached role data
- `users` - User metadata (rarely changes)
- `bid_documents` - Document storage
- `archived_bids` - Historical data
- `offer_history` - Historical data
- `carrier_notification_preferences` - User preferences (rarely changes)
- `notification_logs` - Log data
- `highway_carrier_data` - Analytics data
- `eax_loads_raw` - Raw EAX data
- `dedicated_lanes` - Lane data
- All archive/historical/log tables

**Reason:** These tables either don't change frequently, are historical/archival, or are configuration data that doesn't need instant updates.

---

## 📋 How to Enable in Supabase

### Steps:
1. Go to **Supabase Dashboard** → **Database** → **Replication**
2. Find the table name in the list
3. Toggle **"Enable Realtime"** to **ON**
4. Status should show **"Active"**

### Important Notes:
- ✅ **Only enable tables listed above** (the 15 enabled + 5 Phase 4 optional)
- ❌ **Don't enable tables marked as "Not Recommended"** - they will waste resources
- 🔍 **Verify status** - Make sure it shows "Active" after enabling
- 📝 **Track in REALTIME_TRACKING.md** - Update the tracking document when you enable new tables

---

## 🎯 Next Steps

### If you want to enable Phase 4 tables:

1. **Enable in Supabase** (use the steps above)
2. **Create hooks** (following the pattern of existing hooks in `/hooks/useRealtime*.ts`)
3. **Update components** to use the new hooks
4. **Test thoroughly** to ensure instant updates work
5. **Update REALTIME_TRACKING.md** with the new status

### Current Status:
- ✅ **All 15 high/medium priority tables are enabled and implemented**
- 🟡 **Phase 4 tables are optional enhancements** - can be enabled later if needed

---

## 📊 Summary

- **✅ Enabled:** 15 tables (all critical and medium priority)
- **🟡 Recommended:** 5 tables (Phase 4 - optional)
- **🟢 Low Priority:** 8 tables (probably not worth it)
- **❌ Not Recommended:** 20+ tables (keep polling or no updates needed)

**Recommendation:** The current 15 enabled tables cover all critical use cases. Phase 4 tables can be enabled later if needed based on user feedback or feature usage.

---

## 🔍 Verification Checklist

To verify a table is enabled in Supabase:
- [ ] Go to Supabase Dashboard → Database → Replication
- [ ] Find the table name
- [ ] Toggle "Enable Realtime" should be **ON**
- [ ] Status should show **"Active"**
- [ ] Update REALTIME_TRACKING.md with the enabled date

---

## 📌 Quick Reference

**All Enabled Tables (15):**
1. telegram_bids ✅
2. notifications ✅
3. conversations ✅
4. conversation_messages ✅
5. carrier_chat_messages ✅
6. admin_messages ✅
7. carrier_bids ✅
8. carrier_favorites ✅
9. announcements ✅
10. carrier_profiles ✅
11. system_settings ✅
12. loads ✅
13. load_offers ✅
14. assignments ✅
15. announcement_reads ✅

**Optional Phase 4 Tables (5):**
1. auction_awards (optional)
2. bid_messages (optional)
3. message_reads (optional)
4. offer_comments (optional)
5. carrier_responses (optional)
