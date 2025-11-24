import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ loadId: string }> }
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Check rate limit for read-only carrier operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'readOnly'
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
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }

    const { loadId } = await params;

    // Input validation
    const validation = validateInput(
      { loadId },
      {
        loadId: { required: true, type: 'string', maxLength: 200 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_load_status_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    // Get current load status
    const loadStatus = await sql`
      SELECT 
        lo.status,
        lo.updated_at as lastUpdated,
        l.rr_number,
        l.origin_city,
        l.origin_state,
        l.destination_city,
        l.destination_state
      FROM load_offers lo
      INNER JOIN loads l ON lo.load_rr_number = l.rr_number
      WHERE lo.supabase_user_id = ${userId}
        AND lo.id = ${loadId}
        AND lo.status = 'accepted'
    `;

    if (loadStatus.length === 0) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    logSecurityEvent('load_status_accessed', userId, { loadId });
    
    const response = NextResponse.json({
      ok: true,
      data: loadStatus[0]
    });
    
    return addSecurityHeaders(response, request);

  } catch (error: any) {
    console.error("Error fetching load status:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('load_status_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch load status",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ loadId: string }> }
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const { loadId } = await params;
    const body = await request.json();
    const { status: newStatus } = body;

    // Input validation
    const validation = validateInput(
      { loadId, newStatus },
      {
        loadId: { required: true, type: 'string', maxLength: 200 },
        newStatus: { 
          required: true, 
          type: 'string', 
          enum: ['assigned', 'picked_up', 'in_transit', 'delivered', 'completed']
        }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_load_status_update_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    // Validate status transition
    const validTransitions = {
      accepted: ['assigned'],
      assigned: ['picked_up'],
      picked_up: ['in_transit'],
      in_transit: ['delivered'],
      delivered: ['completed']
    };

    // Get current status
    const currentLoad = await sql`
      SELECT status FROM load_offers 
      WHERE id = ${loadId} AND supabase_user_id = ${userId}
    `;

    if (currentLoad.length === 0) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    const currentStatus = currentLoad[0].status;
    
    if (!validTransitions[currentStatus as keyof typeof validTransitions]?.includes(newStatus)) {
      return NextResponse.json({ 
        error: `Invalid status transition from ${currentStatus} to ${newStatus}` 
      }, { status: 400 });
    }

    // Update status
    const result = await sql`
      UPDATE load_offers 
      SET 
        status = ${newStatus},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${loadId} AND supabase_user_id = ${userId}
      RETURNING status, updated_at
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
    }

    logSecurityEvent('load_status_updated', userId, { 
      loadId, 
      oldStatus: currentStatus, 
      newStatus 
    });
    
    const response = NextResponse.json({
      ok: true,
      data: {
        status: result[0].status,
        lastUpdated: result[0].updated_at
      }
    });
    
    return addSecurityHeaders(response, request);

  } catch (error: any) {
    console.error("Error updating load status:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('load_status_update_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to update load status",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}
