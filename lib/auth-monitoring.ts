/**
 * Authentication Monitoring
 * 
 * Tracks auth events, failures, and metrics for monitoring the migration.
 * Helps identify issues and measure success of the Supabase migration.
 */

export interface AuthEvent {
  timestamp: Date;
  event: string;
  provider: 'clerk' | 'supabase';
  userId?: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

// In-memory event log (in production, send to monitoring service)
const authEvents: AuthEvent[] = [];
const MAX_EVENTS = 1000;

/**
 * Log an auth event
 */
export function logAuthEvent(event: Omit<AuthEvent, 'timestamp'>): void {
  if (process.env.ENABLE_AUTH_MONITORING === 'false') {
    return; // Skip if monitoring disabled
  }
  
  const authEvent: AuthEvent = {
    ...event,
    timestamp: new Date(),
  };
  
  authEvents.push(authEvent);
  
  // Keep only last MAX_EVENTS
  if (authEvents.length > MAX_EVENTS) {
    authEvents.shift();
  }
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Auth Monitoring]', authEvent);
  }
  
  // In production, send to monitoring service (DataDog, Sentry, etc.)
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to monitoring service
    // Example: sendToDataDog(authEvent);
  }
}

/**
 * Log sign-in event
 */
export function logSignIn(provider: 'clerk' | 'supabase', success: boolean, userId?: string, error?: string): void {
  logAuthEvent({
    event: 'sign_in',
    provider,
    userId,
    success,
    error,
  });
}

/**
 * Log sign-up event
 */
export function logSignUp(provider: 'clerk' | 'supabase', success: boolean, userId?: string, error?: string): void {
  logAuthEvent({
    event: 'sign_up',
    provider,
    userId,
    success,
    error,
  });
}

/**
 * Log sign-out event
 */
export function logSignOut(provider: 'clerk' | 'supabase', success: boolean, userId?: string, error?: string): void {
  logAuthEvent({
    event: 'sign_out',
    provider,
    userId,
    success,
    error,
  });
}

/**
 * Log auth verification failure
 */
export function logAuthFailure(
  provider: 'clerk' | 'supabase',
  event: string,
  error: string,
  userId?: string,
  metadata?: Record<string, any>
): void {
  logAuthEvent({
    event: `auth_failure_${event}`,
    provider,
    userId,
    success: false,
    error,
    metadata,
  });
}

/**
 * Get auth metrics
 */
export function getAuthMetrics(timeframe: '1h' | '24h' | '7d' = '24h'): {
  totalEvents: number;
  signIns: number;
  signUps: number;
  signOuts: number;
  failures: number;
  clerkEvents: number;
  supabaseEvents: number;
  failureRate: number;
  events: AuthEvent[];
} {
  const now = new Date();
  const cutoffTime = new Date(now.getTime() - getTimeframeMs(timeframe));
  
  const recentEvents = authEvents.filter(e => e.timestamp >= cutoffTime);
  
  const signIns = recentEvents.filter(e => e.event === 'sign_in').length;
  const signUps = recentEvents.filter(e => e.event === 'sign_up').length;
  const signOuts = recentEvents.filter(e => e.event === 'sign_out').length;
  const failures = recentEvents.filter(e => !e.success).length;
  const clerkEvents = recentEvents.filter(e => e.provider === 'clerk').length;
  const supabaseEvents = recentEvents.filter(e => e.provider === 'supabase').length;
  
  const failureRate = recentEvents.length > 0 
    ? (failures / recentEvents.length) * 100 
    : 0;
  
  return {
    totalEvents: recentEvents.length,
    signIns,
    signUps,
    signOuts,
    failures,
    clerkEvents,
    supabaseEvents,
    failureRate: Math.round(failureRate * 100) / 100,
    events: recentEvents,
  };
}

/**
 * Get timeframe in milliseconds
 */
function getTimeframeMs(timeframe: '1h' | '24h' | '7d'): number {
  switch (timeframe) {
    case '1h':
      return 60 * 60 * 1000;
    case '24h':
      return 24 * 60 * 60 * 1000;
    case '7d':
      return 7 * 24 * 60 * 60 * 1000;
  }
}

/**
 * Check if rollback is recommended based on metrics
 */
export function shouldRollback(): {
  recommended: boolean;
  reason?: string;
  metrics: ReturnType<typeof getAuthMetrics>;
} {
  const metrics = getAuthMetrics('24h');
  
  // Rollback if failure rate is too high
  if (metrics.failureRate > 10) {
    return {
      recommended: true,
      reason: `High failure rate: ${metrics.failureRate}%`,
      metrics,
    };
  }
  
  // Rollback if no successful sign-ins
  if (metrics.signIns === 0 && metrics.signUps === 0 && metrics.totalEvents > 10) {
    return {
      recommended: true,
      reason: 'No successful auth events',
      metrics,
    };
  }
  
  // Rollback if too many failures
  if (metrics.failures > 50 && metrics.failureRate > 5) {
    return {
      recommended: true,
      reason: `Too many failures: ${metrics.failures}`,
      metrics,
    };
  }
  
  return {
    recommended: false,
    metrics,
  };
}

/**
 * API endpoint helper to get metrics (for admin dashboard)
 */
export function getAuthMetricsForAPI() {
  const metrics = getAuthMetrics('24h');
  const rollbackCheck = shouldRollback();
  
  return {
    ...metrics,
    rollbackRecommended: rollbackCheck.recommended,
    rollbackReason: rollbackCheck.reason,
  };
}



