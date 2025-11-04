# Google Workspace Setup for Supabase

## Overview

You need to set up **two separate things** with Google Workspace:

1. **Google OAuth** - For "Sign in with Google" functionality (optional)
2. **Google SMTP** - For sending authentication emails (recommended)

Both are configured in your Supabase Dashboard, but use different Google Workspace credentials.

---

## Part 1: Google SMTP Setup (For Email Sending)

### What This Does
Configures Supabase to send authentication emails (sign-up confirmations, password resets, magic links) using your Google Workspace SMTP server.

### Step-by-Step Instructions

#### Step 1: Generate Google App Password

**Important**: You can't use your regular Google Workspace password. You need an App Password.

1. **Go to Google Account Settings**
   - Visit: https://myaccount.google.com
   - Sign in with your Google Workspace admin account

2. **Enable 2-Step Verification** (Required for App Passwords)
   - Go to **Security** section
   - Enable **2-Step Verification** if not already enabled
   - Follow the setup wizard

3. **Create App Password**
   - Go back to **Security** section
   - Find **2-Step Verification** section
   - Click **App passwords** (or visit: https://myaccount.google.com/apppasswords)
   - Select app: **Mail**
   - Select device: **Other (Custom name)**
   - Enter name: "Supabase NOVA Build"
   - Click **Generate**
   - **Copy the 16-character password** (you'll only see it once!)

#### Step 2: Configure SMTP in Supabase Dashboard

1. **Go to Supabase Dashboard**
   - Visit: https://app.supabase.com
   - Select your project

2. **Navigate to SMTP Settings**
   - Click **Authentication** in left sidebar
   - Click **Settings** (gear icon)
   - Scroll down to **SMTP Settings** section

3. **Enter Google Workspace SMTP Details**
   ```
   SMTP Host: smtp.gmail.com
   SMTP Port: 587
   SMTP User: your-email@yourdomain.com (your Google Workspace email)
   SMTP Password: [The 16-character App Password you just generated]
   Sender Email: noreply@yourdomain.com (or your-email@yourdomain.com)
   Sender Name: NOVA Build
   ```

4. **Click Save**
   - Wait for confirmation message
   - Supabase will test the connection

#### Step 3: Verify SMTP Configuration

1. **Check Supabase Dashboard**
   - Should show "SMTP configured successfully"
   - If error, double-check App Password and email address

2. **Test Email Delivery** (Optional)
   - Try signing up a test user
   - Check if confirmation email arrives

---

## Part 2: Google OAuth Setup (For "Sign in with Google" Button)

### What This Does
Enables users to sign in with their Google account instead of email/password.

### Step-by-Step Instructions

Based on the guide you found: https://www.hemantasundaray.com/blog/implement-google-signin-nextjs-supabase-auth

#### Step 1: Create OAuth Credentials in Google Cloud Console

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com
   - Sign in with your Google Workspace admin account

2. **Create or Select Project**
   - Create new project: "NOVA Build" (or use existing)
   - Wait for project creation

3. **Configure OAuth Consent Screen**
   - Go to **APIs & Services** → **OAuth consent screen**
   - Choose **Internal** (if using Google Workspace only) or **External** (for public)
   - Fill in:
     - App name: NOVA Build
     - User support email: your-email@yourdomain.com
     - Authorized domains: Add your Supabase project domain (e.g., `rbiomzdrlmsexehrhowa.supabase.co`)
     - Developer contact: your-email@yourdomain.com
   - Click **Save and Continue**
   - Skip **Scopes** (default is fine)
   - Skip **Test users** (if internal)
   - Review and **Back to Dashboard**

4. **Create OAuth Client ID**
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: "NOVA Build Web Client"
   - **Authorized JavaScript origins**:
     ```
     http://localhost:3000
     https://yourdomain.com (your production domain)
     ```
   - **Authorized redirect URIs**:
     ```
     https://rbiomzdrlmsexehrhowa.supabase.co/auth/v1/callback
     http://localhost:3000/auth/callback
     https://yourdomain.com/auth/callback
     ```
   - Click **Create**
   - **Copy Client ID and Client Secret** (save them!)

#### Step 2: Enable Google Provider in Supabase

1. **Go to Supabase Dashboard**
   - Navigate to **Authentication** → **Providers**

2. **Find Google Provider**
   - Click on **Google** in the providers list

3. **Enable and Configure**
   - Toggle **Enable Sign In with Google** to **ON**
   - Enter **Client ID** (from Google Cloud Console)
   - Enter **Client Secret** (from Google Cloud Console)
   - Click **Save**

4. **Find Your Callback URL**
   - Scroll down in the Google provider settings
   - Copy the **Callback URL** (looks like: `https://rbiomzdrlmsexehrhowa.supabase.co/auth/v1/callback`)
   - Make sure this matches what you added to Google Cloud Console

#### Step 3: Add Redirect URLs in Supabase

1. **Go to URL Configuration**
   - Navigate to **Authentication** → **URL Configuration**

2. **Add Redirect URLs**
   ```
   Site URL: http://localhost:3000 (for dev) or https://yourdomain.com (for prod)
   
   Redirect URLs:
   http://localhost:3000/**
   https://yourdomain.com/**
   http://localhost:3000/auth/callback
   https://yourdomain.com/auth/callback
   ```

---

## Implementation in Your App

Since you already have Supabase auth set up, you just need to add the Google Sign-In button.

### Update Sign-In Component

You can add Google Sign-In to your existing `components/SupabaseSignIn.tsx`:

```typescript
// Add this function to SupabaseSignIn.tsx
async function handleGoogleSignIn() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  
  if (error) {
    setError(error.message);
  }
}

// Add button in the form:
<Button
  type="button"
  variant="outline"
  onClick={handleGoogleSignIn}
  className="w-full"
>
  <Icons.google className="mr-2 h-4 w-4" />
  Sign in with Google
</Button>
```

### Your Callback Handler Already Exists

You already have `app/auth/callback/route.ts` from Phase 5, so Google OAuth callbacks will work automatically!

---

## Quick Reference: What Goes Where

### For SMTP (Email Sending):
- **Where**: Supabase Dashboard → Authentication → Settings → SMTP Settings
- **What you need**:
  - Your Google Workspace email
  - Google App Password (16 characters)
  - smtp.gmail.com:587

### For OAuth (Google Sign-In):
- **Where**: Supabase Dashboard → Authentication → Providers → Google
- **What you need**:
  - Google Cloud Console OAuth Client ID
  - Google Cloud Console OAuth Client Secret
  - Callback URL from Supabase

---

## Next Steps Summary

1. ✅ **Set up Google SMTP** (for emails) - Do this first
2. ⏳ **Set up Google OAuth** (for Google Sign-In) - Optional, can do later
3. ✅ **Test email delivery** - Try signing up a user
4. ✅ **Test Google Sign-In** - Add button and test

---

## Verification Checklist

**SMTP Setup:**
- [ ] Google App Password generated
- [ ] SMTP configured in Supabase Dashboard
- [ ] Test email sent successfully
- [ ] Sign-up confirmation emails working

**OAuth Setup (if doing Google Sign-In):**
- [ ] OAuth consent screen configured
- [ ] OAuth Client ID created
- [ ] Redirect URIs match Supabase callback URL
- [ ] Google provider enabled in Supabase
- [ ] Google Sign-In button added to app
- [ ] Test sign-in with Google works



