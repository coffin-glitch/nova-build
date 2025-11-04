# Complete Clerk Removal Plan

## Current Status

**Found 262 files with Clerk references** - We need to systematically remove ALL of them and ensure everything uses Supabase.

---

## Strategy

1. **Keep Dual-Auth Helpers** (temporary)
   - `lib/auth-unified.ts` - Can keep temporarily for migration
   - `lib/auth-api-helper.ts` - Uses middleware headers (Supabase-compatible)
   - `lib/db-queries.ts` - Handles both user IDs

2. **Remove Direct Clerk Imports**
   - Replace all `@clerk/nextjs` imports
   - Remove Clerk-specific functions
   - Update all API routes

3. **Update Database Queries**
   - Use `lib/db-queries.ts` helpers instead of direct `clerk_user_id` queries
   - These helpers handle both Clerk and Supabase automatically

---

## Migration Checklist

### ✅ Already Migrated

- [x] `app/layout.tsx` - Uses SupabaseProvider
- [x] `app/sign-in/[[...sign-in]]/page.tsx` - Uses SupabaseSignIn
- [x] `app/sign-up/[[...sign-up]]/page.tsx` - Uses SupabaseSignUp
- [x] `components/layout/SiteHeaderNew.tsx` - No more UserButton
- [x] `hooks/useUnifiedUser.ts` - Uses Supabase
- [x] `hooks/useUnifiedRole.ts` - Uses Supabase
- [x] `middleware.ts` - Uses Supabase auth
- [x] `app/api/user/role/route.ts` - Uses Supabase
- [x] Core admin routes (carriers, bids)

### ⏳ Needs Migration (High Priority)

#### API Routes Still Using Clerk

1. **Admin Routes** (~30 files):
   - `app/api/admin/**/*.ts` - Check each for `auth()` from Clerk
   - Priority: Already started, need to finish

2. **Carrier Routes** (~40 files):
   - `app/api/carrier/**/*.ts` - Need `requireApiCarrier`
   - Priority: HIGH - Security critical

3. **Legacy Routes**:
   - `app/api/clerk-roles/route.ts` - **DEPRECATE**
   - `app/api/auth/validate-role/route.ts` - Update to Supabase

#### Server Pages

1. `app/admin/**/page.tsx` - Check for `auth()` usage
2. `app/carrier/**/page.tsx` - Check for `auth()` usage
3. `app/bid-board/page.tsx`
4. `app/find-loads/page.tsx`

#### Components

1. `components/Nav.tsx` - Check for Clerk hooks
2. `components/nav/AppHeader.tsx` - Check for Clerk hooks
3. `components/ClientSignIn.tsx` - Keep for backward compat (unused if Supabase enabled)
4. `components/ClientSignUp.tsx` - Keep for backward compat
5. `components/ClerkProfile.tsx` - Replace with Supabase profile
6. `components/ClientProfile.tsx` - Check usage

#### Libraries

1. `lib/auth-server.ts` - **DEPRECATE** or update to Supabase only
2. `lib/clerk-server.ts` - **DEPRECATE**
3. `lib/clerk-auth.ts` - **DEPRECATE**
4. `lib/clerk-roles.ts` - **DEPRECATE**
5. `lib/auth.ts` - Check if still used

---

## Migration Pattern

### For API Routes:

**BEFORE:**
```typescript
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // ...
}
```

**AFTER:**
```typescript
import { getApiAuth, requireApiAdmin } from "@/lib/auth-api-helper";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request); // or requireApiCarrier
    // Use auth.userId, auth.userRole
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }
}
```

### For Database Queries:

**BEFORE:**
```typescript
const result = await sql`
  SELECT * FROM carrier_profiles
  WHERE clerk_user_id = ${userId}
`;
```

**AFTER:**
```typescript
import { getUserWhereCondition } from "@/lib/db-queries";

const userWhere = getUserWhereCondition(request, 'clerk_user_id');
const result = await sql`
  SELECT * FROM carrier_profiles
  WHERE ${userWhere}
`;
```

---

## Quick Win: Automated Script

I'll create a script to find and replace common patterns automatically.

---

## Testing After Migration

1. ✅ Sign up with new account
2. ✅ Sign in with existing account
3. ✅ Admin routes work
4. ✅ Carrier routes work
5. ✅ Profile pages work
6. ✅ No Clerk errors in console
7. ✅ All API calls use Supabase auth



