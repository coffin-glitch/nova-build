# Quick Fix: Supabase Auth Setup

## Issue 1: 500 Error on Sign-Up

The redirect URL needs to be configured in Supabase.

### Fix: Add Redirect URL in Supabase Dashboard

1. **Go to Supabase Dashboard**
   - https://supabase.com/dashboard/project/rbiomzdrlmsexehrhowa
   - Navigate to: **Authentication** → **URL Configuration**

2. **Set Site URL:**
   ```
   http://localhost:3000
   ```

3. **Add Redirect URLs** (click "Add URL" for each):
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/**
   ```

4. **Optional: Disable Email Confirmation (for testing)**
   - Go to: **Authentication** → **Settings**
   - Scroll to **Email Auth**
   - Toggle **"Confirm email"** to **OFF** (temporarily for testing)
   - This lets you sign in immediately without checking email

5. **Save** and try signing up again!

---

## Issue 2: Admin Role Not Showing (`isAdmin: false`)

New users default to "carrier" role. To make yourself admin:

### Option A: Use the Set-Admin Script (Recommended)

1. **Sign up** with your email (after fixing Issue 1)
2. **Run this command:**
   ```bash
   npx tsx scripts/set-supabase-admin.ts your-email@example.com
   ```
   Replace `your-email@example.com` with the email you used to sign up.

3. **You should see:**
   ```
   ✅ Found user: your-email@example.com
   ✅ Successfully set user as admin
   💡 Refresh your browser to see the admin button!
   ```

4. **Refresh the page** - you should see admin buttons!

### Option B: Set Role in Database Directly

1. Go to Supabase Dashboard → **Table Editor**
2. Find `user_roles` table
3. Add a row with:
   - `email`: your email
   - `role`: `admin`
   - `supabase_user_id`: (your Supabase user ID from Authentication → Users)

### Option C: Update the Sign-Up Default

If you want new sign-ups to default to admin (NOT recommended for production), we can change it, but it's better to use the script.

---

## Quick Test Checklist

After fixing both issues:

1. ✅ Configure redirect URLs in Supabase
2. ✅ Disable email confirmation (optional, for testing)
3. ✅ Sign up at http://localhost:3000/sign-up
4. ✅ Set your role to admin using script
5. ✅ Refresh page - admin button should appear!

---

## What the Console Logs Mean

```
🚫 FloatingDevAdminButton: Not rendering - not admin
📊 Current state - isAdmin: false
```

This is **normal** for new users. The admin button only shows when `isAdmin: true`. Once you set your role to admin (see Issue 2 above), this will go away.

