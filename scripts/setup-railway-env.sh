#!/bin/bash

# Script to help set up Railway URL environment variable

echo "🔧 Telegram Forwarder Setup Helper"
echo "=================================="
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local file..."
    touch .env.local
    echo "✅ Created .env.local"
    echo ""
fi

# Check if RAILWAY_URL is already set
if grep -q "RAILWAY_URL" .env.local; then
    echo "✅ RAILWAY_URL is already configured in .env.local"
    echo ""
    echo "Current value:"
    grep "RAILWAY_URL" .env.local
    echo ""
    echo "To update it, edit .env.local manually or run:"
    echo "  echo 'RAILWAY_URL=https://your-service.railway.app' >> .env.local"
else
    echo "⚠️  RAILWAY_URL is not configured yet"
    echo ""
    echo "Please add your Railway service URL to .env.local:"
    echo ""
    echo "  RAILWAY_URL=https://your-service-name.railway.app"
    echo ""
    echo "To find your Railway URL:"
    echo "  1. Go to Railway dashboard"
    echo "  2. Select your Telegram forwarder service"
    echo "  3. Go to Settings → Public Domain"
    echo "  4. Copy the URL"
    echo ""
    read -p "Do you want to add it now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your Railway service URL: " railway_url
        if [ ! -z "$railway_url" ]; then
            # Remove protocol if provided
            railway_url=$(echo "$railway_url" | sed 's|^https\?://||')
            echo "RAILWAY_URL=https://$railway_url" >> .env.local
            echo "✅ Added RAILWAY_URL to .env.local"
            echo ""
            echo "⚠️  Remember to restart your Next.js dev server!"
        else
            echo "❌ No URL provided"
        fi
    fi
fi

echo ""
echo "📋 Next steps:"
echo "  1. Make sure Railway service is running"
echo "  2. Restart your Next.js dev server: npm run dev"
echo "  3. Visit http://localhost:3000/admin"
echo "  4. Look for the Telegram Forwarder console (bottom right)"
echo ""

