# Cutover Steps - Step-by-Step Guide

## Step 1: Configure SMTP in Supabase Dashboard

### What This Does
Configures Supabase to send authentication emails (sign-up confirmation, password reset, magic links).

### How to Do It

1. **Go to Supabase Dashboard**
   - Visit: https://app.supabase.com
   - Log in and select your project

2. **Navigate to Authentication Settings**
   - Click **"Authentication"** in the left sidebar
   - Click **"Settings"** (gear icon or Settings tab)
   - Scroll down to **"SMTP Settings"** section

3. **Enable Custom SMTP** (Recommended for Production)

   **Option A: Use SendGrid (Recommended)**
   ```
   SMTP Host: smtp.sendgrid.net
   SMTP Port: 587
   SMTP User: apikey
   SMTP Password: [Your SendGrid API Key]
   Sender Email: noreply@yourdomain.com
   Sender Name: NOVA Build
   ```

   **Option B: Use Mailgun**
   ```
   SMTP Host: smtp.mailgun.org
   SMTP Port: 587
   SMTP User: [Your Mailgun SMTP Username]
   SMTP Password: [Your Mailgun SMTP Password]
   Sender Email: noreply@yourdomain.com
   Sender Name: NOVA Build
   ```

   **Option C: Use Gmail (For Testing Only)**
   ```
   SMTP Host: smtp.gmail.com
   SMTP Port: 587
   SMTP User: your-email@gmail.com
   SMTP Password: [App Password - not regular password]
   Sender Email: your-email@gmail.com
   Sender Name: NOVA Build
   ```

4. **Save SMTP Settings**
   - Click **"Save"** or **"Update"**
   - Wait for confirmation message

5. **Verify Email Templates** (Optional but Recommended)
   - In Authentication → **Email Templates**
   - Review and customize templates:
     - Confirm signup
     - Magic Link
     - Change Email Address
     - Reset Password
     - Invite User

6. **Configure Redirect URLs**
   - In Authentication → **URL Configuration**
   - Set **Site URL**: `http://localhost:3000` (for dev) or `https://yourdomain.com` (for prod)
   - Add **Redirect URLs**:
     ```
     http://localhost:3000/auth/callback
     https://yourdomain.com/auth/callback
     http://localhost:3000/auth/reset-password
     https://yourdomain.com/auth/reset-password
     ```

### Verification
- Try sending a test email from Supabase Dashboard (if available)
- Or proceed to Step 3 to test via the app

---

## Step 2: Run Backfill Script (If You Have Existing Users)

### What This Does
Maps existing Clerk users to Supabase users by matching email addresses. Populates the `supabase_user_id` columns we added in Phase 3.

### Prerequisites
- `SUPABASE_SERVICE_ROLE_KEY` must be set in your `.env.local`

### How to Get SUPABASE_SERVICE_ROLE_KEY

1. **Go to Supabase Dashboard**
   - Visit: https://app.supabase.com
   - Select your project

2. **Navigate to API Settings**
   - Click **"Settings"** (gear icon) in left sidebar
   - Click **"API"** under Project Settings

3. **Copy Service Role Key**
   - Find **"service_role"** key (⚠️ **SECRET** - keep it safe!)
   - Click the **eye icon** to reveal it
   - Copy the entire key

4. **Add to Environment**
   ```bash
   # Add to .env.local
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### Run the Backfill Script

**Step 2a: Dry Run (Test First)**
```bash
cd /Users/dukeisaac/nova-build
npx tsx scripts/backfill-supabase-user-ids.ts --dry-run
```

**What to Expect:**
- Script lists all Clerk users from `user_roles_cache`
- Attempts to find matching Supabase users by email
- Shows summary: mapped/unmapped/errors
- **No changes made** (dry-run mode)

**Review Output:**
- Check how many users would be mapped
- Review any unmapped users (these don't have Supabase accounts yet)
- Verify no errors

**Step 2b: Run for Real**
```bash
npx tsx scripts/backfill-supabase-user-ids.ts
```

**What to Expect:**
- Same process but actually updates the database
- Updates `user_roles_cache.supabase_user_id`
- Updates `carrier_profiles.supabase_user_id`
- Updates all related tables (bids, messages, etc.)

**Verify Backfill:**
```bash
# Connect to your database
psql $DATABASE_URL

# Check mapping coverage
SELECT 
    COUNT(*) as total_users,
    COUNT(supabase_user_id) as mapped_users,
    COUNT(*) - COUNT(supabase_user_id) as unmapped_users,
    ROUND(100.0 * COUNT(supabase_user_id) / COUNT(*), 2) as coverage_percent
FROM user_roles_cache;

# Should show high coverage (ideally 100% if all users signed up in Supabase)
```

### If Users Are Unmapped

**Unmapped users** are Clerk users who don't have Supabase accounts yet. This is fine because:
- Existing queries using `clerk_user_id` still work
- Users will be mapped when they sign up via Supabase
- Or they can continue using Clerk until they migrate

---

## Step 3: Test Supabase Auth Locally

### What This Does
Tests the Supabase authentication flow on your local machine before going to production.

### Enable Supabase Auth Locally

**Step 3a: Update .env.local**

```bash
# Add/update these in .env.local
AUTH_PROVIDER=supabase
NEXT_PUBLIC_USE_SUPABASE_AUTH=true

# Make sure these are set (should already be there)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Step 3b: Restart Dev Server**

```bash
# Stop current server (Ctrl+C)
# Then restart
npm run dev
```

### Test Sign-Up Flow

1. **Open Browser**
   - Go to: http://localhost:3000/sign-up
   - You should see the Supabase sign-up form (not Clerk)

2. **Create Test Account**
   - Enter email: `test@example.com`
   - Enter password: `Test123456` (min 8 characters)
   - Confirm password
   - Click "Create Account"

3. **Check Email**
   - Check your email inbox
   - You should receive a confirmation email from Supabase
   - Click the confirmation link

4. **Verify Sign-In**
   - After clicking confirmation link, you should be redirected
   - Try signing in at http://localhost:3000/sign-in
   - Use the same email/password

### Test Password Reset

1. **Go to Sign-In Page**
   - http://localhost:3000/sign-in

2. **Use Magic Link** (or create forgot password page)
   - Enter your email
   - Click "Sign in with magic link"
   - Check email for magic link

### Test Session Persistence

1. **Sign In**
2. **Navigate to Protected Route**
   - Try `/admin` or `/carrier` routes
   - Should work if you have proper role
3. **Refresh Page**
   - Session should persist
   - Should stay signed in

### Troubleshooting

**Issue: "Sign up not working"**
- Check browser console for errors
- Check Supabase Dashboard → Authentication → Settings
- Verify SMTP is configured
- Check email was sent in Supabase Dashboard → Logs

**Issue: "Callback not working"**
- Verify `/auth/callback` route exists (we created it)
- Check redirect URLs are whitelisted in Supabase
- Check browser console for errors

**Issue: "Session not persisting"**
- Verify cookies are being set (check browser DevTools → Application → Cookies)
- Check SupabaseProvider is mounted in root layout
- Check middleware is working

---

## Step 4: Set Environment Variables for Production

### When You're Ready for Production Cutover

**For Local Testing (Already done in Step 3):**
```bash
# .env.local
AUTH_PROVIDER=supabase
NEXT_PUBLIC_USE_SUPABASE_AUTH=true
```

**For Production (Vercel/Railway/etc.):**

### Option A: Vercel

1. **Go to Vercel Dashboard**
   - https://vercel.com/dashboard
   - Select your project

2. **Navigate to Settings → Environment Variables**

3. **Add/Update Variables:**
   ```
   AUTH_PROVIDER = supabase
   NEXT_PUBLIC_USE_SUPABASE_AUTH = true
   ```

4. **Set for All Environments:**
   - Production ✅
   - Preview ✅
   - Development ✅ (optional)

5. **Save and Redeploy**
   - Click "Save"
   - Redeploy your application
   - Or it will auto-deploy on next push

### Option B: Railway

1. **Go to Railway Dashboard**
   - https://railway.app/dashboard
   - Select your project

2. **Navigate to Variables Tab**

3. **Add/Update Variables:**
   ```
   AUTH_PROVIDER = supabase
   NEXT_PUBLIC_USE_SUPABASE_AUTH = true
   ```

4. **Save**
   - Variables auto-save
   - Application will restart automatically

### Option C: Other Platforms

Add these environment variables in your platform's dashboard:
```bash
AUTH_PROVIDER=supabase
NEXT_PUBLIC_USE_SUPABASE_AUTH=true
```

Then redeploy/restart your application.

### Verify Cutover

After setting variables and redeploying:

1. **Visit Production Site**
2. **Go to Sign-In Page**
   - Should see Supabase sign-in (not Clerk)
3. **Test Sign-In**
   - Use existing account or create new one
4. **Verify Protected Routes Work**
   - Try accessing `/admin` or `/carrier`
   - Should work if you have proper role

### Monitoring

1. **Check Metrics**
   - Visit: `/api/admin/auth-metrics` (admin only)
   - Should see Supabase events being tracked

2. **Monitor for 7 Days**
   - Check metrics daily
   - Watch for rollback recommendations
   - Monitor error logs

---

## Step 5: Migrate Routes Using Query Helpers (Deferred to End)

### What This Means

Update API routes to use the unified query helpers that work with both Clerk and Supabase user IDs. This ensures routes work regardless of which auth provider is active.

### When to Do This

**You requested to defer this** - so we'll do it at the end. But here's what it involves:

### How It Works

**Before (Clerk-only):**
```typescript
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  const { userId } = await auth();
  const data = await sql`
    SELECT * FROM carrier_bids
    WHERE clerk_user_id = ${userId}
  `;
}
```

**After (Dual-Auth):**
```typescript
import { requireApiCarrier } from "@/lib/auth-api-helper";
import { getCurrentUserWhere } from "@/lib/db-queries";

export async function GET() {
  const { userId } = await requireApiCarrier();
  const userWhere = await getCurrentUserWhere('clerk_user_id');
  
  const data = await sql`
    SELECT * FROM carrier_bids
    WHERE ${userWhere}
  `;
}
```

### Migration Process

1. **Pick a Route** (start with low-risk routes)
   - Example: `/api/carrier/bids`

2. **Update Imports**
   - Replace `auth()` with `requireApiAuth()` or `requireApiCarrier()`
   - Import query helpers from `@/lib/db-queries`

3. **Update Queries**
   - Replace `WHERE clerk_user_id = ${userId}` 
   - With `WHERE ${await getCurrentUserWhere('clerk_user_id')}`

4. **Test**
   - Test with Clerk auth
   - Test with Supabase auth (when enabled)
   - Verify data is returned correctly

5. **Repeat**
   - Migrate routes one at a time
   - Test each migration
   - Continue until all routes migrated

### Priority Order

1. **High Priority** (User-facing):
   - `/api/carrier/profile`
   - `/api/carrier/bids`
   - `/api/carrier/awarded-bids`

2. **Medium Priority**:
   - `/api/carrier/booked-loads`
   - `/api/carrier/favorites`
   - `/api/carrier/conversations`

3. **Low Priority**:
   - `/api/carrier/bid-history`
   - `/api/carrier/load-stats`

See `PHASE4_API_MIGRATION.md` for detailed examples.

---

## 🔄 Rollback Plan

If anything goes wrong:

### Immediate Rollback

1. **Update Environment Variables**
   ```bash
   AUTH_PROVIDER=clerk
   NEXT_PUBLIC_USE_SUPABASE_AUTH=false
   ```

2. **Redeploy/Restart**
   - App immediately reverts to Clerk
   - All Clerk sessions remain valid

3. **Investigate**
   - Check error logs
   - Review metrics
   - Fix issues

4. **Retry**
   - Fix issues
   - Attempt cutover again

---

## ✅ Final Checklist

Before going to production:

- [ ] SMTP configured in Supabase Dashboard
- [ ] Redirect URLs whitelisted
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in environment
- [ ] Backfill script run (if users exist)
- [ ] Tested sign-up flow locally
- [ ] Tested sign-in flow locally
- [ ] Tested password reset locally
- [ ] Tested session persistence
- [ ] Environment variables set in production
- [ ] Monitoring enabled
- [ ] Rollback plan ready

---

**Ready to start?** Let's begin with Step 1!



