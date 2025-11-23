import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const { notificationId } = await params;

    // Input validation
    const validation = validateInput(
      { notificationId },
      {
        notificationId: { required: true, type: 'string', pattern: /^\d+$/, maxLength: 50 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_notification_read_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Mark notification as read (using main notifications table)
    const result = await sql`
      UPDATE notifications 
      SET read = true
      WHERE id = ${notificationId}::integer AND user_id = ${userId}
      RETURNING id
    `;

    if (result.length === 0) {
      logSecurityEvent('notification_not_found', userId, { notificationId });
      const response = NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    logSecurityEvent('carrier_notification_marked_read', userId, { notificationId });
    
    const response = NextResponse.json({
      ok: true,
      data: { notificationId }
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error marking notification as read:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_notification_read_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to mark notification as read",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
