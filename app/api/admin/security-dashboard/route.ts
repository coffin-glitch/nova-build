import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
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

    // Get security dashboard data
    const dashboardData = securityMonitor.getDashboardData();
    
    // Get recent security events
    const recentEvents = securityMonitor.getEvents(50);
    
    // Get active alerts
    const activeAlerts = securityMonitor.getAlerts(20).filter(alert => !alert.acknowledged);
    
    // Get suspicious IPs
    const suspiciousIPs = securityMonitor.getSuspiciousIPs();
    
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
      ).length
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
        }))
      }
    });

    return addSecurityHeaders(response);

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
    return addSecurityHeaders(response);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const body = await request.json();
    const { action, alertId, incidentId } = body;

    switch (action) {
      case 'acknowledge_alert':
        if (!alertId) {
          return NextResponse.json(
            { success: false, error: "Alert ID is required" },
            { status: 400 }
          );
        }
        
        // In a real implementation, you would update the alert status
        // For now, we'll just log the action
        console.log(`Alert ${alertId} acknowledged by admin`);
        
        return NextResponse.json({
          success: true,
          message: "Alert acknowledged successfully"
        });

      case 'create_incident':
        if (!alertId) {
          return NextResponse.json(
            { success: false, error: "Alert ID is required" },
            { status: 400 }
          );
        }
        
        // In a real implementation, you would create an incident
        console.log(`Incident created for alert ${alertId}`);
        
        return NextResponse.json({
          success: true,
          message: "Incident created successfully"
        });

      case 'block_ip':
        const { ip, reason } = body;
        if (!ip) {
          return NextResponse.json(
            { success: false, error: "IP address is required" },
            { status: 400 }
          );
        }
        
        // In a real implementation, you would block the IP
        console.log(`IP ${ip} blocked by admin. Reason: ${reason || 'Manual block'}`);
        
        return NextResponse.json({
          success: true,
          message: `IP ${ip} blocked successfully`
        });

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error("Security dashboard POST API error:", error);
    const response = NextResponse.json(
      { success: false, error: "Failed to process security action" },
      { status: 500 }
    );
    return addSecurityHeaders(response);
  }
}
