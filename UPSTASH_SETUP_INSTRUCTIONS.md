# Upstash Redis Setup - Quick Start Guide

## ✅ You've Completed:
- Signed up for Upstash
- Created Redis database: `NOVA`
- Endpoint: `active-penguin-36152.upstash.io:6379`
- TLS: Enabled ✅

## 🔑 Next Steps:

### 1. Get Your Password/Token

In your Upstash dashboard:
- Look for the **Token** field (it shows as dots: `•••••••••`)
- Click on it to reveal the password, OR
- Use "Reset Credentials" to generate a new password
- Copy the password

### 2. Create Your Connection String

Format:
```
rediss://default:YOUR_PASSWORD@active-penguin-36152.upstash.io:6379
```

**Important**: 
- Use `rediss://` (with **double 's'**) for TLS
- Replace `YOUR_PASSWORD` with the actual password from step 1

### 3. Add to `.env.local`

Open `.env.local` and add:
```bash
REDIS_URL=rediss://default:YOUR_ACTUAL_PASSWORD@active-penguin-36152.upstash.io:6379
```

### 4. Test the Connection

Run:
```bash
npm run test:redis
```

You should see:
```
✅ Redis ping successful: PONG
✅ Redis set/get successful: success
✅ Redis connection is working correctly!
```

### 5. Run Database Migration

```bash
psql $DATABASE_URL -f db/migrations/100_notification_system_indexes.sql
```

Or if you have DATABASE_URL in .env.local:
```bash
source .env.local
psql $DATABASE_URL -f db/migrations/100_notification_system_indexes.sql
```

### 6. Start the Worker (Optional - for local testing)

In a separate terminal:
```bash
npm run worker:notifications
```

You should see:
```
🚀 Notification workers started and listening for jobs...
```

## 🚀 Production Deployment

### For Vercel:

1. Add `REDIS_URL` to Vercel environment variables:
   - Go to your Vercel project settings
   - Add environment variable: `REDIS_URL`
   - Value: `rediss://default:YOUR_PASSWORD@active-penguin-36152.upstash.io:6379`

2. The cron job is already configured in `vercel.json` to run every 2 minutes

3. For the worker process, you have two options:

   **Option A: Separate Service (Recommended)**
   - Deploy worker to Railway, Render, or similar
   - Keep it running 24/7 to process jobs

   **Option B: Vercel Cron Only**
   - Jobs will accumulate in the queue
   - Processed every 2 minutes when cron triggers
   - No separate worker needed (but slower)

## 📊 Verify It's Working

1. Check queue stats (you can add this endpoint):
   ```typescript
   // app/api/notifications/queue-stats/route.ts
   import { getQueueStats } from '@/lib/notification-queue';
   
   export async function GET() {
     const stats = await getQueueStats();
     return Response.json(stats);
   }
   ```

2. Trigger a test:
   ```bash
   curl -X POST http://localhost:3000/api/notifications/process
   ```

3. Check worker logs for job processing

## ❌ Troubleshooting

### Connection Errors

**Error: "Connection refused"**
- Check password is correct
- Verify using `rediss://` not `redis://`
- Ensure TLS is enabled in Upstash (it is by default)

**Error: "Invalid password"**
- Reset credentials in Upstash dashboard
- Update `.env.local` with new password

**Error: "Timeout"**
- Check firewall/network settings
- Verify endpoint is correct: `active-penguin-36152.upstash.io:6379`

### Worker Not Processing

- Check Redis connection is working (`npm run test:redis`)
- Verify worker is running (`npm run worker:notifications`)
- Check queue has jobs (use queue stats endpoint)

## 📚 Additional Resources

- Full setup guide: `docs/NOTIFICATION_SYSTEM_SETUP.md`
- Upgrade summary: `NOTIFICATION_UPGRADE_SUMMARY.md`
- Upstash docs: https://docs.upstash.com/redis

