import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAuth, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

// Utility to build ILIKE patterns safely
function ilike(s?: string|null) {
  if (!s) return null;
  const v = s.trim();
  if (!v) return null;
  return `%${v.replace(/[%_]/g, '')}%`;
}

export async function POST(req: NextRequest) {
  try {
    // Require authentication for load search
    const auth = await requireApiAuth(req);
    const userId = auth.userId;

    // Check rate limit for search operation
    const rateLimit = await checkApiRateLimit(req, {
      userId,
      routeType: 'search'
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
      return addRateLimitHeaders(addSecurityHeaders(response, req), rateLimit);
    }
    
    const body = await req.json().catch(() => ({}));
    const {
      q,
      origin,
      destination,
      equipment,
      pickupFrom, // ISO yyyy-mm-dd
      pickupTo,   // ISO yyyy-mm-dd
      milesMin,
      milesMax,
      limit = 60,
      offset = 0,
    } = body || {};

    // Input validation
    const validation = validateInput(
      { q, origin, destination, equipment, pickupFrom, pickupTo, milesMin, milesMax, limit, offset },
      {
        q: { type: 'string', maxLength: 200, required: false },
        origin: { type: 'string', maxLength: 200, required: false },
        destination: { type: 'string', maxLength: 200, required: false },
        equipment: { type: 'string', maxLength: 100, required: false },
        pickupFrom: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/, required: false },
        pickupTo: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/, required: false },
        milesMin: { type: 'number', min: 0, max: 10000, required: false },
        milesMax: { type: 'number', min: 0, max: 10000, required: false },
        limit: { type: 'number', min: 1, max: 200, required: false },
        offset: { type: 'number', min: 0, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_load_search_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, req);
    }

  const oLike = ilike(origin);
  const dLike = ilike(destination);
  const qLike = ilike(q);
  const eLike = ilike(equipment);

  // Build dynamic WHERE
  // Always published=true
  const clauses: string[] = ['published = true'];
  const params: any[] = [];

  if (oLike) { params.push(oLike); clauses.push(`(concat_ws(', ', origin_city, origin_state) ILIKE $${params.length})`); }
  if (dLike) { params.push(dLike); clauses.push(`(concat_ws(', ', destination_city, destination_state) ILIKE $${params.length})`); }
  if (eLike) { params.push(eLike); clauses.push(`(equipment ILIKE $${params.length})`); }
  if (qLike) {
    params.push(qLike, qLike, qLike, qLike);
    clauses.push(`(
      rr_number::text ILIKE $${params.length-3}
      OR coalesce(origin_city,'') ILIKE $${params.length-2}
      OR coalesce(destination_city,'') ILIKE $${params.length-1}
      OR coalesce(equipment,'') ILIKE $${params.length}
    )`);
  }
  if (pickupFrom) { params.push(pickupFrom); clauses.push(`(pickup_date >= $${params.length})`); }
  if (pickupTo)   { params.push(pickupTo);   clauses.push(`(pickup_date <= $${params.length})`); }
  if (milesMin != null && milesMin !== '') { params.push(Number(milesMin)); clauses.push(`(coalesce(total_miles,0) >= $${params.length})`); }
  if (milesMax != null && milesMax !== '') { params.push(Number(milesMax)); clauses.push(`(coalesce(total_miles,0) <= $${params.length})`); }

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

    // Use parameterized query instead of sql.unsafe to prevent SQL injection
    // Build query using sql template literals
    let query = sql`
      SELECT 
        rr_number, 
        equipment, 
        total_miles, 
        revenue, 
        purchase, 
        margin,
        origin_city, 
        origin_state, 
        destination_city, 
        destination_state,
        pickup_date, 
        delivery_date, 
        updated_at
      FROM public.loads
      WHERE published = true
    `;

    // Add filters using parameterized queries
    if (oLike) {
      query = sql`${query} AND (CONCAT_WS(', ', origin_city, origin_state) ILIKE ${oLike})`;
    }
    if (dLike) {
      query = sql`${query} AND (CONCAT_WS(', ', destination_city, destination_state) ILIKE ${dLike})`;
    }
    if (eLike) {
      query = sql`${query} AND equipment ILIKE ${eLike}`;
    }
    if (qLike) {
      query = sql`${query} AND (
        rr_number::text ILIKE ${qLike}
        OR COALESCE(origin_city, '') ILIKE ${qLike}
        OR COALESCE(destination_city, '') ILIKE ${qLike}
        OR COALESCE(equipment, '') ILIKE ${qLike}
      )`;
    }
    if (pickupFrom) {
      query = sql`${query} AND pickup_date >= ${pickupFrom}`;
    }
    if (pickupTo) {
      query = sql`${query} AND pickup_date <= ${pickupTo}`;
    }
    if (milesMin != null && milesMin !== '') {
      query = sql`${query} AND COALESCE(total_miles, 0) >= ${Number(milesMin)}`;
    }
    if (milesMax != null && milesMax !== '') {
      query = sql`${query} AND COALESCE(total_miles, 0) <= ${Number(milesMax)}`;
    }

    query = sql`${query} ORDER BY pickup_date NULLS LAST, updated_at DESC LIMIT ${Math.min(limit, 200)} OFFSET ${Math.max(0, offset)}`;
    
    const rows = await query;

    logSecurityEvent('load_search_performed', userId, { 
      hasQuery: !!q,
      resultCount: rows.length
    });
    
    const response = NextResponse.json({ rows });
    return addRateLimitHeaders(addSecurityHeaders(response, req), rateLimit);
    
  } catch (error: any) {
    console.error("Error searching loads:", error);
    
    if (error.message === "Unauthorized" || error.message === "Authentication required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('load_search_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        rows: [],
        error: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : "Failed to search loads"
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, req);
  }
}
