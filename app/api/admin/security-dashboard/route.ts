import { addRateLimitHeaders, checkApiRateLimit } from "@/lib/api-rate-limiting";
import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { securityMonitor } from "@/lib/security-monitoring";
import { NextRequest, NextResponse } from "next/server";

/**
 * Security Dashboard API
 * Provides comprehensive security monitoring data for admin users
 */

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication (Supabase-only)
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

    // Get security dashboard data
    const dashboardData = securityMonitor.getDashboardData();
    
    // Get recent security events
    const recentEvents = securityMonitor.getEvents(50);
    
    // Get active alerts
    const activeAlerts = securityMonitor.getAlerts(20).filter(alert => !alert.acknowledged);
    
    // Get suspicious IPs
    const suspiciousIPs = securityMonitor.getSuspiciousIPs();
    
    // Get rate limit violation statistics
    const rateLimitEvents = recentEvents.filter(event => 
      event.eventType === 'rate_limit_exceeded' || event.eventType === 'rate_limit_exceeded_ip'
    );
    
    const rateLimitStats = {
      totalViolations: rateLimitEvents.length,
      violationsLast24h: rateLimitEvents.filter(event => 
        new Date(event.timestamp).getTime() > Date.now() - 86400000
      ).length,
      violationsLastHour: rateLimitEvents.filter(event => 
        new Date(event.timestamp).getTime() > Date.now() - 3600000
      ).length,
      topViolatingIPs: Object.entries(
        rateLimitEvents.reduce((acc: Record<string, number>, event) => {
          const ip = event.ip || 'unknown';
          acc[ip] = (acc[ip] || 0) + 1;
          return acc;
        }, {})
      )
        .map(([ip, count]) => ({ ip, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      topViolatingRoutes: Object.entries(
        rateLimitEvents.reduce((acc: Record<string, number>, event) => {
          const path = (event.details as any)?.path || 'unknown';
          acc[path] = (acc[path] || 0) + 1;
          return acc;
        }, {})
      )
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      violationsByType: Object.entries(
        rateLimitEvents.reduce((acc: Record<string, number>, event) => {
          const type = event.eventType;
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {})
      )
        .map(([type, count]) => ({ type, count }))
    };
    
    // Calculate security metrics
    const metrics = {
      totalEvents: dashboardData.totalEvents,
      totalAlerts: dashboardData.totalAlerts,
      criticalAlerts: activeAlerts.filter(alert => alert.severity === 'CRITICAL').length,
      highAlerts: activeAlerts.filter(alert => alert.severity === 'HIGH').length,
      mediumAlerts: activeAlerts.filter(alert => alert.severity === 'MEDIUM').length,
      lowAlerts: activeAlerts.filter(alert => alert.severity === 'LOW').length,
      suspiciousIPs: Object.keys(suspiciousIPs).length,
      blockedIPs: Object.values(suspiciousIPs).filter((ip: any) => ip.blocked).length,
      eventsLast24h: recentEvents.filter(event => 
        new Date(event.timestamp).getTime() > Date.now() - 86400000
      ).length,
      eventsLastHour: recentEvents.filter(event => 
        new Date(event.timestamp).getTime() > Date.now() - 3600000
      ).length,
      rateLimitViolations: rateLimitStats.totalViolations,
      rateLimitViolationsLast24h: rateLimitStats.violationsLast24h,
      rateLimitViolationsLastHour: rateLimitStats.violationsLastHour
    };

    // Get event type distribution
    const eventTypeDistribution = Object.entries(dashboardData.eventCounts)
      .map(([type, count]) => ({ type, count: Number(count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get severity distribution
    const severityDistribution = Object.entries(dashboardData.severityCounts)
      .map(([severity, count]) => ({ severity, count }));

    // Get recent activity timeline
    const activityTimeline = recentEvents
      .slice(0, 20)
      .map(event => ({
        id: event.id,
        timestamp: event.timestamp,
        eventType: event.eventType,
        severity: event.severity,
        userId: event.userId,
        ip: event.ip,
        path: event.path,
        details: event.details
      }));

    logSecurityEvent('security_dashboard_accessed', userId);
    
    const response = NextResponse.json({
      success: true,
      data: {
        metrics,
        eventTypeDistribution,
        severityDistribution,
        activityTimeline,
        suspiciousIPs: Object.entries(suspiciousIPs).map(([ip, data]) => ({
          ip,
          ...data
        })),
        activeAlerts: activeAlerts.map(alert => ({
          id: alert.id,
          alertType: alert.alertType,
          severity: alert.severity,
          message: alert.message,
          timestamp: alert.timestamp,
          eventId: alert.eventId
        })),
        rateLimitStats
      }
    });

    return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);

  } catch (error: any) {
    console.error("Security dashboard API error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('security_dashboard_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch security data",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    return addSecurityHeaders(response, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const body = await request.json();
    const { action, alertId, incidentId, ip, reason } = body;

    // Input validation
    const validation = validateInput(
      { action, alertId, incidentId, ip, reason },
      {
        action: { required: true, type: 'string', enum: ['acknowledge_alert', 'create_incident', 'block_ip'] },
        alertId: { type: 'string', maxLength: 200, required: false },
        incidentId: { type: 'string', maxLength: 200, required: false },
        ip: { type: 'string', maxLength: 50, required: false },
        reason: { type: 'string', maxLength: 500, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_security_dashboard_action', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { success: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    switch (action) {
      case 'acknowledge_alert':
        if (!alertId) {
          const response = NextResponse.json(
            { success: false, error: "Alert ID is required" },
            { status: 400 }
          );
          return addSecurityHeaders(response, request);
        }
        
        logSecurityEvent('security_alert_acknowledged', userId, { alertId });
        
        const ackResponse = NextResponse.json({
          success: true,
          message: "Alert acknowledged successfully"
        });
        return addSecurityHeaders(ackResponse);

      case 'create_incident':
        if (!alertId) {
          const response = NextResponse.json(
            { success: false, error: "Alert ID is required" },
            { status: 400 }
          );
          return addSecurityHeaders(response, request);
        }
        
        logSecurityEvent('security_incident_created', userId, { alertId, incidentId });
        
        const incidentResponse = NextResponse.json({
          success: true,
          message: "Incident created successfully"
        });
        return addSecurityHeaders(incidentResponse);

      case 'block_ip':
        if (!ip) {
          const response = NextResponse.json(
            { success: false, error: "IP address is required" },
            { status: 400 }
          );
          return addSecurityHeaders(response, request);
        }
        
        logSecurityEvent('ip_blocked', userId, { ip, reason: reason || 'Manual block' });
        
        const blockResponse = NextResponse.json({
          success: true,
          message: `IP ${ip} blocked successfully`
        });
        return addSecurityHeaders(blockResponse);

      default:
        const defaultResponse = NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
        return addSecurityHeaders(defaultResponse);
    }

  } catch (error: any) {
    console.error("Security dashboard POST API error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('security_dashboard_post_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        success: false, 
        error: "Failed to process security action",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    return addSecurityHeaders(response, request);
  }
}
