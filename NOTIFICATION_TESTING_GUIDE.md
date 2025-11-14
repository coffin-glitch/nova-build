# 🧪 Notification System Testing Guide

This guide explains how to test if the notification system is detecting matches and sending notifications.

## Quick Test

Run the comprehensive test script:

```bash
npm run test:notifications
```

Or directly:

```bash
npx tsx scripts/test-notification-system.ts
```

This script will:
1. ✅ Check for active notification triggers
2. ✅ Trigger notification processing
3. ✅ Monitor queue stats
4. ✅ Verify notifications were created
5. ✅ Check notification logs
6. ✅ Show a summary

## Manual Testing Steps

### 1. Check if Worker is Running

**Railway Dashboard:**
- Go to your Railway project
- Open the `nova-notification-worker` service
- Check the Logs tab
- You should see: `🚀 Notification workers started and listening for jobs...`

**Or check locally:**
```bash
npm run worker:notifications
```

### 2. Verify Active Triggers

Check if users have notification triggers set up:

```sql
SELECT 
  nt.id,
  nt.supabase_carrier_user_id,
  nt.trigger_type,
  nt.is_active,
  cp.email_notifications,
  u.email
FROM notification_triggers nt
LEFT JOIN carrier_notification_preferences cp 
  ON nt.supabase_carrier_user_id = cp.supabase_carrier_user_id
LEFT JOIN auth.users u 
  ON nt.supabase_carrier_user_id = u.id
WHERE nt.is_active = true;
```

### 3. Trigger Notification Processing

**Option A: Use the test script**
```bash
npm run test:notifications
```

**Option B: Manual API call**
```bash
curl -X POST http://localhost:3000/api/notifications/process
```

**Option C: Production**
```bash
curl -X POST https://your-domain.com/api/notifications/process
```

Expected response:
```json
{
  "ok": true,
  "message": "Enqueued 3 notification jobs",
  "usersProcessed": 3,
  "totalTriggers": 5
}
```

### 4. Monitor Queue Stats

Check if jobs are being processed:

```bash
curl http://localhost:3000/api/notifications/queue-stats
```

Response:
```json
{
  "success": true,
  "waiting": 0,
  "active": 1,
  "completed": 15,
  "failed": 0,
  "delayed": 0
}
```

**What to look for:**
- `waiting` > 0: Jobs queued but not processed (worker may not be running)
- `active` > 0: Jobs currently being processed
- `completed` increasing: System is working!
- `failed` > 0: Check worker logs for errors

### 5. Check Railway Worker Logs

In Railway dashboard → Logs, you should see:

```
✅ Redis connection ready
Processing notifications for user abc123..., 2 triggers
[Email] Email sent to user@example.com for exact_match notification
✅ Notification job user-abc123-1234567890 completed
```

**If you see errors:**
- `❌ Redis connection error`: Check REDIS_URL
- `❌ Error fetching load details`: Check DATABASE_URL
- `⚠️ Email notifications disabled`: User has disabled emails
- `⚠️ No email found`: User doesn't have email in Supabase

### 6. Verify Notifications Created

Check the database for new notifications:

```sql
SELECT 
  cn.id,
  cn.supabase_carrier_user_id,
  cn.notification_type,
  cn.title,
  cn.message,
  cn.bid_number,
  cn.is_read,
  cn.created_at
FROM carrier_notifications cn
WHERE cn.created_at > NOW() - INTERVAL '10 minutes'
ORDER BY cn.created_at DESC;
```

### 7. Check Notification Logs

Verify notification logs were created:

```sql
SELECT 
  nl.id,
  nl.supabase_carrier_user_id,
  nl.notification_type,
  nl.bid_number,
  nl.delivery_status,
  nl.sent_at
FROM notification_logs nl
WHERE nl.sent_at > NOW() - INTERVAL '10 minutes'
ORDER BY nl.sent_at DESC;
```

### 8. Verify Emails Sent

**Check Resend Dashboard:**
- Go to https://resend.com/emails
- Look for recent emails sent
- Check delivery status

**Or check logs:**
The worker logs will show:
```
✅ Email sent to user@example.com for exact_match notification
📬 Message ID: abc-123-def-456
```

## Common Issues & Solutions

### ❌ No Notifications Created

**Possible causes:**
1. **No active triggers** - User hasn't set up notification preferences
2. **No matching loads** - No loads match the trigger criteria
3. **Rate limit** - User has reached 20 notifications/hour limit
4. **Worker not running** - Railway worker is down
5. **Preferences filtered** - User preferences filtered out the notification

**Solutions:**
- Check if triggers exist: `SELECT * FROM notification_triggers WHERE is_active = true;`
- Verify worker is running in Railway
- Check rate limits: `SELECT * FROM notification_rate_limits;`
- Review user preferences

### ❌ Jobs Queued but Not Processed

**Symptoms:**
- Queue stats show `waiting > 0` but not decreasing
- No worker logs

**Solutions:**
- Check Railway worker is running
- Verify REDIS_URL is correct
- Check worker logs for connection errors

### ❌ Emails Not Sending

**Possible causes:**
1. **Email disabled** - User has `email_notifications = false`
2. **No email in Supabase** - User doesn't have email address
3. **Resend not configured** - Missing RESEND_API_KEY
4. **Email provider disabled** - ENABLE_EMAIL_NOTIFICATIONS = false

**Solutions:**
- Check user preferences: `SELECT email_notifications FROM carrier_notification_preferences WHERE supabase_carrier_user_id = '...';`
- Verify email in Supabase: Check `auth.users` table
- Check environment variables: `RESEND_API_KEY`, `EMAIL_PROVIDER`
- Review worker logs for email errors

### ❌ "No matching loads found"

**Possible causes:**
1. **No active bids** - No bids in `telegram_bids` table
2. **Trigger criteria too strict** - Distance threshold too small
3. **No favorites** - User hasn't saved any favorites

**Solutions:**
- Check for active bids: `SELECT COUNT(*) FROM telegram_bids WHERE published = true;`
- Review trigger config: Check `trigger_config` in `notification_triggers`
- Verify favorites exist: `SELECT * FROM carrier_favorites WHERE supabase_carrier_user_id = '...';`

## Testing Specific Scenarios

### Test Exact Match Notification

1. Create a favorite route for a user
2. Ensure there's an active bid matching that route
3. Trigger processing: `curl -X POST http://localhost:3000/api/notifications/process`
4. Check for notification with type `exact_match`

### Test Similar Load Notification

1. Set up a similar load trigger with distance threshold
2. Ensure there are active bids within that distance
3. Trigger processing
4. Check for notification with type `similar_load`

### Test Email Sending

1. Ensure user has `email_notifications = true`
2. Ensure user has email in Supabase
3. Ensure `RESEND_API_KEY` is set
4. Trigger a notification
5. Check Resend dashboard for sent email

## Monitoring in Production

### Set Up Alerts

Monitor these metrics:
- Queue size (should stay low)
- Failed jobs (should be 0)
- Worker uptime
- Email delivery rate

### Regular Health Checks

Run daily:
```bash
npm run test:notifications
```

Check:
- Active triggers count
- Queue stats
- Recent notifications
- Error logs

## Next Steps

Once testing confirms the system works:

1. ✅ Set up Vercel Cron (if not already done)
2. ✅ Monitor Railway worker logs
3. ✅ Set up alerts for failed jobs
4. ✅ Monitor email delivery rates
5. ✅ Review notification preferences with users

