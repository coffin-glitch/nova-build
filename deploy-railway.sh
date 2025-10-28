#!/bin/bash

# Railway deployment script for NOVA Telegram Forwarder

echo "🚀 Deploying NOVA Telegram Forwarder to Railway..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Login to Railway (if not already logged in)
echo "🔐 Checking Railway authentication..."
railway whoami || railway login

# Create new Railway project (if it doesn't exist)
echo "📦 Creating Railway project..."
railway project new nova-telegram-forwarder || echo "Project already exists"

# Set environment variables
echo "🔧 Setting environment variables..."
railway variables set NODE_ENV=production
railway variables set RAILWAY_ENVIRONMENT=production

# Copy telegram forwarder script to railway-service directory
echo "📋 Copying telegram forwarder script..."
cp scripts/telegram_bot_forwarder.py railway-service/scripts/

# Deploy to Railway
echo "🚀 Deploying to Railway..."
cd railway-service
railway up

echo "✅ Deployment complete!"
echo "🌐 Your Railway service URL will be displayed above"
echo "📝 Don't forget to set your environment variables in Railway dashboard:"
echo "   - TELEGRAM_BOT_TOKEN"
echo "   - TELEGRAM_SOURCE_CHAT_ID" 
echo "   - TELEGRAM_TARGET_GROUP_ID"
echo "   - DATABASE_URL"

