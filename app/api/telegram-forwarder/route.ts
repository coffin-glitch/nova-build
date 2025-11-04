import { NextRequest, NextResponse } from "next/server";
import { WebSocketServer } from 'ws';

// Global WebSocket server instance
let wss: WebSocketServer | null = null;
let server: any = null;
let telegramProcess: any = null;

export async function GET(request: NextRequest) {
  try {
    // Always proxy to Railway service (works in both dev and prod)
    const railwayUrl = process.env.RAILWAY_URL || process.env.NEXT_PUBLIC_RAILWAY_URL;
    
    if (!railwayUrl) {
      return NextResponse.json({ 
        error: 'Railway URL not configured',
        message: 'Please set RAILWAY_URL or NEXT_PUBLIC_RAILWAY_URL environment variable'
      }, { status: 500 });
    }

    // Construct the full URL (ensure it has protocol)
    const baseUrl = railwayUrl.startsWith('http://') || railwayUrl.startsWith('https://')
      ? railwayUrl
      : `https://${railwayUrl}`;
    
    const statusUrl = `${baseUrl}/status`;
    
    try {
      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timeout
        signal: AbortSignal.timeout(10000),
      });
      
      if (!response.ok) {
        // Handle specific error codes
        if (response.status === 502) {
          return NextResponse.json({
            error: 'Railway service unavailable',
            message: 'The Railway service returned a 502 Bad Gateway error. This usually means the service is not running or crashed. Please check your Railway dashboard.',
            status: 'offline',
            railwayUrl: baseUrl,
            troubleshooting: [
              'Check if the Railway service is running in your dashboard',
              'Check Railway service logs for errors',
              'Verify the service URL is correct',
              'Try restarting the Railway service'
            ]
          }, { status: 503 });
        }
        
        throw new Error(`Railway service returned ${response.status}`);
      }
      
      const data = await response.json();
      return NextResponse.json(data);
    } catch (fetchError: any) {
      console.error('Error fetching from Railway:', fetchError);
      
      // Handle timeout or connection errors
      if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
        return NextResponse.json({
          error: 'Connection timeout',
          message: 'The Railway service did not respond in time. The service may be down or unreachable.',
          status: 'timeout',
          railwayUrl: baseUrl
        }, { status: 503 });
      }
      
      if (fetchError.code === 'ENOTFOUND' || fetchError.message?.includes('getaddrinfo')) {
        return NextResponse.json({
          error: 'Service not found',
          message: `Could not resolve the Railway service URL: ${baseUrl}. Please verify the URL is correct.`,
          status: 'not_found',
          railwayUrl: baseUrl
        }, { status: 503 });
      }
      
      return NextResponse.json({
        error: 'Failed to connect to Railway service',
        message: fetchError.message || 'Service unavailable',
        status: 'error',
        railwayUrl: baseUrl
      }, { status: 503 });
    }

  } catch (error: any) {
    console.error('Error getting telegram forwarder status:', error);
    return NextResponse.json(
      { error: 'Failed to get status', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    if (!action || !['start', 'stop'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "start" or "stop"' },
        { status: 400 }
      );
    }

    // Always proxy to Railway service
    const railwayUrl = process.env.RAILWAY_URL || process.env.NEXT_PUBLIC_RAILWAY_URL;
    
    if (!railwayUrl) {
      return NextResponse.json({ 
        error: 'Railway URL not configured',
        message: 'Please set RAILWAY_URL or NEXT_PUBLIC_RAILWAY_URL environment variable'
      }, { status: 500 });
    }

    // Construct the full URL (ensure it has protocol)
    const baseUrl = railwayUrl.startsWith('http://') || railwayUrl.startsWith('https://')
      ? railwayUrl
      : `https://${railwayUrl}`;
    
    const forwarderUrl = `${baseUrl}/telegram-forwarder`;
    
    try {
      const response = await fetch(forwarderUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
        // Add timeout
        signal: AbortSignal.timeout(10000),
      });
      
      if (!response.ok) {
        throw new Error(`Railway service returned ${response.status}`);
      }
      
      const data = await response.json();
      return NextResponse.json(data);
    } catch (fetchError: any) {
      console.error('Error sending command to Railway:', fetchError);
      return NextResponse.json({
        error: 'Failed to send command to Railway service',
        message: fetchError.message || 'Service unavailable',
        railwayUrl: baseUrl
      }, { status: 503 });
    }

  } catch (error: any) {
    console.error('Error handling telegram forwarder action:', error);
    return NextResponse.json(
      { error: 'Failed to handle action', message: error.message },
      { status: 500 }
    );
  }
}
