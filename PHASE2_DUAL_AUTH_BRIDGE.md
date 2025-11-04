# Phase 2: Dual-Auth Bridge - Implementation Summary

## ✅ Completed Components

### 1. Unified Authentication Helper (`lib/auth-unified.ts`)

**Purpose**: Single interface for auth operations supporting both Clerk and Supabase.

**Key Features**:
- `getAuthProvider()` - Determines active provider from `AUTH_PROVIDER` env var
- `getUnifiedAuth()` - Gets user ID, role, and email from either provider
- `requireAuthenticated()` - Throws if not authenticated
- `requireAdmin()` - Requires admin role
- `requireCarrier()` - Requires carrier or admin role
- Role caching with 60s TTL for performance
- Automatic fallback: Supabase → Clerk if Supabase fails

**Status**: ✅ Complete

### 2. Middleware Updates (`middleware.ts`)

**Changes**:
- Integrated `getUnifiedAuth()` for dual-provider support
- Added request headers for downstream routes:
  - `X-User-Id` - Unified user ID
  - `X-User-Role` - User role (admin/carrier/none)
  - `X-Auth-Provider` - Current provider (clerk/supabase)
  - `X-Clerk-User-Id` - Clerk ID (backward compatibility)
- Maintains backward compatibility with existing Clerk flows
- Graceful fallback if unified auth fails

**Status**: ✅ Complete (needs testing)

### 3. API Route Helper (`lib/auth-api-helper.ts`)

**Purpose**: Fast auth retrieval for API routes using middleware headers.

**Key Functions**:
- `getApiAuth()` - Reads from headers (fast) or falls back to direct auth
- `requireApiAuth()` - Throws if not authenticated
- `requireApiAdmin()` - Requires admin role
- `requireApiCarrier()` - Requires carrier/admin role
- `getClerkUserIdFromHeader()` - Backward compatibility helper

**Usage Example**:
```typescript
// In API route
import { requireApiAdmin } from "@/lib/auth-api-helper";

export async function GET() {
  const { userId, userRole } = await requireApiAdmin();
  // User is guaranteed to be admin
}
```

**Status**: ✅ Complete

---

## 🔄 How It Works

### Authentication Flow

1. **Request arrives** → Middleware intercepts
2. **Public route?** → Allow through, no auth needed
3. **Check auth provider** → Read `AUTH_PROVIDER` env var (defaults to "clerk")
4. **Get unified auth**:
   - If `AUTH_PROVIDER=supabase` → Try Supabase first
   - If Supabase fails → Fallback to Clerk
   - If `AUTH_PROVIDER=clerk` → Use Clerk directly
5. **Resolve role**:
   - Check in-memory cache (60s TTL)
   - If miss, query provider (Clerk metadata or Supabase DB)
   - Cache result
6. **Set headers** → Attach `X-User-Id`, `X-User-Role`, etc.
7. **Route protection** → Check role against route requirements
8. **Response** → Return with auth headers attached

### API Route Usage

**Before (Clerk-only)**:
```typescript
import { requireAdmin } from "@/lib/auth-server";

export async function GET() {
  const userId = await requireAdmin(); // Direct Clerk call
}
```

**After (Dual-Auth)**:
```typescript
import { requireApiAdmin } from "@/lib/auth-api-helper";

export async function GET() {
  const { userId, userRole } = await requireApiAdmin(); // Uses headers or direct auth
}
```

---

## 🧪 Testing Checklist

### Phase 2 Testing

- [ ] Middleware properly sets headers
- [ ] `getUnifiedAuth()` works with Clerk
- [ ] `getUnifiedAuth()` works with Supabase (when configured)
- [ ] Fallback from Supabase to Clerk works
- [ ] Role caching works (check 60s TTL)
- [ ] API routes can read headers
- [ ] API routes fallback works when headers not present
- [ ] Backward compatibility maintained (existing Clerk routes work)

### Manual Test Steps

1. **Test Clerk Flow** (default):
   ```bash
   # No AUTH_PROVIDER set or AUTH_PROVIDER=clerk
   npm run dev
   # Login with Clerk
   # Check browser dev tools → Network → Headers → Should see X-User-Id, X-User-Role
   ```

2. **Test Supabase Flow** (when ready):
   ```bash
   # Set AUTH_PROVIDER=supabase in .env.local
   AUTH_PROVIDER=supabase
   npm run dev
   # Login with Supabase
   # Verify same headers are set
   ```

3. **Test API Route**:
   ```typescript
   // Create test route: app/api/test-auth/route.ts
   import { getApiAuth } from "@/lib/auth-api-helper";
   
   export async function GET() {
     const auth = await getApiAuth();
     return Response.json(auth);
   }
   ```
   - Visit `/api/test-auth`
   - Should see `{ userId, userRole, provider, fromHeader: true }`

---

## ⚠️ Known Limitations & Notes

### Current Limitations

1. **Supabase Role Resolution** (Phase 3):
   - Currently defaults to "carrier" for Supabase users
   - Will be fixed in Phase 3 when we migrate role data
   - Function `getSupabaseUserRole()` is a placeholder

2. **Cookies in Middleware**:
   - Edge runtime has limited cookie support
   - May need adjustments for production
   - Testing needed in Vercel/Railway environments

3. **Profile Check Still Uses `clerk_user_id`**:
   - Middleware profile check still queries `carrier_profiles.clerk_user_id`
   - Will be updated in Phase 3 to support unified user ID

### Migration Strategy

**Phase 2 (Current)**: Dual-auth bridge ready
- Clerk remains primary
- Supabase support added but not active
- No breaking changes

**Phase 3 (Next)**: Schema migration
- Add `supabase_user_id` columns
- Backfill user mappings
- Update queries to support both IDs

**Phase 4 (Future)**: API migration
- Gradually migrate routes to use `auth-api-helper`
- Can be done incrementally
- Old routes continue to work

---

## 📝 Environment Variables

### Required for Phase 2

```bash
# Clerk (existing, still required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Supabase (already set)
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ... # Get from Supabase dashboard
DATABASE_URL=postgresql://... # pgBouncer pooler URL

# Auth Provider Toggle (optional, defaults to "clerk")
AUTH_PROVIDER=clerk  # or "supabase" when ready
```

### Where to Get `SUPABASE_SERVICE_ROLE_KEY`

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy **`service_role`** key (⚠️ Keep secret!)
5. Add to `.env.local` and Vercel/Railway secrets

---

## 🚀 Next Steps

1. **Test Phase 2 locally**
   - Verify middleware headers work
   - Test API route helpers
   - Ensure no regressions

2. **Phase 3: Schema Migration**
   - Create migration to add `supabase_user_id` columns
   - Create backfill script
   - Update `user_roles_cache` to support Supabase

3. **Gradual API Migration**
   - Start migrating one route at a time
   - Test each migration
   - Monitor for issues

4. **Phase 4: Supabase Auth Integration**
   - Configure Supabase email flows
   - Replace Clerk sign-in/sign-up pages
   - Test end-to-end auth flows

---

## 🔍 Debugging

### Enable Debug Logging

The middleware and unified auth helpers include console logs:
- `🔍 Middleware Debug:` - Middleware execution
- `🔍 Unified Auth Result:` - Auth resolution result
- `❌ Error in unified auth:` - Auth failures

### Check Headers

In browser dev tools:
1. Open Network tab
2. Select any request
3. Check Response Headers for:
   - `X-User-Id`
   - `X-User-Role`
   - `X-Auth-Provider`
   - `X-Clerk-User-Id`

### Common Issues

**Issue**: Headers not appearing
- **Cause**: Middleware not running or error occurred
- **Fix**: Check middleware logs, verify route matches config

**Issue**: "Unauthorized" in API routes
- **Cause**: Headers not set or auth failed
- **Fix**: Check `getApiAuth()` logs, verify middleware executed

**Issue**: Role always "carrier"
- **Cause**: Role resolution failing or defaulting
- **Fix**: Check `getClerkUserRole()` or `getSupabaseUserRole()` logs

---

**Status**: Phase 2 Complete ✅  
**Next**: Phase 3 - Schema Migration  
**Last Updated**: 2025-01-30


