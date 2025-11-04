# Telegram Forwarder Console Setup Guide

This guide explains how to connect the TelegramForwarderConsole on the admin page to display logs and status from the Railway service.

## Architecture

The setup uses a **proxy pattern** where:
1. The Railway service runs the Telegram forwarder and exposes a WebSocket server
2. The Next.js app creates an SSE (Server-Sent Events) endpoint that connects to Railway's WebSocket
3. The frontend component connects to the SSE endpoint to receive real-time updates

```
Railway Service (WebSocket) → Next.js API Route (SSE) → Frontend Component
```

## Setup Steps

### 1. Get Your Railway Service URL

First, you need your Railway service URL. This should be something like:
- `https://your-service-name.railway.app`
- Or just `your-service-name.railway.app`

### 2. Configure Environment Variables

Add the Railway URL to your environment variables:

**Option A: Server-side only (recommended)**
```bash
# .env.local or .env
RAILWAY_URL=https://your-service-name.railway.app
```

**Option B: Client-accessible (if needed)**
```bash
# .env.local
NEXT_PUBLIC_RAILWAY_URL=https://your-service-name.railway.app
```

### 3. Install WebSocket Library (if needed)

The Next.js API route needs a WebSocket client library to connect to Railway. Install it:

```bash
npm install ws
npm install --save-dev @types/ws
```

### 4. Railway Service Configuration

Make sure your Railway service (`railway-service/server.js`) has CORS enabled for your Next.js domain:

```javascript
app.use(cors({
  origin: [
    'http://localhost:3000',  // Local development
    'https://your-vercel-domain.vercel.app',  // Your production domain
  ],
  credentials: true
}));
```

### 5. Test the Connection

1. Start your Next.js dev server: `npm run dev`
2. Navigate to `http://localhost:3000/admin`
3. Look for the Telegram Forwarder Console at the bottom right
4. Click the `+` button to expand it
5. You should see connection status and logs

## How It Works

### API Routes

1. **`/api/telegram-forwarder`** (GET)
   - Fetches status from Railway service
   - Used for polling/fallback status updates

2. **`/api/telegram-forwarder`** (POST)
   - Sends start/stop commands to Railway service
   - Proxies the request to Railway's `/telegram-forwarder` endpoint

3. **`/api/telegram-forwarder/stream`** (GET)
   - Creates an SSE stream that connects to Railway's WebSocket
   - Bridges WebSocket (Railway) → SSE (Next.js) → EventSource (Frontend)
   - Handles reconnection automatically

### Frontend Component

The `TelegramForwarderConsole` component:
- Connects to `/api/telegram-forwarder/stream` via EventSource
- Receives real-time logs and status updates
- Polls `/api/telegram-forwarder` every 5 seconds as a fallback
- Displays status, logs, and control buttons

## Troubleshooting

### "Railway URL not configured" Error

- Check that `RAILWAY_URL` or `NEXT_PUBLIC_RAILWAY_URL` is set in your environment
- Restart your Next.js dev server after adding environment variables

### "Failed to connect to Railway service" Error

- Verify your Railway service is running and accessible
- Check that the Railway URL is correct (try accessing `https://your-service.railway.app/health` in a browser)
- Ensure CORS is configured on the Railway service to allow your Next.js domain

### "WebSocket library not available" Error

- Run: `npm install ws`
- Restart your Next.js dev server

### No Logs Appearing

- Check Railway service logs to see if it's running
- Verify the WebSocket path is correct (`/telegram-forwarder`)
- Check browser console for connection errors
- Try the fallback polling mechanism (status should still update every 5 seconds)

### Connection Keeps Dropping

- Check Railway service health: `https://your-service.railway.app/health`
- Verify the service isn't restarting frequently
- Check Railway service logs for errors

## Railway Service Endpoints

Your Railway service should expose:

- `GET /health` - Health check
- `GET /status` - Service status
- `POST /telegram-forwarder` - Start/stop commands
- `WS /telegram-forwarder` - WebSocket for real-time updates

## Example Railway Service Response

**Status endpoint** (`GET /status`):
```json
{
  "status": "running",
  "connected_clients": 1
}
```

**WebSocket messages**:
```json
{
  "type": "status",
  "data": {
    "connected": true,
    "forwarded_count": 1234,
    "parsed_count": 1230,
    "last_bid_at": "2025-11-04T20:00:00Z",
    "last_error": null,
    "uptime": "2h 15m",
    "status": "running"
  }
}
```

```json
{
  "type": "log",
  "level": "info",
  "message": "New bid received: 84614390"
}
```

## Security Considerations

- The Railway URL should be kept in server-side environment variables when possible
- If using `NEXT_PUBLIC_RAILWAY_URL`, it will be exposed to the client
- Consider adding authentication to the Railway service endpoints
- Use HTTPS/WSS for production connections

## Next Steps

1. Set up your Railway service URL
2. Install the `ws` package
3. Test the connection
4. Monitor logs and status in the admin console

