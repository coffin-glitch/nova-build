import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAuth, unauthorizedResponse } from "@/lib/auth-api-helper";
import { optimizedQueries } from "@/lib/db-optimized";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Cache for frequently accessed data
const cache = new Map();
const CACHE_TTL = 30 * 1000; // 30 seconds

export async function GET(request: NextRequest) {
  try {
    // Require authentication for telegram bids access
    const auth = await requireApiAuth(request);
    const userId = auth.userId;
    
    const { searchParams } = new URL(request.url);
    const hasSearch = searchParams.get("q") || searchParams.get("tag");

    // Check rate limit (search operation if search param present, otherwise read-only)
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: hasSearch ? 'search' : 'readOnly'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }
    const q = searchParams.get("q") || undefined;
    const tag = searchParams.get("tag") || undefined;
    const limitParam = searchParams.get("limit") || "50";
    const offsetParam = searchParams.get("offset") || "0";

    // Input validation
    const validation = validateInput(
      { q, tag, limit: limitParam, offset: offsetParam },
      {
        q: { type: 'string', maxLength: 100, required: false },
        tag: { type: 'string', pattern: /^[A-Z0-9\-_]+$/, maxLength: 10, required: false },
        limit: { type: 'string', pattern: /^\d+$/, required: false },
        offset: { type: 'string', pattern: /^\d+$/, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_telegram_bids_optimized_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const limit = Math.min(parseInt(limitParam), 100);
    const offset = Math.max(0, parseInt(offsetParam));

    // Create cache key
    const cacheKey = `telegram-bids-${q}-${tag}-${limit}-${offset}`;
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ 
        ok: true, 
        data: cached.data,
        cached: true 
      });
    }

    // Build optimized query with parameterized queries (FIX SQL INJECTION)
    let query = optimizedQueries.getActiveTelegramBids(limit, offset);
    
    // FIX: Use parameterized queries instead of sql.unsafe() with string concatenation
    if (q) {
      const searchPattern = `%${q}%`;
      query = sql`${query} AND tb.bid_number ILIKE ${searchPattern}`;
    }

    if (tag) {
      const tagUpper = tag.toUpperCase();
      query = sql`${query} AND tb.tag = ${tagUpper}`;
    }

    const rows = await query;

    // Cache the result
    cache.set(cacheKey, {
      data: rows,
      timestamp: Date.now()
    });

    // Clean old cache entries periodically
    if (cache.size > 100) {
      const now = Date.now();
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          cache.delete(key);
        }
      }
    }

    logSecurityEvent('telegram_bids_optimized_accessed', userId, { 
      hasQuery: !!q,
      tag: tag || null,
      limit,
      offset
    });
    
    const response = NextResponse.json({ 
      ok: true, 
      data: rows,
      cached: false 
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Telegram bids API error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Authentication required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('telegram_bids_optimized_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch bids",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

