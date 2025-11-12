# Railway Worker - Simplest Setup

## ✅ Fixed: Removed railway.json (Railway uses TOML or no config file)

## Easiest Deployment Method

**Just deploy from root directory - no railway.json needed!**

### Steps:

1. **In Railway Dashboard:**
   - New Service → Empty Service  
   - Name: `nova-notification-worker`
   - Connect GitHub: Select `nova-build` repo

2. **Settings → Deploy:**
   - **Start Command:** `npm run worker:notifications`
   - **Root Directory:** Leave empty (uses root `/`)

3. **Settings → Variables:**
   ```
   REDIS_URL=rediss://default:AY04AAIncDI0MGExNTMyZjM4NTI0OWM0ODQzOTJhOGI1M2QxNTczN3AyMzYxNTI@active-penguin-36152.upstash.io:6379
   DATABASE_URL=(copy from your telegram forwarder service)
   NODE_ENV=production
   ```

4. **Deploy** - That's it!

Railway will:
- Auto-detect Node.js
- Run `npm install`
- Execute `npm run worker:notifications`
- Keep it running 24/7

## Why This Works

- No config file needed - Railway auto-detects everything
- Uses your existing `package.json` scripts
- All dependencies already in root `package.json`
- Worker code is in `workers/notification-worker.ts`

## Verify It's Working

Check Railway logs for:
```
🚀 Notification workers started and listening for jobs...
```

If you see that, it's working! 🎉

