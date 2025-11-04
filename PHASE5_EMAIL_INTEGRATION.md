# Phase 5: Email Integration - Implementation Guide

## Overview

Phase 5 focuses on configuring Supabase email and preparing to replace Clerk's built-in email flows. Supabase handles auth emails automatically when SMTP is configured, but we need to set it up and prepare the integration.

## ✅ Completed Components

### 1. Supabase Email Helpers (`lib/supabase-email.ts`)

**Purpose**: Programmatic control over Supabase auth emails.

**Key Functions**:
- `sendSignUpEmail()` - Generate sign-up confirmation links
- `sendPasswordResetEmail()` - Generate password reset links
- `sendMagicLinkEmail()` - Generate magic link for passwordless login
- `sendEmailChangeConfirmation()` - Generate email change confirmation
- `inviteUserByEmail()` - Admin function to invite users
- `checkEmailConfiguration()` - Verify email is configured

**Note**: Supabase automatically sends emails when SMTP is configured. These helpers provide programmatic control when needed.

---

## 📋 Supabase Email Configuration Steps

### Step 1: Configure SMTP in Supabase Dashboard

1. **Go to Supabase Dashboard**:
   - Navigate to: `https://app.supabase.com`
   - Select your project

2. **Navigate to Authentication → Settings → SMTP Settings**:
   - Go to **Authentication** in the left sidebar
   - Click **Settings**
   - Scroll to **SMTP Settings** section

3. **Configure SMTP Provider**:

   **Option A: Custom SMTP Server**
   ```
   SMTP Host: smtp.your-provider.com (e.g., smtp.gmail.com, smtp.sendgrid.net)
   SMTP Port: 587 (TLS) or 465 (SSL)
   SMTP User: your-email@domain.com
   SMTP Password: your-app-password-or-api-key
   Sender Email: noreply@yourdomain.com
   Sender Name: NOVA Build
   ```

   **Option B: Supabase Built-in (Limited)**
   - Supabase provides basic email sending
   - Limited to 4 emails/hour on free tier
   - Not recommended for production

   **Option C: Third-Party Services (Recommended for Production)**
   - **SendGrid**: Professional email service
   - **Mailgun**: Reliable transactional email
   - **Resend**: Modern email API
   - **Amazon SES**: AWS email service

4. **Enable Email Auth**:
   - In **Authentication → Providers**
   - Ensure **Email** provider is enabled
   - Configure email templates (optional)

### Step 2: Configure Email Templates (Optional)

Supabase allows customizing email templates:

1. **Go to Authentication → Email Templates**
2. **Customize Templates**:
   - Confirm signup
   - Magic Link
   - Change Email Address
   - Reset Password
   - Invite User

3. **Use Variables**:
   ```
   {{ .ConfirmationURL }} - Sign-up confirmation link
   {{ .Token }} - Token for magic links
   {{ .SiteURL }} - Your site URL
   {{ .Email }} - User's email
   {{ .RedirectTo }} - Redirect URL after confirmation
   ```

### Step 3: Set Redirect URLs

1. **Go to Authentication → URL Configuration**
2. **Add Site URL**:
   ```
   Site URL: https://yourdomain.com
   ```
3. **Add Redirect URLs** (whitelist allowed redirects):
   ```
   https://yourdomain.com/auth/callback
   https://yourdomain.com/auth/reset-password
   http://localhost:3000/auth/callback (for development)
   ```

---

## 🔧 Integration with Application

### Current State

**Clerk Email Flows** (Automatic):
- Sign-up confirmation: Handled by `<SignUp />` component
- Password reset: Handled by `<SignIn />` component
- Magic links: Handled by Clerk UI

**Application Emails** (Custom):
- Load match notifications: `lib/email/notify.ts`
- Bid notifications: Application-specific

### Migration Strategy

**Phase 5 (Current)**: Set up Supabase email infrastructure
- ✅ Create email helper functions
- ✅ Document configuration steps
- ⏳ Configure SMTP in Supabase Dashboard
- ⏳ Test email delivery

**Phase 6 (Next)**: Replace Clerk UI components
- Replace `<SignUp />` with Supabase auth UI
- Replace `<SignIn />` with Supabase auth UI
- Email flows will automatically use Supabase

---

## 📝 Email Templates Structure

### Recommended Email Templates

1. **Sign-Up Confirmation**
   ```
   Subject: Confirm your NOVA Build account
   Body: Welcome! Click the link below to confirm your email...
   ```

2. **Password Reset**
   ```
   Subject: Reset your NOVA Build password
   Body: Click the link below to reset your password...
   ```

3. **Magic Link**
   ```
   Subject: Sign in to NOVA Build
   Body: Click the link below to sign in...
   ```

4. **Email Change**
   ```
   Subject: Confirm your new email address
   Body: Click the link to confirm your new email...
   ```

5. **User Invitation**
   ```
   Subject: You've been invited to NOVA Build
   Body: You've been invited. Click below to accept...
   ```

---

## 🔐 Environment Variables

Add to `.env.local`:

```bash
# Supabase Email (configured in Dashboard, these are for reference)
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
# Or for development:
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# SMTP is configured in Supabase Dashboard, not via env vars
# But you can check configuration:
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 🧪 Testing Email Configuration

### Test 1: Check Configuration

```typescript
import { checkEmailConfiguration } from '@/lib/supabase-email';

const config = await checkEmailConfiguration();
console.log('Email configured:', config.configured);
```

### Test 2: Send Test Email

```typescript
import { sendMagicLinkEmail } from '@/lib/supabase-email';

const result = await sendMagicLinkEmail({
  email: 'test@example.com',
  redirectTo: 'http://localhost:3000/auth/callback',
});

console.log('Email sent:', result.success);
```

### Test 3: Verify in Supabase Dashboard

1. Go to **Authentication → Users**
2. Check for email verification status
3. Test sign-up flow to verify emails are sent

---

## 🔄 Email Flow Comparison

### Clerk Email Flow (Current)

```
User signs up → Clerk sends email → User clicks link → Clerk verifies → Redirects
```

### Supabase Email Flow (Future)

```
User signs up → Supabase sends email → User clicks link → Supabase verifies → Callback handler → Redirects
```

### Callback Handler Required

Create `app/auth/callback/route.ts`:

```typescript
import { createRouteHandlerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
```

---

## ⚠️ Important Notes

### Email Delivery

- **Supabase Free Tier**: Limited to 4 emails/hour
- **Production**: Use custom SMTP provider (SendGrid, Mailgun, etc.)
- **Monitoring**: Check Supabase Dashboard → Logs for email delivery issues

### Security

- **Redirect URLs**: Always whitelist redirect URLs in Supabase
- **Email Verification**: Enforce email verification for new sign-ups
- **Rate Limiting**: Supabase has built-in rate limiting

### Backward Compatibility

- **Clerk emails**: Continue working until UI components are replaced
- **Gradual migration**: Can test Supabase emails alongside Clerk
- **Feature flag**: Can toggle between providers during migration

---

## 📊 Monitoring & Debugging

### Supabase Dashboard

1. **Authentication → Logs**: Check email sending logs
2. **Authentication → Users**: Verify email confirmation status
3. **Settings → SMTP**: Verify SMTP configuration

### Application Logs

The email helpers log to console:
```
[Supabase Email] Sign-up link generated
[Supabase Email] Password reset link generated
```

### Common Issues

**Issue**: Emails not sending
- **Check**: SMTP configuration in Supabase Dashboard
- **Check**: Email provider limits/quota
- **Check**: Redirect URLs whitelisted

**Issue**: Links not working
- **Check**: Redirect URL whitelist
- **Check**: Callback handler is set up
- **Check**: Site URL is correct

---

## ✅ Checklist

- [ ] Configure SMTP in Supabase Dashboard
- [ ] Set Site URL and Redirect URLs
- [ ] Customize email templates (optional)
- [ ] Test sign-up email delivery
- [ ] Test password reset email delivery
- [ ] Create callback handler (`app/auth/callback/route.ts`)
- [ ] Test email flows end-to-end
- [ ] Monitor email delivery in Supabase Dashboard

---

**Status**: Phase 5 Foundation Complete ✅  
**Next**: Phase 6 - Replace UI Components (will use Supabase emails automatically)  
**Last Updated**: 2025-01-30


