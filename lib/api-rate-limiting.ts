/**
 * API Rate Limiting with Tier-Based Limits
 * 
 * Integrates with existing notification tier system:
 * - Premium: 3x base limits (high-volume users)
 * - Standard: 1x base limits (normal usage)
 * - New: 0.5x base limits (prevent abuse)
 * 
 * Generous limits to avoid throttling legitimate users while protecting against abuse.
 * Designed for 10,000+ concurrent users.
 */

import { NextRequest, NextResponse } from "next/server";
import { redisConnection } from "./notification-queue";
import sql from "./db";
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
 * Get user tier from database (cached in Redis)
 * Returns: 'premium' | 'standard' | 'new'
 */
async function getUserTier(userId: string): Promise<'premium' | 'standard' | 'new'> {
  const tierCacheKey = `user_tier:${userId}`;
  let userTier = await redisConnection.get(tierCacheKey);
  
  if (!userTier) {
    // Fetch from database and cache for 1 hour
    try {
      const tierResult = await sql`
        SELECT 
          COALESCE(cp.notification_tier, 'standard') as tier
        FROM carrier_profiles cp
        WHERE cp.supabase_user_id = ${userId}
        LIMIT 1
      `;
      
      userTier = (tierResult[0]?.tier as string) || 'standard';
      await redisConnection.setex(tierCacheKey, 3600, userTier as string); // Cache for 1 hour
    } catch (error) {
      console.error(`[RateLimit] Error fetching user tier for ${userId}:`, error);
      userTier = 'standard'; // Default to standard on error
    }
  }
  
  return (userTier as 'premium' | 'standard' | 'new') || 'standard';
}

/**
 * Get tier multiplier for rate limiting
 * Premium users get 3x, standard gets 1x, new gets 0.5x
 */
function getTierMultiplier(tier: 'premium' | 'standard' | 'new'): number {
  switch (tier) {
    case 'premium':
      return 3.0; // 3x base limit for high-volume users
    case 'standard':
      return 1.0; // 1x base limit (normal usage)
    case 'new':
    default:
      return 0.5; // 0.5x base limit (prevent abuse from new accounts)
  }
}

/**
 * Get client IP from request
 */
function getClientIP(request: NextRequest): string {
  // Check various headers for IP (handles proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Fallback to connection remote address (if available)
  return request.ip || 'unknown';
}

/**
 * Check rate limit using sliding window algorithm
 * Uses Redis sorted sets for accurate rate limiting
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
    identifier = userId;
    identifierType = 'user';
    
    // Get user tier and apply multiplier
    const tier = await getUserTier(userId);
    const multiplier = getTierMultiplier(tier);
    const effectiveLimit = Math.floor(baseLimit * multiplier);
    
    // Use tier-aware cache key
    const cacheKey = `api_ratelimit:user:${userId}:${finalRouteType}:${tier}`;
    const now = Date.now();
    const cutoff = now - finalWindowMs;
    
    // Remove old entries outside the window
    await redisConnection.zremrangebyscore(cacheKey, 0, cutoff);
    
    // Count current entries in window
    const current = await redisConnection.zcard(cacheKey);
    
    if (current < effectiveLimit) {
      // Add current request to sorted set with timestamp as score
      await redisConnection.zadd(cacheKey, now, `${now}-${Math.random()}`);
      // Set expiration on the key
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
      tier,
      limit: effectiveLimit,
      current,
      path: request.nextUrl.pathname,
      method: request.method
    });
    
    return {
      allowed: false,
      limit: effectiveLimit,
      remaining: 0,
      reset: cutoff + finalWindowMs,
      retryAfter
    };
  } else {
    // IP-based rate limiting (for unauthenticated requests)
    identifier = ip || getClientIP(request);
    identifierType = 'ip';
    
    // IP-based limits are more restrictive (no tier multiplier)
    // Use 0.75x base limit for IP-based to prevent abuse
    const ipLimit = Math.floor(baseLimit * 0.75);
    const cacheKey = `api_ratelimit:ip:${identifier}:${finalRouteType}`;
    const now = Date.now();
    const cutoff = now - finalWindowMs;
    
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
      method: request.method
    });
    
    return {
      allowed: false,
      limit: ipLimit,
      remaining: 0,
      reset: cutoff + finalWindowMs,
      retryAfter
    };
  }
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  rateLimit: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', rateLimit.limit.toString());
  response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
  response.headers.set('X-RateLimit-Reset', new Date(rateLimit.reset).toISOString());
  
  if (!rateLimit.allowed && rateLimit.retryAfter) {
    response.headers.set('Retry-After', rateLimit.retryAfter.toString());
  }
  
  return response;
}

/**
 * Rate limiting middleware wrapper
 * Use this to wrap API route handlers
 */
export async function withRateLimit<T>(
  request: NextRequest,
  handler: (req: NextRequest, rateLimit: RateLimitResult) => Promise<T>,
  options: RateLimitOptions = {}
): Promise<T | NextResponse> {
  // Check rate limit
  const rateLimit = await checkApiRateLimit(request, options);
  
  // Add headers to response (will be added by handler if it returns NextResponse)
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

