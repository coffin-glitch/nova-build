# Resend API Key Permissions for Supabase Integration

## Answer: Do You Need Full Permissions?

**Short Answer: NO, you don't need full permissions!** ✅

When using Resend with Supabase's SMTP integration, you only need **send email permissions**. Supabase handles the email sending through SMTP, not through Resend's API directly.

---

## Permission Levels Explained

### 1. **SMTP Usage (What You're Doing)**
- **Permissions Needed**: Email sending only
- **How It Works**: Supabase uses your Resend API key as an SMTP password
- **Access Level**: Sending emails only (no API access to Resend dashboard)

**✅ This is sufficient for Supabase SMTP integration!**

### 2. **Full API Access (Not Required)**
- **Permissions**: Full access to Resend API
- **Use Case**: Programmatic email sending, managing domains, viewing analytics via API
- **When Needed**: Only if you want to use Resend's API directly (not through Supabase SMTP)

---

## Setting Up Your Resend API Key

### For Supabase SMTP (Recommended - Minimum Permissions):

1. **Go to Resend Dashboard** → **API Keys**
2. **Create API Key**
3. **Name**: `NOVA Build Supabase SMTP`
4. **Permissions**: 
   - ✅ **Sending Domain**: Select your domain (or use `onboarding@resend.dev` for testing)
   - ❌ **Full Access**: NOT needed
   - ❌ **API Access**: NOT needed for SMTP

5. **Copy the API key** (starts with `re_`)

### Why This Is Secure:
- ✅ **Least Privilege**: Only sends emails, nothing else
- ✅ **No API Access**: Can't access Resend dashboard or analytics
- ✅ **Domain Restricted**: Only sends from your verified domain
- ✅ **Revocable**: Easy to revoke if compromised

---

## When Would You Need Full Permissions?

You'd only need full permissions if you want to:

1. **Use Resend API Directly** (instead of SMTP):
   ```typescript
   import { Resend } from 'resend';
   const resend = new Resend(process.env.RESEND_API_KEY);
   await resend.emails.send({ ... });
   ```

2. **Access Resend Dashboard Features via API**:
   - View email analytics
   - Manage domains programmatically
   - List sent emails
   - Access webhooks

3. **Use Custom Email Templates in Resend**:
   - Manage templates in Resend dashboard
   - Use React Email preview
   - Template versioning

---

## For Your Current Setup

Since you're using **Supabase SMTP integration**, you only need:

✅ **SMTP Sending Permissions** (Email sending only)

**That's it!** No need for full API access.

---

## Security Best Practices

1. **Use Separate Keys**:
   - One key for Supabase SMTP (restricted)
   - Another key for API access (if needed later, also restricted)

2. **Rotate Keys Regularly**:
   - Every 90 days for production
   - Immediately if compromised

3. **Store Keys Securely**:
   - Never commit to git
   - Use environment variables
   - Use Supabase Secrets for production

4. **Monitor Usage**:
   - Check Resend dashboard for unusual activity
   - Set up email alerts for high usage

---

## Summary

| Use Case | Permissions Needed |
|----------|-------------------|
| **Supabase SMTP** (your setup) | ✅ Sending emails only |
| **Resend API Direct** | ⚠️ Full access or specific API permissions |
| **Dashboard Analytics** | ⚠️ Full access or read-only |

**For your current setup: Sending emails only is perfect!** ✅

---

## Next Steps

1. ✅ Create API key with **sending permissions only**
2. ✅ Add to Supabase SMTP settings
3. ✅ Test email delivery
4. ✅ Monitor in Resend dashboard

No need to change your current setup - you're using the most secure configuration! 🎉



