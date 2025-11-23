import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const { messageId } = await params;

    // Input validation
    const validation = validateInput(
      { messageId },
      {
        messageId: { required: true, type: 'string', maxLength: 50 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_message_read_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Mark message as read
    await sql`
      UPDATE admin_messages SET
        is_read = true,
        read_at = CURRENT_TIMESTAMP
      WHERE id = ${messageId} AND supabase_user_id = ${userId}
    `;

    logSecurityEvent('carrier_message_marked_read', userId, { messageId });
    
    const response = NextResponse.json({ 
      ok: true, 
      message: "Message marked as read" 
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error marking message as read:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_message_read_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to mark message as read",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
