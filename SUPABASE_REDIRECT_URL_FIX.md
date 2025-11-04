# Fix Supabase 500 Error - Redirect URL Configuration

## The Problem

You're getting a 500 error from Supabase when trying to sign up:
```
rbiomzdrlmsexehrhowa.supabase.co/auth/v1/signup?redirect_to=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback
```

This is because Supabase needs to know which URLs are allowed for redirects.

## Quick Fix: Configure Redirect URLs in Supabase Dashboard

### Step 1: Go to Supabase Dashboard

1. Visit: https://supabase.com/dashboard
2. Select your project: **rbiomzdrlmsexehrhowa**
3. Navigate to: **Authentication** → **URL Configuration**

### Step 2: Configure URLs

**Site URL:**
```
http://localhost:3000
```

**Redirect URLs:**
Click "Add URL" and add each of these (one at a time):

```
http://localhost:3000/auth/callback
http://localhost:3000/**
```

**Important Notes:**
- The `/**` pattern allows all paths on localhost:3000
- Make sure there are **no trailing slashes** (e.g., `http://localhost:3000/` ❌)
- Click **Save** after adding each URL

### Step 3: Check Email Confirmation Settings

While you're in Authentication settings:

1. Go to **Authentication** → **Settings**
2. Scroll to **Email Auth**
3. Check **"Confirm email"** setting:
   - If **ON**: Users must confirm email before signing in (requires SMTP)
   - If **OFF**: Users can sign in immediately (good for testing)

**For testing, I recommend:**
- Set **"Confirm email"** to **OFF** temporarily
- This lets you test sign-up immediately
- Turn it back ON when SMTP is fully working

### Step 4: Save and Test

1. Click **Save** on all changes
2. Try signing up again at http://localhost:3000/sign-up
3. The 500 error should be gone!

---

## Additional Configuration (Optional)

If you want to allow production URLs too, add these to Redirect URLs:

```
https://yourdomain.com/auth/callback
https://yourdomain.com/**
```

Replace `yourdomain.com` with your actual production domain.

---

## Troubleshooting

**Still getting 500 error?**
1. Check Supabase Dashboard → **Logs** → **API Logs** for detailed error
2. Verify SMTP is configured (if email confirmation is ON)
3. Try disabling email confirmation temporarily for testing

**Can't find URL Configuration?**
- Make sure you're in the correct project
- URL Configuration is under **Authentication** → **URL Configuration** (or sometimes **Authentication** → **Settings** → scroll down)



