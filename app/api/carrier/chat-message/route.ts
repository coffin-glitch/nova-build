import sql from "@/lib/db";
import { requireApiCarrier } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ 
        error: "Message is required" 
      }, { status: 400 });
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

    return NextResponse.json({ 
      ok: true, 
      message: "Message sent successfully",
      data: { id: result[0].id }
    });

  } catch (error) {
    console.error("Error sending chat message:", error);
    return NextResponse.json({ 
      error: "Failed to send message" 
    }, { status: 500 });
  }
}
