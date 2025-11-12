# Nova Notification Worker

This is the notification worker process that processes jobs from the Redis queue.

## Railway Deployment

### Setup Steps

1. **Create New Service in Railway**
   - Go to your Railway project
   - Click "New" → "GitHub Repo" or "Empty Service"
   - Select this directory or the main repo

2. **Configure Environment Variables**
   Add these in Railway dashboard:
   ```
   REDIS_URL=rediss://default:YOUR_PASSWORD@active-penguin-36152.upstash.io:6379
   DATABASE_URL=your_postgres_connection_string
   NODE_ENV=production
   ```

3. **Set Root Directory** (if deploying from main repo)
   - In Railway service settings
   - Set "Root Directory" to: `railway-worker`
   - Or deploy from root and adjust paths

4. **Deploy**
   - Railway will auto-detect and deploy
   - Worker will start processing jobs automatically

### Monitoring

- Check Railway logs for worker activity
- Monitor Redis queue stats via API
- Set up alerts for worker failures

### Scaling

- Railway can auto-scale based on load
- Or manually increase instances if needed
- Each instance processes jobs concurrently

