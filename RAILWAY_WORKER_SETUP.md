# Railway Worker Setup Guide

## Quick Setup (Recommended)

Since you already have Railway infrastructure, deploying the worker there is the best option.

### Option 1: Deploy as Separate Service (Recommended)

1. **In Railway Dashboard:**
   - Go to your project
   - Click "New" → "Empty Service"
   - Name it: `nova-notification-worker`

2. **Connect to GitHub:**
   - Click "Connect GitHub Repo"
   - Select your `nova-build` repository
   - Set "Root Directory" to: `/` (root)

3. **Configure Environment Variables:**
   ```
   REDIS_URL=rediss://default:AY04AAIncDI0MGExNTMyZjM4NTI0OWM0ODQzOTJhOGI1M2QxNTczN3AyMzYxNTI@active-penguin-36152.upstash.io:6379
   DATABASE_URL=your_existing_database_url
   NODE_ENV=production
   ```

4. **Set Start Command:**
   - In service settings → "Deploy"
   - Start Command: `npm run worker:notifications`

5. **Deploy:**
   - Railway will auto-deploy
   - Worker starts processing jobs immediately

### Option 2: Add to Existing Telegram Forwarder Service

If you want to run both in the same service:

1. **Update your existing Railway service:**
   - Add `REDIS_URL` environment variable
   - Modify start command to run both processes:
     ```bash
     npm run telegram-forwarder & npm run worker:notifications
     ```

2. **Or use PM2:**
   ```json
   {
     "apps": [
       {
         "name": "telegram-forwarder",
         "script": "your-telegram-script.js"
       },
       {
         "name": "notification-worker",
         "script": "workers/notification-worker.ts",
         "interpreter": "tsx"
       }
     ]
   }
   ```

## Why Railway is Better Than Vercel Cron

| Feature | Railway Worker | Vercel Cron |
|---------|---------------|-------------|
| **Processing Speed** | Real-time (immediate) | Every 2 minutes |
| **User Experience** | ✅ Fast notifications | ⚠️ 0-2 min delay |
| **Time-Sensitive** | ✅ Perfect for 25-min bids | ⚠️ Can miss opportunities |
| **Scalability** | ✅ Auto-scale workers | ❌ Fixed schedule |
| **Cost** | ✅ Free tier available | ✅ Free |
| **Infrastructure** | ✅ You already have it | ✅ No extra setup |

## Monitoring

### Check Worker Status

1. **Railway Logs:**
   - View real-time logs in Railway dashboard
   - Look for: `🚀 Notification workers started and listening for jobs...`

2. **Queue Stats:**
   - Create endpoint: `/api/notifications/queue-stats`
   - Check waiting/active jobs count

3. **Health Check:**
   - Worker should process jobs within seconds
   - If queue grows, add more worker instances

## Troubleshooting

### Worker Not Processing

1. Check Railway logs for errors
2. Verify `REDIS_URL` is set correctly
3. Verify `DATABASE_URL` is set correctly
4. Check Redis connection: `npm run test:redis`

### High Queue Depth

- Add more worker instances in Railway
- Or increase concurrency: `NOTIFICATION_WORKER_CONCURRENCY=20`

### Worker Crashes

- Railway will auto-restart (configured in railway.json)
- Check logs for error details
- Verify all environment variables are set

## Cost Estimate

- **Railway Free Tier**: $5/month credit
- **Worker Usage**: ~$1-2/month (light usage)
- **Total**: Well within free tier ✅

## Next Steps

1. Deploy worker to Railway
2. Monitor first few job runs
3. Adjust concurrency if needed
4. Set up alerts for failures

