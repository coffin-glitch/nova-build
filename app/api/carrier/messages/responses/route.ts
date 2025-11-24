import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Check rate limit for authenticated read operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'readOnly'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          ok: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }

    // Fetch carrier responses
    // Note: carrier_responses may only have carrier_user_id, not supabase_user_id
    const responses = await sql`
      SELECT 
        cr.id,
        cr.message_id,
        cr.carrier_user_id,
        cr.response,
        cr.is_read,
        cr.read_at,
        cr.created_at,
        cr.updated_at
      FROM carrier_responses cr
      WHERE cr.carrier_user_id = ${userId}
      ORDER BY cr.created_at DESC
    `;

    const response = NextResponse.json({ 
      ok: true, 
      data: responses || []
    });
    
    return addSecurityHeaders(response, request);

  } catch (error: any) {
    console.error("Error fetching responses:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_responses_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch responses",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const body = await request.json();
    const {
      message_id,
      response
    } = body;

    // Input validation
    const validation = validateInput(
      { message_id, response },
      {
        message_id: { required: true, type: 'string', maxLength: 50 },
        response: { required: true, type: 'string', minLength: 1, maxLength: 2000 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_carrier_response_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    if (!message_id || !response) {
      const errorResponse = NextResponse.json(
        { error: "Missing required fields: message_id, response" },
        { status: 400 }
      );
      return addSecurityHeaders(errorResponse, request);
    }

    // Create carrier response
    // Note: carrier_responses uses carrier_user_id (stores Supabase user ID)
    const result = await sql`
      INSERT INTO carrier_responses (
        message_id,
        carrier_user_id,
        response,
        created_at,
        updated_at
      ) VALUES (${message_id}, ${userId}, ${response}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `;

    logSecurityEvent('carrier_response_sent', userId, { 
      messageId: message_id,
      responseId: result[0].id
    });
    
    const successResponse = NextResponse.json({ 
      ok: true, 
      message: "Response sent successfully",
      data: { id: result[0].id }
    });
    
    return addSecurityHeaders(successResponse, request);

  } catch (error: any) {
    console.error("Error sending response:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_response_send_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to send response",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}
