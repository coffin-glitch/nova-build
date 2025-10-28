import { NextResponse } from "next/server";

// Security headers for API responses
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Enhanced security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');
  
  // Content Security Policy
  const csp = "default-src 'self'; script-src 'self' 'unsafe-inline' https://clerk.com https://*.clerk.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.clerk.com https://*.clerk.com; frame-src 'self' https://clerk.com https://*.clerk.com; object-src 'none'; base-uri 'self'; form-action 'self'";
  response.headers.set('Content-Security-Policy', csp);
  
  // Strict Transport Security
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  return response;
}

// Input validation
export function validateInput(data: any, rules: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const [field, value] of Object.entries(data)) {
    const rule = rules[field];
    if (!rule) continue;
    
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }
    
    if (value !== undefined && value !== null && value !== '') {
      if (rule.type === 'number') {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(`${field} must be a number`);
        } else {
          if (rule.min !== undefined && num < rule.min) {
            errors.push(`${field} must be at least ${rule.min}`);
          }
          if (rule.max !== undefined && num > rule.max) {
            errors.push(`${field} must be at most ${rule.max}`);
          }
        }
      }
      
      if (rule.type === 'string') {
        if (rule.minLength !== undefined && String(value).length < rule.minLength) {
          errors.push(`${field} must be at least ${rule.minLength} characters`);
        }
        if (rule.maxLength !== undefined && String(value).length > rule.maxLength) {
          errors.push(`${field} must be at most ${rule.maxLength} characters`);
        }
        if (rule.pattern && !rule.pattern.test(String(value))) {
          errors.push(`${field} format is invalid`);
        }
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// Security event logging
export function logSecurityEvent(event: string, userId?: string, metadata?: any): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event,
    userId: userId || 'unknown',
    metadata: metadata || {},
    userAgent: typeof window !== 'undefined' ? window.navigator?.userAgent : 'server',
    ip: 'unknown' // Would need to be passed from request
  };
  
  console.log(`🔒 SECURITY EVENT: ${event}`, logEntry);
  
  // In production, this would be sent to a security monitoring service
  // For now, we'll just log to console
}
