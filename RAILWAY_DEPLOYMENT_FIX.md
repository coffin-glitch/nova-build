# Railway Service Connection Refused Fix

## Problem
Railway HTTP logs show 502 "connection refused" errors even though deploy logs show the service is running.

## Root Cause
Railway's reverse proxy can't connect to the service because:
1. Railway might be deploying from the wrong root directory
2. The service needs to be in the `railway-service/` directory
3. Railway needs to know to use `railway-service/` as the root

## Solution

### Option 1: Set Root Directory in Railway Dashboard (Recommended)

1. Go to Railway dashboard
2. Select your service
3. Go to **Settings** tab
4. Find **Root Directory** setting
5. Set it to: `railway-service`
6. Save and redeploy

### Option 2: Verify Railway Service Structure

Make sure your Railway service is configured to:
- Use `railway-service/` as the root directory
- Run `npm start` from that directory
- Have `package.json` and `server.js` in that directory

### Option 3: Check Environment Variables

Verify in Railway dashboard → Variables:
- `PORT` should be set automatically by Railway (don't set it manually)
- `HOST` is optional (defaults to 0.0.0.0)
- `DATABASE_URL` must be set
- `TELEGRAM_BOT_TOKEN` must be set

## What to Check After Deployment

After Railway redeploys, check the deploy logs for:

```
✅ Telegram forwarder service running on 0.0.0.0:[PORT]
✅ Server is listening on 0.0.0.0:[PORT]
```

If you see these messages, the service is running correctly. If you still get 502 errors, it means Railway's reverse proxy can't route to it.

## Next Steps

1. Set Root Directory to `railway-service` in Railway dashboard
2. Trigger a redeploy
3. Check deploy logs for the ✅ messages
4. Test the health endpoint: `curl https://your-service.railway.app/health`
5. The console should automatically connect once the service is accessible

