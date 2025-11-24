import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Mock data for fallback when database is unavailable
const mockBids = [
  {
    bid_number: "USPS-2024-001",
    distance_miles: 450,
    pickup_timestamp: "2024-09-22T08:00:00Z",
    delivery_timestamp: "2024-09-23T14:00:00Z",
    stops: ["Atlanta, GA", "Nashville, TN", "Memphis, TN"],
    tag: "GA",
    received_at: "2024-09-22T06:30:00Z",
    expires_at: "2024-09-22T12:00:00Z"
  },
  {
    bid_number: "USPS-2024-002",
    distance_miles: 320,
    pickup_timestamp: "2024-09-22T10:00:00Z",
    delivery_timestamp: "2024-09-22T18:00:00Z",
    stops: ["Dallas, TX", "Houston, TX"],
    tag: "TX",
    received_at: "2024-09-22T08:15:00Z",
    expires_at: "2024-09-22T14:00:00Z"
  },
  {
    bid_number: "USPS-2024-003",
    distance_miles: 680,
    pickup_timestamp: "2024-09-22T12:00:00Z",
    delivery_timestamp: "2024-09-23T16:00:00Z",
    stops: ["Chicago, IL", "Indianapolis, IN", "Cleveland, OH"],
    tag: "IL",
    received_at: "2024-09-22T10:45:00Z",
    expires_at: "2024-09-22T16:00:00Z"
  },
  {
    bid_number: "USPS-2024-004",
    distance_miles: 890,
    pickup_timestamp: "2024-09-22T14:00:00Z",
    delivery_timestamp: "2024-09-24T10:00:00Z",
    stops: ["Los Angeles, CA", "Phoenix, AZ", "Denver, CO", "Kansas City, MO"],
    tag: "CA",
    received_at: "2024-09-22T12:30:00Z",
    expires_at: "2024-09-22T18:00:00Z"
  },
  {
    bid_number: "USPS-2024-005",
    distance_miles: 250,
    pickup_timestamp: "2024-09-22T16:00:00Z",
    delivery_timestamp: "2024-09-22T22:00:00Z",
    stops: ["Miami, FL", "Orlando, FL"],
    tag: "FL",
    received_at: "2024-09-22T14:20:00Z",
    expires_at: "2024-09-22T20:00:00Z"
  }
];

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const tag = url.searchParams.get("tag") || "";
    const limitParam = url.searchParams.get("limit") || "50";

    // Check rate limit (search operation if search param present, otherwise public)
    const hasSearch = q || tag;
    
    const rateLimit = await checkApiRateLimit(req, {
      routeType: hasSearch ? 'search' : 'public'
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

    // Input validation
    const validation = validateInput(
      { q, tag, limit: limitParam },
      {
        q: { type: 'string', maxLength: 100, required: false },
        tag: { type: 'string', maxLength: 50, required: false },
        limit: { type: 'string', pattern: /^\d+$/, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_input_bids', undefined, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, req);
    }

    const limit = Math.min(parseInt(limitParam), 100); // Max 100

    // Try to query the database first
    let base = sql`
      select bid_number, distance_miles, pickup_timestamp, delivery_timestamp, stops, tag, received_at, expires_at
      from telegram_bids
      where published = true
    `;
    if (q) base = sql`${base} and bid_number ilike ${'%' + q + '%'}`;
    if (tag) base = sql`${base} and tag = ${tag.toUpperCase()}`;
    base = sql`${base} order by received_at desc limit ${limit}`;
    const rows = await base;

    const response = NextResponse.json({ ok: true, rows });
    return addSecurityHeaders(response, req);
  } catch (error: any) {
    console.error("Bids API error:", error);
    logSecurityEvent('bids_api_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    // Fallback to mock data when database is unavailable
    console.log("Falling back to mock data due to database connection failure");
    
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const tag = url.searchParams.get("tag") || "";
    const limitParam = url.searchParams.get("limit") || "50";
    const limit = Math.min(parseInt(limitParam), 100);

    // Filter mock data based on query parameters
    let filteredBids = mockBids;
    
    if (q) {
      filteredBids = filteredBids.filter(bid => 
        bid.bid_number.toLowerCase().includes(q.toLowerCase())
      );
    }
    
    if (tag) {
      filteredBids = filteredBids.filter(bid => 
        bid.tag === tag.toUpperCase()
      );
    }

    // Apply limit
    filteredBids = filteredBids.slice(0, limit);

    const response = NextResponse.json({ 
      ok: true, 
      rows: filteredBids,
      fallback: true,
      error: "Using mock data - database unavailable"
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response, req), rateLimit);
  }
}
