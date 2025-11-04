# Clerk to Supabase Migration - Phase 1 Audit

## Executive Summary

This document provides a comprehensive inventory of all authentication and authorization touchpoints in the NOVA Build application, mapping every file, function, and database column that references Clerk or user identity.

**Migration Strategy**: Dual-auth bridge approach - maintain Clerk as primary while building Supabase integration in parallel, then cutover with feature flag.

---

## 1. Authentication Provider Touchpoints

### 1.1 Core Clerk Initialization

| File | Line(s) | Purpose | Migration Impact |
|------|---------|---------|------------------|
| `app/layout.tsx` | 37-52 | `ClerkProvider` wrapper for entire app | **HIGH** - Replace with Supabase session provider |
| `middleware.ts` | 2, 53-196 | `clerkMiddleware` with route protection | **CRITICAL** - Rewrite to support dual-auth |
| `middleware-profile.ts` | 2, 7 | Profile completion middleware using Clerk `auth()` | **HIGH** - Update to use unified auth |

### 1.2 Clerk SDK Imports

| File | Usage | Migration Action |
|------|-------|------------------|
| `lib/auth-server.ts` | `@clerk/nextjs/server` `auth()`, `@clerk/clerk-sdk-node` users API | Create Supabase equivalent |
| `lib/clerk-server.ts` | `@clerk/nextjs/server` `auth()`, `@clerk/clerk-sdk-node` users API | Create Supabase equivalent |
| `lib/clerk-auth.ts` | `@clerk/nextjs/server` `requireSignedIn()`, `requireAdmin()` | Migrate to Supabase auth helpers |
| `lib/auth.ts` | `@clerk/nextjs/server` `auth()` | Migrate to Supabase auth helpers |
| `hooks/useUserRole.ts` | `@clerk/nextjs` `useUser()` | Create `useSupabaseUser()` hook |
| `app/api/auth/validate-role/route.ts` | `@clerk/nextjs/server` `auth()` | Migrate to Supabase session validation |
| `app/api/clerk-roles/route.ts` | `@clerk/clerk-sdk-node` users API | Migrate to Supabase admin API |
| `lib/advanced-security.ts` | `@clerk/nextjs/server` `auth()` | Update to dual-auth support |
| `components/ClientSignIn.tsx` | Clerk sign-in component | Replace with Supabase auth UI |
| `components/ClientSignUp.tsx` | Clerk sign-up component | Replace with Supabase auth UI |
| `components/ClerkProfile.tsx` | Clerk profile component | Replace with Supabase profile UI |
| `app/sign-up/[[...sign-up]]/page.tsx` | Clerk sign-up page | Replace with Supabase auth page |

---

## 2. Role Management System

### 2.1 Role Resolution Functions

| File | Function | Purpose | Migration Action |
|------|----------|---------|------------------|
| `lib/auth-server.ts` | `getClerkUserRole()` | Get role from Clerk metadata | Create `getSupabaseUserRole()` |
| `lib/auth-server.ts` | `setClerkUserRole()` | Set role in Clerk metadata | Create `setSupabaseUserRole()` |
| `lib/auth-server.ts` | `requireAdmin()` | Require admin role | Migrate to Supabase auth |
| `lib/auth-server.ts` | `requireCarrier()` | Require carrier role | Migrate to Supabase auth |
| `lib/clerk-server.ts` | `getClerkUserRole()` | Get role from Clerk | Duplicate in Supabase version |
| `lib/clerk-server.ts` | `isClerkAdmin()` | Check if admin | Migrate to Supabase |
| `lib/clerk-server.ts` | `isClerkCarrier()` | Check if carrier | Migrate to Supabase |
| `lib/clerk-server.ts` | `getClerkUserInfo()` | Get full user info | Migrate to Supabase |
| `lib/role-manager.ts` | `getUserRole()` | Cached role lookup | **Keep** - Update to support Supabase |
| `lib/role-manager.ts` | `isAdmin()` | Check admin status | **Keep** - Update to support Supabase |
| `lib/role-manager.ts` | `isCarrier()` | Check carrier status | **Keep** - Update to support Supabase |

### 2.2 Role Cache System

| Component | Purpose | Migration Strategy |
|-----------|---------|-------------------|
| `user_roles_cache` table | DB cache for roles | **Keep** - Add `supabase_user_id` column |
| `lib/role-manager.ts` | In-memory + DB caching | **Keep** - Update to resolve from Supabase |
| API endpoint `/api/roles` | Role management API | Update to support Supabase users |

### 2.3 Client-Side Role Hooks

| File | Hook | Purpose | Migration Action |
|------|------|---------|------------------|
| `hooks/useUserRole.ts` | `useUserRole()` | Get role from Clerk user | Create Supabase version |
| `hooks/useUserRole.ts` | `useIsAdmin()` | Boolean admin check | Create Supabase version |
| `hooks/useUserRole.ts` | `useIsCarrier()` | Boolean carrier check | Create Supabase version |
| `hooks/useEffectiveRole.ts` | Role resolution with admin view mode | Update to support Supabase |

---

## 3. Middleware & Route Protection

### 3.1 Main Middleware (`middleware.ts`)

**Current Implementation:**
- Uses `clerkMiddleware()` from `@clerk/nextjs/server`
- Extracts `userId` and `sessionClaims` from Clerk
- Role resolution via `getClerkUserRole()`
- Route matchers for public/admin/carrier routes

**Migration Plan:**
1. Keep Clerk as primary initially
2. Add Supabase session verification as fallback
3. Centralize role resolution with 60-120s cache
4. Attach resolved role to request header for downstream routes

### 3.2 Profile Middleware (`middleware-profile.ts`)

**Current Implementation:**
- Checks `carrier_profiles` table using `clerk_user_id`
- Redirects for incomplete profiles

**Migration Plan:**
- Update to use unified user ID (support both `clerk_user_id` and `supabase_user_id`)

---

## 4. API Route Authentication

### 4.1 Admin-Only Routes

| Route | Current Auth | Migration Action |
|-------|--------------|------------------|
| `/api/admin/*` | Clerk `requireAdmin()` | Update to dual-auth with role header |
| `/api/admin/carriers/*` | Clerk role check | Migrate to Supabase |
| `/api/admin/bids/*` | Clerk role check | Migrate to Supabase |
| `/api/admin/awarded-bids` | Clerk role check | Migrate to Supabase |
| `/api/admin/bid-stats` | Clerk role check | Migrate to Supabase |
| `/api/admin/carrier-leaderboard` | Clerk role check | Migrate to Supabase |
| `/api/admin/conversations` | Clerk role check | Migrate to Supabase |
| `/api/admin/all-chat-messages` | Clerk role check | Migrate to Supabase |
| `/api/admin/check-admin` | Clerk role check | Migrate to Supabase |
| `/api/admin/users` | Clerk role check | Migrate to Supabase |
| `/api/clerk-roles` | Clerk API | **Remove** - Replace with Supabase equivalent |

### 4.2 Carrier-Only Routes

| Route | Current Auth | Migration Action |
|-------|--------------|------------------|
| `/api/carrier/*` | Clerk `requireCarrier()` | Update to dual-auth |
| `/api/carrier/profile` | Clerk auth | Migrate to Supabase |
| `/api/carrier/bids` | Clerk auth | Migrate to Supabase |
| `/api/carrier/notifications` | Clerk auth | Migrate to Supabase |
| `/api/carrier/conversations` | Clerk auth | Migrate to Supabase |
| `/api/carrier/messages` | Clerk auth | Migrate to Supabase |
| `/api/carrier/favorites` | Clerk auth | Migrate to Supabase |

### 4.3 Authenticated Routes (Both Roles)

| Route | Current Auth | Migration Action |
|-------|--------------|------------------|
| `/api/users/batch` | Clerk auth | Migrate to Supabase |
| `/api/notifications` | Clerk auth | Migrate to Supabase |

### 4.4 Auth Helpers Used in Routes

| File | Function | Usage Count | Migration Priority |
|------|----------|-------------|-------------------|
| `lib/auth-server.ts` | `requireAdmin()` | ~15 routes | **HIGH** |
| `lib/auth-server.ts` | `requireCarrier()` | ~20 routes | **HIGH** |
| `lib/auth-server.ts` | `getClerkUserRole()` | ~30 routes | **HIGH** |
| `lib/clerk-server.ts` | `requireAdmin()` | ~5 routes | **MEDIUM** |
| `lib/clerk-server.ts` | `requireCarrier()` | ~10 routes | **MEDIUM** |
| `lib/role-manager.ts` | `getUserRole()` | ~5 routes | **LOW** (already abstracted) |

---

## 5. Database Schema - User ID Columns

### 5.1 Tables with `clerk_user_id`

| Table | Column | Usage | Migration Action |
|-------|--------|-------|------------------|
| `carrier_profiles` | `clerk_user_id` (PRIMARY KEY) | Main carrier profile | **CRITICAL** - Add `supabase_user_id`, keep dual IDs |
| `carrier_bids` | `clerk_user_id` | Foreign key to profiles | **CRITICAL** - Add `supabase_user_id` |
| `user_roles_cache` | `clerk_user_id` (PRIMARY KEY) | Role caching | **HIGH** - Add `supabase_user_id` |
| `auction_awards` | `winner_user_id` | Winning bidder | **HIGH** - Add `supabase_user_id` |
| `auction_awards` | `awarded_by` | Admin who awarded | **HIGH** - Add `supabase_user_id` |

### 5.2 Tables with `user_id` (Generic)

| Table | Column | Usage | Migration Action |
|-------|--------|-------|------------------|
| `user_roles` | `user_id` | Legacy role table | **LOW** - Map to unified ID |
| `assignments` | `user_id` | Load assignments | **MEDIUM** - Map to unified ID |
| `telegram_bid_offers` | `user_id` | Bid offers | **MEDIUM** - Map to unified ID |

### 5.3 Tables with Role-Specific User IDs

| Table | Column | Usage | Migration Action |
|-------|--------|-------|------------------|
| `conversations` | `carrier_user_id` | Carrier in conversation | **HIGH** - Add `supabase_carrier_user_id` |
| `conversations` | `admin_user_id` | Admin in conversation | **HIGH** - Add `supabase_admin_user_id` |
| `conversation_messages` | `sender_id` | Message sender | **HIGH** - Add `supabase_sender_id` |
| `message_reads` | `user_id` | User who read message | **HIGH** - Add `supabase_user_id` |
| `carrier_chat_messages` | `carrier_user_id` | Chat message sender | **HIGH** - Add `supabase_user_id` |
| `admin_messages` | `carrier_user_id` | Message recipient | **HIGH** - Add `supabase_user_id` |
| `admin_messages` | `admin_user_id` | Message sender | **HIGH** - Add `supabase_user_id` |
| `load_offers` | `carrier_user_id` | Offer creator | **HIGH** - Add `supabase_user_id` |
| `carrier_responses` | `carrier_user_id` | Response sender | **HIGH** - Add `supabase_user_id` |
| `appeal_conversations` | `carrier_user_id` | Appeal creator | **HIGH** - Add `supabase_user_id` |
| `bid_messages` | `carrier_user_id` | Message sender | **HIGH** - Add `supabase_user_id` |
| `carrier_favorites` | `clerk_user_id` | Favorite owner | **HIGH** - Add `supabase_user_id` |

---

## 6. UI Components & Client-Side Auth

### 6.1 Clerk UI Components

| Component | File | Purpose | Migration Action |
|-----------|------|---------|------------------|
| Sign In | `components/ClientSignIn.tsx` | Clerk `<SignIn />` | Replace with Supabase auth |
| Sign Up | `components/ClientSignUp.tsx` | Clerk `<SignUp />` | Replace with Supabase auth |
| User Profile | `components/ClerkProfile.tsx` | Clerk profile management | Replace with Supabase profile |
| User Button | Various layouts | Clerk `<UserButton />` | Replace with Supabase user menu |

### 6.2 Protected Pages

| Page | Protection | Migration Action |
|------|------------|------------------|
| `/admin/*` | Admin role check | Update to dual-auth |
| `/carrier/*` | Carrier role check | Update to dual-auth |
| `/profile` | Authenticated check | Update to dual-auth |
| `/dashboard` | Authenticated check | Update to dual-auth |

### 6.3 Client-Side Auth Hooks

| Hook | File | Usage | Migration Action |
|------|------|-------|------------------|
| `useUser()` | Multiple components | Get current user | Create `useSupabaseUser()` |
| `useUserRole()` | Multiple components | Get user role | Already abstracted - update backend |
| `useIsAdmin()` | Multiple components | Admin check | Already abstracted - update backend |
| `useIsCarrier()` | Multiple components | Carrier check | Already abstracted - update backend |

---

## 7. Environment Variables

### 7.1 Current Clerk Variables

| Variable | Usage | Migration Action |
|----------|-------|------------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Client-side Clerk | **Remove** after migration |
| `CLERK_SECRET_KEY` | Server-side Clerk | **Remove** after migration |

### 7.2 Supabase Variables (Already Set)

| Variable | Status | Notes |
|----------|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Set | Ready |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Set | Ready |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ Need | Get from Supabase dashboard |
| `DATABASE_URL` | ✅ Set | Using pgBouncer pooler |

### 7.3 Feature Toggle Variable (To Add)

| Variable | Purpose |
|----------|---------|
| `AUTH_PROVIDER` | `clerk` | `supabase` | Enable dual-auth mode |

---

## 8. SQL Queries Using User IDs

### 8.1 Critical Queries to Update

| Query Location | Table | Column | Impact |
|----------------|-------|--------|--------|
| `app/api/admin/carrier-leaderboard/route.ts` | `carrier_profiles`, `carrier_bids` | `clerk_user_id` | **HIGH** - Update to support dual IDs |
| `app/api/admin/carrier-leaderboard-grouped/route.ts` | `carrier_profiles`, `carrier_bids` | `clerk_user_id` | **HIGH** - Update to support dual IDs |
| `lib/role-manager.ts` | `user_roles_cache` | `clerk_user_id` | **HIGH** - Update to support dual IDs |
| `middleware-profile.ts` | `carrier_profiles` | `clerk_user_id` | **HIGH** - Update to support dual IDs |
| All API routes | Multiple tables | Various user ID columns | **HIGH** - Systematic update needed |

---

## 9. Migration Strategy Summary

### Phase 1: ✅ Audit (Current)
- Complete inventory of all touchpoints
- Map database schema
- Identify migration priorities

### Phase 2: Dual-Auth Bridge
1. Update middleware to support both Clerk and Supabase
2. Create centralized role resolution with caching
3. Add `X-User-Id` and `X-User-Role` headers to requests
4. Maintain backward compatibility

### Phase 3: Schema Migration
1. Add `supabase_user_id` columns to all tables with `clerk_user_id`
2. Create indexes on new columns
3. Run backfill job to map Clerk users → Supabase users by email
4. Create database views for backward compatibility

### Phase 4: API Migration
1. Update all API routes to read from middleware headers
2. Support both Clerk and Supabase sessions
3. Gradually migrate queries to use unified user ID

### Phase 5: Email Integration
1. Configure Supabase SMTP
2. Migrate email flows (sign-up, password reset, etc.)
3. Keep Clerk email as fallback during transition

### Phase 6: UI Migration
1. Replace Clerk components with Supabase auth UI
2. Update all client-side hooks
3. Test all protected routes

### Phase 7: Cutover
1. Add feature flag `AUTH_PROVIDER=supabase`
2. Monitor for 1 week with both providers active
3. Switch default to Supabase
4. Keep Clerk fallback for 30 days
5. Remove Clerk code after validation period

---

## 10. Risk Assessment

### High Risk Areas
1. **Middleware** - Single point of failure for all routes
2. **Role Resolution** - Used in every protected route
3. **Database Foreign Keys** - Schema changes require careful migration
4. **Active Sessions** - Users may be logged out during cutover

### Mitigation Strategies
1. Dual-auth bridge allows gradual migration
2. Feature flag enables instant rollback
3. Backfill job runs in background without downtime
4. Session migration script for active users

---

## 11. Testing Checklist

### Pre-Migration Testing
- [ ] All Clerk auth flows working
- [ ] All role checks working
- [ ] All protected routes accessible
- [ ] Database backups completed

### Phase 2 Testing (Dual-Auth)
- [ ] Middleware supports both providers
- [ ] Role resolution works for both
- [ ] Headers properly set
- [ ] Backward compatibility maintained

### Phase 3 Testing (Schema)
- [ ] Migration scripts tested on staging
- [ ] Backfill job completes successfully
- [ ] No data loss
- [ ] Foreign keys maintained

### Phase 4 Testing (API)
- [ ] All API routes support dual-auth
- [ ] Queries work with both user IDs
- [ ] Performance not degraded

### Phase 5 Testing (Email)
- [ ] Supabase emails deliver
- [ ] All email flows work
- [ ] No duplicate emails sent

### Phase 6 Testing (UI)
- [ ] Sign-in/Sign-up work
- [ ] Profile management works
- [ ] All protected pages accessible
- [ ] No UI regressions

### Phase 7 Testing (Cutover)
- [ ] Feature flag works
- [ ] Rollback tested
- [ ] Monitoring alerts configured
- [ ] Performance metrics baseline

---

## Next Steps

1. ✅ **Phase 1 Complete** - Audit done
2. **Start Phase 2** - Implement dual-auth bridge in middleware
3. Create unified auth helper functions
4. Update role resolution to support Supabase
5. Test dual-auth mode locally

---

**Last Updated**: 2025-01-30  
**Status**: Phase 1 Complete - Ready for Phase 2 Implementation


