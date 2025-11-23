/**
 * Rate Limiting Configuration
 * Universal standard limits for all users (no tier system)
 * 
 * Based on industry best practices (OWASP, REST API standards):
 * - Generous limits to avoid throttling legitimate users
 * - Protective limits to prevent abuse and DDoS
 * - Designed for 10,000+ concurrent users
 * - Scales gracefully with traffic spikes
 * 
 * Industry standard limits:
 * - Public APIs: 100-1000 req/min
 * - Authenticated: 200-1000 req/min
 * - Admin: 500-2000 req/min
 * - Critical ops: 20-100 req/min
 * - File uploads: 10-50 req/min
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  description: string;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Public routes (unauthenticated)
  // Industry standard: 100-200 req/min for public APIs
  public: {
    maxRequests: 120,        // 120 requests per minute (generous for browsing)
    windowMs: 60000,         // 1 minute window
    description: 'Public routes - 120 req/min (industry standard)'
  },

  // Authenticated carrier routes
  // Industry standard: 200-500 req/min for authenticated users
  authenticated: {
    maxRequests: 300,        // 300 requests per minute (generous for normal operations)
    windowMs: 60000,         // 1 minute window
    description: 'Authenticated routes - 300 req/min (generous standard)'
  },

  // Admin routes
  // Industry standard: 500-2000 req/min for admin operations
  admin: {
    maxRequests: 1000,       // 1000 requests per minute (very generous for admin tools)
    windowMs: 60000,         // 1 minute window
    description: 'Admin routes - 1000 req/min (very generous)'
  },

  // Critical operations (bid submission, awards, load updates)
  // Industry standard: 20-100 req/min for write operations
  critical: {
    maxRequests: 60,         // 60 requests per minute (prevents abuse, allows bursts)
    windowMs: 60000,         // 1 minute window
    description: 'Critical operations - 60 req/min (balanced protection)'
  },

  // File uploads
  // Industry standard: 10-50 req/min for resource-intensive operations
  fileUpload: {
    maxRequests: 30,        // 30 uploads per minute (resource-intensive)
    windowMs: 60000,         // 1 minute window
    description: 'File uploads - 30 req/min (resource-intensive)'
  },

  // Read-only operations (GET requests)
  // Industry standard: 300-1000 req/min for read operations
  readOnly: {
    maxRequests: 500,       // 500 requests per minute (very generous for reads)
    windowMs: 60000,         // 1 minute window
    description: 'Read-only operations - 500 req/min (very generous)'
  },

  // Search and filter operations
  // Industry standard: 100-300 req/min for search
  search: {
    maxRequests: 200,       // 200 requests per minute (generous for search UX)
    windowMs: 60000,         // 1 minute window
    description: 'Search operations - 200 req/min (generous for UX)'
  },
};

/**
 * Get rate limit config for a route type
 */
export function getRateLimit(type: keyof typeof RATE_LIMITS): RateLimitConfig {
  return RATE_LIMITS[type] || RATE_LIMITS.authenticated;
}

/**
 * Determine rate limit type based on route path and method
 */
export function determineRateLimitType(
  pathname: string,
  method: string
): keyof typeof RATE_LIMITS {
  // File upload routes
  if (pathname.includes('/upload') || pathname.includes('/documents')) {
    return 'fileUpload';
  }

  // Critical operations
  if (
    pathname.includes('/bids') && method === 'POST' ||
    pathname.includes('/award') ||
    pathname.includes('/load-status') && method === 'PATCH' ||
    pathname.includes('/users') && (method === 'DELETE' || method === 'PATCH')
  ) {
    return 'critical';
  }

  // Admin routes
  if (pathname.includes('/admin/')) {
    return 'admin';
  }

  // Read-only operations
  if (method === 'GET' && !pathname.includes('/search')) {
    return 'readOnly';
  }

  // Search operations
  if (pathname.includes('/search') || pathname.includes('/filter')) {
    return 'search';
  }

  // Default to authenticated
  return 'authenticated';
}

