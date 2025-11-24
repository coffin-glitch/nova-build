import { NextRequest, NextResponse } from "next/server";

/**
 * Get allowed origins for CORS
 */
function getAllowedOrigins(): string[] {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
  
  // Add default origins based on environment
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000');
  }
  
  // Add Vercel URL if available
  if (process.env.VERCEL_URL) {
    allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
  }
  
  // Add NEXT_PUBLIC_APP_URL if available
  if (process.env.NEXT_PUBLIC_APP_URL) {
    allowedOrigins.push(process.env.NEXT_PUBLIC_APP_URL);
  }
  
  return [...new Set(allowedOrigins)]; // Remove duplicates
}

/**
 * Add CORS headers to response
 */
export function addCorsHeaders(response: NextResponse, request?: NextRequest): NextResponse {
  const allowedOrigins = getAllowedOrigins();
  const origin = request?.headers.get('origin');
  
  // Check if origin is allowed
  if (origin && allowedOrigins.some(allowed => {
    // Support exact match or subdomain match
    return origin === allowed || origin.endsWith(`.${allowed.replace(/^https?:\/\//, '')}`);
  })) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'development') {
    // In development, allow all origins for easier testing
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
  } else if (allowedOrigins.length > 0) {
    // In production, use first allowed origin as default
    response.headers.set('Access-Control-Allow-Origin', allowedOrigins[0]);
  }
  
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  
  return response;
}

// Security headers for API responses
export function addSecurityHeaders(response: NextResponse, request?: NextRequest): NextResponse {
  // Enhanced security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');
  
  // Content Security Policy (updated to remove Clerk references - migrated to Supabase)
  const csp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://*.supabase.in; frame-src 'self' https://*.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self'";
  response.headers.set('Content-Security-Policy', csp);
  
  // Strict Transport Security
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Add CORS headers if request is provided
  if (request) {
    addCorsHeaders(response, request);
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

/**
 * Standardized Error Response Helpers
 * 
 * These functions provide consistent error handling across all API routes.
 * They ensure sensitive information is not leaked in production.
 */

export interface StandardErrorResponse {
  error: string;
  message?: string;
  details?: string;
  code?: string;
}

/**
 * Create a standardized error response
 * 
 * @param error - The error object or message
 * @param status - HTTP status code (default: 500)
 * @param customMessage - Custom error message (optional)
 * @param errorCode - Error code for client handling (optional)
 * @returns NextResponse with standardized error format
 */
export function createErrorResponse(
  error: unknown,
  status: number = 500,
  customMessage?: string,
  errorCode?: string
): NextResponse {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorDetails = isDevelopment ? errorMessage : undefined;
  const errorStack = isDevelopment && error instanceof Error ? error.stack : undefined;
  
  const response: StandardErrorResponse = {
    error: customMessage || getDefaultErrorMessage(status),
    ...(errorDetails && { details: errorDetails }),
    ...(errorCode && { code: errorCode })
  };
  
  const nextResponse = NextResponse.json(response, { status });
  
  // Add security headers
  return addSecurityHeaders(nextResponse);
}

/**
 * Get default error message based on status code
 */
function getDefaultErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Bad request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Resource not found';
    case 409:
      return 'Conflict';
    case 422:
      return 'Validation error';
    case 429:
      return 'Too many requests';
    case 500:
      return 'Internal server error';
    case 502:
      return 'Bad gateway';
    case 503:
      return 'Service unavailable';
    default:
      return 'An error occurred';
  }
}

/**
 * Handle and log errors consistently
 * 
 * @param error - The error object
 * @param eventName - Security event name for logging
 * @param userId - User ID for logging (optional)
 * @param status - HTTP status code (default: 500)
 * @param customMessage - Custom error message (optional)
 * @returns NextResponse with standardized error format
 */
export function handleApiError(
  error: unknown,
  eventName: string,
  userId?: string,
  status: number = 500,
  customMessage?: string
): NextResponse {
  // Log the error
  logSecurityEvent(eventName, userId, {
    error: error instanceof Error ? error.message : String(error),
    status
  });
  
  // Create standardized error response
  return createErrorResponse(error, status, customMessage);
}

/**
 * Handle authentication/authorization errors
 */
export function handleAuthError(error: unknown): NextResponse {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  if (errorMessage.includes('Unauthorized') || errorMessage === 'Unauthorized') {
    return createErrorResponse(error, 401, 'Unauthorized', 'UNAUTHORIZED');
  }
  
  if (errorMessage.includes('Admin access required') || errorMessage.includes('Forbidden')) {
    return createErrorResponse(error, 403, 'Forbidden', 'FORBIDDEN');
  }
  
  return createErrorResponse(error, 401, 'Authentication required', 'AUTH_REQUIRED');
}

/**
 * Handle validation errors
 */
export function handleValidationError(
  errors: string[],
  eventName: string = 'validation_error',
  userId?: string
): NextResponse {
  logSecurityEvent(eventName, userId, { errors });
  
  return NextResponse.json(
    {
      error: 'Validation error',
      message: 'Invalid input provided',
      details: errors,
      code: 'VALIDATION_ERROR'
    },
    { status: 400 }
  );
}

/**
 * Handle not found errors
 */
export function handleNotFoundError(
  resource: string = 'Resource',
  eventName: string = 'resource_not_found',
  userId?: string
): NextResponse {
  logSecurityEvent(eventName, userId, { resource });
  
  const response = NextResponse.json(
    {
      error: 'Not found',
      message: `${resource} not found`,
      code: 'NOT_FOUND'
    },
    { status: 404 }
  );
  
  return addSecurityHeaders(response);
}

/**
 * Request Size Limits
 * 
 * Validates request body size to prevent DoS attacks
 */

const MAX_JSON_BODY_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FORM_DATA_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILE_UPLOAD_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Validate request body size
 * 
 * @param request - NextRequest object
 * @param maxSize - Maximum size in bytes (default: 10MB for JSON)
 * @returns Error response if size exceeded, null otherwise
 */
export async function validateRequestSize(
  request: NextRequest,
  maxSize: number = MAX_JSON_BODY_SIZE
): Promise<NextResponse | null> {
  const contentLength = request.headers.get('content-length');
  
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    
    if (size > maxSize) {
      logSecurityEvent('request_size_exceeded', undefined, {
        size,
        maxSize,
        path: request.nextUrl.pathname
      });
      
      const response = NextResponse.json(
        {
          error: 'Request too large',
          message: `Request body exceeds maximum size of ${Math.round(maxSize / 1024 / 1024)}MB`,
          code: 'REQUEST_TOO_LARGE'
        },
        { status: 413 }
      );
      
      return addSecurityHeaders(response, request);
    }
  }
  
  return null;
}

/**
 * Get appropriate max size based on content type
 */
export function getMaxSizeForContentType(contentType: string | null): number {
  if (!contentType) {
    return MAX_JSON_BODY_SIZE;
  }
  
  if (contentType.includes('multipart/form-data')) {
    return MAX_FORM_DATA_SIZE;
  }
  
  if (contentType.includes('application/json')) {
    return MAX_JSON_BODY_SIZE;
  }
  
  // Default to JSON size for other types
  return MAX_JSON_BODY_SIZE;
}

/**
 * Validate file upload size
 */
export function validateFileSize(file: File, maxSize: number = MAX_FILE_UPLOAD_SIZE): NextResponse | null {
  if (file.size > maxSize) {
    logSecurityEvent('file_size_exceeded', undefined, {
      fileName: file.name,
      fileSize: file.size,
      maxSize
    });
    
    const response = NextResponse.json(
      {
        error: 'File too large',
        message: `File exceeds maximum size of ${Math.round(maxSize / 1024 / 1024)}MB`,
        code: 'FILE_TOO_LARGE'
      },
      { status: 413 }
    );
    
    return addSecurityHeaders(response);
  }
  
  return null;
}
