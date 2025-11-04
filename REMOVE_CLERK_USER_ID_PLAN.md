# Complete Removal of clerk_user_id - Implementation Plan

## Overview
This document outlines the complete removal of all `clerk_user_id` references from the database, API routes, and functions, migrating everything to use only `supabase_user_id`.

## Database Tables Affected

### Primary Tables (with clerk_user_id as PK or critical FK):
1. **carrier_profiles** - PRIMARY KEY → migrate to supabase_user_id
2. **user_roles_cache** - PRIMARY KEY → migrate to supabase_user_id  
3. **carrier_bids** - Foreign key → remove FK, use supabase_user_id

### Secondary Tables (with clerk-based user IDs):
4. **auction_awards** - winner_user_id, awarded_by
5. **conversations** - carrier_user_id, admin_user_id
6. **conversation_messages** - sender_id
7. **message_reads** - user_id
8. **carrier_chat_messages** - carrier_user_id
9. **admin_messages** - carrier_user_id, admin_user_id
10. **load_offers** - carrier_user_id
11. **assignments** - user_id
12. **telegram_bid_offers** - user_id
13. **carrier_bid_history** - carrier_user_id
14. **notification_triggers** - carrier_user_id
15. **notification_logs** - carrier_user_id
16. **carrier_favorites** - carrier_user_id
17. **carrier_notification_preferences** - carrier_user_id
18. **bid_messages** - sender_id

## Migration Steps

### Phase 1: Code Updates (✅ Started)
- [x] Remove clerk_user_id from carrier_profiles INSERT
- [ ] Remove clerk_user_id from all API route SELECT statements
- [ ] Remove clerk_user_id from all API route INSERT statements
- [ ] Remove clerk_user_id from all API route WHERE clauses
- [ ] Update library functions (role-manager, db-optimized, etc.)

### Phase 2: Database Migration
- [x] Create migration script (078_remove_clerk_user_id_complete.sql)
- [ ] Test migration on development database
- [ ] Backup production database
- [ ] Run migration on production

### Phase 3: Verification
- [ ] Verify no code references clerk_user_id
- [ ] Verify all queries use supabase_user_id
- [ ] Test all API endpoints
- [ ] Test authentication flows
- [ ] Test profile management
- [ ] Test bidding system

## Files to Update

### API Routes (High Priority):
- app/api/carrier/profile/route.ts ✅ (partially done)
- app/api/admin/carriers/[userId]/*/route.ts
- app/api/carrier/bids/route.ts
- app/api/carrier/favorites/route.ts
- app/api/admin/awarded-bids/route.ts
- app/api/admin/bids/[bidNumber]/award/route.ts
- All other routes that query by user

### Library Files:
- lib/role-manager.ts (partially done - but may be deprecated)
- lib/db-optimized.ts ✅
- lib/advanced-load-matching.ts ✅
- lib/schema.ts (type definitions)
- lib/db-queries.ts (if still used)

## Important Notes

1. **Foreign Key Constraints**: Must be dropped before removing columns
2. **Primary Keys**: Tables with clerk_user_id as PK need special handling
3. **Indexes**: Drop all indexes on clerk_user_id before dropping columns
4. **Data Integrity**: Ensure all rows have supabase_user_id before migration
5. **Rollback Plan**: Keep migration reversible if possible

## Testing Checklist

- [ ] User authentication works
- [ ] Profile creation/update works
- [ ] Profile approval/decline works
- [ ] Bidding system works
- [ ] Admin functions work
- [ ] Message/chat system works
- [ ] Notifications work
- [ ] Favorites work
- [ ] Load offers work
- [ ] Auction awards work


