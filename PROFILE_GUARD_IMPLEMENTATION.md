# ProfileGuard Implementation - Supabase Auth Best Practices

## Overview

This document outlines the implementation of the ProfileGuard system using Supabase authentication and Next.js App Router, following industry best practices for profile-based access control.

## Architecture

### Components

1. **`hooks/useCarrierProfile.ts`** - Centralized profile fetching hook
   - Uses SWR for intelligent caching
   - Only refreshes on focus/reconnect (no aggressive polling)
   - Handles visibility changes to catch admin approvals
   - Provides stable profile state

2. **`components/ProfileGuard.tsx`** - Route protection component
   - Wraps protected routes
   - Checks profile status before allowing access
   - Handles redirects based on profile state
   - Prevents flickering with proper state management

3. **`app/api/carrier/profile/route.ts`** - Profile API endpoint
   - Returns profile data with Supabase auth
   - Uses `supabase_user_id` exclusively
   - Properly handles authentication

## Key Features

### 1. Intelligent Caching
- **No aggressive polling**: `refreshInterval: 0` prevents constant re-fetching
- **Focus-based refresh**: Only refreshes when page gains focus (catches admin approvals)
- **Deduping**: 30-second deduping interval prevents duplicate requests
- **Stable cache**: Uses `keepPreviousData: true` for smooth navigation

### 2. Approval Detection
- **Visibility change listener**: Refreshes profile when tab becomes visible
- **Focus refresh**: Auto-refreshes on window focus
- **Reconnect refresh**: Refreshes when network reconnects

### 3. State Management
- **Last approved status tracking**: Prevents flickering between approved/unapproved states
- **Timeout-based redirects**: Small delays prevent rapid redirect loops
- **Proper cleanup**: All event listeners and timeouts are properly cleaned up

### 4. Route Protection Logic
```typescript
// Always allow:
- /carrier/profile (profile management)
- /carrier (dashboard)
- /dashboard (general dashboard)

// Require approval:
- /bid-board
- /carrier/bids
- /carrier/my-loads
- All other carrier routes
```

## Best Practices Implemented

### 1. Server-Side Rendering (SSR) Compatibility
- Never blocks SSR - always renders children immediately
- All auth checks happen client-side after mount
- Uses `mounted` state to prevent hydration issues

### 2. Performance Optimization
- Aggressive caching with 30-second deduping
- Only fetches when user is logged in
- Keeps previous data during navigation
- No unnecessary re-fetches

### 3. Error Handling
- Gracefully handles profile fetch errors
- Doesn't block access on transient errors
- Logs warnings for debugging
- Allows API routes to handle auth errors

### 4. User Experience
- Smooth transitions without flickering
- Loading states only when necessary
- Clear redirect logic
- Immediate access after approval

## Usage

### Protecting Routes

```tsx
// app/bid-board/layout.tsx
import { ProfileGuard } from "@/components/ProfileGuard";

export default function BidBoardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileGuard>
      {children}
    </ProfileGuard>
  );
}
```

### Using Profile Data

```tsx
// In any component
import { useCarrierProfile } from "@/hooks/useCarrierProfile";

function MyComponent() {
  const { profile, isApproved, isLoading, mutate } = useCarrierProfile();
  
  if (isLoading) return <div>Loading...</div>;
  if (!isApproved) return <div>Access Restricted</div>;
  
  return <div>Approved content</div>;
}
```

## Flow Diagram

```
User Navigates to Protected Route
    ↓
ProfileGuard Checks Authentication
    ↓
User Authenticated? → No → Redirect to /sign-in
    ↓ Yes
Fetch Profile (with caching)
    ↓
Profile Status Check
    ↓
Approved? → Yes → Allow Access
    ↓ No
Redirect to /carrier/profile with appropriate status
    ↓
Admin Approves Profile
    ↓
Visibility Change / Focus Event
    ↓
Profile Refreshes Automatically
    ↓
User Can Now Access Protected Routes
```

## Configuration

### SWR Configuration
```typescript
{
  revalidateOnFocus: true,      // Refresh on window focus
  revalidateOnReconnect: true,   // Refresh on network reconnect
  refreshInterval: 0,            // No automatic polling
  dedupingInterval: 30000,       // 30-second dedupe
  revalidateIfStale: false,      // Don't revalidate stale data
  revalidateOnMount: true,       // Revalidate on component mount
  keepPreviousData: true,        // Keep data during navigation
}
```

## Database Schema

The profile system uses:
- `carrier_profiles.supabase_user_id` - Primary identifier (Supabase-only)
- `carrier_profiles.profile_status` - Status: 'pending', 'approved', 'declined', 'open'
- `carrier_profiles.is_first_login` - Tracks first-time setup
- `carrier_profiles.profile_completed_at` - When profile was completed

## Security Considerations

1. **Server-Side Validation**: API routes validate authentication server-side
2. **Client-Side UX Only**: ProfileGuard provides UX, not security
3. **Proper Auth Headers**: All API calls include credentials
4. **Session Management**: Uses Supabase session cookies

## Troubleshooting

### Profile Not Updating After Approval
- Check if visibility change listener is working
- Verify SWR cache is being invalidated
- Check browser console for errors
- Ensure API route returns correct profile data

### Flickering Between States
- Check `lastApprovedStatus` ref tracking
- Verify redirect timeout logic
- Ensure proper cleanup of timeouts

### Redirect Loops
- Verify pathname matching logic
- Check that profile page is always allowed
- Ensure redirect conditions are mutually exclusive

## Future Improvements

1. **WebSocket Support**: Real-time profile status updates
2. **Server-Sent Events**: Push notifications for approvals
3. **Optimistic Updates**: Immediate UI updates on approval
4. **Profile Cache Invalidation**: Clear cache on approval event


