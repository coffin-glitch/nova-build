/**
 * API Rate Limiting - Universal Standard Limits
 * 
 * Industry-leading implementation following OWASP and REST API best practices:
 * - Sliding window algorithm for accurate rate limiting
 * - Standard HTTP headers (X-RateLimit-*)
 * - Per-user and per-IP rate limiting
 * - Generous limits to avoid throttling legitimate users
 * - Designed for 10,000+ concurrent users
 * 
 * Rate limits are universal for all users (no tier system - tiers are for notifications only)
 */

import { NextRequest, NextResponse } from "next/server";
import { redisConnection } from "./notification-queue";
import { logSecurityEvent } from "./api-security";
import { getRateLimit, determineRateLimitType, RATE_LIMITS } from "./rate-limiting-config";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

export interface RateLimitOptions {
  userId?: string;
  ip?: string;
  routeType?: keyof typeof RATE_LIMITS;
  customLimit?: number;
  windowMs?: number;
}

/**
 * Get client IP from request
 * Handles proxies, load balancers, and CDNs
 */
function getClientIP(request: NextRequest): string {
  // Check various headers for IP (handles proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // Fallback to connection remote address (if available)
  return request.ip || 'unknown';
}

/**
 * Check rate limit using sliding window algorithm
 * 
 * Industry best practices:
 * - Uses Redis sorted sets for accurate sliding window
 * - Supports both user-based and IP-based limiting
 * - Universal limits for all users (no tier multipliers)
 * - Graceful degradation on Redis errors
 */
export async function checkApiRateLimit(
  request: NextRequest,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const {
    userId,
    ip,
    routeType,
    customLimit,
    windowMs
  } = options;

  // Determine route type if not provided
  const finalRouteType = routeType || determineRateLimitType(
    request.nextUrl.pathname,
    request.method
  );

  // Get base rate limit config
  const baseConfig = getRateLimit(finalRouteType);
  const baseLimit = customLimit || baseConfig.maxRequests;
  const finalWindowMs = windowMs || baseConfig.windowMs;

  // Determine identifier (user ID preferred, fallback to IP)
  let identifier: string;
  let identifierType: 'user' | 'ip';
  
  if (userId) {
    // User-based rate limiting (authenticated requests)
    identifier = userId;
    identifierType = 'user';
    
    // Universal limit for all authenticated users (no tier multiplier)
    const effectiveLimit = baseLimit;
    const cacheKey = `api_ratelimit:user:${userId}:${finalRouteType}`;
    const now = Date.now();
    const cutoff = now - finalWindowMs;
    
    try {
      // Remove old entries outside the window (sliding window algorithm)
      await redisConnection.zremrangebyscore(cacheKey, 0, cutoff);
      
      // Count current entries in window
      const current = await redisConnection.zcard(cacheKey);
      
      if (current < effectiveLimit) {
        // Add current request to sorted set with timestamp as score
        await redisConnection.zadd(cacheKey, now, `${now}-${Math.random()}`);
        // Set expiration on the key (cleanup)
        await redisConnection.expire(cacheKey, Math.ceil(finalWindowMs / 1000));
        
        return {
          allowed: true,
          limit: effectiveLimit,
          remaining: effectiveLimit - current - 1,
          reset: now + finalWindowMs
        };
      }
      
      // Rate limit exceeded
      const retryAfter = Math.ceil((cutoff + finalWindowMs - now) / 1000);
      
      logSecurityEvent('rate_limit_exceeded', userId, {
        routeType: finalRouteType,
        limit: effectiveLimit,
        current,
        path: request.nextUrl.pathname,
        method: request.method,
        identifierType: 'user'
      });
      
      return {
        allowed: false,
        limit: effectiveLimit,
        remaining: 0,
        reset: cutoff + finalWindowMs,
        retryAfter
      };
    } catch (error) {
      // Graceful degradation: if Redis fails, allow the request but log the error
      console.error('[RateLimit] Redis error, allowing request:', error);
      logSecurityEvent('rate_limit_redis_error', userId, {
        error: error instanceof Error ? error.message : String(error),
        path: request.nextUrl.pathname
      });
      
      // Allow request on Redis failure (fail open)
      return {
        allowed: true,
        limit: effectiveLimit,
        remaining: effectiveLimit - 1,
        reset: now + finalWindowMs
      };
    }
  } else {
    // IP-based rate limiting (for unauthenticated requests)
    identifier = ip || getClientIP(request);
    identifierType = 'ip';
    
    // IP-based limits are more restrictive to prevent abuse
    // Use 0.75x base limit for IP-based (industry standard: stricter for anonymous)
    const ipLimit = Math.floor(baseLimit * 0.75);
    const cacheKey = `api_ratelimit:ip:${identifier}:${finalRouteType}`;
    const now = Date.now();
    const cutoff = now - finalWindowMs;
    
    try {
      // Remove old entries outside the window
      await redisConnection.zremrangebyscore(cacheKey, 0, cutoff);
      
      // Count current entries in window
      const current = await redisConnection.zcard(cacheKey);
      
      if (current < ipLimit) {
        // Add current request to sorted set
        await redisConnection.zadd(cacheKey, now, `${now}-${Math.random()}`);
        await redisConnection.expire(cacheKey, Math.ceil(finalWindowMs / 1000));
        
        return {
          allowed: true,
          limit: ipLimit,
          remaining: ipLimit - current - 1,
          reset: now + finalWindowMs
        };
      }
      
      // Rate limit exceeded
      const retryAfter = Math.ceil((cutoff + finalWindowMs - now) / 1000);
      
      logSecurityEvent('rate_limit_exceeded_ip', undefined, {
        routeType: finalRouteType,
        limit: ipLimit,
        current,
        ip: identifier,
        path: request.nextUrl.pathname,
        method: request.method,
        identifierType: 'ip'
      });
      
      return {
        allowed: false,
        limit: ipLimit,
        remaining: 0,
        reset: cutoff + finalWindowMs,
        retryAfter
      };
    } catch (error) {
      // Graceful degradation: if Redis fails, allow the request but log the error
      console.error('[RateLimit] Redis error, allowing request:', error);
      logSecurityEvent('rate_limit_redis_error_ip', undefined, {
        error: error instanceof Error ? error.message : String(error),
        ip: identifier,
        path: request.nextUrl.pathname
      });
      
      // Allow request on Redis failure (fail open)
      return {
        allowed: true,
        limit: ipLimit,
        remaining: ipLimit - 1,
        reset: now + finalWindowMs
      };
    }
  }
}

/**
 * Add rate limit headers to response
 * 
 * Industry standard headers (RFC 6585, GitHub/Twitter conventions):
 * - X-RateLimit-Limit: Maximum requests allowed in window
 * - X-RateLimit-Remaining: Requests remaining in current window
 * - X-RateLimit-Reset: Timestamp when window resets
 * - Retry-After: Seconds to wait before retrying (when exceeded)
 */
export function addRateLimitHeaders(
  response: NextResponse,
  rateLimit: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', rateLimit.limit.toString());
  response.headers.set('X-RateLimit-Remaining', Math.max(0, rateLimit.remaining).toString());
  response.headers.set('X-RateLimit-Reset', new Date(rateLimit.reset).toISOString());
  
  if (!rateLimit.allowed && rateLimit.retryAfter) {
    response.headers.set('Retry-After', rateLimit.retryAfter.toString());
  }
  
  return response;
}

/**
 * Rate limiting middleware wrapper
 * Use this to wrap API route handlers for cleaner code
 */
export async function withRateLimit<T>(
  request: NextRequest,
  handler: (req: NextRequest, rateLimit: RateLimitResult) => Promise<T>,
  options: RateLimitOptions = {}
): Promise<T | NextResponse> {
  // Check rate limit
  const rateLimit = await checkApiRateLimit(request, options);
  
  // If rate limit exceeded, return 429 response
  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
        retryAfter: rateLimit.retryAfter
      },
      { status: 429 }
    );
    
    return addRateLimitHeaders(response, rateLimit);
  }
  
  // Call handler with rate limit info
  const result = await handler(request, rateLimit);
  
  // If result is NextResponse, add rate limit headers
  if (result instanceof NextResponse) {
    return addRateLimitHeaders(result, rateLimit);
  }
  
  return result;
}
