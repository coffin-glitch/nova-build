# Supabase Auth Migration Progress

## Completed Routes ✅

### Critical Routes (10):
1. ✅ `/api/carrier/bids` (GET)
2. ✅ `/api/carrier/favorites` (GET, POST, DELETE)
3. ✅ `/api/carrier/favorites/check` (GET)
4. ✅ `/api/carrier/awarded-bids` (GET)
5. ✅ `/api/carrier/bid-history` (GET, POST)
6. ✅ `/api/carrier/bids/[id]` (DELETE)
7. ✅ `/api/carrier/booked-loads` (GET)
8. ✅ `/api/carrier/bid-stats` (GET)
9. ✅ `/api/carrier/load-offers` (GET)
10. ✅ `/api/carrier/messages` (GET)
11. ✅ `/api/carrier/notification-preferences` (GET, PUT)
12. ✅ `/api/carrier/conversations` (GET, POST)
13. ✅ `/api/carrier/profile` (GET, POST)
14. ✅ `/api/carrier/notifications` (GET)
15. ✅ `/api/carrier/driver-profiles` (POST)

## Remaining Routes (25):

### Conversation Routes:
- `/api/carrier/conversations/[conversationId]` (GET, POST)
- `/api/carrier/conversations/[conversationId]/read` (POST)
- `/api/carrier/appeal-conversations` (GET, POST)
- `/api/carrier/appeal-conversations/[conversationId]` (GET, POST)

### Bid/Load Routes:
- `/api/carrier/bid-lifecycle/[bidNumber]` (GET, POST)
- `/api/carrier/load-lifecycle/[loadId]` (GET, POST)
- `/api/carrier/load-lifecycle/[loadId]/driver-info` (POST)
- `/api/carrier/load-status/[loadId]` (GET, PATCH)
- `/api/carrier/loads/[loadId]/driver-info` (POST)
- `/api/carrier/load-offers` (might need POST)
- `/api/carrier/load-stats` (GET)
- `/api/carrier/load-analytics` (GET)

### Offer Routes:
- `/api/carrier/offers/[offerId]` (GET, POST, PATCH)
- `/api/carrier/offers/[offerId]/driver-info` (POST)
- `/api/carrier/offers/[offerId]/history` (GET)

### Message Routes:
- `/api/carrier/messages/responses` (GET, POST)
- `/api/carrier/messages/responses/[messageId]/read` (POST)
- `/api/carrier/messages/[messageId]/read` (POST)
- `/api/carrier/chat-message` (POST)

### Other Routes:
- `/api/carrier/notification-triggers` (GET, POST)
- `/api/carrier/notifications/[notificationId]/read` (POST)
- `/api/carrier/notifications/read-all` (POST)
- `/api/carrier/profile/history` (GET)
- `/api/carrier/admins` (GET)
- `/api/carrier/start-chat` (POST)
- `/api/carrier/driver-profiles` (GET, PATCH - partially done)

## Migration Pattern:

1. Replace `auth()` from `@clerk/nextjs/server` with `requireApiCarrier(request)`
2. Update all SQL queries to use dual-ID pattern:
   ```typescript
   WHERE (
     ${auth.authProvider === 'supabase' 
       ? sql`(column.supabase_user_id = ${userId} OR column.clerk_user_id IN (SELECT clerk_user_id FROM user_roles_cache WHERE supabase_user_id = ${userId}))`
       : sql`(column.clerk_user_id = ${userId} OR column.supabase_user_id IN (SELECT supabase_user_id FROM user_roles_cache WHERE clerk_user_id = ${userId}))`
     }
   )
   ```
3. For INSERT operations, set both IDs:
   ```typescript
   const clerkUserId = auth.authProvider === 'supabase' ? null : userId;
   const supabaseUserId = auth.authProvider === 'supabase' ? userId : null;
   ```

## Next Steps:
Continue migrating remaining 25 routes systematically.
