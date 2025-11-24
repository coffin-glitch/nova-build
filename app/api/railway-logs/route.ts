import { addRateLimitHeaders, checkApiRateLimit } from "@/lib/api-rate-limiting";
import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy endpoint to fetch Railway service logs
 * This helps debug what's happening on the Railway service
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin authentication for Railway logs access
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
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }
    
    const railwayUrl = process.env.RAILWAY_URL || process.env.NEXT_PUBLIC_RAILWAY_URL;
    
    if (!railwayUrl) {
      return NextResponse.json({ 
        error: 'Railway URL not configured'
      }, { status: 500 });
    }

    const baseUrl = railwayUrl.startsWith('http://') || railwayUrl.startsWith('https://')
      ? railwayUrl
      : `https://${railwayUrl}`;

    // Try to get service info that might include logs endpoint
    // Note: Railway doesn't expose logs via HTTP API directly
    // But we can check if the service is responding
    
    const healthUrl = `${baseUrl}/health`;
    
    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        const data = await response.json();
        logSecurityEvent('railway_logs_accessed', userId, { status: 'online' });
        
        const responseObj = NextResponse.json({
          status: 'online',
          service: data,
          message: 'Railway service is running. Check Railway dashboard logs for detailed output.',
          railwayUrl: baseUrl,
          logsUrl: `https://railway.app/project/[your-project]/service/[your-service]/logs`
        });
        
        return addSecurityHeaders(responseObj);
      } else {
        logSecurityEvent('railway_logs_offline', userId, { httpStatus: response.status });
        
        const responseObj = NextResponse.json({
          status: 'offline',
          httpStatus: response.status,
          message: 'Railway service is not responding. Check Railway dashboard for deployment status and logs.',
          railwayUrl: baseUrl,
          troubleshooting: {
            checkDeployment: 'Go to Railway dashboard → Deployments tab',
            checkLogs: 'Go to Railway dashboard → Logs tab',
            checkService: 'Verify the service is running and listening on the correct port',
            commonIssues: [
              'Service may have crashed - check logs',
              'Port may not be configured correctly',
              'Environment variables may be missing',
              'Database connection may have failed'
            ]
          }
        }, { status: 503 });
        
        return addSecurityHeaders(responseObj);
      }
    } catch (fetchError: any) {
      logSecurityEvent('railway_logs_connection_error', userId, { 
        error: fetchError.message || 'Connection refused' 
      });
      
      const responseObj = NextResponse.json({
        status: 'offline',
        error: 'Connection refused',
        message: 'Railway service is not running or not accessible. The service needs to be started in Railway dashboard.',
        railwayUrl: baseUrl,
        errorDetails: process.env.NODE_ENV === 'development' ? fetchError.message : undefined,
        troubleshooting: {
          immediateActions: [
            '1. Go to Railway dashboard: https://railway.app',
            '2. Select your Telegram forwarder service',
            '3. Check the "Logs" tab to see what\'s happening',
            '4. Check the "Deployments" tab for failed deployments',
            '5. Try restarting/redeploying the service'
          ],
          checkServiceConfig: [
            'Verify PORT environment variable is set (Railway sets this automatically)',
            'Check that DATABASE_URL is configured',
            'Verify TELEGRAM_BOT_TOKEN is set',
            'Ensure all required environment variables are present'
          ]
        }
      }, { status: 503 });
      
      return addSecurityHeaders(responseObj);
    }

  } catch (error: any) {
    console.error('Error checking Railway service:', error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('railway_logs_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const responseObj = NextResponse.json(
      { 
        error: 'Failed to check Railway service',
        message: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'Failed to check Railway service'
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(responseObj);
  }
}

