# Supabase Email Configuration Guide

## Configuring Reauthentication Email Template

### Step 1: Access Email Templates in Supabase Dashboard

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **Email Templates**
4. Find the **"Reauthentication"** template (or create a custom one)

### Step 2: Update Email Template

Replace the default template with the reauthentication email HTML provided. The template uses these variables:
- `{{ .Token }}` - The 6-digit verification code
- `{{ .ConfirmationURL }}` - The verification link (optional)
- `{{ .SiteURL }}` - Your site URL
- `{{ .Year }}` - Current year

### Step 3: Configure Site URL and Redirect URLs

#### In Supabase Dashboard:

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to: `https://novabuild.io`
3. Add **Redirect URLs**:
   - `https://novabuild.io/profile`
   - `https://novabuild.io/auth/callback`
   - `http://localhost:3000/profile` (for local development)
   - `http://localhost:3000/auth/callback` (for local development)

#### In Your Environment Variables:

Make sure your `.env.local` has:
```bash
NEXT_PUBLIC_BASE_URL=https://novabuild.io
```

For local development:
```bash
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Step 4: Email Template Configuration

The reauthentication email template should be set up as follows:

**Template Type:** Reauthentication  
**Subject:** Security Verification Required  
**Body:** Use the HTML template provided

### Step 5: Verify Email Sending

1. Test the password change flow
2. Check your email inbox for the verification code
3. The code should appear in the email as a large, highlighted number
4. The link should point to `https://novabuild.io` (or your configured domain)

## How the Flow Works

1. **User clicks "Change Password"**
   - Triggers `signInWithOtp` with `shouldCreateUser: false`
   - Supabase sends reauthentication email with 6-digit code

2. **User receives email**
   - Email shows the verification code prominently
   - Also includes a verification link (optional)

3. **User enters code**
   - Code is verified using `verifyOtp`
   - User is authenticated for password change

4. **User changes password**
   - New password is set using `updateUser`

## Custom Domain Configuration

### Option 1: Using Custom Domain in Redirects

The redirect URL in the code uses `NEXT_PUBLIC_BASE_URL`:
```typescript
emailRedirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://novabuild.io'}/profile`
```

### Option 2: Supabase Custom Domain (Advanced)

If you want the verification link itself to use your domain:

1. Set up a custom domain in Supabase (requires Pro plan)
2. Configure DNS records as instructed by Supabase
3. Update your redirect URLs to use the custom domain

## Troubleshooting

### Email not sending?
- Check Supabase email logs in Dashboard → Authentication → Logs
- Verify SMTP configuration is set up
- Check spam folder

### Code not working?
- Codes expire in 15 minutes (configurable in Supabase)
- Make sure you're using the exact code from the email
- Check that the email template is using `{{ .Token }}` correctly

### Wrong domain in link?
- Verify `NEXT_PUBLIC_BASE_URL` environment variable
- Check Supabase URL Configuration settings
- Ensure redirect URLs are whitelisted in Supabase

## Email Template Variables Reference

- `{{ .Token }}` - 6-digit verification code
- `{{ .ConfirmationURL }}` - Full verification URL with token
- `{{ .SiteURL }}` - Your configured site URL
- `{{ .Email }}` - User's email address
- `{{ .Year }}` - Current year

