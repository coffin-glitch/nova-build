# Seg 2: Notification System Improvements

## Analysis and Implementation Plan

### 1. Rate Limiting Per User (10,000+ Subscribers)

**Current State:**
- Basic rate limiting: 20 notifications per hour per user
- Uses Redis with simple counter
- Applied at job processing level

**Challenge:**
- 10,000+ subscribers requiring substantial notifications per minute
- Need to prevent abuse while allowing legitimate high-volume users
- Must scale horizontally

**Recommended Approach:**
1. **Tiered Rate Limiting** (Best for your use case):
   - **Premium Users**: Higher limits (e.g., 100/hour or unlimited)
   - **Standard Users**: Moderate limits (e.g., 50/hour)
   - **New Users**: Lower limits (e.g., 20/hour) to prevent spam
   - Store user tier in database, check before rate limiting

2. **Sliding Window Rate Limiting**:
   - Use Redis sorted sets with timestamps
   - More accurate than fixed windows
   - Allows bursts but smooths over time

3. **Per-Trigger-Type Limits**:
   - Exact match: Higher priority, higher limits
   - State match: Moderate limits
   - Similar load: Lower limits
   - Prevents one trigger type from consuming all quota

4. **Smart Batching**:
   - Group multiple matches into single notifications when possible
   - Reduces notification count while maintaining value

**Implementation Strategy:**
- Keep current Redis-based approach (scales well)
- Add user tier checking
- Implement sliding window for accuracy
- Add per-trigger-type limits
- Monitor and adjust limits based on actual usage patterns

**Why This Works for 10,000+ Users:**
- Redis handles millions of operations per second
- Horizontal scaling: multiple workers can share Redis
- Tiered approach allows power users while protecting system
- Batching reduces total notification volume

---

### 2. Notification Grouping

**Current State:**
- Each match creates individual notification
- No grouping mechanism

**Recommended Approach:**
- Group notifications by:
  - **Time window**: Same trigger type within 5 minutes
  - **Bid similarity**: Multiple bids matching same favorite
  - **Route similarity**: Multiple bids on same route
  
- Display grouped notifications as:
  - "3 new exact matches found" (expandable)
  - "5 state matches in last 10 minutes" (expandable)
  - Single notification with list of bids

**Benefits:**
- Reduces notification fatigue
- Better UX for high-volume users
- Lower database load
- Easier to scan and prioritize

---

### 3. Notification Filtering by Type

**Current State:**
- Basic filtering exists in API (`unread_only`)
- No frontend filtering UI

**Recommended Approach:**
- Add filter buttons in Recent Notifications:
  - All
  - Exact Match
  - State Match
  - State Pref Bid
  - Deadline Approaching
  - Other
- Add date range filtering
- Add search functionality

---

### 4. Sound/Desktop Notifications

**Current State:**
- No sound or desktop notifications
- Only in-app notifications

**Recommended Approach:**
- Use Browser Notification API
- Request permission on first notification
- Play sound (optional, user preference)
- Show desktop notification with bid details
- Respect user's "Do Not Disturb" settings
- Add user preference toggle

**Implementation:**
- Service Worker for background notifications
- Web Audio API for sounds
- User preference in notification preferences

---

### 5. Composite Indexes for Complex Queries

**Current State:**
- Basic indexes exist
- May need optimization for complex queries

**Recommended Queries to Optimize:**
- `user_id + type + created_at` (notification listing)
- `user_id + read + created_at` (unread count)
- `supabase_carrier_user_id + trigger_type + is_active` (trigger queries)
- `user_id + bid_number + notification_type` (cooldown checks)

---

### 6. notification_logs Cleanup Job

**Current State:**
- `notification_logs` table grows indefinitely
- No archival/cleanup mechanism

**Recommended Approach:**
- Archive logs older than 90 days to separate table
- Keep last 30 days in main table for quick access
- Run cleanup job daily via cron or scheduled task
- Optionally: Export to S3/cloud storage for long-term retention

**Benefits:**
- Maintains query performance
- Reduces database size
- Preserves historical data for analytics

---

### 7. trigger_config Validation at Database Level

**Current State:**
- Validation only at application level
- Invalid configs can be stored

**Recommended Approach:**
- Add JSON schema validation constraint
- Validate on INSERT/UPDATE
- Provide clear error messages
- Ensure data integrity

**Implementation:**
- PostgreSQL JSONB validation
- Check constraint with JSON schema
- Application-level validation as backup

---

## Implementation Priority

1. **High Priority:**
   - Rate limiting improvements (tiered system)
   - Composite indexes (performance)
   - notification_logs cleanup (maintenance)

2. **Medium Priority:**
   - Notification grouping
   - Filtering by type
   - trigger_config validation

3. **Nice to Have:**
   - Sound/desktop notifications

