import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ 
        error: "Message is required" 
      }, { status: 400 });
    }

    // Create carrier chat message
    const result = await sql`
      INSERT INTO carrier_chat_messages (
        carrier_user_id,
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
