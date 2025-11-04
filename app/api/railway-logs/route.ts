import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy endpoint to fetch Railway service logs
 * This helps debug what's happening on the Railway service
 */
export async function GET(request: NextRequest) {
  try {
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
        return NextResponse.json({
          status: 'online',
          service: data,
          message: 'Railway service is running. Check Railway dashboard logs for detailed output.',
          railwayUrl: baseUrl,
          logsUrl: `https://railway.app/project/[your-project]/service/[your-service]/logs`
        });
      } else {
        return NextResponse.json({
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
      }
    } catch (fetchError: any) {
      return NextResponse.json({
        status: 'offline',
        error: 'Connection refused',
        message: 'Railway service is not running or not accessible. The service needs to be started in Railway dashboard.',
        railwayUrl: baseUrl,
        errorDetails: fetchError.message,
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
    }

  } catch (error: any) {
    console.error('Error checking Railway service:', error);
    return NextResponse.json(
      { error: 'Failed to check Railway service', message: error.message },
      { status: 500 }
    );
  }
}

