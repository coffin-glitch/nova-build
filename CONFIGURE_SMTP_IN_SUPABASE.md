# Configure SMTP in Supabase Dashboard

## What You're Currently Looking At

What you're seeing is **Google OAuth configuration** (for "Sign in with Google"). This is different from SMTP.

- **OAuth**: Allows users to sign in with Google (what you're looking at)
- **SMTP**: Sends emails like sign-up confirmations, password resets (what you need for rate limits)

---

## Where to Find SMTP Settings

### Step 1: Navigate to SMTP Settings

1. Go to: https://app.supabase.com
2. Select your project: `rbiomzdrlmsexehrhowa`
3. In the left sidebar, click: **Authentication**
4. Click: **Settings** (or "Configuration")
5. Scroll down to find: **SMTP Settings** section

It should look like this:
```
SMTP Settings
┌─────────────────────────────────────┐
│ Enable Custom SMTP                  │
│ [ ] Enable custom SMTP              │
│                                     │
│ SMTP Host:                          │
│ SMTP Port:                          │
│ SMTP User:                          │
│ SMTP Password:                      │
│ Sender Email:                       │
│ Sender Name:                        │
└─────────────────────────────────────┘
```

---

## Step 2: Configure Google Workspace SMTP

Since you have Google Workspace set up, use these settings:

### Enable Custom SMTP
✅ **Check the box**: "Enable custom SMTP"

### Enter Your SMTP Details:

**SMTP Host:**
```
smtp.gmail.com
```

**SMTP Port:**
```
587
```
(Or `465` for SSL - both work)

**SMTP User:**
```
Your email address (e.g., noreply@novafreight.io)
```
*Use the email address you want emails to come FROM*

**SMTP Password:**
```
Your Google App Password
```
*This is NOT your regular Google password!*
*You need to generate an App Password from Google Workspace*

**Sender Email:**
```
noreply@novafreight.io
```
*Or whatever email you want to show as the sender*

**Sender Name:**
```
NOVA Build
```

---

## Step 3: Generate Google App Password

If you don't have a Google App Password yet:

1. Go to: https://myaccount.google.com/apppasswords
2. Sign in with your Google Workspace admin account
3. Select app: **Mail**
4. Select device: **Other (Custom name)** → Type "Supabase"
5. Click **Generate**
6. Copy the 16-character password (it will look like: `abcd efgh ijkl mnop`)
7. **Paste this into Supabase SMTP Password field** (remove spaces)

---

## Step 4: Save and Test

1. Click **Save** in Supabase
2. Try signing up again - it should work without rate limits!
3. Check your email inbox for the confirmation email

---

## Quick Reference

**OAuth** (what you already have configured):
- Location: Authentication → Providers → Google
- Purpose: Let users sign in with Google
- Status: ✅ Already configured

**SMTP** (what you need to configure):
- Location: Authentication → Settings → SMTP Settings
- Purpose: Send emails (sign-up confirmations, password resets)
- Status: ⏳ Needs configuration (this will fix rate limit!)

---

## After Configuring SMTP

✅ No more "email rate limit exceeded" errors
✅ Unlimited emails (based on your Google Workspace limits)
✅ Professional email delivery
✅ Custom sender email/name

---

## Troubleshooting

**"Invalid credentials" error?**
- Make sure you're using a Google App Password, not your regular password
- Check that 2FA is enabled on your Google account (required for App Passwords)

**Still hitting rate limits?**
- Make sure "Enable custom SMTP" is checked
- Verify all fields are filled correctly
- Try using port `465` instead of `587` if `587` doesn't work

**Not receiving emails?**
- Check spam folder
- Verify sender email is correct
- Check Supabase Dashboard → Logs for email sending errors



