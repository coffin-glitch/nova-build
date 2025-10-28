# 🚀 Railway + Vercel Deployment Guide

## Overview

This setup creates a hybrid deployment:
- **Vercel**: Next.js frontend + API routes (fast, reliable)
- **Railway**: Telegram forwarder + WebSocket server (persistent processes)

## 📁 Project Structure

```
nova-build/
├── railway-service/           # Railway deployment
│   ├── server.js             # WebSocket server + Express API
│   ├── package.json          # Node.js dependencies
│   ├── requirements.txt      # Python dependencies
│   ├── Dockerfile           # Container configuration
│   ├── railway.toml         # Railway configuration
│   └── README.md            # Service documentation
├── app/                     # Next.js app (deploys to Vercel)
├── scripts/
│   └── telegram_bot_forwarder.py
└── deploy-railway.sh        # Deployment script
```

## 🚀 Deployment Steps

### Step 1: Deploy to Railway

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Run deployment script**:
   ```bash
   ./deploy-railway.sh
   ```

4. **Set Environment Variables in Railway Dashboard**:
   - Go to your Railway project dashboard
   - Navigate to Variables tab
   - Add these variables:
     ```
     TELEGRAM_BOT_TOKEN=your_bot_token
     TELEGRAM_SOURCE_CHAT_ID=your_source_chat_id
     TELEGRAM_TARGET_GROUP_ID=your_target_group_id
     DATABASE_URL=postgresql://postgres.rbiomzdrlmsexehrhowa:LVJPHzZbah5pW4Lp@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require
     NODE_ENV=production
     RAILWAY_ENVIRONMENT=production
     PORT=3001
     ```

### Step 2: Deploy to Vercel

1. **Set Environment Variables in Vercel**:
   - Go to your Vercel project dashboard
   - Navigate to Settings > Environment Variables
   - Add:
     ```
     NEXT_PUBLIC_RAILWAY_URL=your-railway-url.railway.app
     ```

2. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

## 🔧 How It Works

### Railway Service (railway-service/)
- **WebSocket Server**: Handles real-time connections
- **Express API**: REST endpoints for control
- **Telegram Forwarder**: Python script for parsing bids
- **Auto-start**: Automatically starts telegram forwarder on Railway

### Next.js App (Vercel)
- **Frontend**: Admin dashboard with live console
- **API Routes**: Proxy requests to Railway service
- **WebSocket Client**: Connects to Railway WebSocket server

### Communication Flow
```
┌─────────────────┐    HTTP/WebSocket    ┌─────────────────┐
│   Vercel        │◄──────────────────►│   Railway       │
│   (Next.js)     │                     │   (Telegram Bot)│
│                 │                     │                 │
│ - Admin Panel   │                     │ - WebSocket     │
│ - WebSocket     │                     │ - Telegram Bot  │
│   Client        │                     │ - Database      │
└─────────────────┘                     └─────────────────┘
```

## 🌐 URLs

- **Vercel App**: `https://your-app.vercel.app`
- **Railway Service**: `https://your-service.railway.app`
- **WebSocket**: `wss://your-service.railway.app/telegram-forwarder`

## 🔍 Testing

1. **Test Railway Service**:
   ```bash
   curl https://your-service.railway.app/health
   ```

2. **Test WebSocket Connection**:
   - Open browser dev tools
   - Navigate to admin dashboard
   - Check console for WebSocket connection

3. **Test Telegram Forwarder**:
   - Use admin dashboard controls
   - Check Railway logs for telegram forwarder output

## 📊 Monitoring

### Railway Dashboard
- View logs and metrics
- Monitor resource usage
- Check deployment status

### Vercel Dashboard
- View build logs
- Monitor performance
- Check function invocations

## 🛠️ Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**:
   - Check Railway URL is correct
   - Verify environment variables
   - Check Railway service is running

2. **Telegram Forwarder Not Starting**:
   - Check Python dependencies
   - Verify environment variables
   - Check Railway logs

3. **Database Connection Issues**:
   - Verify DATABASE_URL format
   - Check Supabase connection
   - Verify SSL settings

### Debug Commands

```bash
# Check Railway service status
curl https://your-service.railway.app/health

# Check Railway logs
railway logs

# Test WebSocket connection
wscat -c wss://your-service.railway.app/telegram-forwarder
```

## 🔄 Updates

### Update Railway Service
```bash
cd railway-service
railway up
```

### Update Vercel App
```bash
vercel --prod
```

## 💰 Costs

- **Railway**: Free tier available (500 hours/month)
- **Vercel**: Free tier available (100GB bandwidth/month)
- **Supabase**: Free tier available (500MB database)

## 🎯 Benefits

✅ **Reliability**: Railway keeps telegram forwarder running 24/7
✅ **Performance**: Vercel provides fast frontend delivery
✅ **Scalability**: Both services auto-scale
✅ **Cost-effective**: Free tiers available
✅ **Separation of concerns**: Frontend and backend are independent
✅ **Easy deployment**: Simple CLI commands
✅ **Monitoring**: Built-in dashboards for both services

