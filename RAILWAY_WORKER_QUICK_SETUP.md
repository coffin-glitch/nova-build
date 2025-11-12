# Railway Worker Quick Setup

## ✅ Fixed: railway.json → railway.toml

Railway uses `railway.toml` format, not JSON. The file has been updated.

## Simple Deployment Steps

### Option 1: Deploy from Root Directory (Easiest)

1. **In Railway Dashboard:**
   - New Service → Empty Service
   - Name: `nova-notification-worker`
   - Connect GitHub repo: `nova-build`

2. **Set Root Directory:**
   - Settings → Root Directory: Leave empty (use root `/`)

3. **Set Start Command:**
   - Settings → Deploy → Start Command: `npm run worker:notifications`

4. **Environment Variables:**
   ```
   REDIS_URL=rediss://default:AY04AAIncDI0MGExNTMyZjM4NTI0OWM0ODQzOTJhOGI1M2QxNTczN3AyMzYxNTI@active-penguin-36152.upstash.io:6379
   DATABASE_URL=(same as your telegram forwarder)
   NODE_ENV=production
   ```

5. **Deploy** - Railway will auto-deploy

### Option 2: Use railway-worker Directory

If you want to use the `railway-worker/` directory:

1. **Set Root Directory:**
   - Settings → Root Directory: `railway-worker`

2. **Start Command:**
   - `npm start` (already configured in railway-worker/package.json)

3. **Same environment variables as above**

## Verification

After deployment, check Railway logs for:
```
🚀 Notification workers started and listening for jobs...
```

## Troubleshooting

**If you see JSON parse errors:**
- ✅ Fixed: Changed `railway.json` to `railway.toml`
- Railway uses TOML format, not JSON

**If worker doesn't start:**
- Check logs in Railway dashboard
- Verify `REDIS_URL` and `DATABASE_URL` are set
- Verify start command is correct

