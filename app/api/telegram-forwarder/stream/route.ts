import { NextRequest } from "next/server";

// Import WebSocket client library
let WebSocket: any;
try {
  WebSocket = require('ws');
} catch {
  console.error('WebSocket library not found. Please install: npm install ws');
  WebSocket = null;
}

/**
 * Server-Sent Events (SSE) endpoint for streaming Telegram forwarder logs and status
 * This connects to the Railway service WebSocket and streams data to the client
 * 
 * Best practices:
 * - Send heartbeat every 30 seconds to keep connection alive
 * - Handle reconnection automatically
 * - Provide clear error messages
 * - Stream JSON messages in SSE format
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
  let heartbeatInterval: NodeJS.Timeout | null = null;
  let ws: any = null;
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let isClosing = false;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 10;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({
          type: 'system',
          level: 'info',
          message: 'Initializing connection to Railway service...'
        })}\n\n`)
      );

      const connectToRailway = async () => {
        if (isClosing) return;

        try {
          // Get Railway URL from environment
          const railwayUrl = process.env.RAILWAY_URL || process.env.NEXT_PUBLIC_RAILWAY_URL;
          
          if (!railwayUrl) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                level: 'error',
                message: 'Railway URL not configured. Please set RAILWAY_URL or NEXT_PUBLIC_RAILWAY_URL environment variable.'
              })}\n\n`)
            );
            return;
          }

          // Construct WebSocket URL
          const wsProtocol = railwayUrl.startsWith('https://') ? 'wss://' : 'ws://';
          const wsHost = railwayUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
          const wsUrl = `${wsProtocol}${wsHost}/telegram-forwarder`;

          console.log(`[SSE] Connecting to Railway WebSocket: ${wsUrl} (attempt ${reconnectAttempts + 1})`);

          // Create WebSocket connection
          ws = new WebSocket(wsUrl, {
            // Add timeout for connection
            handshakeTimeout: 10000,
          });

          ws.onopen = () => {
            console.log('[SSE] Connected to Railway WebSocket');
            reconnectAttempts = 0; // Reset on successful connection
            
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'system',
                level: 'success',
                message: 'Connected to Railway telegram forwarder service'
              })}\n\n`)
            );

            // Start heartbeat to keep connection alive
            heartbeatInterval = setInterval(() => {
              if (ws && ws.readyState === WebSocket.OPEN) {
                try {
                  // Send ping to keep connection alive
                  ws.ping();
                } catch (error) {
                  console.error('[SSE] Heartbeat ping error:', error);
                }
              }
            }, 30000); // Every 30 seconds
          };

          ws.onmessage = (event: any) => {
            try {
              const data = event.data.toString();
              
              // Try to parse as JSON first
              try {
                const jsonData = JSON.parse(data);
                // Forward the message as-is
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(jsonData)}\n\n`)
                );
              } catch {
                // If not JSON, wrap it as a log message
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: 'log',
                    level: 'info',
                    message: data
                  })}\n\n`)
                );
              }
            } catch (error) {
              console.error('[SSE] Error processing WebSocket message:', error);
            }
          };

          ws.onerror = (error: any) => {
            console.error('[SSE] WebSocket error:', error);
            
            let errorMessage = 'WebSocket connection error';
            if (error?.error?.message) {
              errorMessage = error.error.message;
            } else if (error?.message) {
              errorMessage = error.message;
            } else if (typeof error === 'string') {
              errorMessage = error;
            }
            
            // Handle specific error types
            if (errorMessage.includes('502') || errorMessage.includes('Bad Gateway')) {
              errorMessage = 'Railway service returned 502 Bad Gateway. The service may be down or crashed.';
            } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connection refused')) {
              errorMessage = 'Connection refused. Railway service is not running or not accessible.';
            }
            
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                level: 'error',
                message: errorMessage
              })}\n\n`)
            );
          };

          ws.onclose = (event: any) => {
            console.log(`[SSE] WebSocket closed: ${event.code} ${event.reason || 'No reason provided'}`);
            
            // Clear heartbeat
            if (heartbeatInterval) {
              clearInterval(heartbeatInterval);
              heartbeatInterval = null;
            }
            
            if (!isClosing) {
              reconnectAttempts++;
              
              // Handle different close codes
              let reconnectDelay = 3000;
              let message = 'Disconnected from Railway service.';
              
              if (event.code === 1006) {
                message = 'Connection lost (abnormal closure). Railway service may be down.';
                reconnectDelay = 5000;
              } else if (event.code === 1000) {
                message = 'Connection closed normally.';
                reconnectDelay = 3000;
              } else if (event.code === 1001) {
                message = 'Railway service is going away (possibly redeploying).';
                reconnectDelay = 10000;
              } else if (event.code === 1002) {
                message = 'Protocol error. Check Railway service configuration.';
                reconnectDelay = 5000;
              } else if (event.code === 1003) {
                message = 'Unsupported data type. Railway service may have incompatible version.';
                reconnectDelay = 5000;
              }
              
              if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                message += ` Reconnecting in ${reconnectDelay / 1000}s... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`;
                
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: 'system',
                    level: 'warning',
                    message: message
                  })}\n\n`)
                );

                reconnectTimeout = setTimeout(() => {
                  connectToRailway();
                }, reconnectDelay);
              } else {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: 'error',
                    level: 'error',
                    message: `Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Please check Railway service manually.`
                  })}\n\n`)
                );
              }
            }
          };

          ws.on('ping', () => {
            // Respond to ping with pong
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.pong();
            }
          });

        } catch (error: any) {
          console.error('[SSE] Error connecting to Railway:', error);
          
          reconnectAttempts++;
          let errorMessage = `Failed to connect: ${error.message || 'Unknown error'}`;
          let reconnectDelay = 5000;
          
          if (error.message?.includes('502') || error.message?.includes('Bad Gateway')) {
            errorMessage = 'Railway service returned 502 Bad Gateway. The service may still be deploying.';
            reconnectDelay = 10000;
          } else if (error.message?.includes('ECONNREFUSED') || error.message?.includes('connection refused')) {
            errorMessage = 'Connection refused. Railway service is not running or not accessible.';
            reconnectDelay = 5000;
          } else if (error.message?.includes('ENOTFOUND') || error.message?.includes('getaddrinfo')) {
            errorMessage = `Could not resolve Railway service URL. Please verify RAILWAY_URL is correct.`;
            reconnectDelay = 30000;
          }
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              level: 'error',
              message: errorMessage
            })}\n\n`)
          );

          // Try to reconnect after error
          if (!isClosing && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectTimeout = setTimeout(() => {
              connectToRailway();
            }, reconnectDelay);
          }
        }
      };

      // Start initial connection
      connectToRailway();

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        console.log('[SSE] Client disconnected, cleaning up...');
        isClosing = true;
        
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        if (ws) {
          try {
            ws.close();
          } catch (error) {
            console.error('[SSE] Error closing WebSocket:', error);
          }
        }
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
    },
  });
}
