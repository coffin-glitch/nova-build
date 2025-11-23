import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get('page') || '1';
    const limitParam = searchParams.get('limit') || '20';
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Input validation
    const validation = validateInput(
      { pageParam, limitParam, search, status, sortBy, sortOrder },
      {
        pageParam: { type: 'string', pattern: /^\d+$/, maxLength: 10, required: false },
        limitParam: { type: 'string', pattern: /^\d+$/, maxLength: 10, required: false },
        search: { type: 'string', maxLength: 200, required: false },
        status: { type: 'string', enum: ['all', 'awarded', 'bid_awarded', 'accepted', 'rejected'], maxLength: 50, required: false },
        sortBy: { type: 'string', enum: ['bid_number', 'created_at', 'carrier_name', 'bid_amount', 'status'], maxLength: 50, required: false },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], maxLength: 10, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_awarded_bids_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const page = parseInt(pageParam);
    const limit = parseInt(limitParam);

    // Validate numeric ranges
    if (page < 1 || page > 1000) {
      logSecurityEvent('invalid_awarded_bids_page', userId, { page });
      const response = NextResponse.json(
        { error: "Page must be between 1 and 1000" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (limit < 1 || limit > 100) {
      logSecurityEvent('invalid_awarded_bids_limit', userId, { limit });
      const response = NextResponse.json(
        { error: "Limit must be between 1 and 100" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Validate sort fields
    const validSortFields = ['bid_number', 'created_at', 'carrier_name', 'bid_amount', 'status'];
    const validSortOrders = ['asc', 'desc'];
    
    if (!validSortFields.includes(sortBy)) {
      const response = NextResponse.json(
        { error: "Invalid sort field" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }
    
    if (!validSortOrders.includes(sortOrder)) {
      const response = NextResponse.json(
        { error: "Invalid sort order" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Build WHERE clause using parameterized queries
    const whereConditions: any[] = [];
    const queryParams: any[] = [];
    
    // Always filter for awarded bids only
    whereConditions.push(sql`aa.bid_number IS NOT NULL`);
    
    if (search) {
      // Sanitize search input - only allow alphanumeric, spaces, and basic punctuation
      const sanitizedSearch = search.replace(/[^a-zA-Z0-9\s\-_]/g, '');
      whereConditions.push(sql`(
        aa.bid_number ILIKE ${`%${sanitizedSearch}%`} OR 
        cp.contact_name ILIKE ${`%${sanitizedSearch}%`}
      )`);
    }
    
    if (status !== 'all') {
      whereConditions.push(sql`cb.status = ${status}`);
    }
    
    // Build ORDER BY clause - use validated sortBy and sortOrder
    const orderByField = sortBy;
    const orderByClause = sql`ORDER BY ${sql.unsafe(orderByField)} ${sql.unsafe(sortOrder.toUpperCase())}`;
    
    // Build WHERE clause using parameterized queries
    const whereClause = whereConditions.length > 0 
      ? sql`WHERE ${whereConditions.reduce((acc, condition, index) => 
          index === 0 ? condition : sql`${acc} AND ${condition}`
        )}`
      : sql``;

    // Get total count for pagination using parameterized queries
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM (
        SELECT 
          aa.bid_number,
          ROW_NUMBER() OVER (PARTITION BY aa.bid_number ORDER BY aa.awarded_at DESC, aa.id DESC) as rn
        FROM auction_awards aa
        LEFT JOIN carrier_bids cb ON aa.bid_number = cb.bid_number AND aa.supabase_winner_user_id = cb.supabase_user_id
        LEFT JOIN carrier_profiles cp ON aa.supabase_winner_user_id = cp.supabase_user_id
        LEFT JOIN user_roles_cache urc ON aa.supabase_winner_user_id = urc.supabase_user_id
        LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
        ${whereClause}
      ) ranked_bids
      WHERE rn = 1
    `;
    
    const totalCount = parseInt(countResult[0]?.total || '0');
    
    // Calculate pagination
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(totalCount / limit);

    // Get paginated results using parameterized queries
    const bids = await sql`
      SELECT 
        bid_number,
        id,
        carrier_id,
        carrier_name,
        carrier_email,
        carrier_phone,
        bid_amount,
        status,
        lifecycle_notes,
        driver_name,
        driver_phone,
        driver_email,
        driver_license_number,
        driver_license_state,
        truck_number,
        trailer_number,
        driver_info_submitted_at,
        created_at,
        updated_at,
        miles,
        equipment_type,
        stops,
        pickup_timestamp,
        delivery_timestamp
      FROM (
        SELECT 
          aa.bid_number,
          aa.id,
          aa.supabase_winner_user_id as carrier_id,
          COALESCE(cp.contact_name, 'Carrier (' || aa.supabase_winner_user_id || ')') as carrier_name,
          COALESCE(urc.email, 'No email available') as carrier_email,
          COALESCE(cp.phone, 'No phone available') as carrier_phone,
          aa.winner_amount_cents as bid_amount,
          COALESCE(cb.status, 'awarded') as status,
          cb.lifecycle_notes,
          cb.driver_name,
          cb.driver_phone,
          cb.driver_email,
          cb.driver_license_number,
          cb.driver_license_state,
          cb.truck_number,
          cb.trailer_number,
          cb.driver_info_submitted_at,
          aa.awarded_at as created_at,
          aa.awarded_at as updated_at,
          COALESCE(tb.distance_miles, 0) as miles,
          COALESCE(tb.tag, '') as equipment_type,
          COALESCE(tb.stops, '[]'::jsonb) as stops,
          tb.pickup_timestamp,
          tb.delivery_timestamp,
          ROW_NUMBER() OVER (PARTITION BY aa.bid_number ORDER BY aa.awarded_at DESC, aa.id DESC) as rn
        FROM auction_awards aa
        LEFT JOIN carrier_bids cb ON aa.bid_number = cb.bid_number AND aa.supabase_winner_user_id = cb.supabase_user_id
        LEFT JOIN carrier_profiles cp ON aa.supabase_winner_user_id = cp.supabase_user_id
        LEFT JOIN user_roles_cache urc ON aa.supabase_winner_user_id = urc.supabase_user_id
        LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
        ${whereClause}
      ) ranked_bids
      WHERE rn = 1
      ${orderByClause}
      LIMIT ${limit} OFFSET ${offset}
    `;

    logSecurityEvent('awarded_bids_accessed', userId, { page, limit, totalCount });
    
    const response = NextResponse.json({
      bids,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Error fetching awarded bids:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('awarded_bids_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch awarded bids",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : "Unknown error")
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
