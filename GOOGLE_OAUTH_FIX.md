# Google OAuth Sign-In Loop Fix

## The Problem

After signing in with Google OAuth, users are redirected back to the sign-in page instead of being authenticated.

## What I Fixed

### 1. Sign-In Page Now Checks for Existing Session

The `SupabaseSignIn` component now automatically redirects authenticated users to the home page.

**File:** `components/SupabaseSignIn.tsx`

### 2. Improved Callback Handler

Added better logging and explicit cookie setting in the OAuth callback handler.

**File:** `app/auth/callback/route.ts`

### 3. Admin Role Script

Created a script to set admin roles for Supabase users.

**File:** `scripts/set-supabase-admin.ts`

---

## How to Test

### Step 1: Make Sure Environment Variables Are Set

Check that `.env.local` has:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://rbiomzdrlmsexehrhowa.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 2: Set Admin Role for Your Account

Run:
```bash
npx tsx scripts/set-supabase-admin.ts duke@novafreight.io
```

This will:
- Find your Supabase user by email
- Set your role to `admin` in the database
- Update both `user_roles` and `user_roles_cache` tables

### Step 3: Test Google Sign-In

1. Go to: http://localhost:3000/sign-in
2. Click "Sign in with Google"
3. Complete Google authentication
4. You should be redirected to the home page (not back to sign-in)
5. The admin button should appear

---

## If It Still Loops

### Check Browser Console

Look for errors like:
- `[Auth Callback] Code exchange error`
- `[SupabaseSignIn] User already authenticated, redirecting...`

### Check Terminal/Server Logs

Look for:
- `[Auth Callback] Exchanging code for session...`
- `[Auth Callback] Success! User authenticated: duke@novafreight.io`
- `[Auth Callback] Redirecting to: /`

### Verify Supabase Configuration

1. **Redirect URLs in Supabase:**
   - Go to: Supabase Dashboard → Authentication → URL Configuration
   - Make sure these are added:
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3000/**`

2. **Google OAuth Configuration:**
   - Go to: Supabase Dashboard → Authentication → Providers → Google
   - Make sure it's enabled
   - Verify Client ID and Secret are set
   - Check the Callback URL matches what's in Google Cloud Console

3. **Google Cloud Console:**
   - Go to: Google Cloud Console → APIs & Services → Credentials
   - Find your OAuth Client ID
   - Make sure these redirect URIs are added:
     - `https://rbiomzdrlmsexehrhowa.supabase.co/auth/v1/callback`
     - `http://localhost:3000/auth/callback`

---

## Next Steps

1. ✅ Test Google Sign-In again
2. ✅ Run the admin script for `duke@novafreight.io`
3. ✅ Verify admin button appears after refresh
4. ✅ Test other auth flows (email/password, magic link)



