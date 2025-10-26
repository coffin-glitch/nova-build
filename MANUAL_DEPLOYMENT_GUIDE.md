# 🚀 Manual Railway Deployment Guide

## Step 1: Login to Railway

**Option A: Using Railway CLI (Recommended)**
```bash
# Open terminal and run:
npx @railway/cli login
# Follow the browser login process
```

**Option B: Using Railway Website**
1. Go to https://railway.app
2. Sign up/Login with GitHub
3. Create a new project

## Step 2: Deploy to Railway

**Option A: Using Railway CLI**
```bash
cd railway-service
npx @railway/cli up
```

**Option B: Using Railway Website**
1. Go to Railway dashboard
2. Click "New Project"
3. Choose "Deploy from GitHub repo"
4. Connect your GitHub account
5. Select your nova-build repository
6. Set root directory to `railway-service`

## Step 3: Set Environment Variables

In Railway dashboard, go to your project → Variables tab and add:

```
TELEGRAM_BOT_TOKEN=your_actual_bot_token
TELEGRAM_SOURCE_CHAT_ID=your_actual_source_chat_id  
TELEGRAM_TARGET_GROUP_ID=your_actual_target_group_id
DATABASE_URL=postgresql://postgres.rbiomzdrlmsexehrhowa:LVJPHzZbah5pW4Lp@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require
NODE_ENV=production
RAILWAY_ENVIRONMENT=production
PORT=3001
```

## Step 4: Get Railway URL

After deployment, Railway will give you a URL like:
`https://your-service-name.railway.app`

## Step 5: Deploy to Vercel

1. Go to https://vercel.com
2. Import your GitHub repository
3. Set environment variable:
   ```
   NEXT_PUBLIC_RAILWAY_URL=https://your-service-name.railway.app
   ```
4. Deploy

## Step 6: Test

1. Go to your Vercel URL: `https://your-app.vercel.app/admin`
2. Check if the Telegram Forwarder Console shows "Running"
3. Test the Start/Stop buttons

## 🎯 Quick Commands

```bash
# Test Railway service locally
cd railway-service
npm start

# Test health endpoint
curl http://localhost:3001/health

# Deploy to Railway (after login)
npx @railway/cli up
```

## 🔧 Troubleshooting

**If Railway deployment fails:**
1. Check Railway logs in dashboard
2. Verify all environment variables are set
3. Make sure Python dependencies are installed

**If WebSocket connection fails:**
1. Check Railway URL is correct
2. Verify environment variable in Vercel
3. Check Railway service is running

## 📊 Monitoring

- **Railway Dashboard**: Monitor logs and metrics
- **Vercel Dashboard**: Monitor frontend performance
- **Admin Panel**: Real-time telegram forwarder status
