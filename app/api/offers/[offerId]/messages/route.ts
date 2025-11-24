import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const MessageSchema = z.object({
  message: z.string().min(1).max(1000),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    // Ensure user is authenticated (Supabase-only)
    let userId: string;
    try {
      const adminAuth = await requireApiAdmin(request);
      userId = adminAuth.userId;
    } catch {
      const carrierAuth = await requireApiCarrier(request);
      userId = carrierAuth.userId;
    }

    // Check rate limit for authenticated read operation
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

    const { offerId } = await params;
    const id = offerId;

    // Input validation
    const validation = validateInput(
      { offerId },
      {
        offerId: { required: true, type: 'string', maxLength: 50 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_offer_messages_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    // Get offer messages
    const messages = await sql`
      SELECT 
        om.id,
        om.offer_id,
        om.sender_id,
        om.sender_role,
        om.message,
        om.created_at,
        om.read_at
      FROM offer_messages om
      WHERE om.offer_id = ${id}
      ORDER BY om.created_at ASC
    `;

    const response = NextResponse.json({
      ok: true,
      data: messages
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);

  } catch (error: any) {
    console.error("Error fetching offer messages:", error);
    
    if (error.message === "Unauthorized" || error.message === "Authentication required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('offer_messages_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch messages",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    // Check if user is admin or carrier (Supabase-only)
    let userId: string;
    let userRole: 'admin' | 'carrier';
    
    try {
      const adminAuth = await requireApiAdmin(request);
      userId = adminAuth.userId;
      userRole = 'admin';
    } catch {
      // Not admin, try carrier
      const carrierAuth = await requireApiCarrier(request);
      userId = carrierAuth.userId;
      userRole = 'carrier';
    }

    const { offerId } = await params;
    const id = offerId;
    
    // Input validation for offerId
    const offerIdValidation = validateInput(
      { offerId },
      {
        offerId: { required: true, type: 'string', maxLength: 50 }
      }
    );

    if (!offerIdValidation.valid) {
      logSecurityEvent('invalid_offer_message_create_input', userId, { errors: offerIdValidation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${offerIdValidation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }
    
    const body = await request.json();
    const { message } = MessageSchema.parse(body);

    // Verify user has access to this offer (Supabase-only)
    const offerResult = await sql`
      SELECT id FROM load_offers 
      WHERE id = ${id} AND (
        supabase_carrier_user_id = ${userId} OR 
        EXISTS (
          SELECT 1 FROM user_roles_cache 
          WHERE supabase_user_id = ${userId} AND role = 'admin'
        )
      )
    `;

    if (offerResult.length === 0) {
      logSecurityEvent('offer_message_unauthorized_access', userId, { offerId: id });
      const response = NextResponse.json(
        { error: "Offer not found or access denied" },
        { status: 404 }
      );
      return addSecurityHeaders(response, request);
    }

    // Create message
    const messageResult = await sql`
      INSERT INTO offer_messages (
        offer_id,
        sender_id,
        sender_role,
        message,
        created_at
      ) VALUES (
        ${id},
        ${userId},
        ${userRole},
        ${message},
        NOW()
      ) RETURNING id, created_at
    `;

    // Create notification for the other party (Supabase-only)
    const otherPartyRole = userRole === 'admin' ? 'carrier' : 'admin';
    const otherPartyId = userRole === 'admin' 
      ? (await sql`SELECT supabase_user_id FROM load_offers WHERE id = ${id}`)[0]?.supabase_user_id
      : null; // For admin notifications, we'll handle this differently

    if (otherPartyId) {
      await sql`
        INSERT INTO carrier_notifications (
          supabase_user_id,
          type,
          title,
          message,
          priority,
          load_id,
          action_url
        ) VALUES (
          ${otherPartyId},
          'offer_message',
          'New Message',
          'You have received a new message about your offer.',
          'medium',
          ${id}::uuid,
          '/carrier/my-loads'
        )
      `;
    }

    logSecurityEvent('offer_message_sent', userId, { 
      offerId: id,
      userRole
    });
    
    const response = NextResponse.json({
      ok: true,
      data: {
        id: messageResult[0].id,
        created_at: messageResult[0].created_at
      }
    });
    
    return addSecurityHeaders(response, request);

  } catch (error: any) {
    console.error("Error sending offer message:", error);
    
    if (error.message === "Unauthorized" || error.message === "Authentication required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('offer_message_send_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to send message",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}
