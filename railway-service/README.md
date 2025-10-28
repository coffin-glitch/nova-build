# NOVA Telegram Forwarder Service

This service runs the Telegram forwarder and provides a WebSocket server for real-time communication with the Next.js frontend.

## Features

- 🚀 Telegram bot forwarder with PostgreSQL integration
- 🔌 WebSocket server for real-time updates
- 📊 Health monitoring and status endpoints
- 🛡️ Graceful shutdown handling
- 🔄 Auto-restart on failure

## Environment Variables

Required environment variables:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_SOURCE_CHAT_ID=your_source_chat_id
TELEGRAM_TARGET_GROUP_ID=your_target_group_id

# Database Configuration
DATABASE_URL=postgresql://user:password@host:port/database

# Railway Configuration
RAILWAY_ENVIRONMENT=production
PORT=3001
```

## API Endpoints

### Health Check
```
GET /health
```

### Status
```
GET /status
```

### Control Telegram Forwarder
```
POST /telegram-forwarder
Content-Type: application/json

{
  "action": "start" | "stop"
}
```

## WebSocket Connection

Connect to the WebSocket server at:
```
ws://your-railway-domain/telegram-forwarder
```

### Message Types

#### Status Updates
```json
{
  "type": "status",
  "data": {
    "connected": boolean,
    "forwarded_count": number,
    "parsed_count": number,
    "last_bid_at": string,
    "last_error": string | null,
    "uptime": string,
    "status": "running" | "stopped"
  }
}
```

#### Log Messages
```json
{
  "type": "log",
  "level": "info" | "warning" | "error",
  "message": string
}
```

## Deployment

This service is designed to be deployed on Railway. It will automatically:

1. Start the WebSocket server
2. Auto-start the Telegram forwarder
3. Handle graceful shutdowns
4. Restart on failures

## Local Development

```bash
# Install dependencies
npm install

# Install Python dependencies
pip3 install -r requirements.txt

# Start development server
npm run dev
```

## Monitoring

The service provides health checks and status endpoints for monitoring:

- Health endpoint: `/health`
- Status endpoint: `/status`
- WebSocket client count tracking
- Process monitoring

