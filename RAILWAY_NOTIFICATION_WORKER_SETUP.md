# 🚀 Railway Notification Worker - Complete Setup Guide

## Overview

This guide will help you deploy the notification worker to Railway so it can process jobs from the Upstash Redis queue 24/7.

## Prerequisites

✅ Upstash Redis database created (already done)
✅ REDIS_URL connection string ready
✅ DATABASE_URL from your existing services

## Step-by-Step Setup

### Step 1: Create New Railway Service

1. Go to [Railway Dashboard](https://railway.app)
2. Open your project (or create a new one)
3. Click **"New"** → **"Empty Service"**
4. Name it: `nova-notification-worker`

### Step 2: Connect GitHub Repository

1. In the service settings, click **"Connect GitHub Repo"**
2. Select your `nova-build` repository
3. Railway will automatically detect the repository

### Step 3: Configure Deployment Settings

1. Go to **Settings** → **Deploy**
2. **Root Directory:** Leave empty (uses root `/`)
3. **Start Command:** `npm run worker:notifications`
4. **Build Command:** `npm ci --legacy-peer-deps` (or leave empty, Railway auto-detects)

### Step 4: Set Environment Variables

Go to **Settings** → **Variables** and add:

```bash
# Upstash Redis (Required)
REDIS_URL=rediss://default:AY04AAIncDI0MGExNTMyZjM4NTI0OWM0ODQzOTJhOGI1M2QxNTczN3AyMzYxNTI@active-penguin-36152.upstash.io:6379

# Database (Copy from your telegram forwarder service)
DATABASE_URL=postgresql://postgres.rbiomzdrlmsexehrhowa:LVJPHzZbah5pW4Lp@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require

# Environment
NODE_ENV=production
```

**Important Notes:**
- Use `rediss://` (with double 's') for TLS
- Copy `DATABASE_URL` from your existing Railway service
- Railway will automatically restart the service when you add variables

### Step 5: Deploy

1. Railway will automatically start deploying
2. Watch the **Deployments** tab for progress
3. Check the **Logs** tab once deployment starts

### Step 6: Verify It's Working

**Check Railway Logs:**
Look for this message in the logs:
```
🚀 Notification workers started and listening for jobs...
```

**Test the Connection:**
1. Go to your Vercel/production site
2. Visit: `https://your-site.vercel.app/api/notifications/queue-stats`
3. Should return JSON with queue statistics

**Trigger a Test Job:**
```bash
curl -X POST https://your-site.vercel.app/api/notifications/process
```

Then check Railway logs - you should see job processing messages.

## Monitoring

### Railway Dashboard
- **Logs Tab:** Real-time worker logs
- **Metrics Tab:** CPU, Memory, Network usage
- **Deployments Tab:** Deployment history

### Queue Stats API
Monitor queue status:
```bash
curl https://your-site.vercel.app/api/notifications/queue-stats
```

Response:
```json
{
  "success": true,
  "waiting": 0,
  "active": 0,
  "completed": 5,
  "failed": 0,
  "delayed": 0,
  "total": 5,
  "timestamp": "2025-11-13T15:30:00.000Z"
}
```

## Troubleshooting

### Worker Not Starting

**Error: "REDIS_URL not set"**
- ✅ Check environment variables are set in Railway
- ✅ Verify REDIS_URL format: `rediss://default:PASSWORD@HOST:6379`
- ✅ Make sure password is correct (reset in Upstash if needed)

**Error: "Connection refused" or "ECONNREFUSED"**
- ✅ Verify using `rediss://` (double 's') not `redis://`
- ✅ Check Upstash dashboard - endpoint should be: `active-penguin-36152.upstash.io:6379`
- ✅ Ensure TLS is enabled in Upstash (it is by default)

**Error: "Invalid password"**
- ✅ Reset credentials in Upstash dashboard
- ✅ Update REDIS_URL in Railway with new password

**Error: "Cannot find module"**
- ✅ Check Root Directory is empty (uses root `/`)
- ✅ Verify Start Command is: `npm run worker:notifications`
- ✅ Check Railway logs for build errors

### Worker Running But No Jobs Processing

1. **Check Queue Stats:**
   ```bash
   curl https://your-site.vercel.app/api/notifications/queue-stats
   ```

2. **Trigger Processing:**
   ```bash
   curl -X POST https://your-site.vercel.app/api/notifications/process
   ```

3. **Check Railway Logs:**
   - Should see: "Processing notifications for user..."
   - Should see: "Processed X notifications for user..."

4. **Verify Database Connection:**
   - Check DATABASE_URL is correct
   - Verify database is accessible

## Scaling

### Manual Scaling
1. Go to Railway service settings
2. Adjust **Instance Count** (default: 1)
3. Each instance processes jobs concurrently

### Auto-Scaling (Pro Plan)
- Railway can auto-scale based on CPU/Memory
- Configure in service settings

## Cost Estimation

**Railway Free Tier:**
- $5 credit/month
- Worker uses minimal resources (~100MB RAM)
- Should run comfortably on free tier

**Upstash Free Tier:**
- 10,000 commands/day
- More than enough for notification system

## Next Steps

1. ✅ Worker deployed and running
2. ✅ Test queue stats endpoint
3. ✅ Trigger test notification processing
4. ✅ Monitor Railway logs
5. ✅ Set up alerts (optional)

## Quick Reference

**Start Command:** `npm run worker:notifications`
**Root Directory:** (empty - uses root)
**Required Env Vars:**
- `REDIS_URL`
- `DATABASE_URL`
- `NODE_ENV=production`

**Test Endpoints:**
- Queue Stats: `/api/notifications/queue-stats`
- Trigger Processing: `POST /api/notifications/process`

**Success Message:**
```
🚀 Notification workers started and listening for jobs...
```

