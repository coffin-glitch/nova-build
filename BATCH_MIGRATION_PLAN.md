# Comprehensive Clerk → Supabase Migration Plan

## 🚨 Current Status: 138 Files Still Using Clerk

**CRITICAL SECURITY ISSUE:** Mixed authentication creates security gaps!

---

## Migration Pattern

### Pattern 1: API Routes with `auth()` from Clerk

**BEFORE:**
```typescript
import { auth } from "@clerk/nextjs/server";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ... use userId
}
```

**AFTER:**
```typescript
import { requireApiAuth, requireApiAdmin, requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";

export async function GET(request: NextRequest) {
  try {
    // For admin routes:
    const auth = await requireApiAdmin(request);
    // OR for carrier routes:
    // const auth = await requireApiCarrier(request);
    // OR for any authenticated:
    // const auth = await requireApiAuth(request);
    
    // auth.userId - use this instead of userId
    // auth.userRole - role (admin/carrier/none)
    // auth.provider - 'clerk' or 'supabase'
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    if (error.message.includes("access required")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
```

---

### Pattern 2: Server Pages with `auth()` from Clerk

**BEFORE:**
```typescript
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function MyPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }
}
```

**AFTER:**
```typescript
import { getUnifiedAuth } from "@/lib/auth-unified";
import { redirect } from "next/navigation";

export default async function MyPage() {
  const { userId, userRole } = await getUnifiedAuth();
  if (!userId) {
    redirect('/sign-in');
  }
}
```

**NOTE:** Middleware already handles most route protection, but pages that need user ID should use `getUnifiedAuth()`.

---

### Pattern 3: Database Queries Using `clerk_user_id`

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

const userCondition = await getUserWhereCondition(auth.userId, auth.provider as 'clerk' | 'supabase');
const result = await sql`
  SELECT * FROM carrier_profiles 
  WHERE ${userCondition}
`;
```

**OR use the helper:**
```typescript
import { getCurrentUserWhere } from "@/lib/db-queries";

const userCondition = await getCurrentUserWhere('clerk_user_id');
const result = await sql`
  SELECT * FROM carrier_profiles 
  WHERE ${userCondition}
`;
```

---

## Files to Migrate (138 total)

### Priority 1: Admin API Routes (35+ files) - HIGHEST PRIORITY
- `app/api/admin/**/*.ts` - All need `requireApiAdmin(request)`
- Security critical!

### Priority 2: Carrier API Routes (40+ files) - HIGH PRIORITY  
- `app/api/carrier/**/*.ts` - All need `requireApiCarrier(request)`
- Security critical!

### Priority 3: Server Pages (10+ files) - MEDIUM PRIORITY
- `app/**/page.tsx` - Server components using `auth()`
- Middleware helps, but pages needing user ID should use `getUnifiedAuth()`

### Priority 4: Other API Routes (50+ files) - MEDIUM PRIORITY
- Public/admin/carrier routes using `auth()`

---

## Next Steps

**Option A: Batch Migrate Now**
- I can migrate all 138 files systematically
- Will take multiple passes
- Test after each batch

**Option B: Migrate Critical Routes First**
- Start with admin routes (highest security risk)
- Then carrier routes
- Then server pages
- Then remaining routes

**Which approach do you prefer?** 

I recommend **Option B** - migrate critical security routes first, test, then continue with the rest.

---

## Migration Checklist

For each file:
- [ ] Replace `import { auth } from "@clerk/nextjs/server"` with unified auth
- [ ] Replace `auth()` calls with `requireApiAdmin/Carrier/Auth(request)`
- [ ] Update error handling (401/403)
- [ ] Update database queries to use `getUserWhereCondition` if needed
- [ ] Update user ID references to use `auth.userId`
- [ ] Test the route after migration

---

## Already Migrated

✅ `app/page.tsx` - Client component (uses hooks)
✅ `components/**` - All client components migrated
✅ `lib/auth-api-helper.ts` - Helper functions ready
✅ `lib/auth-unified.ts` - Unified auth logic ready
✅ `middleware.ts` - Already handles unified auth
⏳ `app/api/admin/carriers/route.ts` - IN PROGRESS

---

## Critical: Database Column Usage

**IMPORTANT:** Routes that query by `clerk_user_id` need to be updated to also check `supabase_user_id` OR use the helper functions from `lib/db-queries.ts` that handle both automatically.

**Example:**
```typescript
// BAD - Only works with Clerk:
WHERE clerk_user_id = ${userId}

// GOOD - Works with both:
WHERE ${await getUserWhereCondition(userId, provider, 'cp')}
```



