# Google Workspace SMTP Setup - Detailed Step-by-Step Guide

## 🎯 Goal
Configure Supabase to send authentication emails using your Google Workspace SMTP server.

---

## Step 1: Generate Google App Password

### Why App Password?
Google Workspace requires 2-Step Verification + App Passwords for SMTP authentication. Regular passwords won't work.

### Detailed Steps:

1. **Open Google Account**
   - Go to: https://myaccount.google.com
   - Sign in with your **Google Workspace admin account**
   - Make sure you're using the correct account!

2. **Enable 2-Step Verification** (Skip if already enabled)
   - Click **Security** in the left sidebar
   - Find **2-Step Verification** section
   - Click **Turn on** or **Get started**
   - Follow the wizard:
     - Verify your phone number
     - Enter verification code
     - Complete setup

3. **Generate App Password**
   - After 2-Step is enabled, go to: https://myaccount.google.com/apppasswords
   - Or navigate: **Security** → **2-Step Verification** → **App passwords**
   - You may need to sign in again
   
4. **Create the Password**
   - In "Select app" dropdown: Choose **Mail**
   - In "Select device" dropdown: Choose **Other (Custom name)**
   - Type: `Supabase NOVA Build`
   - Click **Generate**
   
5. **Copy the Password**
   - You'll see a 16-character password like: `abcd efgh ijkl mnop`
   - **⚠️ CRITICAL: Copy this immediately - you won't see it again!**
   - Remove spaces when using: `abcdefghijklmnop`
   - Save it somewhere secure (password manager, notes app, etc.)

---

## Step 2: Configure SMTP in Supabase Dashboard

### Detailed Steps:

1. **Go to Supabase Dashboard**
   - Visit: https://app.supabase.com
   - Sign in (use your Supabase account)
   - Select your project: **rbiomzdrlmsexehrhowa** (or your project name)

2. **Navigate to SMTP Settings**
   - In the left sidebar, click **Authentication**
   - Click **Settings** (looks like a gear icon ⚙️ or Settings tab)
   - Scroll down until you see **SMTP Settings** section

3. **Fill in SMTP Configuration**

   Click the fields and enter:

   ```
   ┌─────────────────────────────────────┐
   │ SMTP Host                           │
   │ smtp.gmail.com                      │
   └─────────────────────────────────────┘

   ┌─────────────────────────────────────┐
   │ SMTP Port                           │
   │ 587                                 │
   └─────────────────────────────────────┘

   ┌─────────────────────────────────────┐
   │ SMTP User                           │
   │ your-email@yourdomain.com           │
   │ (Your full Google Workspace email)  │
   └─────────────────────────────────────┘

   ┌─────────────────────────────────────┐
   │ SMTP Password                       │
   │ abcdefghijklmnop                    │
   │ (The 16-char App Password, no spaces)
   └─────────────────────────────────────┘

   ┌─────────────────────────────────────┐
   │ Sender Email                        │
   │ noreply@yourdomain.com              │
   │ OR your-email@yourdomain.com        │
   └─────────────────────────────────────┘

   ┌─────────────────────────────────────┐
   │ Sender Name                         │
   │ NOVA Build                          │
   └─────────────────────────────────────┘
   ```

4. **Click "Save" or "Update"**
   - Wait a few seconds
   - Supabase will test the connection
   - You should see: ✅ **"SMTP configured successfully"**

### Troubleshooting

**If you get an error:**

- ❌ **"Invalid credentials"**
  - Double-check App Password (no spaces)
  - Make sure 2-Step Verification is enabled
  - Regenerate App Password if needed

- ❌ **"Connection timeout"**
  - Check SMTP Host: `smtp.gmail.com` (not `smtp.google.com`)
  - Check Port: `587` (not `465`)
  - Check firewall/network restrictions

- ❌ **"Authentication failed"**
  - Verify email address is correct
  - Make sure you're using App Password, not regular password
  - Try generating a new App Password

---

## Step 3: Configure Redirect URLs

### Why This Matters
After users click email links (sign-up confirmation, password reset), they need to be redirected back to your app.

### Steps:

1. **In Supabase Dashboard**
   - Still in **Authentication** → **Settings**
   - Scroll to **URL Configuration** section

2. **Set Site URL**
   ```
   Site URL: http://localhost:3000
   ```
   (Change to your production domain when deploying)

3. **Add Redirect URLs**
   Click **Add URL** and add each:
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/**
   https://yourdomain.com/auth/callback (when deploying)
   https://yourdomain.com/**
   ```

4. **Save**

---

## Step 4: Test SMTP Configuration

### Test Method 1: Try Sign-Up

1. **Go to your app**
   - Visit: http://localhost:3000/sign-up
   - Enter a test email address
   - Create an account

2. **Check Email**
   - Go to the inbox of the email you used
   - You should receive a "Confirm your email" message from Supabase
   - Subject: "Confirm your signup" or similar

3. **Click the Confirmation Link**
   - Should redirect to your app
   - Account should be confirmed

### Test Method 2: Try Password Reset

1. **Go to Sign-In Page**
   - Visit: http://localhost:3000/sign-in
   - Click "Forgot password?" or similar

2. **Enter Email**
   - Submit your email

3. **Check Email**
   - You should receive a password reset email
   - Click the link
   - Should redirect to password reset page

---

## ✅ Success Checklist

After completing all steps, you should have:

- [x] Google App Password generated
- [x] SMTP configured in Supabase Dashboard
- [x] "SMTP configured successfully" message shown
- [x] Redirect URLs configured
- [x] Test email received (sign-up or password reset)
- [x] Email links work correctly

---

## 🎉 Next Steps

Once SMTP is working:

1. ✅ **Test thoroughly** - Try all email flows
2. ⏳ **Move to OAuth setup** (optional - for Google Sign-In)
3. ⏳ **Test Supabase auth** with email/password
4. ⏳ **Switch from Clerk to Supabase** when ready

---

## 📞 Need Help?

If you encounter issues:

1. **Check Supabase Logs**
   - Dashboard → Logs → Email logs
   - Look for error messages

2. **Verify App Password**
   - Try generating a new one
   - Make sure no spaces

3. **Test SMTP Connection**
   - Use a tool like `telnet smtp.gmail.com 587` (advanced)

4. **Check Google Workspace Settings**
   - Make sure SMTP is enabled for your account
   - Contact Workspace admin if needed

---

**Ready to proceed?** Let me know when SMTP is configured and we'll test it together!



