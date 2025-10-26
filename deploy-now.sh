#!/bin/bash

echo "🚀 NOVA Telegram Forwarder - Railway Deployment"
echo "================================================"

# Check if we're in the right directory
if [ ! -f "railway-service/server.js" ]; then
    echo "❌ Error: Please run this script from the nova-build root directory"
    exit 1
fi

echo "✅ Railway service files found"

# Check if Railway CLI is available
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx not found. Please install Node.js"
    exit 1
fi

echo "✅ npx available"

# Test Railway CLI
echo "🔍 Testing Railway CLI..."
if npx @railway/cli --version &> /dev/null; then
    echo "✅ Railway CLI available"
else
    echo "❌ Railway CLI not available. Installing..."
    npm install -g @railway/cli
fi

echo ""
echo "🎯 Ready to deploy!"
echo ""
echo "Next steps:"
echo "1. Run: npx @railway/cli login"
echo "2. Follow the browser login process"
echo "3. Run: cd railway-service && npx @railway/cli up"
echo "4. Set environment variables in Railway dashboard"
echo "5. Deploy to Vercel with Railway URL"
echo ""
echo "📖 See MANUAL_DEPLOYMENT_GUIDE.md for detailed instructions"
echo ""
echo "🔧 Test locally first:"
echo "   cd railway-service && npm start"
echo "   curl http://localhost:3001/health"
