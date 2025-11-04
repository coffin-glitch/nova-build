# How to Use the Custom NOVA Build Email Template

## Overview

The custom email template has been created to match your NOVA Build UI design exactly. It includes:
- ✅ Gradient backgrounds matching your UI
- ✅ Primary brand color (`hsl(221.2, 83.2%, 53.3%)`)
- ✅ Brand gradient (Blue → Purple → Indigo)
- ✅ Modern card design with glassmorphism feel
- ✅ Truck icon branding
- ✅ Professional typography

---

## Current Status

**The template is ready!** However, Supabase SMTP sends its default email templates. To use your custom template, you have two options:

---

## Option 1: Use Resend API Directly (Recommended for Custom Templates)

This gives you full control over the email design.

### Step 1: Install Resend (if not already installed)

```bash
npm install resend
```

### Step 2: Create Email Helper

Create `lib/email-sender.ts`:

```typescript
import { Resend } from 'resend';
import { render } from '@react-email/render';
import EmailConfirmationTemplate from '@/lib/resend-templates';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendConfirmationEmail(
  email: string,
  confirmationUrl: string
) {
  try {
    // Render React Email template to HTML
    const html = await render(
      EmailConfirmationTemplate({
        confirmationUrl,
        userEmail: email,
      })
    );

    // Send via Resend API
    const { data, error } = await resend.emails.send({
      from: 'NOVA Build <noreply@novafreight.io>', // or onboarding@resend.dev for testing
      to: email,
      subject: 'Confirm your email address - NOVA Build',
      html,
    });

    if (error) {
      console.error('❌ Error sending email:', error);
      throw error;
    }

    console.log('✅ Confirmation email sent:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to send confirmation email:', error);
    throw error;
  }
}
```

### Step 3: Update Sign-Up Component

Update `components/SupabaseSignUp.tsx`:

```typescript
import { sendConfirmationEmail } from '@/lib/email-sender';

// In handleSignUp function, after successful sign-up:
const { data, error: signUpError } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
  },
});

if (signUpError) throw signUpError;

// If sign-up successful but needs email confirmation
if (data?.user && !data.session) {
  try {
    // Generate confirmation URL
    const confirmationUrl = `${window.location.origin}/auth/callback?token=HASH_TOKEN&type=signup`;
    
    // Note: Supabase doesn't expose the token directly
    // You may need to use Supabase Admin API to generate the link
    // Or use the magic link approach
    
    // Alternative: Use Supabase's built-in email, but customize it
    // (see Option 2)
  } catch (emailError) {
    console.error('Failed to send custom email:', emailError);
    // Supabase will send default email as fallback
  }
}
```

### Step 4: Generate Confirmation Link (Advanced)

For full control, use Supabase Admin API:

```typescript
import { getSupabaseService } from '@/lib/supabase';

async function generateConfirmationLink(email: string) {
  const supabase = getSupabaseService();
  
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'signup',
    email: email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) throw error;
  
  // data.properties.action_link contains the confirmation URL
  return data.properties.action_link;
}
```

Then send your custom email with that link.

---

## Option 2: Customize Supabase Email Templates (Easier)

Supabase allows you to customize email templates directly in the dashboard.

### Step 1: Go to Supabase Dashboard

1. **Authentication** → **Email Templates**
2. Select **"Confirm signup"** template

### Step 2: Customize HTML

You can copy the HTML from your React Email template:

```bash
# Generate HTML from your React Email template
npx tsx -e "
import { render } from '@react-email/render';
import EmailConfirmationTemplate from './lib/resend-templates';
const html = render(EmailConfirmationTemplate({
  confirmationUrl: '{{ .ConfirmationURL }}',
  userEmail: '{{ .Email }}'
}));
console.log(html);
" > email-template.html
```

### Step 3: Use Supabase Template Variables

Supabase provides these variables:
- `{{ .ConfirmationURL }}` - The confirmation link
- `{{ .Email }}` - User's email
- `{{ .SiteURL }}` - Your site URL
- `{{ .RedirectTo }}` - Redirect URL

### Step 4: Paste HTML in Supabase

1. Go to **Email Templates** → **Confirm signup**
2. Switch to **HTML** view
3. Paste your custom HTML
4. Replace variables:
   - `{confirmationUrl}` → `{{ .ConfirmationURL }}`
   - `{userEmail}` → `{{ .Email }}`
5. Click **Save**

**Note**: Supabase templates use Go templates, so you'll need to adapt the React Email HTML.

---

## Option 3: Hybrid Approach (Best of Both Worlds)

1. **Use Supabase SMTP** for default emails (password reset, magic links)
2. **Use Resend API** for custom branded emails (confirmations, welcome emails)

This way:
- ✅ Supabase handles auth emails automatically
- ✅ You customize important first-impression emails
- ✅ Best user experience

---

## Testing Your Custom Template

### 1. Generate HTML Locally

```bash
# Install React Email CLI
npm install -g @react-email/cli

# Generate HTML preview
npx @react-email/render lib/resend-templates.tsx \
  --props '{"confirmationUrl":"https://example.com/confirm","userEmail":"test@example.com"}' \
  > preview.html

# Open in browser
open preview.html
```

### 2. Test in Resend

1. Go to Resend Dashboard → **Email Templates**
2. Create new template
3. Paste HTML
4. Send test email

### 3. Test in Supabase

1. Sign up test account
2. Check email (inbox and spam)
3. Verify design matches

---

## Environment Variables Needed

Add to `.env.local`:

```bash
# Resend API Key (for custom emails via API)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx

# Your app URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Troubleshooting

### Email Not Sending
- ✅ Check Resend API key is correct
- ✅ Verify domain is verified in Resend
- ✅ Check spam folder
- ✅ Verify sender email is correct

### Template Not Rendering
- ✅ Check React Email HTML is valid
- ✅ Verify template variables are correct
- ✅ Test HTML in browser first

### Supabase Not Using Custom Template
- ✅ Make sure you saved the template in Supabase dashboard
- ✅ Check template is selected as active
- ✅ Clear Supabase cache (if exists)

---

## Next Steps

1. ✅ Template is ready in `lib/resend-templates.tsx`
2. ⏳ Choose your approach (Option 1, 2, or 3)
3. ⏳ Set up email sending (Resend API or Supabase templates)
4. ⏳ Test email delivery
5. ⏳ Monitor in Resend dashboard

The template perfectly matches your NOVA Build UI! 🎉



