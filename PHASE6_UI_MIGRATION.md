# Phase 6: UI Migration - Implementation Guide

## Overview

Phase 6 replaces Clerk UI components with Supabase auth components. This includes sign-in/sign-up pages, user buttons, and client-side hooks.

## ✅ Completed Components

### 1. Supabase Provider (`components/providers/SupabaseProvider.tsx`)

**Purpose**: Replaces `ClerkProvider` and provides Supabase auth context.

**Features**:
- Session management
- User state tracking
- Auth state change listeners
- Hooks: `useSupabase()`, `useSupabaseUser()`, `useSupabaseAuth()`

### 2. Sign In Component (`components/SupabaseSignIn.tsx`)

**Purpose**: Replaces Clerk's `<SignIn />` component.

**Features**:
- Email/password authentication
- Magic link authentication
- Error handling
- Loading states
- Responsive design matching app style

### 3. Sign Up Component (`components/SupabaseSignUp.tsx`)

**Purpose**: Replaces Clerk's `<SignUp />` component.

**Features**:
- Email/password registration
- Password confirmation
- Email confirmation flow
- Error handling
- Loading states

---

## 🔄 Migration Steps

### Step 1: Update Root Layout

**File**: `app/layout.tsx`

**Before**:
```tsx
import { ClerkProvider } from "@clerk/nextjs";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
```

**After** (Feature Flag Approach):
```tsx
import { ClerkProvider } from "@clerk/nextjs";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";

const USE_SUPABASE_AUTH = process.env.NEXT_PUBLIC_USE_SUPABASE_AUTH === 'true';

export default function RootLayout({ children }) {
  const AuthProvider = USE_SUPABASE_AUTH ? SupabaseProvider : ClerkProvider;
  
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### Step 2: Update Sign-In Page

**File**: `app/sign-in/[[...sign-in]]/page.tsx`

**Before**:
```tsx
import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return <SignIn routing="hash" />;
}
```

**After**:
```tsx
import SupabaseSignIn from "@/components/SupabaseSignIn";
import { SignIn } from "@clerk/nextjs";

const USE_SUPABASE_AUTH = process.env.NEXT_PUBLIC_USE_SUPABASE_AUTH === 'true';

export default function Page() {
  if (USE_SUPABASE_AUTH) {
    return <SupabaseSignIn />;
  }
  return <SignIn routing="hash" />;
}
```

### Step 3: Update Sign-Up Page

**File**: `app/sign-up/[[...sign-up]]/page.tsx`

**Before**:
```tsx
import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return <SignUp routing="hash" />;
}
```

**After**:
```tsx
import SupabaseSignUp from "@/components/SupabaseSignUp";
import { SignUp } from "@clerk/nextjs";

const USE_SUPABASE_AUTH = process.env.NEXT_PUBLIC_USE_SUPABASE_AUTH === 'true';

export default function Page() {
  if (USE_SUPABASE_AUTH) {
    return <SupabaseSignUp />;
  }
  return <SignUp routing="hash" />;
}
```

### Step 4: Update Client Components

**Replace Clerk hooks with Supabase hooks**:

**Before**:
```tsx
import { useUser, useAuth } from "@clerk/nextjs";

export function MyComponent() {
  const { user } = useUser();
  const { isSignedIn } = useAuth();
  
  if (!isSignedIn) return <div>Not signed in</div>;
  
  return <div>Hello {user?.firstName}</div>;
}
```

**After**:
```tsx
import { useSupabaseUser, useSupabaseAuth } from "@/components/providers/SupabaseProvider";

export function MyComponent() {
  const { user } = useSupabaseUser();
  const { isSignedIn } = useSupabaseAuth();
  
  if (!isSignedIn) return <div>Not signed in</div>;
  
  return <div>Hello {user?.email}</div>;
}
```

### Step 5: Update Navigation Components

**File**: `components/layout/SiteHeaderNew.tsx`

**Replace UserButton**:

**Before**:
```tsx
import { UserButton } from "@clerk/nextjs";

<UserButton afterSignOutUrl="/" />
```

**After**:
```tsx
import { useSupabaseAuth } from "@/components/providers/SupabaseProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const { user, isSignedIn } = useSupabaseAuth();
const { supabase } = useSupabase();

{isSignedIn && user && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm">
        {user.email}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem onClick={() => supabase.auth.signOut()}>
        Sign Out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

---

## 📋 Component Mapping

| Clerk Component | Supabase Replacement | Status |
|----------------|---------------------|--------|
| `<ClerkProvider />` | `<SupabaseProvider />` | ✅ Created |
| `<SignIn />` | `<SupabaseSignIn />` | ✅ Created |
| `<SignUp />` | `<SupabaseSignUp />` | ✅ Created |
| `<UserButton />` | Custom dropdown menu | ⏳ TODO |
| `<SignInButton />` | Link to `/sign-in` | ⏳ TODO |
| `<SignOutButton />` | `supabase.auth.signOut()` | ⏳ TODO |
| `useUser()` | `useSupabaseUser()` | ✅ Created |
| `useAuth()` | `useSupabaseAuth()` | ✅ Created |
| `useClerk()` | `useSupabase()` | ✅ Created |

---

## 🔧 Feature Flag Strategy

Use environment variable to toggle between providers:

```bash
# .env.local
NEXT_PUBLIC_USE_SUPABASE_AUTH=false  # Start with Clerk (false)
```

**Migration Flow**:
1. Set `NEXT_PUBLIC_USE_SUPABASE_AUTH=false` (use Clerk)
2. Test Supabase components alongside Clerk
3. Set `NEXT_PUBLIC_USE_SUPABASE_AUTH=true` (use Supabase)
4. Monitor for issues
5. Remove Clerk components after validation

---

## ⚠️ Important Differences

### User Object

**Clerk**:
```typescript
user.firstName
user.lastName
user.emailAddresses[0].emailAddress
user.id
```

**Supabase**:
```typescript
user.email
user.id
user.user_metadata.firstName  // Custom metadata
user.user_metadata.lastName
```

### Sign Out

**Clerk**:
```typescript
<SignOutButton />
```

**Supabase**:
```typescript
await supabase.auth.signOut();
```

### Session Management

**Clerk**: Automatic via `<ClerkProvider />`

**Supabase**: Managed via `<SupabaseProvider />` and `supabase.auth.onAuthStateChange()`

---

## ✅ Migration Checklist

- [ ] Create SupabaseProvider component
- [ ] Create SupabaseSignIn component
- [ ] Create SupabaseSignUp component
- [ ] Add feature flag to root layout
- [ ] Update sign-in page
- [ ] Update sign-up page
- [ ] Replace UserButton in headers
- [ ] Replace SignInButton/SignOutButton
- [ ] Update all `useUser()` hooks
- [ ] Update all `useAuth()` hooks
- [ ] Test sign-in flow
- [ ] Test sign-up flow
- [ ] Test sign-out flow
- [ ] Test session persistence
- [ ] Verify email confirmation flow
- [ ] Test password reset flow

---

## 🧪 Testing

### Test Sign-In
1. Navigate to `/sign-in`
2. Enter email and password
3. Verify redirect after sign-in
4. Check session persistence on refresh

### Test Sign-Up
1. Navigate to `/sign-up`
2. Enter email and password
3. Verify email confirmation sent
4. Check email and click confirmation link
5. Verify account created

### Test Sign-Out
1. Click sign out button
2. Verify session cleared
3. Verify redirect to home page
4. Verify cannot access protected routes

---

## 📊 Rollback Plan

If issues arise:

1. **Immediate**: Set `NEXT_PUBLIC_USE_SUPABASE_AUTH=false`
2. **Redeploy**: App reverts to Clerk immediately
3. **Investigate**: Fix issues in Supabase components
4. **Retry**: Set flag back to `true` after fixes

---

**Status**: Phase 6 Foundation Complete ✅  
**Next**: Phase 7 - Cutover & Monitoring  
**Last Updated**: 2025-01-30


