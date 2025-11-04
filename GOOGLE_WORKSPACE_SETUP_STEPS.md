# Google Workspace Setup for Supabase - Step-by-Step

## Quick Answer

**You need TWO separate setups:**
1. **SMTP** (for sending emails) - Required
2. **OAuth** (for "Sign in with Google") - Optional but nice to have

Both use Google Workspace but are configured differently.

---

## Part 1: SMTP Setup (For Email Sending) - DO THIS FIRST

### Step 1: Get Google App Password

1. **Go to Google Account**
   - Visit: https://myaccount.google.com
   - Sign in with your Google Workspace admin email

2. **Enable 2-Step Verification** (if not already enabled)
   - Security → 2-Step Verification → Turn on
   - Follow the setup wizard

3. **Generate App Password**
   - After 2-Step is enabled, go to: https://myaccount.google.com/apppasswords
   - Or: Security → 2-Step Verification → App passwords
   - Select app: **Mail**
   - Select device: **Other (Custom name)**
   - Enter: "Supabase NOVA Build"
   - Click **Generate**
   - **Copy the 16-character password** (example: `abcd efgh ijkl mnop`)
   - **You won't see it again!** Save it somewhere safe.

### Step 2: Configure in Supabase Dashboard

1. **Go to Supabase Dashboard**
   - https://app.supabase.com
   - Select your project

2. **Navigate to SMTP Settings**
   - Left sidebar: **Authentication**
   - Click **Settings** (gear icon)
   - Scroll to **SMTP Settings** section

3. **Fill in SMTP Details**
   ```
   SMTP Host: smtp.gmail.com
   SMTP Port: 587
   SMTP User: your-workspace-email@yourdomain.com
   SMTP Password: [The 16-char App Password - remove spaces]
   Sender Email: noreply@yourdomain.com (or your email)
   Sender Name: NOVA Build
   ```

4. **Click Save**
   - Wait for "SMTP configured successfully" message
   - If error, double-check App Password (remove spaces if any)

### Step 3: Test It

Try signing up a test user - you should receive the confirmation email!

---

## Part 2: Google OAuth Setup (For "Sign in with Google") - OPTIONAL

### Step 1: Get OAuth Credentials from Google Cloud

1. **Go to Google Cloud Console**
   - https://console.cloud.google.com
   - Sign in with your Google Workspace admin account

2. **Create/Select Project**
   - Create new project: "NOVA Build"
   - Or select existing project

3. **Configure OAuth Consent Screen**
   - **APIs & Services** → **OAuth consent screen**
   - Choose **External** (for public users) or **Internal** (Workspace only)
   - Fill in:
     ```
     App name: NOVA Build
     User support email: your-email@yourdomain.com
     Authorized domains: 
       - rbiomzdrlmsexehrhowa.supabase.co (your Supabase project)
       - yourdomain.com (your production domain)
     Developer contact: your-email@yourdomain.com
     ```
   - Click **Save and Continue**
   - **Scopes**: Skip (default is fine)
   - **Test users**: Skip (if Internal) or add test emails
   - **Summary**: Review and **Back to Dashboard**

4. **Create OAuth Client ID**
   - **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: "NOVA Build Web Client"
   
   **Authorized JavaScript origins:**
   ```
   http://localhost:3000
   https://yourdomain.com
   ```
   
   **Authorized redirect URIs:**
   ```
   https://rbiomzdrlmsexehrhowa.supabase.co/auth/v1/callback
   http://localhost:3000/auth/callback
   https://yourdomain.com/auth/callback
   ```
   
   - Click **Create**
   - **Copy Client ID and Client Secret** - Save them!

### Step 2: Enable in Supabase Dashboard

1. **Get Your Callback URL**
   - Supabase Dashboard → **Authentication** → **Providers**
   - Click **Google** provider
   - Scroll down to see **Callback URL**
   - It looks like: `https://rbiomzdrlmsexehrhowa.supabase.co/auth/v1/callback`
   - **Make sure this matches what you put in Google Cloud Console**

2. **Enable Google Provider**
   - Still in **Authentication** → **Providers** → **Google**
   - Toggle **Enable Sign In with Google** to **ON**
   - Enter **Client ID** (from Google Cloud)
   - Enter **Client Secret** (from Google Cloud)
   - Click **Save**

### Step 3: Configure Redirect URLs in Supabase

1. **Go to URL Configuration**
   - **Authentication** → **URL Configuration**

2. **Set Site URL**
   ```
   Site URL: http://localhost:3000 (dev) or https://yourdomain.com (prod)
   ```

3. **Add Redirect URLs**
   ```
   http://localhost:3000/**
   https://yourdomain.com/**
   http://localhost:3000/auth/callback
   https://yourdomain.com/auth/callback
   ```

---

## What's Next?

Once SMTP is configured:
1. ✅ Emails will send automatically (sign-up, password reset)
2. ✅ No code changes needed - Supabase handles it

Once OAuth is configured:
1. ⏳ Add Google Sign-In button to your sign-in page (I'll help with this)
2. ✅ Test Google Sign-In

Let me know when you've completed the SMTP setup, and I'll help you add the Google Sign-In button!



