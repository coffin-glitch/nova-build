# Additional Tables to Enable Realtime For

## ✅ Already Enabled (High Priority)
- ✅ `telegram_bids` - Bid board
- ✅ `conversations` - Chat conversations
- ✅ `conversation_messages` - Chat messages
- ✅ `carrier_chat_messages` - Carrier chat
- ✅ `admin_messages` - Admin messages
- ✅ `notifications` - Notifications
- ✅ `carrier_bids` - Bid submissions
- ✅ `carrier_favorites` - Favorite bids
- ✅ `announcements` - System announcements
- ✅ `carrier_profiles` - Profile status

---

## 🟡 MEDIUM PRIORITY (Enable Next)

### 1. **`system_settings` Table**
**Current Polling:** 5-30 seconds  
**Impact:** ⭐⭐⭐ (Medium)

**Where it's used:**
- `app/bid-board/BidBoardClient.tsx` - 30s polling (shop status)
- `app/admin/AdminDashboardClient.tsx` - 5s polling (shop status)

**Why enable:**
- Shop status changes should be instant
- Currently 5-30 second delay
- Important for user experience

**Action:** ✅ Hook already created: `useRealtimeSystemSettings`

---

### 2. **Load Management Tables**

#### A. **`loads` Table**
**Current Polling:** 10-30 seconds  
**Impact:** ⭐⭐⭐ (Medium)

**Where it's used:**
- `app/carrier/my-loads/CarrierLoadsConsole.tsx` - 30s polling
- `components/load/EnhancedLoadLifecycleManager.tsx` - 30s polling

**Why enable:**
- Load status changes are important
- Currently 30 second delay
- Better UX for load tracking

**Action:** Create `useRealtimeLoads` hook

---

#### B. **`load_offers` Table**
**Current Polling:** 10-30 seconds  
**Impact:** ⭐⭐⭐ (Medium)

**Where it's used:**
- `app/carrier/my-loads/CarrierLoadsConsole.tsx` - 30s polling
- `app/admin/offers/AdminOffersClient.tsx` - Various polling

**Why enable:**
- Offer status changes need instant updates
- Currently 30 second delay
- Important for offer management

**Action:** Create `useRealtimeLoadOffers` hook

---

#### C. **`assignments` Table**
**Current Polling:** 10-30 seconds  
**Impact:** ⭐⭐⭐ (Medium)

**Where it's used:**
- `app/carrier/my-loads/LoadStatusTracker.tsx` - 10s polling
- `app/carrier/my-loads/LoadLifecycleManager.tsx` - 30s polling

**Why enable:**
- Assignment status changes are critical
- Currently 10-30 second delay
- Important for load tracking

**Action:** Create `useRealtimeAssignments` hook

---

### 3. **`announcement_reads` Table**
**Current Polling:** 30 seconds (indirect)  
**Impact:** ⭐⭐ (Low-Medium)

**Where it's used:**
- `app/announcements/page.tsx` - 30s polling (reads affect unread counts)
- `components/announcements/AnnouncementsBadge.tsx` - 30s polling

**Why enable:**
- Unread counts should update instantly
- Currently 30 second delay
- Better UX for announcement badges

**Action:** Create `useRealtimeAnnouncementReads` hook

---

## 🟢 LOW PRIORITY (Optional - Keep Polling)

### 4. **Analytics & Stats Tables**
**Current Polling:** 30-60 seconds  
**Impact:** ⭐⭐ (Low)

**Why NOT enable:**
- Analytics don't need instant updates
- 30-60s refresh is acceptable
- Low user impact
- Can enable later if needed

**Recommendation:** Keep polling for now

---

### 5. **Archive Data**
**Current Polling:** 30 seconds  
**Impact:** ⭐ (Very Low)

**Why NOT enable:**
- Archive data is historical
- 30s refresh is fine
- Low priority

**Recommendation:** Keep polling, not worth Realtime

---

## 📊 Summary

### Recommended Next Steps:

1. **Enable Realtime for:**
   - ✅ `system_settings` (hook ready)
   - `loads` (create hook)
   - `load_offers` (create hook)
   - `assignments` (create hook)
   - `announcement_reads` (create hook)

2. **Keep Polling for:**
   - Analytics/leaderboard data
   - Archive data
   - User lists (admin users, carriers list)

---

## 🎯 Priority Order

1. **`system_settings`** - Shop status (hook ready ✅)
2. **`assignments`** - Load assignments (10s polling, high impact)
3. **`loads`** - Load data (30s polling, medium impact)
4. **`load_offers`** - Load offers (30s polling, medium impact)
5. **`announcement_reads`** - Read status (30s polling, low-medium impact)

---

## 💡 Implementation Notes

- **Load management tables** are used together, so enable them together for best UX
- **`system_settings`** is already implemented (hook created)
- **`announcement_reads`** is less critical but improves UX for badges
- Analytics can stay on polling (not time-sensitive)

---

## ✅ Conclusion

**Enable Realtime for 4 additional tables:**
1. ✅ `system_settings` (ready)
2. `loads`
3. `load_offers`
4. `assignments`
5. `announcement_reads` (optional)

This will eliminate another **15-20 polling instances** and provide instant updates for load management features.

