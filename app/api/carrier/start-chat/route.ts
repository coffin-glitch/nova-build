import sql from "@/lib/db";
import { requireApiCarrier } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const body = await request.json();
    const { admin_user_id, message } = body;

    if (!admin_user_id || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

    return NextResponse.json({ 
      success: true, 
      message: "New chat started successfully",
      data: newMessage[0]
    });

  } catch (error) {
    console.error("Error starting new chat:", error);
    return NextResponse.json(
      { error: "Failed to start new chat" },
      { status: 500 }
    );
  }
}
