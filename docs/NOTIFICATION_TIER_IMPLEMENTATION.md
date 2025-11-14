# Notification Tier System - Implementation Guide

## Overview

The tier system allows different notification rate limits based on user subscription level:
- **Premium**: 200 notifications/hour (2x for high-priority triggers = 400/hr)
- **Standard**: 50 notifications/hour (2x for high-priority triggers = 100/hr)
- **New**: 20 notifications/hour (2x for high-priority triggers = 40/hr)

## Implementation Components

### 1. Database Schema ✅ (Already Done)

The `notification_tier` column exists in `carrier_profiles` table:
- Type: `TEXT` with CHECK constraint: `('premium', 'standard', 'new')`
- Default: `'standard'`
- Indexed for fast lookups

### 2. Rate Limiting Logic ✅ (Already Done)

The `checkRateLimit()` function in `lib/notification-cache.ts`:
- Fetches user tier from database (cached in Redis for 1 hour)
- Applies tier-based limits
- Applies per-trigger-type multipliers
- Uses sliding window for accuracy

### 3. What Needs to Be Implemented

#### A. Admin Interface for Tier Management

**Location**: `/app/admin/carriers/[userId]/` or new route `/app/admin/carriers/[userId]/tier`

**Features Needed:**
1. **Display Current Tier**: Show user's current tier in carrier detail view
2. **Tier Selector**: Dropdown to change tier (premium/standard/new)
3. **Tier History**: Track when tiers change (optional but recommended)
4. **Bulk Tier Updates**: Ability to update multiple users at once

**Implementation Steps:**

1. **Add API Route**: `/app/api/admin/carriers/[userId]/tier/route.ts`
```typescript
// PUT /api/admin/carriers/[userId]/tier
export async function PUT(request: NextRequest, { params }) {
  const auth = await requireApiAdmin(request);
  const { userId } = await params;
  const { tier } = await request.json();
  
  // Validate tier
  if (!['premium', 'standard', 'new'].includes(tier)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }
  
  // Update tier
  await sql`
    UPDATE carrier_profiles 
    SET notification_tier = ${tier}, updated_at = NOW()
    WHERE supabase_user_id = ${userId}
  `;
  
  // CRITICAL: Invalidate Redis cache so new tier takes effect immediately
  await redisConnection.del(`user_tier:${userId}`);
  
  // Clear other related caches
  clearCarrierRelatedCaches(userId);
  
  return NextResponse.json({ ok: true, tier });
}
```

2. **Add UI Component**: Update admin carrier detail page to show/edit tier

3. **Add to Carrier List**: Show tier badge in carrier list table

#### B. Automatic Tier Assignment

**When to Assign Tiers:**

1. **New Users** (On Profile Creation):
   - Default: `'new'` (already handled by database default)
   - After 30 days of activity → auto-upgrade to `'standard'`
   - After 90 days + X notifications → consider `'premium'`

2. **Based on Activity**:
   - High notification volume users → `'premium'`
   - Regular users → `'standard'`
   - Inactive users → `'new'`

3. **Based on Subscription** (if you add paid tiers):
   - Paid subscribers → `'premium'`
   - Free users → `'standard'` or `'new'`

**Implementation Options:**

**Option 1: Background Job (Recommended)**
```typescript
// scripts/update-user-tiers.ts
// Run daily via cron or scheduled task

async function updateUserTiers() {
  // Get users with activity in last 30 days
  const activeUsers = await sql`
    SELECT 
      cp.supabase_user_id,
      cp.notification_tier,
      COUNT(nl.id) as notification_count,
      MAX(nl.sent_at) as last_notification
    FROM carrier_profiles cp
    LEFT JOIN notification_logs nl ON nl.supabase_carrier_user_id = cp.supabase_user_id
    WHERE nl.sent_at > NOW() - INTERVAL '30 days'
    GROUP BY cp.supabase_user_id, cp.notification_tier
  `;
  
  for (const user of activeUsers) {
    let newTier = 'standard';
    
    // High-volume users → premium
    if (user.notification_count > 1000) {
      newTier = 'premium';
    }
    // Inactive users → new
    else if (user.notification_count < 10) {
      newTier = 'new';
    }
    
    if (newTier !== user.notification_tier) {
      await sql`
        UPDATE carrier_profiles 
        SET notification_tier = ${newTier}
        WHERE supabase_user_id = ${user.supabase_user_id}
      `;
      
      // Invalidate cache
      await redisConnection.del(`user_tier:${user.supabase_user_id}`);
    }
  }
}
```

**Option 2: On-Demand (When User Logs In)**
```typescript
// In user login/profile fetch
async function checkAndUpdateTier(userId: string) {
  const profile = await sql`
    SELECT notification_tier, created_at
    FROM carrier_profiles
    WHERE supabase_user_id = ${userId}
  `;
  
  // Auto-upgrade after 30 days
  if (profile.created_at < NOW() - INTERVAL '30 days' && profile.notification_tier === 'new') {
    await sql`
      UPDATE carrier_profiles 
      SET notification_tier = 'standard'
      WHERE supabase_user_id = ${userId}
    `;
    await redisConnection.del(`user_tier:${userId}`);
  }
}
```

#### C. Cache Invalidation Strategy

**Critical**: When tier changes, Redis cache MUST be invalidated immediately.

**Where to Invalidate:**

1. **Admin Tier Update**:
```typescript
// After updating tier in admin interface
await redisConnection.del(`user_tier:${userId}`);
```

2. **Automatic Tier Updates**:
```typescript
// After background job updates tier
await redisConnection.del(`user_tier:${userId}`);
```

3. **Add to Cache Invalidation Helper**:
```typescript
// lib/cache-invalidation.ts
export async function clearCarrierRelatedCaches(userId: string) {
  // Existing cache clears...
  await redisConnection.del(`user_tier:${userId}`);
  await redisConnection.del(`prefs:${userId}`);
  await redisConnection.del(`favorites:${userId}`);
  // ... etc
}
```

#### D. User-Facing Tier Display (Optional but Recommended)

**Where to Show:**
- Carrier dashboard (small badge)
- Notification preferences page
- Profile page

**What to Show:**
- Current tier badge
- Current rate limit (e.g., "50 notifications/hour")
- Upgrade path (if applicable)

**Example Component:**
```typescript
// components/carrier/TierBadge.tsx
export function TierBadge({ tier }: { tier: string }) {
  const limits = {
    premium: '200/hour',
    standard: '50/hour',
    new: '20/hour'
  };
  
  return (
    <Badge variant={tier === 'premium' ? 'default' : 'secondary'}>
      {tier.toUpperCase()} ({limits[tier]})
    </Badge>
  );
}
```

## Implementation Priority

### Phase 1: Basic Admin Control (High Priority)
1. ✅ Database migration (done)
2. ✅ Rate limiting logic (done)
3. ⚠️ Admin API route for tier updates
4. ⚠️ Admin UI for tier management
5. ⚠️ Cache invalidation on tier change

### Phase 2: Automatic Assignment (Medium Priority)
1. ⚠️ Background job for tier updates
2. ⚠️ Activity-based tier assignment logic
3. ⚠️ Tier history tracking (optional)

### Phase 3: User Experience (Low Priority)
1. ⚠️ Display tier to users
2. ⚠️ Tier upgrade notifications
3. ⚠️ Tier-based feature differences (if applicable)

## Edge Cases to Handle

### 1. New Users Without Profile
- **Solution**: Default to `'new'` tier when profile is created
- **Location**: Profile creation logic

### 2. Tier Changes During Active Session
- **Problem**: User has tier cached in Redis, tier changes in DB
- **Solution**: 
  - Short cache TTL (1 hour) - already implemented ✅
  - Invalidate cache immediately on tier change
  - Consider shorter TTL (15-30 minutes) if tier changes frequently

### 3. Missing Tier Data
- **Problem**: User has no `notification_tier` value
- **Solution**: 
  - Database default handles this ✅
  - Code defaults to `'standard'` if null ✅

### 4. Bulk Tier Updates
- **Problem**: Updating many users at once
- **Solution**: 
  - Batch update SQL query
  - Batch cache invalidation
  - Consider doing in background job

## Testing Checklist

- [ ] Admin can view user tier
- [ ] Admin can update user tier
- [ ] Cache invalidates on tier change
- [ ] Rate limits apply correctly per tier
- [ ] New users default to 'new' tier
- [ ] Per-trigger multipliers work correctly
- [ ] Tier changes take effect within cache TTL (1 hour max)

## Recommended Next Steps

1. **Immediate**: Implement admin API route and UI for tier management
2. **Short-term**: Add cache invalidation to tier update operations
3. **Medium-term**: Implement automatic tier assignment based on activity
4. **Long-term**: Add user-facing tier display and upgrade paths

## Questions to Consider

1. **How do users upgrade tiers?**
   - Automatic (activity-based)?
   - Manual (admin assignment)?
   - Paid subscription?
   - Combination?

2. **Should tier affect other features?**
   - Just notifications?
   - Also API rate limits?
   - Feature access?

3. **How often should tiers be recalculated?**
   - Daily?
   - Weekly?
   - On-demand?

4. **Should we track tier change history?**
   - For auditing?
   - For analytics?
   - For user communication?

