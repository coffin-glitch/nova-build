import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ carrierUserId: string }> }
) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const { carrierUserId } = await params;

    // Input validation
    const validation = validateInput(
      { carrierUserId },
      {
        carrierUserId: { required: true, type: 'string', maxLength: 200 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_admin_messages_get_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Get messages for specific carrier (Supabase-only)
    const messages = await sql`
      SELECT 
        id,
        supabase_user_id,
        admin_user_id,
        subject,
        message,
        is_read,
        read_at,
        created_at,
        updated_at
      FROM admin_messages 
      WHERE supabase_user_id = ${carrierUserId}
      ORDER BY created_at DESC
    `;

    logSecurityEvent('admin_messages_accessed', userId, { carrierUserId, messageCount: messages.length });
    
    const response = NextResponse.json({ 
      ok: true, 
      data: messages 
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching messages:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('admin_messages_get_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json({ 
      error: "Failed to fetch messages",
      details: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : undefined
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}
