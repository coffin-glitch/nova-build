# Password Flow Fixes - Professional Implementation

## Issues Fixed

### 1. Forgot Password Redirect Issue ✅
**Problem**: Clicking "Forgot Password" redirected to sign-in page

**Root Cause**: Middleware was blocking unauthenticated access to `/auth/forgot-password`

**Solution**: 
- Added `/auth/forgot-password(.*)` and `/auth/reset-password(.*)` to public routes
- Added explicit pathname checks in middleware redirect logic

### 2. Token Expiration Issue ✅
**Problem**: Reauthentication code showing "Token has expired or is invalid" immediately after receiving

**Root Cause**: 
- Using `reauthenticate()` with `verifyOtp({ type: 'reauthentication' })` has TypeScript type issues
- The `reauthenticate()` flow is designed for direct password updates, not for sending reset links

**Solution**: 
- Changed to use `signInWithOtp()` with `shouldCreateUser: false` for both flows
- This works for both logged-in users (profile page) and logged-out users (forgot password)
- Uses `verifyOtp({ type: 'email' })` which is properly typed and works consistently
- After verification, sends password reset link via `resetPasswordForEmail()`

## Current Flow (Fixed)

### Profile Page Password Change:
1. User clicks "Change Password"
2. `signInWithOtp({ email, shouldCreateUser: false })` → Sends 6-digit code
3. User enters code
4. `verifyOtp({ email, token, type: 'email' })` → Verifies code
5. `resetPasswordForEmail({ email, redirectTo })` → Sends password reset link
6. User clicks link → Redirects to `/auth/reset-password`
7. User enters new password → `updateUser({ password })` → Password updated

### Forgot Password Flow:
1. User enters email on `/auth/forgot-password`
2. `signInWithOtp({ email, shouldCreateUser: false })` → Validates email exists, sends code
3. If email doesn't exist → Shows error "This email address is not registered"
4. User enters code
5. `verifyOtp({ email, token, type: 'email' })` → Verifies code
6. `resetPasswordForEmail({ email, redirectTo })` → Sends password reset link
7. User clicks link → Redirects to `/auth/reset-password`
8. User enters new password → `updateUser({ password })` → Password updated

## Supabase Configuration Required

### 1. Email Templates

**Magic Link Template** (used for OTP codes):
- Must include `{{ .Token }}` for the 6-digit code
- Should display the code prominently
- Code expires in 15 minutes (default)

**Reset Password Template**:
- Must include `{{ .ConfirmationURL }}` for the reset link
- Link expires in 1 hour (default)

### 2. Redirect URLs

Add these to Supabase Dashboard → Authentication → URL Configuration:
```
https://novabuild.io/auth/reset-password
https://novabuild.io/profile
http://localhost:3000/auth/reset-password (for dev)
http://localhost:3000/profile (for dev)
```

### 3. Site URL

Set Site URL to: `https://novabuild.io`

## Why This Approach Works

1. **Consistent Flow**: Both logged-in and logged-out users use the same OTP verification method
2. **Proper Typing**: `type: 'email'` is properly typed in Supabase TypeScript definitions
3. **Email Validation**: `signInWithOtp` with `shouldCreateUser: false` automatically validates email exists
4. **Security**: Two-step verification (OTP + reset link) provides strong security
5. **User Experience**: Clear error messages and consistent flow

## Testing Checklist

- [ ] Forgot password page accessible without login
- [ ] Invalid email shows proper error message
- [ ] Valid email receives OTP code
- [ ] OTP code verification works immediately
- [ ] Password reset link sent after verification
- [ ] Reset link redirects to reset password page
- [ ] Password can be changed successfully
- [ ] Profile page password change works same way
- [ ] All redirect URLs configured in Supabase

## Common Issues & Solutions

### Issue: "Token has expired or is invalid"
**Solution**: Ensure email template uses `{{ .Token }}` and code is entered within 15 minutes

### Issue: "User not found" error
**Solution**: This is expected behavior - email doesn't exist in system

### Issue: Reset link not working
**Solution**: Check redirect URLs are whitelisted in Supabase Dashboard

### Issue: Code not received
**Solution**: Check Supabase email logs, verify SMTP configuration

