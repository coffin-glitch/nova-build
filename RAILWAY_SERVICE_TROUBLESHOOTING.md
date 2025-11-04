# Railway Service 502 Error Troubleshooting

## Error: 502 Bad Gateway

If you're seeing a 502 error, it means the Railway service is not responding. Here's how to fix it:

## Quick Fixes

### 1. Check if Railway Service is Running

1. Go to your Railway dashboard: https://railway.app
2. Select your Telegram forwarder service
3. Check the "Deployments" tab to see if there are any failed deployments
4. Check the "Logs" tab for any error messages

### 2. Restart the Railway Service

1. In Railway dashboard, go to your service
2. Click on the "Settings" tab
3. Click "Restart" or "Redeploy"
4. Wait for the service to restart (usually takes 1-2 minutes)

### 3. Verify the Service URL

Make sure your Railway URL is correct:
- Check the Railway dashboard for the correct public domain
- It should be something like: `https://your-service-name.up.railway.app`
- Verify in `.env.local`: `RAILWAY_URL=https://your-service-name.up.railway.app`

### 4. Check Railway Service Logs

1. In Railway dashboard, go to your service
2. Click "Logs" tab
3. Look for:
   - Startup errors
   - Python errors (if using the Python telegram forwarder)
   - Database connection errors
   - Port binding errors

### 5. Verify Service Health Endpoint

Test if the service is accessible:

```bash
curl https://your-railway-service.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "telegram_running": true,
  "connected_clients": 0
}
```

If you get a 502, the service is definitely down.

## Common Causes

### Service Not Deployed
- The service might not be deployed yet
- Solution: Trigger a new deployment in Railway

### Service Crashed
- The service started but crashed
- Solution: Check logs, fix the error, and redeploy

### Environment Variables Missing
- Required env vars (like `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`) might be missing
- Solution: Check Railway service settings → Variables tab

### Port Mismatch
- Service might be listening on wrong port
- Solution: Railway sets `PORT` env var automatically, make sure your service uses it

### Database Connection Issues
- If the service can't connect to the database, it will crash
- Solution: Verify `DATABASE_URL` is correct in Railway variables

## Service Configuration Checklist

Make sure your Railway service has:

- ✅ `DATABASE_URL` - PostgreSQL connection string
- ✅ `TELEGRAM_BOT_TOKEN` - Your Telegram bot token
- ✅ `TELEGRAM_SOURCE_CHAT_ID` - Source chat ID
- ✅ `TELEGRAM_TARGET_GROUP_ID` - Target group ID (optional)
- ✅ `PORT` - Railway sets this automatically
- ✅ `RAILWAY_ENVIRONMENT` - Set to "production" (optional)

## Testing the Service Manually

1. **Test Health Endpoint:**
   ```bash
   curl https://nova-build-production.up.railway.app/health
   ```

2. **Test Status Endpoint:**
   ```bash
   curl https://nova-build-production.up.railway.app/status
   ```

3. **Test WebSocket (using wscat):**
   ```bash
   npm install -g wscat
   wscat -c wss://nova-build-production.up.railway.app/telegram-forwarder
   ```

## Next Steps

Once the Railway service is running:

1. Restart your Next.js dev server
2. Visit `http://localhost:3000/admin`
3. Check the Telegram Forwarder console
4. You should see "Connected to Railway telegram forwarder service"

## Still Having Issues?

1. Check Railway service logs for specific error messages
2. Verify all environment variables are set correctly
3. Try redeploying the service from scratch
4. Check if the Railway service code is up to date

