# Password Change Flow - Complete Guide

## Overview

The password change flow uses Supabase's reauthentication system to securely verify user identity before allowing password changes.

## Flow Steps

1. **User clicks "Change Password"**
   - Calls `supabase.auth.reauthenticate()`
   - Sends reauthentication email with 6-digit code

2. **User receives email**
   - Email uses "Reauthentication" template
   - Contains 6-digit code: `{{ .Token }}`
   - Code expires in 15 minutes

3. **User enters code**
   - Code is verified using `verifyOtp()`
   - After verification, password reset link is sent

4. **User receives password reset link**
   - Email contains link to change password
   - Link uses your domain: `https://novabuild.io/profile?passwordReset=true`

5. **User clicks link and changes password**
   - Redirects to profile page
   - Shows password change dialog
   - User enters new password
   - Password is updated using `updateUser()`

## Configuration Steps

### Step 1: Enable Secure Password Change in Supabase

1. Go to Supabase Dashboard → **Authentication** → **Providers** → **Email**
2. Enable **"Secure password change"** option
3. This ensures users must reauthenticate before changing password

### Step 2: Configure Reauthentication Email Template

1. Go to **Authentication** → **Email Templates**
2. Find or create **"Reauthentication"** template
3. Paste the reauthentication email HTML you provided
4. Make sure it includes `{{ .Token }}` for the 6-digit code
5. Save the template

### Step 3: Configure Password Reset Email Template

1. Still in **Email Templates**
2. Find **"Reset Password"** template
3. Customize it to match your brand
4. The template should include `{{ .ConfirmationURL }}` for the reset link
5. Save the template

### Step 4: Set Site URL and Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL**: `https://novabuild.io`
3. Add **Redirect URLs**:
   ```
   https://novabuild.io/profile
   https://novabuild.io/auth/callback
   http://localhost:3000/profile (for local dev)
   http://localhost:3000/auth/callback (for local dev)
   ```

### Step 5: Set Environment Variable

In your `.env.local`:
```bash
NEXT_PUBLIC_BASE_URL=https://novabuild.io
```

For local development:
```bash
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## How It Works

### Reauthentication Email
- Triggered by: `supabase.auth.reauthenticate()`
- Template: "Reauthentication"
- Contains: 6-digit code (`{{ .Token }}`)
- Expires: 15 minutes

### Password Reset Link
- Triggered by: `supabase.auth.resetPasswordForEmail()`
- Template: "Reset Password"
- Contains: Link with token (`{{ .ConfirmationURL }}`)
- Redirects to: Your domain (`https://novabuild.io/profile?passwordReset=true`)

### Password Change
- Triggered by: User clicking reset link
- Event: `PASSWORD_RECOVERY` auth event
- Method: `supabase.auth.updateUser({ password: newPassword })`

## Testing the Flow

1. **Test Reauthentication Email**:
   - Click "Change Password"
   - Check email for 6-digit code
   - Verify code appears in reauthentication template

2. **Test Code Verification**:
   - Enter the 6-digit code
   - Should receive success message
   - Should receive password reset email

3. **Test Password Reset Link**:
   - Click link in password reset email
   - Should redirect to profile page
   - Should show password change dialog

4. **Test Password Change**:
   - Enter new password
   - Confirm password
   - Should successfully update password

## Troubleshooting

### Reauthentication email not sending?
- Check Supabase Dashboard → **Logs** → **Auth Logs**
- Verify "Secure password change" is enabled
- Check SMTP configuration

### Code not working?
- Codes expire in 15 minutes
- Make sure you're using the exact code from email
- Verify reauthentication template uses `{{ .Token }}`

### Password reset link not working?
- Check redirect URLs are whitelisted in Supabase
- Verify `NEXT_PUBLIC_BASE_URL` is set correctly
- Check email template includes `{{ .ConfirmationURL }}`

### Wrong domain in link?
- Verify `NEXT_PUBLIC_BASE_URL` environment variable
- Check Supabase URL Configuration settings
- Ensure redirect URLs match your domain

## Security Notes

- Reauthentication ensures user identity is verified
- OTP codes expire after 15 minutes
- Password reset links are single-use
- All operations require valid session

