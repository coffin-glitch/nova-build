const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Enable CORS for all routes
app.use(cors({
  origin: ['http://localhost:3000', 'https://nova-build.vercel.app'], // Add your Vercel domain
  credentials: true
}));

app.use(express.json());

// WebSocket server
const wss = new WebSocket.Server({ 
  server,
  path: '/telegram-forwarder'
});

// Store connected clients
const clients = new Set();
let telegramProcess = null;

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('Client connected to telegram forwarder WebSocket');
  clients.add(ws);

  // Send initial status
  ws.send(JSON.stringify({
    type: 'status',
    data: {
      connected: telegramProcess ? true : false,
      forwarded_count: 0,
      parsed_count: 0,
      last_bid_at: null,
      last_error: null,
      uptime: '0s',
      status: telegramProcess ? 'running' : 'stopped'
    }
  }));

  ws.on('close', () => {
    console.log('Client disconnected from telegram forwarder WebSocket');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Broadcast to all connected clients
function broadcast(message) {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Start telegram forwarder process
function startTelegramForwarder() {
  if (telegramProcess) {
    console.log('Telegram forwarder already running');
    return;
  }

  console.log('Starting telegram forwarder...');
  
  // Use the telegram forwarder script from the current directory
  const scriptPath = path.join(__dirname, 'scripts', 'telegram_bot_forwarder.py');
  
  telegramProcess = spawn('python3', [scriptPath], {
    cwd: __dirname,
    env: { 
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL
    }
  });

  telegramProcess.stdout.on('data', (data) => {
    const message = data.toString().trim();
    console.log('Telegram forwarder:', message);
    
    broadcast({
      type: 'log',
      level: 'info',
      message: message
    });
  });

  telegramProcess.stderr.on('data', (data) => {
    const message = data.toString().trim();
    console.error('Telegram forwarder error:', message);
    
    broadcast({
      type: 'log',
      level: 'error',
      message: message
    });
  });

  telegramProcess.on('close', (code) => {
    console.log(`Telegram forwarder process exited with code ${code}`);
    telegramProcess = null;
    
    broadcast({
      type: 'log',
      level: 'warning',
      message: `Process exited with code ${code}`
    });

    broadcast({
      type: 'status',
      data: {
        connected: false,
        forwarded_count: 0,
        parsed_count: 0,
        last_bid_at: null,
        last_error: null,
        uptime: '0s',
        status: 'stopped'
      }
    });
  });

  // Send running status
  broadcast({
    type: 'status',
    data: {
      connected: true,
      forwarded_count: 0,
      parsed_count: 0,
      last_bid_at: null,
      last_error: null,
      uptime: '0s',
      status: 'running'
    }
  });
}

// Stop telegram forwarder process
function stopTelegramForwarder() {
  if (telegramProcess) {
    console.log('Stopping telegram forwarder...');
    telegramProcess.kill();
    telegramProcess = null;
    
    broadcast({
      type: 'status',
      data: {
        connected: false,
        forwarded_count: 0,
        parsed_count: 0,
        last_bid_at: null,
        last_error: null,
        uptime: '0s',
        status: 'stopped'
      }
    });
  }
}

// REST API endpoints
app.get('/health', (req, res) => {
  console.log(`[HEALTH] Health check requested from ${req.ip} at ${new Date().toISOString()}`);
  res.json({ 
    status: 'healthy',
    telegram_running: telegramProcess ? true : false,
    connected_clients: clients.size,
    port: process.env.PORT || 3001,
    host: process.env.HOST || '0.0.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/status', (req, res) => {
  console.log(`[STATUS] Status check requested from ${req.ip}`);
  res.json({ 
    status: telegramProcess ? 'running' : 'stopped',
    connected_clients: clients.size,
    port: process.env.PORT || 3001,
    host: process.env.HOST || '0.0.0.0',
    timestamp: new Date().toISOString()
  });
});

app.post('/telegram-forwarder', (req, res) => {
  try {
    const { action } = req.body;
    
    if (action === 'start') {
      startTelegramForwarder();
      res.json({ 
        status: 'started',
        message: 'Telegram forwarder process started'
      });
    } else if (action === 'stop') {
      stopTelegramForwarder();
      res.json({ 
        status: 'stopped',
        message: 'Telegram forwarder process stopped'
      });
    } else {
      res.status(400).json({ 
        status: 'unknown',
        message: 'Unknown action'
      });
    }
  } catch (error) {
    console.error('Error handling telegram forwarder action:', error);
    res.status(500).json({ 
      error: 'Failed to handle action'
    });
  }
});

// Start the server
// Railway sets PORT env var automatically, but we need to bind to 0.0.0.0
// so Railway's reverse proxy can reach us
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0'; // Bind to all interfaces for Railway

server.listen(PORT, HOST, () => {
  console.log(`✅ Telegram forwarder service running on ${HOST}:${PORT}`);
  console.log(`✅ HTTP server available at http://${HOST}:${PORT}`);
  console.log(`✅ WebSocket server available at ws://${HOST}:${PORT}/telegram-forwarder`);
  console.log(`✅ Health check: http://${HOST}:${PORT}/health`);
  console.log(`✅ Status: http://${HOST}:${PORT}/status`);
  console.log(`✅ Environment: PORT=${PORT}, HOST=${HOST}, NODE_ENV=${process.env.NODE_ENV || 'development'}`);
  
  // Auto-start telegram forwarder on Railway
  if (process.env.RAILWAY_ENVIRONMENT || process.env.PORT) {
    console.log('✅ Railway environment detected, auto-starting telegram forwarder...');
    setTimeout(startTelegramForwarder, 2000); // Wait 2 seconds for startup
  }
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else if (error.code === 'EACCES') {
    console.error(`❌ Permission denied to bind to port ${PORT}`);
  } else {
    console.error(`❌ Unknown server error: ${error.message}`);
  }
  process.exit(1);
});

// Verify server is actually listening
server.on('listening', () => {
  const addr = server.address();
  console.log(`✅ Server is listening on ${typeof addr === 'string' ? addr : `${addr.address}:${addr.port}`}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  stopTelegramForwarder();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  stopTelegramForwarder();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
