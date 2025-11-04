# Testing Supabase Auth - Step by Step

## ✅ Prerequisites Complete
- [x] SMTP configured in Supabase Dashboard
- [x] Service Role Key added to `.env.local`
- [x] Supabase auth enabled (`NEXT_PUBLIC_USE_SUPABASE_AUTH=true`)
- [x] Auth pages redesigned with modern UI

---

## 🧪 Test Plan

### Test 1: Sign Up Flow

1. **Open your app**
   - Go to: http://localhost:3000/sign-up
   - You should see the new redesigned sign-up page (glass morphism, gradients, NOVA Build branding)

2. **Create a test account**
   - Enter a test email (use a real email you can access)
   - Enter password (min 8 characters)
   - Confirm password
   - Click "Create Account"

3. **Check your email**
   - Go to the inbox of the email you used
   - Look for an email from Supabase/NOVA Build
   - Subject: "Confirm your signup" or similar
   - **If you don't see it**: Check spam folder, wait 1-2 minutes

4. **Confirm your account**
   - Click the confirmation link in the email
   - Should redirect back to your app
   - Should show success or redirect to sign-in page

### Test 2: Sign In Flow

1. **Go to sign-in page**
   - Visit: http://localhost:3000/sign-in
   - Should see the new redesigned sign-in page

2. **Sign in**
   - Enter the email and password you just created
   - Click "Sign In"
   - Should redirect to home page or dashboard

3. **Verify session**
   - Refresh the page
   - Should stay signed in
   - Check if user info is displayed (if visible)

### Test 3: Password Reset Flow

1. **Go to sign-in page**
   - Click "Forgot password?" link

2. **Request reset**
   - Enter your email
   - Click submit (or whatever button is there)

3. **Check email**
   - Look for password reset email
   - Click the reset link

4. **Reset password**
   - Enter new password
   - Confirm new password
   - Submit

5. **Sign in with new password**
   - Go to sign-in page
   - Sign in with new password
   - Should work

### Test 4: Google Sign-In (If Configured)

1. **On sign-in page**
   - Click "Sign in with Google"
   - Should redirect to Google OAuth
   - Sign in with Google account
   - Should redirect back to your app

---

## ⚠️ Troubleshooting

### Issue: "SMTP not configured" or emails not sending

**Check:**
1. Supabase Dashboard → Authentication → Settings → SMTP Settings
2. Verify SMTP is enabled and configured correctly
3. Check Supabase logs: Dashboard → Logs → Email logs

### Issue: "Sign up not working" or errors

**Check:**
1. Browser console for errors (F12 → Console tab)
2. Terminal/console for server errors
3. Verify `.env.local` has correct values
4. Restart dev server after changing `.env.local`

### Issue: "Session not persisting"

**Check:**
1. Browser cookies are enabled
2. Check browser DevTools → Application → Cookies
3. Should see Supabase session cookies

### Issue: "Page looks broken" or styling issues

**Check:**
1. Verify SupabaseProvider is in root layout
2. Check if there are any import errors
3. Restart dev server

---

## 📋 What to Report

When testing, note:
- [ ] Sign-up email received?
- [ ] Confirmation link works?
- [ ] Sign-in works?
- [ ] Session persists on refresh?
- [ ] Password reset works?
- [ ] Google Sign-In works? (if configured)
- [ ] Any errors in console?
- [ ] Any errors in terminal?

---

## 🎉 Next Steps After Testing

Once all tests pass:
1. ✅ Update root layout to use SupabaseProvider
2. ✅ Update navigation components
3. ✅ Migrate API routes
4. ✅ Run backfill script (if you have existing users)
5. ✅ Deploy to production



