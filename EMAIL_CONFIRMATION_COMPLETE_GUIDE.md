# Complete Email Confirmation & Resend Setup Guide

## 📧 Part 1: Check if Email is Confirmed

### Quick Script Method
```bash
tsx scripts/check-email-confirmation.ts carrier@example.com
```

**Output shows:**
- ✅ Email confirmed: YES/NO
- Confirmed date (if confirmed)
- User ID, creation date, last sign-in
- Role from database

### Supabase Dashboard Method
1. Go to: https://app.supabase.com
2. **Authentication** → **Users**
3. Search by email
4. Check **"Confirmed"** column

### SQL Method
```sql
SELECT email, email_confirmed_at 
FROM auth.users 
WHERE email = 'carrier@example.com';
```

---

## 📧 Part 2: Setup Resend for Beautiful Emails

### Step 1: Sign Up for Resend
1. Go to: **https://resend.com**
2. Create free account (100 emails/day free)

### Step 2: Get API Key
1. Dashboard → **API Keys**
2. Create new key: `NOVA Build Production`
3. **Copy the key** (starts with `re_`)

### Step 3: Configure in Supabase
1. Supabase Dashboard → **Authentication** → **Settings** → **SMTP Settings**
2. Enable **Custom SMTP**
3. Enter:

```
SMTP Host: smtp.resend.com
SMTP Port: 587
SMTP User: resend
SMTP Password: [Paste your Resend API Key]
Sender Email: onboarding@resend.dev (for testing)
Sender Name: NOVA Build
```

4. Click **Save**

### Step 4: (Optional) Add Your Domain

For production, add your domain:
1. Resend Dashboard → **Domains** → **Add Domain**
2. Enter: `novafreight.io`
3. Add DNS records (SPF, DKIM, DMARC)
4. Verify domain
5. Update sender email to `noreply@novafreight.io`

**Full instructions**: See `RESEND_EMAIL_SETUP.md`

---

## 📧 Part 3: Customize Email Template

The beautiful email template is in: `lib/resend-templates.tsx`

### To Customize:

1. **Update Logo**:
   - Line 40: Change logo URL to your logo
   - Or use a hosted image URL

2. **Update Colors**:
   - Line 200-250: Update button colors, backgrounds
   - Change `#4f46e5` to your brand color

3. **Update Text**:
   - Line 250: Welcome message
   - Line 280: Footer text
   - Line 285: Links (Privacy, Terms)

4. **Update Links**:
   - Line 285: Privacy Policy URL
   - Line 287: Terms of Service URL

### To Use Custom Template:

```typescript
import { render } from '@react-email/render';
import EmailConfirmationTemplate from '@/lib/resend-templates';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// In your sign-up handler:
const html = render(
  EmailConfirmationTemplate({
    confirmationUrl: 'https://yourdomain.com/auth/callback?token=xxx',
    userEmail: 'user@example.com'
  })
);

await resend.emails.send({
  from: 'NOVA Build <noreply@novafreight.io>',
  to: email,
  subject: 'Confirm your email address',
  html,
});
```

**Note**: For now, Supabase will send its default email. To use custom template, you'll need to:
1. Install `resend` package (already done)
2. Create email helper function (see `RESEND_EMAIL_SETUP.md`)
3. Call it after sign-up

---

## 📧 Part 4: Resend Confirmation Email

### Script Method
```bash
tsx scripts/resend-confirmation.ts carrier@example.com
```

This generates a confirmation link you can send manually.

### Supabase Dashboard Method
1. **Authentication** → **Users**
2. Find user → Click **"..."** → **"Resend Confirmation Email"**

### Programmatic Method
Add this button to your sign-in page:

```tsx
const resendConfirmation = async () => {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  
  if (error) {
    setError(error.message);
  } else {
    setMessage('Confirmation email sent! Check your inbox.');
  }
};
```

---

## ✅ Quick Reference

| Task | Command/URL |
|------|-------------|
| **Check email status** | `tsx scripts/check-email-confirmation.ts <email>` |
| **Resend confirmation** | `tsx scripts/resend-confirmation.ts <email>` |
| **Resend Dashboard** | https://resend.com |
| **Supabase Dashboard** | https://app.supabase.com |
| **Email Template** | `lib/resend-templates.tsx` |

---

## 📋 Next Steps

1. ✅ Setup Resend account
2. ✅ Configure SMTP in Supabase
3. ✅ Test email delivery
4. ✅ Customize email template (optional)
5. ✅ Add your domain (for production)

All scripts and guides are ready! See:
- `CHECK_EMAIL_CONFIRMATION_GUIDE.md` - Detailed checking guide
- `RESEND_EMAIL_SETUP.md` - Complete Resend setup
- `CLERK_MIGRATION_SUMMARY.md` - Migration status



