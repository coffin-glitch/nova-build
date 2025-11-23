import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";
import { WebSocketServer } from 'ws';

// Global WebSocket server instance
let wss: WebSocketServer | null = null;
let server: any = null;
let telegramProcess: any = null;

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication for telegram forwarder access
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin read operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'readOnly'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }
    
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
      
      logSecurityEvent('telegram_forwarder_status_accessed', userId);
      
      const responseObj = NextResponse.json(data);
      return addRateLimitHeaders(addSecurityHeaders(responseObj), rateLimit);
      
    } catch (fetchError: any) {
      console.error('Error fetching from Railway:', fetchError);
      
      logSecurityEvent('telegram_forwarder_connection_error', userId, { 
        error: fetchError.message || 'Connection error' 
      });
      
      // Handle timeout or connection errors
      if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
        const responseObj = NextResponse.json({
          error: 'Connection timeout',
          message: 'The Railway service did not respond in time. The service may be down or unreachable.',
          status: 'timeout',
          railwayUrl: baseUrl
        }, { status: 503 });
        return addSecurityHeaders(responseObj);
      }
      
      if (fetchError.code === 'ENOTFOUND' || fetchError.message?.includes('getaddrinfo')) {
        const responseObj = NextResponse.json({
          error: 'Service not found',
          message: `Could not resolve the Railway service URL: ${baseUrl}. Please verify the URL is correct.`,
          status: 'not_found',
          railwayUrl: baseUrl
        }, { status: 503 });
        return addSecurityHeaders(responseObj);
      }
      
      const responseObj = NextResponse.json({
        error: 'Failed to connect to Railway service',
        message: process.env.NODE_ENV === 'development' 
          ? (fetchError.message || 'Service unavailable')
          : 'Service unavailable',
        status: 'error',
        railwayUrl: baseUrl
      }, { status: 503 });
      
      return addSecurityHeaders(responseObj);
    }

  } catch (error: any) {
    console.error('Error getting telegram forwarder status:', error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('telegram_forwarder_status_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const responseObj = NextResponse.json(
      { 
        error: 'Failed to get status',
        message: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'Failed to get status'
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(responseObj);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication for telegram forwarder control
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;
    
    const { action } = await request.json();
    
    // Input validation
    const validation = validateInput(
      { action },
      {
        action: { required: true, type: 'string', enum: ['start', 'stop'] }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_telegram_forwarder_action', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }
    
    if (!action || !['start', 'stop'].includes(action)) {
      const response = NextResponse.json(
        { error: 'Invalid action. Must be "start" or "stop"' },
        { status: 400 }
      );
      return addSecurityHeaders(response);
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
      
      logSecurityEvent('telegram_forwarder_action', userId, { action });
      
      const responseObj = NextResponse.json(data);
      return addSecurityHeaders(responseObj);
      
    } catch (fetchError: any) {
      console.error('Error sending command to Railway:', fetchError);
      
      logSecurityEvent('telegram_forwarder_command_error', userId, { 
        action,
        error: fetchError.message || 'Service unavailable' 
      });
      
      const responseObj = NextResponse.json({
        error: 'Failed to send command to Railway service',
        message: process.env.NODE_ENV === 'development' 
          ? (fetchError.message || 'Service unavailable')
          : 'Service unavailable',
        railwayUrl: baseUrl
      }, { status: 503 });
      
      return addSecurityHeaders(responseObj);
    }

  } catch (error: any) {
    console.error('Error handling telegram forwarder action:', error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('telegram_forwarder_action_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const responseObj = NextResponse.json(
      { 
        error: 'Failed to handle action',
        message: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'Failed to handle action'
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(responseObj);
  }
}
