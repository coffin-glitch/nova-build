import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Check rate limit for authenticated write operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'authenticated'
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

    const body = await request.json();
    const { admin_user_id, message } = body;

    // Input validation
    const validation = validateInput(
      { admin_user_id, message },
      {
        admin_user_id: { 
          required: true, 
          type: 'string', 
          minLength: 1,
          maxLength: 200
        },
        message: { 
          required: true, 
          type: 'string', 
          minLength: 1,
          maxLength: 1000
        }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_start_chat_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    // Verify the admin user exists (Supabase-only)
    const adminExists = await sql`
      SELECT supabase_user_id FROM user_roles_cache 
      WHERE supabase_user_id = ${admin_user_id} AND role = 'admin'
      LIMIT 1
    `;
    
    if (adminExists.length === 0) {
      return NextResponse.json({ error: "Admin user not found" }, { status: 404 });
    }

    // Check if there's already an existing conversation
    const existingMessage = await sql`
      SELECT id FROM admin_messages 
      WHERE admin_user_id = ${admin_user_id} AND supabase_user_id = ${userId}
      LIMIT 1
    `;

    if (existingMessage.length > 0) {
      return NextResponse.json({ error: "Conversation already exists with this admin" }, { status: 409 });
    }

    // Create a new carrier chat message to start the conversation (Supabase-only)
    const newMessage = await sql`
      INSERT INTO carrier_chat_messages (supabase_user_id, message, created_at, updated_at)
      VALUES (${userId}, ${message}, NOW(), NOW())
      RETURNING id, carrier_user_id, message, created_at
    `;

    logSecurityEvent('chat_started', userId, { admin_user_id, message_id: newMessage[0].id });
    
    const response = NextResponse.json({ 
      success: true, 
      message: "New chat started successfully",
      data: newMessage[0]
    });
    
    return addSecurityHeaders(response, request);

  } catch (error: any) {
    console.error("Error starting new chat:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('chat_start_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to start new chat",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}
