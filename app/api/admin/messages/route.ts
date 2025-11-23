import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Ensure user is admin (Supabase-only)
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

    const body = await request.json();
    const {
      carrier_user_id,
      subject,
      message
    } = body;

    // Input validation
    const validation = validateInput(
      { carrier_user_id, subject, message },
      {
        carrier_user_id: { required: true, type: 'string', maxLength: 200 },
        subject: { type: 'string', maxLength: 200, required: false },
        message: { required: true, type: 'string', minLength: 1, maxLength: 5000 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_admin_message_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!carrier_user_id || !message) {
      const response = NextResponse.json({ 
        error: "Missing required fields: carrier_user_id, message" 
      }, { status: 400 });
      return addSecurityHeaders(response);
    }

    // Create admin message
    const result = await sql`
      INSERT INTO admin_messages (
        carrier_user_id,
        admin_user_id,
        subject,
        message,
        is_read,
        created_at,
        updated_at
      ) VALUES (${carrier_user_id}, ${userId}, ${subject || 'Admin Message'}, ${message}, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `;

    logSecurityEvent('admin_message_sent', userId, { carrierUserId: carrier_user_id });
    
    const response = NextResponse.json({ 
      ok: true, 
      message: "Message sent successfully",
      data: { id: result[0].id }
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Error sending admin message:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('admin_message_send_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json({ 
      error: "Failed to send message",
      details: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : undefined
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}