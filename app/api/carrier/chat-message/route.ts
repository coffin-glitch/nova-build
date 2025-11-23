import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const body = await request.json();
    const { message } = body;

    // Input validation
    const validation = validateInput(
      { message },
      {
        message: { required: true, type: 'string', minLength: 1, maxLength: 2000 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_chat_message_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!message) {
      const response = NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Create carrier chat message (Supabase-only)
    const result = await sql`
      INSERT INTO carrier_chat_messages (
        supabase_user_id,
        message,
        created_at,
        updated_at
      ) VALUES (${userId}, ${message}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `;

    logSecurityEvent('carrier_chat_message_sent', userId, { messageId: result[0].id });
    
    const response = NextResponse.json({ 
      ok: true, 
      message: "Message sent successfully",
      data: { id: result[0].id }
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error sending chat message:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_chat_message_error', undefined, { 
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
    
    return addSecurityHeaders(response);
  }
}
