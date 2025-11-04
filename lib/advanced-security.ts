import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "./supabase";
import { headers } from "next/headers";
import { getUserRole } from "./auth";

/**
 * Advanced Security Middleware for Next.js API Routes
 * Implements OWASP Top 10 security guidelines
 */

export interface SecurityConfig {
  requireAuth?: boolean;
  requireAdmin?: boolean;
  requireCarrier?: boolean;
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests?: boolean;
  };
  allowedMethods?: string[];
  cors?: {
    origin: string | string[];
    credentials: boolean;
  };
  inputValidation?: {
    schema: Record<string, any>;
    sanitize?: boolean;
  };
  auditLog?: boolean;
}

/**
 * Redis-like rate limiting store (in production, use Redis)
 */
const rateLimitStore = new Map<string, { 
  count: number; 
  resetTime: number; 
  blocked: boolean;
  blockUntil?: number;
}>();

/**
 * IP-based blocking for suspicious activity
 */
const blockedIPs = new Map<string, { 
  blockedUntil: number; 
  reason: string;
  attempts: number;
}>();

/**
 * Advanced API security middleware
 */
export async function secureApiEndpoint(
  request: NextRequest,
  config: SecurityConfig = {}
): Promise<{ 
  userId?: string; 
  userRole?: string; 
  error?: NextResponse;
  securityContext?: any;
}> {
  try {
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // 1. Check for blocked IPs
    if (isIPBlocked(clientIP)) {
      logSecurityEvent('blocked_ip_access_attempt', undefined, { 
        ip: clientIP, 
        userAgent,
        path: request.nextUrl.pathname 
      });
      return {
        error: NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        )
      };
    }

    // 2. CORS Security
    if (config.cors) {
      const origin = request.headers.get('origin');
      const allowedOrigins = Array.isArray(config.cors.origin) 
        ? config.cors.origin 
        : [config.cors.origin];
      
      if (origin && !allowedOrigins.includes(origin)) {
        logSecurityEvent('cors_violation', undefined, { 
          origin, 
          allowedOrigins,
          ip: clientIP,
          path: request.nextUrl.pathname 
        });
        return {
          error: NextResponse.json(
            { error: "CORS policy violation" },
            { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } }
          )
        };
      }
    }

    // 3. Method Security
    if (config.allowedMethods && !config.allowedMethods.includes(request.method)) {
      logSecurityEvent('method_not_allowed', undefined, { 
        method: request.method,
        allowedMethods: config.allowedMethods,
        ip: clientIP,
        path: request.nextUrl.pathname 
      });
      return {
        error: NextResponse.json(
          { error: "Method not allowed" },
          { status: 405 }
        )
      };
    }

    // 4. Advanced Rate Limiting with IP blocking
    if (config.rateLimit) {
      const rateLimitResult = await handleRateLimit(request, config.rateLimit, clientIP);
      if (rateLimitResult.error) {
        return rateLimitResult;
      }
    }

    // 5. Authentication (Supabase-only)
    let userId: string | undefined;
    let userRole: string | undefined;
    
    if (config.requireAuth || config.requireAdmin || config.requireCarrier) {
      // Try to get from headers first (set by middleware)
      const headersList = request.headers;
      userId = headersList.get('X-User-Id') || undefined;
      userRole = headersList.get('X-User-Role') || undefined;
      
      // Fallback to direct Supabase auth if not in headers
      if (!userId) {
        try {
          const supabaseHeaders = await headers();
          const supabase = getSupabaseServer(supabaseHeaders);
          const { data: { user } } = await supabase.auth.getUser();
          userId = user?.id;
        } catch (error) {
          console.error('[advanced-security] Error getting user from Supabase:', error);
        }
      }
      
      if (!userId) {
        logSecurityEvent('unauthorized_access_attempt', undefined, { 
          ip: clientIP,
          userAgent,
          path: request.nextUrl.pathname 
        });
        return {
          error: NextResponse.json(
            { error: "Authentication required" },
            { status: 401 }
          )
        };
      }

      // 6. Authorization (Supabase-only)
      if ((config.requireAdmin || config.requireCarrier) && !userRole) {
        try {
          userRole = await getUserRole(userId);
          
          if (config.requireAdmin && userRole !== 'admin') {
            logSecurityEvent('unauthorized_admin_access_attempt', userId, { 
              userRole,
              ip: clientIP,
              path: request.nextUrl.pathname 
            });
            return {
              error: NextResponse.json(
                { error: "Admin access required" },
                { status: 403 }
              )
            };
          }
          
          if (config.requireCarrier && userRole !== 'carrier' && userRole !== 'admin') {
            logSecurityEvent('unauthorized_carrier_access_attempt', userId, { 
              userRole,
              ip: clientIP,
              path: request.nextUrl.pathname 
            });
            return {
              error: NextResponse.json(
                { error: "Carrier access required" },
                { status: 403 }
              )
            };
          }
        } catch (error) {
          logSecurityEvent('authorization_error', userId, { 
            error: error instanceof Error ? error.message : String(error),
            ip: clientIP,
            path: request.nextUrl.pathname 
          });
          return {
            error: NextResponse.json(
              { error: "Authorization failed" },
              { status: 500 }
            )
          };
        }
      }
    }

    // 7. Input Validation
    if (config.inputValidation && request.method !== 'GET') {
      try {
        const body = await request.clone().json();
        const validation = validateInput(body, config.inputValidation.schema);
        
        if (!validation.valid) {
          logSecurityEvent('input_validation_failed', userId, { 
            errors: validation.errors,
            ip: clientIP,
            path: request.nextUrl.pathname 
          });
          return {
            error: NextResponse.json(
              { error: `Invalid input: ${validation.errors.join(', ')}` },
              { status: 400 }
            )
          };
        }
        
        if (config.inputValidation.sanitize) {
          // Sanitize the request body
          const sanitizedBody = sanitizeInput(body);
          // Note: In a real implementation, you'd need to reconstruct the request
          // with sanitized data, which is complex in Next.js middleware
        }
      } catch (error) {
        logSecurityEvent('input_parsing_error', userId, { 
          error: error instanceof Error ? error.message : String(error),
          ip: clientIP,
          path: request.nextUrl.pathname 
        });
        return {
          error: NextResponse.json(
            { error: "Invalid request body" },
            { status: 400 }
          )
        };
      }
    }

    // 8. Audit Logging
    if (config.auditLog) {
      logSecurityEvent('api_access', userId, {
        method: request.method,
        path: request.nextUrl.pathname,
        ip: clientIP,
        userAgent,
        userRole
      });
    }

    return { 
      userId, 
      userRole,
      securityContext: {
        ip: clientIP,
        userAgent,
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error("Security middleware error:", error);
    logSecurityEvent('security_middleware_error', undefined, { 
      error: error instanceof Error ? error.message : String(error),
      path: request.nextUrl.pathname 
    });
    return {
      error: NextResponse.json(
        { error: "Security validation failed" },
        { status: 500 }
      )
    };
  }
}

/**
 * Advanced rate limiting with IP blocking
 */
async function handleRateLimit(
  request: NextRequest, 
  config: SecurityConfig['rateLimit'], 
  clientIP: string
): Promise<{ error?: NextResponse }> {
  if (!config) return {};
  
  const now = Date.now();
  const windowMs = config.windowMs;
  const maxRequests = config.maxRequests;
  const key = `${clientIP}:${request.nextUrl.pathname}`;
  
  const current = rateLimitStore.get(key);
  
  // Reset window if expired
  if (!current || now > current.resetTime) {
    rateLimitStore.set(key, { 
      count: 1, 
      resetTime: now + windowMs,
      blocked: false
    });
    return {};
  }
  
  // Check if currently blocked
  if (current.blocked && current.blockUntil && now < current.blockUntil) {
    return {
      error: NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    };
  }
  
  // Increment counter
  current.count++;
  
  // Check if limit exceeded
  if (current.count > maxRequests) {
    // Block IP for increasing durations
    const blockDuration = Math.min(300000, 60000 * Math.pow(2, current.count - maxRequests)); // Max 5 minutes
    current.blocked = true;
    current.blockUntil = now + blockDuration;
    
    // Track suspicious IPs
    const ipData = blockedIPs.get(clientIP) || { blockedUntil: 0, reason: '', attempts: 0 };
    ipData.attempts++;
    ipData.blockedUntil = now + blockDuration;
    ipData.reason = 'Rate limit exceeded';
    blockedIPs.set(clientIP, ipData);
    
    logSecurityEvent('rate_limit_exceeded', undefined, { 
      ip: clientIP,
      count: current.count,
      maxRequests,
      blockDuration,
      path: request.nextUrl.pathname
    });
    
    return {
      error: NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    };
  }
  
  return {};
}

/**
 * Check if IP is blocked
 */
function isIPBlocked(ip: string): boolean {
  const blockData = blockedIPs.get(ip);
  if (!blockData) return false;
  
  if (Date.now() < blockData.blockedUntil) {
    return true;
  } else {
    // Unblock expired IPs
    blockedIPs.delete(ip);
    return false;
  }
}

/**
 * Get client IP address
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (cfConnectingIP) return cfConnectingIP;
  if (realIP) return realIP;
  if (forwarded) return forwarded.split(',')[0].trim();
  
  return request.ip || 'unknown';
}

/**
 * Enhanced input validation
 */
export function validateInput(data: any, schema: Record<string, any>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [key, rules] of Object.entries(schema)) {
    const value = data[key];

    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${key} is required`);
      continue;
    }

    if (value !== undefined && rules.type) {
      if (rules.type === 'string' && typeof value !== 'string') {
        errors.push(`${key} must be a string`);
      } else if (rules.type === 'number' && typeof value !== 'number') {
        errors.push(`${key} must be a number`);
      } else if (rules.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`${key} must be a boolean`);
      } else if (rules.type === 'array' && !Array.isArray(value)) {
        errors.push(`${key} must be an array`);
      } else if (rules.type === 'object' && typeof value !== 'object') {
        errors.push(`${key} must be an object`);
      }
    }

    if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
      errors.push(`${key} must be at least ${rules.minLength} characters`);
    }

    if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
      errors.push(`${key} must be no more than ${rules.maxLength} characters`);
    }

    if (rules.min && typeof value === 'number' && value < rules.min) {
      errors.push(`${key} must be at least ${rules.min}`);
    }

    if (rules.max && typeof value === 'number' && value > rules.max) {
      errors.push(`${key} must be no more than ${rules.max}`);
    }

    if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
      errors.push(`${key} format is invalid`);
    }

    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${key} must be one of: ${rules.enum.join(', ')}`);
    }

    if (rules.custom && typeof rules.custom === 'function') {
      const customError = rules.custom(value);
      if (customError) {
        errors.push(customError);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Advanced input sanitization
 */
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove potentially dangerous characters and scripts
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/[';-]/g, '') // Remove SQL injection characters
      .trim();
  }
  
  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item));
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}

/**
 * Enhanced security headers
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // OWASP recommended security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');
  
  // Content Security Policy
  response.headers.set('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.com https://*.clerk.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://api.clerk.com https://*.clerk.com; " +
    "frame-src 'self' https://clerk.com https://*.clerk.com; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  );
  
  // Strict Transport Security
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Cross-Origin policies
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  
  return response;
}

/**
 * Enhanced audit logging
 */
export function logSecurityEvent(
  event: string,
  userId?: string,
  details?: any
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    userId,
    details,
    severity: getEventSeverity(event),
    source: 'api-security'
  };

  // Log to console with appropriate level
  if (logEntry.severity === 'HIGH') {
    console.error(`🚨 SECURITY ALERT: ${JSON.stringify(logEntry)}`);
  } else if (logEntry.severity === 'MEDIUM') {
    console.warn(`⚠️ Security Event: ${JSON.stringify(logEntry)}`);
  } else {
    console.log(`🔒 Security Event: ${JSON.stringify(logEntry)}`);
  }
  
  // In production, send to security monitoring service
  // await sendToSecurityMonitoring(logEntry);
}

/**
 * Determine event severity
 */
function getEventSeverity(event: string): 'LOW' | 'MEDIUM' | 'HIGH' {
  const highSeverityEvents = [
    'unauthorized_admin_access_attempt',
    'rate_limit_exceeded',
    'blocked_ip_access_attempt',
    'cors_violation',
    'security_middleware_error'
  ];
  
  const mediumSeverityEvents = [
    'unauthorized_access_attempt',
    'input_validation_failed',
    'method_not_allowed',
    'authorization_error'
  ];
  
  if (highSeverityEvents.includes(event)) return 'HIGH';
  if (mediumSeverityEvents.includes(event)) return 'MEDIUM';
  return 'LOW';
}

/**
 * Common validation schemas
 */
export const validationSchemas = {
  bidAmount: {
    amount: { required: true, type: 'number', min: 0, max: 1000000 },
    bidNumber: { required: true, type: 'string', pattern: /^\d+$/ }
  },
  userProfile: {
    company: { required: true, type: 'string', minLength: 2, maxLength: 100 },
    mcNumber: { required: true, type: 'string', pattern: /^\d+$/ },
    contactName: { required: true, type: 'string', minLength: 2, maxLength: 50 },
    phone: { required: true, type: 'string', pattern: /^[\+]?[1-9][\d]{0,15}$/ }
  },
  notification: {
    type: { required: true, type: 'string', pattern: /^[a-z_]+$/ },
    title: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    message: { required: true, type: 'string', minLength: 1, maxLength: 500 }
  },
  conversation: {
    message: { required: true, type: 'string', minLength: 1, maxLength: 1000 },
    admin_user_id: { type: 'string', minLength: 1 }
  }
};

/**
 * Security monitoring utilities
 */
export class SecurityMonitor {
  private static instance: SecurityMonitor;
  private suspiciousActivity: Map<string, number> = new Map();
  
  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }
  
  trackSuspiciousActivity(ip: string, event: string): void {
    const key = `${ip}:${event}`;
    const count = this.suspiciousActivity.get(key) || 0;
    this.suspiciousActivity.set(key, count + 1);
    
    // If too many suspicious activities, block IP
    if (count > 10) {
      blockedIPs.set(ip, {
        blockedUntil: Date.now() + 3600000, // 1 hour
        reason: 'Suspicious activity detected',
        attempts: count
      });
      
      logSecurityEvent('ip_blocked_suspicious_activity', undefined, { 
        ip, 
        event, 
        count 
      });
    }
  }
  
  getSuspiciousActivity(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, count] of this.suspiciousActivity.entries()) {
      result[key] = count;
    }
    return result;
  }
}
