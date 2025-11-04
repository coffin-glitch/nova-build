# Complete Clerk → Supabase Migration Plan

## 🎯 End Goal
Switch completely from Clerk to Supabase Auth across the entire application, maintaining all functionality while improving security and centralization.

---

## ✅ What's Already Done

1. **Phase 1-7 Complete** - All infrastructure is in place
2. **Supabase Auth Pages Redesigned** - Match your sleek UI design
3. **SMTP Setup Guide** - Ready for Google Workspace configuration
4. **Google OAuth Ready** - Button added to sign-in/sign-up pages

---

## 📋 Migration Checklist

### Step 1: Configure SMTP ✅ (Ready to do)
- [ ] Generate Google App Password
- [ ] Configure SMTP in Supabase Dashboard
- [ ] Test email delivery (sign-up confirmation)
- [ ] Verify password reset emails work

**Guide**: See `SMTP_SETUP_DETAILED_GUIDE.md`

---

### Step 2: Test Supabase Auth Locally

- [ ] Set environment variables in `.env.local`:
  ```bash
  AUTH_PROVIDER=supabase
  NEXT_PUBLIC_USE_SUPABASE_AUTH=true
  ```

- [ ] Restart dev server: `npm run dev`

- [ ] Test sign-up flow:
  - Go to `/sign-up`
  - Create test account
  - Check email for confirmation
  - Click confirmation link
  - Verify account is confirmed

- [ ] Test sign-in flow:
  - Go to `/sign-in`
  - Sign in with email/password
  - Verify redirect works
  - Check session persistence

- [ ] Test password reset:
  - Click "Forgot password"
  - Enter email
  - Check email for reset link
  - Reset password
  - Sign in with new password

- [ ] Test Google Sign-In (if OAuth configured):
  - Click "Sign in with Google"
  - Complete OAuth flow
  - Verify redirect and session

---

### Step 3: Update Application Pages

#### 3a: Update Root Layout
**File**: `app/layout.tsx`

Replace ClerkProvider with SupabaseProvider (use feature flag):

```typescript
import { ClerkProvider } from "@clerk/nextjs";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";

const USE_SUPABASE_AUTH = process.env.NEXT_PUBLIC_USE_SUPABASE_AUTH === 'true';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {USE_SUPABASE_AUTH ? (
          <SupabaseProvider>
            {children}
          </SupabaseProvider>
        ) : (
          <ClerkProvider>
            {children}
          </ClerkProvider>
        )}
        {/* Rest of layout */}
      </body>
    </html>
  );
}
```

#### 3b: Update Sign-In Page
**File**: `app/sign-in/[[...sign-in]]/page.tsx`

```typescript
import SupabaseSignIn from "@/components/SupabaseSignIn";
import { SignIn } from "@clerk/nextjs";

const USE_SUPABASE_AUTH = process.env.NEXT_PUBLIC_USE_SUPABASE_AUTH === 'true';

export default function Page() {
  if (USE_SUPABASE_AUTH) {
    return <SupabaseSignIn />;
  }
  return <SignIn routing="hash" />;
}
```

#### 3c: Update Sign-Up Page
**File**: `app/sign-up/[[...sign-up]]/page.tsx`

```typescript
import SupabaseSignUp from "@/components/SupabaseSignUp";
import { SignUp } from "@clerk/nextjs";

const USE_SUPABASE_AUTH = process.env.NEXT_PUBLIC_USE_SUPABASE_AUTH === 'true';

export default function Page() {
  if (USE_SUPABASE_AUTH) {
    return <SupabaseSignUp />;
  }
  return <SignUp routing="hash" />;
}
```

---

### Step 4: Update Client Components

#### 4a: Update Navigation/Header Components

**Files to update**:
- `components/layout/SiteHeaderNew.tsx`
- `components/Nav.tsx`
- `components/nav/AppHeader.tsx`

**Replace Clerk hooks with Supabase hooks**:

```typescript
// Before
import { useUser, UserButton } from "@clerk/nextjs";

// After
import { useSupabaseUser, useSupabaseAuth } from "@/components/providers/SupabaseProvider";

// Usage
const { user } = useSupabaseUser();
const { isSignedIn } = useSupabaseAuth();
```

**Replace UserButton with custom dropdown**:

```typescript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const { user, isSignedIn } = useSupabaseAuth();
const { supabase } = useSupabase();

{isSignedIn && user && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm">
        {user.email}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem onClick={() => supabase.auth.signOut()}>
        Sign Out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

#### 4b: Update Protected Route Guards

**File**: `components/ProfileGuard.tsx`

Update to use Supabase auth instead of Clerk.

---

### Step 5: Update API Routes

For each API route that uses Clerk auth:

1. **Replace auth import**:
   ```typescript
   // Before
   import { auth } from "@clerk/nextjs/server";
   
   // After
   import { requireApiAuth, requireApiAdmin, requireApiCarrier } from "@/lib/auth-api-helper";
   ```

2. **Update auth checks**:
   ```typescript
   // Before
   const { userId } = await auth();
   if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   
   // After
   const { userId } = await requireApiAuth();
   ```

3. **Update role checks**:
   ```typescript
   // Before
   // Manual role check
   
   // After
   await requireApiAdmin(); // or requireApiCarrier()
   ```

4. **Update database queries**:
   ```typescript
   // Use query helpers for dual-ID support
   import { getCurrentUserWhere } from "@/lib/db-queries";
   
   const userWhere = await getCurrentUserWhere('clerk_user_id');
   const data = await sql`
     SELECT * FROM table
     WHERE ${userWhere}
   `;
   ```

**Priority API Routes**:
- `/api/carrier/profile` - High priority
- `/api/carrier/bids` - High priority
- `/api/carrier/awarded-bids` - High priority
- `/api/admin/*` - All admin routes
- `/api/carrier/conversations` - Medium priority
- Others as needed

---

### Step 6: Run Backfill Script

Once SMTP is working and you have users:

```bash
# Dry run first
npx tsx scripts/backfill-supabase-user-ids.ts --dry-run

# If looks good, run for real
npx tsx scripts/backfill-supabase-user-ids.ts
```

This maps existing Clerk users to Supabase users by email.

---

### Step 7: Deploy to Production

1. **Set Environment Variables** (Vercel/Railway):
   ```
   AUTH_PROVIDER=supabase
   NEXT_PUBLIC_USE_SUPABASE_AUTH=true
   ```

2. **Update Supabase Redirect URLs**:
   - Add production domain to Supabase Dashboard
   - Update OAuth redirect URIs (if using Google Sign-In)

3. **Deploy**

4. **Monitor**:
   - Check `/api/admin/auth-metrics` for auth stats
   - Monitor error logs
   - Watch for rollback recommendations

---

### Step 8: Clean Up (After 7+ Days of Successful Operation)

- [ ] Remove Clerk dependencies from `package.json`
- [ ] Remove Clerk environment variables
- [ ] Remove Clerk provider from code
- [ ] Update documentation
- [ ] Archive Clerk credentials (keep for 30 days as backup)

---

## 🧪 Testing Checklist

After each major step, test:

- [ ] Sign up new user
- [ ] Sign in existing user
- [ ] Password reset
- [ ] Email confirmation
- [ ] Google Sign-In (if enabled)
- [ ] Protected routes (admin/carrier)
- [ ] Session persistence (refresh page)
- [ ] Sign out
- [ ] Role-based access control
- [ ] API routes authentication
- [ ] All features that depend on auth

---

## 🔄 Rollback Plan

If issues occur:

1. **Immediate Rollback**:
   ```bash
   # Set in environment
   AUTH_PROVIDER=clerk
   NEXT_PUBLIC_USE_SUPABASE_AUTH=false
   
   # Redeploy
   ```

2. **Investigate Issues**:
   - Check error logs
   - Review metrics
   - Fix issues

3. **Retry**:
   - Fix issues
   - Attempt cutover again

---

## 📊 Success Metrics

Migration is successful when:

- ✅ All auth flows working (sign-up, sign-in, password reset)
- ✅ Email delivery > 95% success rate
- ✅ No user complaints for 7+ days
- ✅ All protected routes working
- ✅ API routes functioning correctly
- ✅ Session persistence working
- ✅ Role-based access control working

---

## 📚 Reference Documents

- `SMTP_SETUP_DETAILED_GUIDE.md` - SMTP configuration
- `GOOGLE_WORKSPACE_SETUP_STEPS.md` - Google OAuth setup
- `MIGRATION_COMPLETE_SUMMARY.md` - Overview of all phases
- `PHASE6_UI_MIGRATION.md` - UI component migration guide
- `PHASE4_API_MIGRATION.md` - API route migration guide

---

**Status**: Ready for Step 1 (SMTP Setup)  
**Next**: Configure SMTP in Supabase Dashboard  
**Last Updated**: 2025-01-30



