# NOVA Supabase Email Templates

These email templates are designed to match your NOVA UI design exactly, with:
- ✅ Gradient backgrounds (Blue → Purple → Indigo)
- ✅ Primary brand color (`hsl(221.2, 83.2%, 53.3%)`)
- ✅ NOVA branding with truck icon
- ✅ Modern card design with rounded corners
- ✅ Professional typography

---

## How to Use

### Step 1: Go to Supabase Dashboard

1. Navigate to: **https://app.supabase.com**
2. Select your project
3. Go to: **Authentication** → **Email Templates**

### Step 2: Update Each Template

For each template type, follow these steps:

1. **Click on the template** (e.g., "Confirm signup")
2. **Switch to HTML view** (there's a toggle/button)
3. **Select all existing HTML** and delete it
4. **Copy the HTML** from the corresponding file below
5. **Paste into Supabase**
6. **Click Save**

---

## Template Files

### 1. Confirm Signup
**File**: `confirm-signup.html`
**Supabase Template**: "Confirm signup"
**When Used**: When a user signs up and needs to confirm their email

### 2. Reset Password
**File**: `reset-password.html`
**Supabase Template**: "Reset password"
**When Used**: When a user requests a password reset

### 3. Magic Link
**File**: `magic-link.html`
**Supabase Template**: "Magic Link"
**When Used**: When a user requests a passwordless sign-in link

### 4. Change Email Address
**File**: `change-email.html`
**Supabase Template**: "Change email address"
**When Used**: When a user requests to change their email

### 5. Invite User
**File**: `invite-user.html`
**Supabase Template**: "Invite user"
**When Used**: When you invite a new user via Supabase Admin API

### 6. Reauthentication
**File**: `reauthentication.html`
**Supabase Template**: "Reauthentication"
**When Used**: When a user needs to verify their identity for sensitive operations (like deleting accounts)

---

## Supabase Template Variables

These templates use Supabase's Go template variables:

- `{{ .ConfirmationURL }}` - The confirmation/reset/invite link
- `{{ .Email }}` - User's email address
- `{{ .SiteURL }}` - Your site URL (from Supabase settings)
- `{{ .RedirectTo }}` - Redirect URL after confirmation
- `{{ .Year }}` - Current year

**Note**: Some variables may vary by template type. Supabase will automatically populate them.

---

## Customization

To customize these templates:

1. **Update URLs**: Change `{{ .SiteURL }}/privacy` and `/terms` to your actual URLs
2. **Update Colors**: Modify `hsl(221.2, 83.2%, 53.3%)` to change the primary color
3. **Update Logo**: Replace the emoji 🚛 with your logo image URL (if you have one)
4. **Update Text**: Modify the content text to match your brand voice

---

## Testing

After updating templates:

1. **Sign up a test account** with a real email
2. **Check your inbox** (and spam folder)
3. **Verify the design** matches your expectations
4. **Test all links** to ensure they work

---

## Support

If you need to customize further:
- Edit the HTML files directly
- Copy and paste into Supabase
- Test with a real email address

All templates are mobile-responsive and work across major email clients (Gmail, Outlook, Apple Mail, etc.).

---

## Quick Copy Checklist

- [ ] Confirm signup - `confirm-signup.html`
- [ ] Reset password - `reset-password.html`
- [ ] Magic Link - `magic-link.html`
- [ ] Change email - `change-email.html`
- [ ] Invite user - `invite-user.html`
- [ ] Reauthentication - `reauthentication.html`

Once all templates are updated, your users will receive beautiful, branded emails that match your NOVA UI! 🎉

