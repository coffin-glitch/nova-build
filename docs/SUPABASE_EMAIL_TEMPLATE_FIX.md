# Fix: Magic Link Instead of OTP Code

## Problem

When clicking "Send Verification Code" on the profile page, you're receiving a **magic link** instead of a **6-digit code**. This happens because Supabase's Magic Link email template is configured to use `{{ .ConfirmationURL }}` instead of `{{ .Token }}`.

## Solution: Update Supabase Email Template

### Step 1: Access Email Templates

1. Go to **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **Email Templates**
4. Find the **"Magic Link"** template

### Step 2: Update the Template

**IMPORTANT**: The template must use `{{ .Token }}` to send a 6-digit code. If it uses `{{ .ConfirmationURL }}`, it will send a magic link.

#### Option A: Use the Provided Template

I've created a template file at `supabase-email-templates/magic-link-otp.html` that:
- Displays the 6-digit code prominently using `{{ .Token }}`
- Includes both the code AND an optional link (for flexibility)
- Matches your NOVA branding

**Copy the contents** of `supabase-email-templates/magic-link-otp.html` and paste it into your Supabase Magic Link template.

#### Option B: Quick Fix - Update Existing Template

In your current Magic Link template, find this section:
```html
<a href="{{ .ConfirmationURL }}">
  Sign In →
</a>
```

Replace it with:
```html
<div style="background: linear-gradient(135deg, #f0f4ff 0%, #f5f0ff 100%); border: 2px solid hsl(221.2, 83.2%, 53.3%); border-radius: 12px; padding: 24px 32px; display: inline-block;">
  <p style="color: #6b7280; font-size: 14px; font-weight: 600; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.1em; text-align: center;">Verification Code</p>
  <p style="color: #162f4e; font-size: 32px; font-weight: 700; margin: 0; text-align: center; letter-spacing: 0.2em; font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;">
    {{ .Token }}
  </p>
</div>
```

### Step 3: Save and Test

1. Click **Save** in Supabase Dashboard
2. Test by clicking "Send Verification Code" on your profile page
3. You should now receive a 6-digit code instead of a magic link

## How Supabase Determines What to Send

Supabase's `signInWithOtp()` method checks your email template:

- **If template has `{{ .ConfirmationURL }}`** → Sends magic link
- **If template has `{{ .Token }}`** → Sends 6-digit OTP code
- **If template has both** → Sends both (code + link)

## Template Variables Reference

- `{{ .Token }}` - The 6-digit verification code (use this for OTP)
- `{{ .ConfirmationURL }}` - The magic link URL (use this for links)
- `{{ .SiteURL }}` - Your site URL
- `{{ .Email }}` - User's email address
- `{{ .Year }}` - Current year

## Verification

After updating the template:

1. ✅ Click "Send Verification Code"
2. ✅ Check your email
3. ✅ You should see a **6-digit code** displayed prominently
4. ✅ Enter the code in the verification field
5. ✅ Code should verify successfully

## Troubleshooting

### Still receiving magic link?
- Make sure you saved the template in Supabase Dashboard
- Clear your browser cache
- Try with a different email address
- Check Supabase logs for any errors

### Code not appearing?
- Verify the template uses `{{ .Token }}` (not `{{ .ConfirmationURL }}`)
- Check email spam folder
- Verify SMTP is configured correctly

### Code expires too quickly?
- Default expiration is 15 minutes
- Can be adjusted in Supabase Auth settings (if available)

