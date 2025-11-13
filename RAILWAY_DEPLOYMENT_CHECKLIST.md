# ✅ Railway Notification Worker - Deployment Checklist

## Quick Setup (5 minutes)

### 1. Create Service
- [ ] Go to Railway Dashboard
- [ ] New → Empty Service
- [ ] Name: `nova-notification-worker`
- [ ] Connect GitHub repo: `nova-build`

### 2. Configure Deployment
- [ ] Settings → Deploy
- [ ] Root Directory: (leave empty)
- [ ] Start Command: `npm run worker:notifications`
- [ ] Build Command: (leave empty or `npm ci --legacy-peer-deps`)

### 3. Set Environment Variables
- [ ] Settings → Variables
- [ ] Add `REDIS_URL=rediss://default:AY04AAIncDI0MGExNTMyZjM4NTI0OWM0ODQzOTJhOGI1M2QxNTczN3AyMzYxNTI@active-penguin-36152.upstash.io:6379`
- [ ] Add `DATABASE_URL` (copy from telegram forwarder service)
- [ ] Add `NODE_ENV=production`

### 4. Verify Deployment
- [ ] Check Deployments tab - should show "Active"
- [ ] Check Logs tab - should see: `🚀 Notification workers started and listening for jobs...`
- [ ] No error messages in logs

### 5. Test Connection
- [ ] Visit: `https://your-site.vercel.app/api/notifications/queue-stats`
- [ ] Should return JSON with queue stats
- [ ] Trigger test: `curl -X POST https://your-site.vercel.app/api/notifications/process`
- [ ] Check Railway logs - should see job processing

## Environment Variables Template

Copy and paste into Railway Variables:

```bash
REDIS_URL=rediss://default:AY04AAIncDI0MGExNTMyZjM4NTI0OWM0ODQzOTJhOGI1M2QxNTczN3AyMzYxNTI@active-penguin-36152.upstash.io:6379
DATABASE_URL=postgresql://postgres.rbiomzdrlmsexehrhowa:LVJPHzZbah5pW4Lp@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require
NODE_ENV=production
```

## Success Indicators

✅ **Deployment Successful:**
- Service shows "Active" status
- Logs show: `🚀 Notification workers started and listening for jobs...`
- No error messages

✅ **Connection Working:**
- Queue stats endpoint returns data
- Jobs can be enqueued
- Worker processes jobs (check logs)

## Troubleshooting Quick Fixes

| Issue | Solution |
|-------|----------|
| "REDIS_URL not set" | Add REDIS_URL to Railway variables |
| "Connection refused" | Check using `rediss://` (double 's') |
| "Invalid password" | Reset password in Upstash, update REDIS_URL |
| "Cannot find module" | Check Root Directory is empty |
| No jobs processing | Trigger via API: `POST /api/notifications/process` |

## Full Documentation

See `RAILWAY_NOTIFICATION_WORKER_SETUP.md` for detailed instructions.

