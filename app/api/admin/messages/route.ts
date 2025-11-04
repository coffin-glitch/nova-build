import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Ensure user is admin (Supabase-only)
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const body = await request.json();
    const {
      carrier_user_id,
      subject,
      message
    } = body;

    if (!carrier_user_id || !message) {
      return NextResponse.json({ 
        error: "Missing required fields: carrier_user_id, message" 
      }, { status: 400 });
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

    return NextResponse.json({ 
      ok: true, 
      message: "Message sent successfully",
      data: { id: result[0].id }
    });

  } catch (error) {
    console.error("Error sending admin message:", error);
    return NextResponse.json({ 
      error: "Failed to send message" 
    }, { status: 500 });
  }
}