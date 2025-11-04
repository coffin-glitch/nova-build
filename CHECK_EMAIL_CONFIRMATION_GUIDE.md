# How to Check if a Carrier Account Confirmed Their Email

## Quick Method: Use the Script

```bash
tsx scripts/check-email-confirmation.ts <email>
```

Example:
```bash
tsx scripts/check-email-confirmation.ts carrier@example.com
```

This will show:
- ✅ If email is confirmed
- ❌ If email is NOT confirmed
- User ID, creation date, last sign-in
- Role information from database

---

## Method 2: Supabase Dashboard

1. Go to: **https://app.supabase.com**
2. Select your project
3. Go to: **Authentication** → **Users**
4. Search for the user by email
5. Check the **"Confirmed"** column:
   - ✅ Green check = Confirmed
   - ❌ Red X = Not confirmed

6. Click on the user to see details:
   - **Email Confirmed At**: Shows date/time if confirmed
   - **Last Sign In**: Shows when they last logged in

---

## Method 3: Supabase SQL Editor

1. Go to: **SQL Editor** in Supabase dashboard
2. Run this query:

```sql
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at,
  raw_app_meta_data->>'role' as role
FROM auth.users
WHERE email = 'carrier@example.com';
```

Look at `email_confirmed_at`:
- **NULL** = Not confirmed ❌
- **Has timestamp** = Confirmed ✅

---

## Method 4: Check in Your Database

If you want to see the role too:

```sql
SELECT 
  urc.email,
  urc.role,
  urc.supabase_user_id,
  au.email_confirmed_at,
  au.created_at,
  au.last_sign_in_at
FROM user_roles_cache urc
LEFT JOIN auth.users au ON urc.supabase_user_id = au.id
WHERE urc.email = 'carrier@example.com';
```

---

## What Happens When Email is NOT Confirmed?

- ❌ User cannot sign in (Supabase blocks it)
- ❌ User will see "Please confirm your email" message
- ✅ User can request a new confirmation email

---

## Resend Confirmation Email

### Option 1: Use the Script

```bash
tsx scripts/resend-confirmation.ts <email>
```

This generates a confirmation link you can send to the user.

### Option 2: Supabase Dashboard

1. Go to **Authentication** → **Users**
2. Find the user
3. Click the **"..."** menu
4. Click **"Resend Confirmation Email"**

### Option 3: Programmatically

Update `components/SupabaseSignUp.tsx` to add a "Resend" button:

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
    setMessage('Confirmation email sent!');
  }
};
```

---

## Troubleshooting

### User Says They Didn't Receive Email

1. **Check Spam Folder** - Most common issue
2. **Verify Email Address** - Make sure they typed it correctly
3. **Check Resend Dashboard** - See if email was sent/delivered
4. **Check Supabase Logs** - Look for email send errors
5. **Resend Confirmation** - Use one of the methods above

### Email Confirmed but Still Can't Sign In

1. Check user role in database:
   ```sql
   SELECT * FROM user_roles_cache WHERE email = 'user@example.com';
   ```

2. Check if profile exists:
   ```sql
   SELECT * FROM carrier_profiles WHERE supabase_user_id = '<user_id>';
   ```

3. Check middleware - might be blocking access

---

## Best Practice

**Always verify email confirmation before allowing access to protected routes.**

Our middleware and `ProfileGuard` should handle this, but you can also check in API routes:

```typescript
const { data: { user } } = await supabase.auth.getUser();

if (!user?.email_confirmed_at) {
  return NextResponse.json(
    { error: 'Please confirm your email address' },
    { status: 403 }
  );
}
```



