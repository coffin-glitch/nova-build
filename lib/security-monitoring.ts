
/**
 * Security Monitoring and Incident Response System
 * Implements OWASP security monitoring guidelines
 */

export interface SecurityEvent {
  id: string;
  timestamp: string;
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId?: string;
  ip?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  details?: Record<string, unknown>;
  source: string;
  resolved?: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface SecurityAlert {
  id: string;
  eventId: string;
  alertType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  timestamp: string;
  acknowledged?: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  escalated?: boolean;
  escalatedAt?: string;
}

/**
 * Security Event Types
 */
export const SECURITY_EVENTS = {
  // Authentication Events
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILURE: 'login_failure',
  LOGOUT: 'logout',
  PASSWORD_RESET: 'password_reset',
  ACCOUNT_LOCKED: 'account_locked',
  
  // Authorization Events
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  PRIVILEGE_ESCALATION: 'privilege_escalation',
  ROLE_CHANGE: 'role_change',
  
  // API Security Events
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  SUSPICIOUS_REQUEST: 'suspicious_request',
  INVALID_INPUT: 'invalid_input',
  SQL_INJECTION_ATTEMPT: 'sql_injection_attempt',
  XSS_ATTEMPT: 'xss_attempt',
  
  // System Events
  SYSTEM_ERROR: 'system_error',
  DATABASE_ERROR: 'database_error',
  FILE_UPLOAD: 'file_upload',
  DATA_EXPORT: 'data_export',
  
  // Network Events
  BLOCKED_IP: 'blocked_ip',
  CORS_VIOLATION: 'cors_violation',
  CSP_VIOLATION: 'csp_violation',
  
  // Data Events
  DATA_ACCESS: 'data_access',
  DATA_MODIFICATION: 'data_modification',
  DATA_DELETION: 'data_deletion',
  SENSITIVE_DATA_ACCESS: 'sensitive_data_access'
} as const;

/**
 * Security Monitoring Class
 */
export class SecurityMonitor {
  private static instance: SecurityMonitor;
  private events: Map<string, SecurityEvent> = new Map();
  private alerts: Map<string, SecurityAlert> = new Map();
  private suspiciousIPs: Map<string, { count: number; lastSeen: string; blocked: boolean }> = new Map();
  private userActivity: Map<string, { count: number; lastActivity: string; suspicious: boolean }> = new Map();
  
  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }
  
  /**
   * Log a security event
   */
  logEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): string {
    const id = this.generateEventId();
    const timestamp = new Date().toISOString();
    
    const securityEvent: SecurityEvent = {
      id,
      timestamp,
      ...event
    };
    
    this.events.set(id, securityEvent);
    
    // Check for suspicious patterns
    this.analyzeEvent(securityEvent);
    
    // Log to console with appropriate level
    this.logToConsole(securityEvent);
    
    // In production, send to external monitoring service
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalMonitoring(securityEvent);
    }
    
    return id;
  }
  
  /**
   * Create a security alert
   */
  createAlert(eventId: string, alertType: string, message: string, severity: SecurityAlert['severity']): string {
    const id = this.generateAlertId();
    const timestamp = new Date().toISOString();
    
    const alert: SecurityAlert = {
      id,
      eventId,
      alertType,
      severity,
      message,
      timestamp
    };
    
    this.alerts.set(id, alert);
    
    // Log alert
    console.error(`🚨 SECURITY ALERT [${severity}]: ${message}`);
    
    // Send notifications for high/critical alerts
    if (severity === 'HIGH' || severity === 'CRITICAL') {
      this.sendAlertNotification(alert);
    }
    
    return id;
  }
  
  /**
   * Analyze event for suspicious patterns
   */
  private analyzeEvent(event: SecurityEvent): void {
    // Track IP activity
    if (event.ip) {
      const ipData = this.suspiciousIPs.get(event.ip) || { count: 0, lastSeen: '', blocked: false };
      ipData.count++;
      ipData.lastSeen = event.timestamp;
      
      // Check for suspicious IP patterns
      if (this.isSuspiciousIP(event.ip, ipData)) {
        ipData.blocked = true;
        this.createAlert(
          event.id,
          'suspicious_ip',
          `Suspicious activity detected from IP: ${event.ip}`,
          'HIGH'
        );
      }
      
      this.suspiciousIPs.set(event.ip, ipData);
    }
    
    // Track user activity
    if (event.userId) {
      const userData = this.userActivity.get(event.userId) || { count: 0, lastActivity: '', suspicious: false };
      userData.count++;
      userData.lastActivity = event.timestamp;
      
      // Check for suspicious user patterns
      if (this.isSuspiciousUser(event.userId, userData)) {
        userData.suspicious = true;
        this.createAlert(
          event.id,
          'suspicious_user',
          `Suspicious activity detected from user: ${event.userId}`,
          'MEDIUM'
        );
      }
      
      this.userActivity.set(event.userId, userData);
    }
    
    // Check for specific attack patterns
    this.checkAttackPatterns(event);
  }
  
  /**
   * Check for attack patterns
   */
  private checkAttackPatterns(event: SecurityEvent): void {
    // SQL Injection attempts
    if (event.details?.input && this.containsSQLInjection(event.details.input)) {
      this.createAlert(
        event.id,
        'sql_injection_attempt',
        'Potential SQL injection attempt detected',
        'HIGH'
      );
    }
    
    // XSS attempts
    if (event.details?.input && this.containsXSS(event.details.input)) {
      this.createAlert(
        event.id,
        'xss_attempt',
        'Potential XSS attempt detected',
        'HIGH'
      );
    }
    
    // Brute force attempts
    if (event.eventType === SECURITY_EVENTS.LOGIN_FAILURE) {
      const recentFailures = Array.from(this.events.values())
        .filter(e => e.eventType === SECURITY_EVENTS.LOGIN_FAILURE && 
                    e.ip === event.ip && 
                    new Date(e.timestamp).getTime() > Date.now() - 300000) // 5 minutes
        .length;
      
      if (recentFailures > 5) {
        this.createAlert(
          event.id,
          'brute_force_attempt',
          `Brute force attack detected from IP: ${event.ip}`,
          'CRITICAL'
        );
      }
    }
  }
  
  /**
   * Check if IP is suspicious
   */
  private isSuspiciousIP(ip: string, ipData: any): boolean {
    // Multiple failed login attempts
    const recentFailures = Array.from(this.events.values())
      .filter(e => e.eventType === SECURITY_EVENTS.LOGIN_FAILURE && 
                  e.ip === ip && 
                  new Date(e.timestamp).getTime() > Date.now() - 3600000) // 1 hour
      .length;
    
    return recentFailures > 10 || ipData.count > 100;
  }
  
  /**
   * Check if user is suspicious
   */
  private isSuspiciousUser(userId: string, userData: { count: number; lastActivity: string; suspicious: boolean }): boolean {
    // Unusual activity patterns
    const recentActivity = Array.from(this.events.values())
      .filter(e => e.userId === userId && 
                  new Date(e.timestamp).getTime() > Date.now() - 3600000) // 1 hour
      .length;
    
    return recentActivity > 50 || userData.count > 200;
  }
  
  /**
   * Check for SQL injection patterns
   */
  private containsSQLInjection(input: unknown): boolean {
    const sqlPatterns = [
      /(\'|(\\)(\')|(;)|(\\)(\\)(;)|(--)|(\/\*)|(\*\/)|(xp_)|(sp_)|(exec)|(execute)|(select)|(insert)|(update)|(delete)|(drop)|(create)|(alter)|(union)|(script))/i
    ];
    
    const inputStr = JSON.stringify(input);
    return sqlPatterns.some(pattern => pattern.test(inputStr));
  }
  
  /**
   * Check for XSS patterns
   */
  private containsXSS(input: unknown): boolean {
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /<link/i,
      /<meta/i
    ];
    
    const inputStr = JSON.stringify(input);
    return xssPatterns.some(pattern => pattern.test(inputStr));
  }
  
  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Log to console with appropriate level
   */
  private logToConsole(event: SecurityEvent): void {
    const logMessage = `[${event.severity}] ${event.eventType}: ${JSON.stringify(event)}`;
    
    switch (event.severity) {
      case 'CRITICAL':
        console.error(`🚨 ${logMessage}`);
        break;
      case 'HIGH':
        console.error(`⚠️ ${logMessage}`);
        break;
      case 'MEDIUM':
        console.warn(`🔶 ${logMessage}`);
        break;
      case 'LOW':
        console.log(`🔵 ${logMessage}`);
        break;
    }
  }
  
  /**
   * Send to external monitoring service
   */
  private async sendToExternalMonitoring(event: SecurityEvent): Promise<void> {
    try {
      // In production, integrate with services like:
      // - Datadog
      // - New Relic
      // - Splunk
      // - Custom security monitoring service
      
      console.log(`📡 Sending to external monitoring: ${event.id}`);
    } catch (error) {
      console.error('Failed to send to external monitoring:', error);
    }
  }
  
  /**
   * Send alert notifications
   */
  private async sendAlertNotification(alert: SecurityAlert): Promise<void> {
    try {
      // In production, send notifications via:
      // - Email
      // - Slack
      // - PagerDuty
      // - SMS
      
      console.log(`📧 Sending alert notification: ${alert.id}`);
    } catch (error) {
      console.error('Failed to send alert notification:', error);
    }
  }
  
  /**
   * Get security events
   */
  getEvents(limit: number = 100): SecurityEvent[] {
    return Array.from(this.events.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
  
  /**
   * Get security alerts
   */
  getAlerts(limit: number = 50): SecurityAlert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
  
  /**
   * Get suspicious IPs
   */
  getSuspiciousIPs(): Record<string, { count: number; lastSeen: string; blocked: boolean }> {
    const result: Record<string, { count: number; lastSeen: string; blocked: boolean }> = {};
    for (const [ip, data] of this.suspiciousIPs.entries()) {
      if (data.blocked || data.count > 10) {
        result[ip] = data;
      }
    }
    return result;
  }
  
  /**
   * Get security dashboard data
   */
  getDashboardData(): {
    totalEvents: number;
    totalAlerts: number;
    eventCounts: Record<string, number>;
    severityCounts: Record<string, number>;
    suspiciousIPs: number;
    recentActivity: SecurityEvent[];
  } {
    const events = this.getEvents(1000);
    const alerts = this.getAlerts(100);
    
    const eventCounts = events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const severityCounts = events.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalEvents: events.length,
      totalAlerts: alerts.length,
      eventCounts,
      severityCounts,
      suspiciousIPs: Object.keys(this.getSuspiciousIPs()).length,
      recentActivity: events.slice(0, 10)
    };
  }
}

/**
 * Security event logging functions
 */
export function logSecurityEvent(
  eventType: string,
  userId?: string,
  details?: any,
  severity: SecurityEvent['severity'] = 'LOW'
): string {
  const monitor = SecurityMonitor.getInstance();
  
  return monitor.logEvent({
    eventType,
    severity,
    userId,
    details,
    source: 'api-security'
  });
}

export function logSecurityAlert(
  eventId: string,
  alertType: string,
  message: string,
  severity: SecurityAlert['severity'] = 'MEDIUM'
): string {
  const monitor = SecurityMonitor.getInstance();
  
  return monitor.createAlert(eventId, alertType, message, severity);
}

/**
 * Security incident response
 */
export class IncidentResponse {
  private static instance: IncidentResponse;
  private incidents: Map<string, {
    id: string;
    alertId: string;
    severity: SecurityAlert['severity'];
    status: string;
    createdAt: string;
    steps: string[];
  }> = new Map();
  
  static getInstance(): IncidentResponse {
    if (!IncidentResponse.instance) {
      IncidentResponse.instance = new IncidentResponse();
    }
    return IncidentResponse.instance;
  }
  
  /**
   * Create incident response
   */
  createIncident(alertId: string, severity: SecurityAlert['severity']): string {
    const incidentId = `inc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const incident = {
      id: incidentId,
      alertId,
      severity,
      status: 'open',
      createdAt: new Date().toISOString(),
      steps: this.getResponseSteps(severity)
    };
    
    this.incidents.set(incidentId, incident);
    
    console.log(`🚨 Incident created: ${incidentId}`);
    
    return incidentId;
  }
  
  /**
   * Get response steps based on severity
   */
  private getResponseSteps(severity: SecurityAlert['severity']): string[] {
    const baseSteps = [
      'Document the incident',
      'Assess the impact',
      'Contain the threat',
      'Investigate the root cause',
      'Implement remediation',
      'Monitor for recurrence',
      'Update security measures',
      'Document lessons learned'
    ];
    
    if (severity === 'CRITICAL') {
      return [
        'Immediate containment',
        'Notify security team',
        'Activate incident response plan',
        ...baseSteps,
        'Post-incident review',
        'Update security policies'
      ];
    }
    
    if (severity === 'HIGH') {
      return [
        'Notify security team',
        'Assess containment needs',
        ...baseSteps
      ];
    }
    
    return baseSteps;
  }
  
  /**
   * Get incidents
   */
  getIncidents(): Array<{
    id: string;
    alertId: string;
    severity: SecurityAlert['severity'];
    status: string;
    createdAt: string;
    steps: string[];
  }> {
    return Array.from(this.incidents.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

/**
 * Export singleton instances
 */
export const securityMonitor = SecurityMonitor.getInstance();
export const incidentResponse = IncidentResponse.getInstance();
