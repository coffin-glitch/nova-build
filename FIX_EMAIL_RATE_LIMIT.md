# Fix: Email Rate Limit Exceeded Error

## Problem
You're getting "email rate limit exceeded" when trying to sign up. This happens because:
- **Supabase Free Tier**: Limited to **4 emails per hour**
- You've tried to sign up multiple times and hit this limit

---

## Solutions

### Option 1: Wait for Rate Limit Reset (Quick Fix)
⏰ **Wait 30-60 minutes** - The rate limit resets hourly.

### Option 2: Disable Email Confirmation (Best for Testing)
For development/testing, you can disable email confirmation:

1. **Go to Supabase Dashboard**:
   - https://app.supabase.com
   - Select your project: `rbiomzdrlmsexehrhowa`

2. **Navigate to**: Authentication → Settings → Email Auth

3. **Disable "Confirm email"**:
   - Turn OFF "Enable email confirmations"
   - This allows users to sign up without email verification
   - **Perfect for testing!**

4. **Save** and try signing up again

### Option 3: Use Google Sign-In (No Email Needed)
Since Google OAuth doesn't require email verification, you can:
- Click "Sign up with Google" instead
- No rate limits, no email verification needed
- Works immediately

### Option 4: Configure Custom SMTP (Production Solution)
If you already set up Google Workspace SMTP:

1. **Go to Supabase Dashboard**:
   - Authentication → Settings → SMTP Settings

2. **Enter your Google Workspace SMTP details**:
   ```
   SMTP Host: smtp.gmail.com
   SMTP Port: 587
   SMTP User: your-email@yourdomain.com
   SMTP Password: [Your Google App Password]
   Sender Email: noreply@yourdomain.com
   Sender Name: NOVA Build
   ```

3. **Save** - This removes the 4/hour limit!

---

## Quick Test Steps

1. **Try Google Sign-In** (no rate limit):
   - Click "Sign up with Google"
   - Complete OAuth flow
   - No email verification needed!

2. **OR disable email confirmation**:
   - Go to Supabase Dashboard → Auth Settings
   - Turn OFF "Confirm email"
   - Try signing up again

3. **OR wait 30-60 minutes** for rate limit reset

---

## Recommendation

For **testing/development**:
- ✅ Disable email confirmation in Supabase Dashboard
- ✅ Users can sign up immediately without email

For **production**:
- ✅ Configure custom SMTP (Google Workspace)
- ✅ Enable email confirmation for security
- ✅ No rate limits!

---

## Check Rate Limit Status

You can check if you're still rate limited by:
1. Trying to sign up again after waiting
2. Checking Supabase Dashboard → Logs → API Logs for rate limit errors

---

**For now**: Use Google Sign-In or wait a bit, then try again! 🚀



