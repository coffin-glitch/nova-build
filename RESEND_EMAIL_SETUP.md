# Resend Email Setup Guide for Supabase Auth

## Overview

This guide will help you set up Resend for beautiful, professional email templates in Supabase Auth. Resend is the recommended email service for production applications.

---

## Step 1: Create Resend Account

1. Go to: **https://resend.com**
2. Click **"Sign Up"** (free account)
3. Verify your email address
4. Complete account setup

---

## Step 2: Get Your Resend API Key

1. In Resend dashboard, go to **"API Keys"**
2. Click **"Create API Key"**
3. Name it: `NOVA Build Production`
4. Give it **"Full Access"** permissions
5. Click **"Create"**
6. **Copy the API key** (starts with `re_`) - you'll need this!

---

## Step 3: Add Your Domain (Recommended)

### 3a. Add Domain in Resend

1. Go to **"Domains"** in Resend dashboard
2. Click **"Add Domain"**
3. Enter your domain: `novafreight.io` (or your domain)
4. Click **"Add"**

### 3b. Configure DNS Records

Resend will show you DNS records to add:

1. **SPF Record** (TXT):
   ```
   v=spf1 include:_spf.resend.com ~all
   ```

2. **DKIM Records** (CNAME):
   - Record 1: `resend._domainkey` → `resend._domainkey.resend.com`
   - Record 2: `resend2._domainkey` → `resend2._domainkey.resend.com`

3. **DMARC Record** (TXT):
   ```
   v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
   ```

**Add these to your domain's DNS settings** (wherever you manage DNS - Cloudflare, Namecheap, etc.)

4. Wait 5-10 minutes for DNS propagation
5. Click **"Verify"** in Resend dashboard

**✅ Once verified, emails will come from `noreply@novafreight.io`**

---

## Step 4: Configure Supabase to Use Resend

### 4a. Get SMTP Settings from Resend

In Resend dashboard → **"Domains"** → Your verified domain → **"SMTP Settings"**:

```
SMTP Host: smtp.resend.com
SMTP Port: 587
SMTP User: resend
SMTP Password: [Your Resend API Key]
```

### 4b. Configure in Supabase Dashboard

1. Go to: **https://app.supabase.com**
2. Select your project
3. Go to: **Authentication** → **Settings** → **SMTP Settings**
4. Enable **"Custom SMTP"**
5. Enter:

```
✅ Enable Custom SMTP: [Check this]

SMTP Host: smtp.resend.com
SMTP Port: 587
SMTP User: resend
SMTP Password: [Paste your Resend API Key here - starts with re_]
Sender Email: noreply@novafreight.io (or onboarding@resend.dev for testing)
Sender Name: NOVA Build
```

6. Click **"Save"**

---

## Step 5: Use Custom Email Templates (Optional - Advanced)

For even more control, you can use Resend's API directly instead of Supabase's built-in emails:

### Install Resend Package

```bash
npm install resend
```

### Create Email Helper

Create `lib/email.ts`:

```typescript
import { Resend } from 'resend';
import EmailConfirmationTemplate from '@/lib/resend-templates';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendConfirmationEmail(email: string, confirmationUrl: string) {
  const { data, error } = await resend.emails.send({
    from: 'NOVA Build <noreply@novafreight.io>',
    to: email,
    subject: 'Confirm your email address',
    react: EmailConfirmationTemplate({
      confirmationUrl,
      userEmail: email,
    }),
  });

  if (error) {
    console.error('Error sending email:', error);
    throw error;
  }

  return data;
}
```

### Update Supabase Sign-Up

In `components/SupabaseSignUp.tsx`, after sign-up:

```typescript
// After successful sign-up, send custom email
if (data?.user && !data.session) {
  try {
    await sendConfirmationEmail(
      email,
      `${window.location.origin}/auth/callback?token=${data.user.confirmation_token}`
    );
  } catch (emailError) {
    console.error('Failed to send custom email:', emailError);
    // Supabase will send default email as fallback
  }
}
```

---

## Step 6: Test Email Delivery

### Test Sign-Up Email

1. Go to your app: `http://localhost:3000/sign-up`
2. Sign up with a test email
3. Check your inbox (and spam folder)
4. You should receive a confirmation email from `noreply@novafreight.io`

### Check Resend Dashboard

1. Go to Resend dashboard → **"Emails"**
2. You should see sent emails with status (delivered, opened, clicked)
3. Click on an email to see details

---

## Step 7: Update Email Template (Using Resend Templates)

### Option A: Use Resend Dashboard (Easiest)

1. Go to Resend → **"Email Templates"**
2. Click **"Create Template"**
3. Use the HTML from `lib/resend-templates.tsx` (convert to HTML)
4. Save as template
5. Update Supabase to use template ID

### Option B: Use React Email (Recommended for Development)

1. Install React Email:
   ```bash
   npm install @react-email/components react-dom
   ```

2. Use the template in `lib/resend-templates.tsx`

3. Render and send:
   ```typescript
   import { render } from '@react-email/render';
   import EmailConfirmationTemplate from '@/lib/resend-templates';

   const html = render(
     EmailConfirmationTemplate({ confirmationUrl, userEmail })
   );

   await resend.emails.send({
     from: 'NOVA Build <noreply@novafreight.io>',
     to: email,
     subject: 'Confirm your email address',
     html,
   });
   ```

---

## Troubleshooting

### Emails Not Sending

1. **Check Resend Dashboard**: Look for failed sends and error messages
2. **Verify SMTP Settings**: Double-check all settings in Supabase
3. **Check API Key**: Make sure it's correct (starts with `re_`)
4. **Verify Domain**: Ensure domain is verified in Resend
5. **Check Spam**: Emails might be in spam folder

### "Sender Email Not Verified"

- Use `onboarding@resend.dev` for testing (no verification needed)
- Or verify your domain in Resend first

### Emails Going to Spam

1. **Verify Domain**: Add SPF, DKIM, DMARC records
2. **Warm Up Domain**: Start with low volume
3. **Use Proper From Name**: Use your brand name
4. **Include Unsubscribe**: Required for compliance

---

## Production Checklist

- [ ] Resend account created
- [ ] API key generated
- [ ] Domain added and verified
- [ ] DNS records configured (SPF, DKIM, DMARC)
- [ ] SMTP configured in Supabase
- [ ] Test email sent successfully
- [ ] Email template customized
- [ ] Monitored in Resend dashboard

---

## Cost

- **Free Tier**: 100 emails/day (3,000/month) ✅ Perfect for testing
- **Pro**: $20/month for 50,000 emails
- **Business**: $80/month for 100,000 emails

For NOVA Build, start with free tier, upgrade when needed.

---

## Next Steps

1. ✅ Set up Resend account
2. ✅ Configure SMTP in Supabase
3. ✅ Test email delivery
4. ✅ Customize email template (optional)
5. ✅ Monitor email delivery in Resend dashboard

Need help? Check Resend docs: https://resend.com/docs



