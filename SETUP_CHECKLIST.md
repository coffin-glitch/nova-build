# Telegram Forwarder Setup Checklist

## ✅ Step 1: Install WebSocket Library
**Status: COMPLETED**
- Installed `ws` package
- Installed `@types/ws` for TypeScript support

## 📝 Step 2: Configure Railway URL

You need to add your Railway service URL to your environment variables.

### Option A: Add to `.env.local` (Recommended)
Create or edit `.env.local` in the project root and add:

```bash
RAILWAY_URL=https://your-service-name.railway.app
```

**Replace `your-service-name.railway.app` with your actual Railway service URL.**

To find your Railway URL:
1. Go to your Railway dashboard
2. Select your Telegram forwarder service
3. Go to the "Settings" tab
4. Look for "Public Domain" or "Custom Domain"
5. Copy the URL (e.g., `telegram-forwarder-production.up.railway.app`)

### Option B: If you need it client-accessible
If you need the URL accessible from the browser (usually not needed), add:

```bash
NEXT_PUBLIC_RAILWAY_URL=https://your-service-name.railway.app
```

## ✅ Step 3: Verify Railway Service CORS

Check that your Railway service (`railway-service/server.js`) has CORS configured. It should include:

```javascript
app.use(cors({
  origin: [
    'http://localhost:3000',  // Local development
    'https://your-production-domain.com',  // Your production domain
  ],
  credentials: true
}));
```

## 🧪 Step 4: Test the Connection

1. **Restart your Next.js dev server** (important - environment variables are loaded on startup)
   ```bash
   # Stop the current server (Ctrl+C)
   # Then start it again
   npm run dev
   ```

2. **Navigate to the admin page**
   - Open: `http://localhost:3000/admin`
   - Look for the "Telegram Forwarder" console at the bottom right

3. **Expand the console**
   - Click the `+` button to expand the console
   - You should see:
     - Connection status
     - Real-time logs
     - Status metrics (forwarded count, parsed count, uptime)

4. **Test controls**
   - Try clicking "Start" or "Stop" buttons
   - Check if logs appear in real-time

## 🔍 Troubleshooting

### If you see "Railway URL not configured":
- Make sure you added `RAILWAY_URL` to `.env.local`
- Restart your Next.js dev server
- Check for typos in the environment variable name

### If you see "Failed to connect to Railway service":
- Verify your Railway service is running
- Check the Railway URL is correct
- Test the Railway service directly: `https://your-railway-url.railway.app/health`
- Check Railway service logs for errors

### If you see "WebSocket library not available":
- Run: `npm install ws --legacy-peer-deps`
- Restart your dev server

### If no logs appear:
- Check Railway service is running and processing messages
- Check browser console for errors
- Verify CORS is configured correctly on Railway service
- Status should still update every 5 seconds via polling

## 📋 Quick Reference

**Environment Variable:**
```bash
RAILWAY_URL=https://your-railway-service.railway.app
```

**Test Railway Service:**
```bash
curl https://your-railway-service.railway.app/health
```

**Next.js Admin Page:**
```
http://localhost:3000/admin
```

