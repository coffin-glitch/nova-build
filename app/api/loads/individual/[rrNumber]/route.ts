import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ rrNumber: string }> }
) {
  try {
    // Require admin authentication for load updates
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin write operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'admin'
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
    
    const { rrNumber } = await params;
    const body = await request.json();
    const { status } = body;

    // Input validation
    const validation = validateInput(
      { rrNumber, status },
      {
        rrNumber: { required: true, type: 'string', pattern: /^[A-Z0-9\-_]+$/, maxLength: 100 },
        status: { required: true, type: 'string', enum: ['active', 'published', 'completed', 'cancelled', 'archived'] }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_load_update_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!status) {
      const response = NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Validate status
    const validStatuses = ["active", "published", "completed", "cancelled", "archived"];
    if (!validStatuses.includes(status)) {
      const response = NextResponse.json(
        { error: "Invalid status. Must be one of: " + validStatuses.join(", ") },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Update the load status
    const result = await sql`
      UPDATE loads 
      SET 
        status_code = ${status},
        updated_at = NOW()
      WHERE rr_number = ${rrNumber}
      RETURNING rr_number, status_code, updated_at
    `;

    if (!Array.isArray(result) || result.length === 0) {
      const response = NextResponse.json(
        { error: "Load not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    const updatedLoad = result[0];

    logSecurityEvent('load_status_updated', userId, { rrNumber, newStatus: status });
    
    const response = NextResponse.json({
      success: true,
      load: updatedLoad
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error updating load:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('load_update_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to update load",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rrNumber: string }> }
) {
  try {
    // Require authentication for load details
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;
    
    const { rrNumber } = await params;

    // Input validation
    const validation = validateInput(
      { rrNumber },
      {
        rrNumber: { required: true, type: 'string', pattern: /^[A-Z0-9\-_]+$/, maxLength: 100 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_load_details_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const result = await sql`
      SELECT 
        rr_number,
        tm_number,
        status_code,
        pickup_date,
        pickup_time as pickup_window,
        delivery_date,
        delivery_time as delivery_window,
        revenue,
        purchase,
        net,
        margin,
        equipment,
        customer_name,
        driver_name,
        miles as total_miles,
        origin_city,
        origin_state,
        destination_city,
        destination_state,
        vendor_name,
        dispatcher_name,
        updated_at,
        published
      FROM loads
      WHERE rr_number = ${rrNumber}
    `;

    if (!Array.isArray(result) || result.length === 0) {
      return NextResponse.json(
        { error: "Load not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      load: result[0]
    });

  } catch (error) {
    console.error("Error fetching load:", error);
    return NextResponse.json(
      { error: "Failed to fetch load", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
