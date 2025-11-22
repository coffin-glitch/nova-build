/**
 * Rate Limiting Configuration
 * Generous limits to avoid problems while still protecting against abuse
 * 
 * For 10,000 concurrent users, these limits are designed to:
 * - Allow normal usage patterns without throttling
 * - Prevent abuse and DDoS attacks
 * - Scale gracefully with traffic spikes
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  description: string;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Public routes (unauthenticated)
  // Very generous to allow legitimate browsing
  public: {
    maxRequests: 100,        // 100 requests per minute
    windowMs: 60000,         // 1 minute window
    description: 'Public routes - 100 req/min (very generous)'
  },

  // Authenticated carrier routes
  // Generous for normal carrier operations
  authenticated: {
    maxRequests: 200,        // 200 requests per minute
    windowMs: 60000,         // 1 minute window
    description: 'Authenticated routes - 200 req/min (generous)'
  },

  // Admin routes
  // Very generous for admin operations
  admin: {
    maxRequests: 500,        // 500 requests per minute
    windowMs: 60000,         // 1 minute window
    description: 'Admin routes - 500 req/min (very generous)'
  },

  // Critical operations (bid submission, load updates)
  // Lower limit to prevent abuse while allowing legitimate bursts
  critical: {
    maxRequests: 50,         // 50 requests per minute
    windowMs: 60000,         // 1 minute window
    description: 'Critical operations - 50 req/min (prevents abuse)'
  },

  // File uploads
  // Lower limit due to resource-intensive nature
  fileUpload: {
    maxRequests: 20,         // 20 uploads per minute
    windowMs: 60000,         // 1 minute window
    description: 'File uploads - 20 req/min (resource-intensive)'
  },

  // Read-only operations (GET requests)
  // More generous since they're less resource-intensive
  readOnly: {
    maxRequests: 300,        // 300 requests per minute
    windowMs: 60000,         // 1 minute window
    description: 'Read-only operations - 300 req/min (very generous)'
  },

  // Search and filter operations
  // Generous for user experience
  search: {
    maxRequests: 150,        // 150 requests per minute
    windowMs: 60000,         // 1 minute window
    description: 'Search operations - 150 req/min (generous)'
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

