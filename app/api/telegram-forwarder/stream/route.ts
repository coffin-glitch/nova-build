import { NextRequest } from "next/server";

// Import WebSocket client library
// In Node.js, we need the 'ws' package for WebSocket client
let WebSocket: any;
try {
  // Try to use ws package (required for Node.js)
  WebSocket = require('ws');
} catch {
  // ws package not installed
  console.error('WebSocket library not found. Please install: npm install ws');
  WebSocket = null;
}

/**
 * Server-Sent Events (SSE) endpoint for streaming Telegram forwarder logs and status
 * This connects to the Railway service WebSocket and streams data to the client
 */
export async function GET(request: NextRequest) {
  if (!WebSocket) {
    return new Response(
      JSON.stringify({ error: 'WebSocket library not available' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Set up SSE headers
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let ws: any = null;
      let reconnectTimeout: NodeJS.Timeout | null = null;
      let isClosing = false;

      const connectToRailway = async () => {
        if (isClosing) return;

        try {
          // Get Railway URL from environment
          const railwayUrl = process.env.RAILWAY_URL || process.env.NEXT_PUBLIC_RAILWAY_URL;
          
          if (!railwayUrl) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                message: 'Railway URL not configured. Please set RAILWAY_URL or NEXT_PUBLIC_RAILWAY_URL environment variable.'
              })}\n\n`)
            );
            return;
          }

          // Construct WebSocket URL
          // Railway URL should be like: https://your-service.railway.app
          // Convert to WebSocket URL: wss://your-service.railway.app/telegram-forwarder
          const wsProtocol = railwayUrl.startsWith('https://') ? 'wss://' : 'ws://';
          const wsHost = railwayUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
          const wsUrl = `${wsProtocol}${wsHost}/telegram-forwarder`;

          console.log(`[SSE] Connecting to Railway WebSocket: ${wsUrl}`);

          // Create WebSocket connection using ws package
          ws = new WebSocket(wsUrl);

          ws.onopen = () => {
            console.log('[SSE] Connected to Railway WebSocket');
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'log',
                level: 'success',
                message: 'Connected to Railway telegram forwarder service'
              })}\n\n`)
            );
          };

          ws.onmessage = (event) => {
            try {
              const data = event.data.toString();
              // Forward the message as-is to the client
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            } catch (error) {
              console.error('[SSE] Error processing WebSocket message:', error);
            }
          };

          ws.onerror = (error: any) => {
            console.error('[SSE] WebSocket error:', error);
            
            // Extract error message
            let errorMessage = 'WebSocket connection error';
            if (error?.error?.message) {
              errorMessage = error.error.message;
            } else if (error?.message) {
              errorMessage = error.message;
            }
            
            // Handle 502 Bad Gateway specifically
            if (errorMessage.includes('502') || errorMessage.includes('Bad Gateway')) {
              errorMessage = 'Railway service returned 502 Bad Gateway. The service may be down or crashed. Please check your Railway dashboard.';
            }
            
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                message: errorMessage,
                level: 'error'
              })}\n\n`)
            );
          };

          ws.onclose = (event) => {
            console.log(`[SSE] WebSocket closed: ${event.code} ${event.reason || 'No reason provided'}`);
            
            if (!isClosing) {
              // Handle different close codes
              let reconnectDelay = 5000;
              let message = 'Disconnected from Railway service. Reconnecting...';
              
              if (event.code === 1006) {
                // Abnormal closure - usually means 502 Bad Gateway
                message = 'Railway service returned 502 Bad Gateway. The service may still be deploying or is not running. Waiting before reconnect...';
                reconnectDelay = 10000; // Wait longer for deployment
              } else if (event.code === 1000) {
                // Normal closure
                message = 'Connection closed normally. Reconnecting...';
              } else if (event.code === 1001) {
                // Going away
                message = 'Railway service is going away (possibly redeploying). Reconnecting...';
                reconnectDelay = 10000;
              }
              
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'log',
                  level: 'warning',
                  message: message,
                  code: event.code,
                  reason: event.reason || 'No reason provided'
                })}\n\n`)
              );

              // Reconnect after delay
              reconnectTimeout = setTimeout(() => {
                connectToRailway();
              }, reconnectDelay);
            }
          };

        } catch (error: any) {
          console.error('[SSE] Error connecting to Railway:', error);
          
          let errorMessage = `Failed to connect: ${error.message}`;
          let reconnectDelay = 10000; // Wait longer if connection failed
          
          // Provide more helpful error messages
          if (error.message?.includes('502') || error.message?.includes('Bad Gateway')) {
            errorMessage = 'Railway service returned 502 Bad Gateway. The service may still be deploying. Please check Railway dashboard for deployment status. Will retry in 10 seconds...';
          } else if (error.message?.includes('ECONNREFUSED') || error.message?.includes('connection refused')) {
            errorMessage = 'Connection refused. Railway service is not running or not accessible. Please check Railway dashboard.';
          } else if (error.message?.includes('ENOTFOUND') || error.message?.includes('getaddrinfo')) {
            errorMessage = `Could not resolve Railway service URL. Please verify RAILWAY_URL is correct: ${railwayUrl}`;
            reconnectDelay = 30000; // Wait even longer for DNS issues
          }
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              message: errorMessage,
              level: 'error'
            })}\n\n`)
          );

          // Try to reconnect after error
          if (!isClosing) {
            reconnectTimeout = setTimeout(() => {
              connectToRailway();
            }, reconnectDelay);
          }
        }
      };

      // Start connection
      connectToRailway();

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        isClosing = true;
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        if (ws) {
          ws.close();
        }
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

