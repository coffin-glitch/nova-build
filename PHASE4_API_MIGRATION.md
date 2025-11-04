# Phase 4: API Migration - Implementation Guide

## Overview

Phase 4 focuses on migrating API routes to use the unified auth system and query helpers that support both Clerk and Supabase user IDs. This enables gradual migration without breaking existing functionality.

## ✅ Completed Components

### 1. Query Helpers (`lib/db-queries.ts`)

**Purpose**: Provide unified query building functions that work with both Clerk and Supabase user IDs.

**Key Functions**:
- `getUserWhereCondition()` - For `clerk_user_id` / `supabase_user_id` columns
- `getCarrierUserWhereCondition()` - For `carrier_user_id` columns
- `getAdminUserWhereCondition()` - For `admin_user_id` columns
- `getWinnerUserWhereCondition()` - For `winner_user_id` columns
- `getSenderUserWhereCondition()` - For `sender_id` columns
- `getCurrentUserWhere()` - Auto-detects provider and column type
- `getCurrentUserIds()` - Gets both Clerk and Supabase IDs for current user
- `insertWithUserIds()` - Inserts records with both user IDs set

**How It Works**:
- Checks both the direct ID column and the mapped ID via `user_roles_cache`
- Automatically handles provider detection from middleware headers
- Backward compatible: works even if `supabase_user_id` is NULL

---

## 🔄 Migration Pattern

### Before (Clerk-only):
```typescript
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const data = await sql`
    SELECT * FROM carrier_bids
    WHERE clerk_user_id = ${userId}
  `;
  
  return NextResponse.json({ data });
}
```

### After (Dual-Auth):
```typescript
import { requireApiAuth } from "@/lib/auth-api-helper";
import { getCurrentUserWhere } from "@/lib/db-queries";

export async function GET() {
  const { userId } = await requireApiAuth(); // Works with both providers
  
  const userWhere = await getCurrentUserWhere('clerk_user_id');
  
  const data = await sql`
    SELECT * FROM carrier_bids
    WHERE ${userWhere}
  `;
  
  return NextResponse.json({ data });
}
```

---

## 📋 Migration Checklist

### High Priority Routes (User-facing)

- [ ] `/api/carrier/bids` - Get carrier bids
- [ ] `/api/carrier/awarded-bids` - Get awarded bids
- [ ] `/api/carrier/profile` - Carrier profile CRUD
- [ ] `/api/carrier/booked-loads` - Get booked loads
- [ ] `/api/carrier/load-offers` - Get load offers
- [ ] `/api/carrier/favorites` - Favorites management
- [ ] `/api/carrier/conversations` - Conversations
- [ ] `/api/carrier/messages` - Messages

### Medium Priority Routes (Admin)

- [ ] `/api/admin/carriers` - List carriers
- [ ] `/api/admin/bids` - Admin bid management
- [ ] `/api/admin/awarded-bids` - Award management
- [ ] `/api/admin/conversations` - Admin conversations

### Low Priority Routes (Internal)

- [ ] `/api/carrier/bid-history` - Bid history
- [ ] `/api/carrier/load-stats` - Load statistics
- [ ] `/api/carrier/notifications` - Notifications

---

## 🔧 Step-by-Step Migration

### Step 1: Replace Auth Calls

**Old**:
```typescript
import { auth } from "@clerk/nextjs/server";
const { userId } = await auth();
```

**New**:
```typescript
import { requireApiAuth } from "@/lib/auth-api-helper";
const { userId, userRole, provider } = await requireApiAuth();
```

### Step 2: Replace User ID in Queries

**Old**:
```typescript
WHERE clerk_user_id = ${userId}
```

**New**:
```typescript
const userWhere = await getCurrentUserWhere('clerk_user_id');
WHERE ${userWhere}
```

### Step 3: Update Role Checks

**Old**:
```typescript
import { getClerkUserRole } from "@/lib/clerk-server";
const role = await getClerkUserRole(userId);
```

**New**:
```typescript
import { requireApiCarrier, requireApiAdmin } from "@/lib/auth-api-helper";
const { userRole } = await requireApiCarrier(); // or requireApiAdmin()
```

---

## 📝 Example Migrations

### Example 1: Carrier Bids Route

**File**: `app/api/carrier/bids/route.ts`

```typescript
// Before
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const rows = await sql`
    SELECT * FROM carrier_bids
    WHERE clerk_user_id = ${userId}
  `;
  
  return NextResponse.json({ data: rows });
}

// After
import { requireApiCarrier } from "@/lib/auth-api-helper";
import { getCurrentUserWhere } from "@/lib/db-queries";

export async function GET() {
  const { userId } = await requireApiCarrier(); // Auto-checks carrier role
  
  const userWhere = await getCurrentUserWhere('clerk_user_id');
  
  const rows = await sql`
    SELECT * FROM carrier_bids
    WHERE ${userWhere}
  `;
  
  return NextResponse.json({ data: rows });
}
```

### Example 2: Awarded Bids Route

**File**: `app/api/carrier/awarded-bids/route.ts`

```typescript
// Before
import { auth } from "@clerk/nextjs/server";
import { getClerkUserRole } from "@/lib/clerk-server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const userRole = await getClerkUserRole(userId);
  if (userRole !== "carrier" && userRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  
  const bids = await sql`
    SELECT * FROM auction_awards
    WHERE winner_user_id = ${userId}
  `;
  
  return NextResponse.json({ data: bids });
}

// After
import { requireApiCarrier } from "@/lib/auth-api-helper";
import { getCurrentUserWhere } from "@/lib/db-queries";

export async function GET() {
  const { userId } = await requireApiCarrier(); // Auto-checks carrier/admin role
  
  const winnerWhere = await getCurrentUserWhere('winner_user_id');
  
  const bids = await sql`
    SELECT * FROM auction_awards
    WHERE ${winnerWhere}
  `;
  
  return NextResponse.json({ data: bids });
}
```

---

## ⚠️ Important Notes

### Backward Compatibility

- **Old routes still work**: Routes not yet migrated continue using Clerk
- **Gradual migration**: Can migrate one route at a time
- **No breaking changes**: Existing functionality preserved

### Performance Considerations

- **Index usage**: Queries use existing indexes on `clerk_user_id`
- **Mapping lookups**: Only happen if direct ID match fails
- **Caching**: Role resolution cached (60s TTL from Phase 2)

### Testing

After migrating each route:
1. Test with Clerk authentication
2. Test with Supabase authentication (when enabled)
3. Verify data is returned correctly
4. Check for performance regressions

---

## 🚀 Migration Priority

### Phase 4a: Critical User Routes (Do First)
1. `/api/carrier/profile` - Profile is core functionality
2. `/api/carrier/bids` - Main bidding feature
3. `/api/carrier/awarded-bids` - Award tracking

### Phase 4b: Secondary Features
4. `/api/carrier/booked-loads` - Load management
5. `/api/carrier/favorites` - Favorites
6. `/api/carrier/conversations` - Messaging

### Phase 4c: Admin Routes
7. `/api/admin/carriers` - Carrier management
8. `/api/admin/bids` - Bid administration

### Phase 4d: Analytics/Stats
9. `/api/carrier/bid-history` - History
10. `/api/carrier/load-stats` - Statistics

---

## 🔍 Verification Queries

After migrating routes, verify with:

```sql
-- Check that queries work with both IDs
SELECT COUNT(*) 
FROM carrier_bids cb
JOIN user_roles_cache urc ON (
  cb.clerk_user_id = urc.clerk_user_id 
  OR cb.supabase_user_id = urc.supabase_user_id
)
WHERE urc.clerk_user_id = 'some_clerk_id';
```

---

## 📊 Migration Progress Tracker

Create a simple tracking file or checklist:

```
Phase 4 Migration Status:
✅ Query helpers created (lib/db-queries.ts)
✅ Auth helpers ready (lib/auth-api-helper.ts)
⏳ Route migrations: 0/30 complete
⏳ Testing: Pending
⏳ Performance validation: Pending
```

---

**Status**: Phase 4 Started ✅  
**Next**: Begin migrating routes one by one  
**Last Updated**: 2025-01-30


