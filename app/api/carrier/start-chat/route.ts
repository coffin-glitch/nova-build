import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is carrier
    const userRole = await sql`
      SELECT role FROM user_roles WHERE user_id = ${userId}
    `;
    
    if (userRole.length === 0 || userRole[0].role !== 'carrier') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { admin_user_id, message } = body;

    if (!admin_user_id || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify the admin user exists
    const adminExists = await sql`
      SELECT user_id FROM user_roles WHERE user_id = ${admin_user_id} AND role = 'admin'
    `;
    
    if (adminExists.length === 0) {
      return NextResponse.json({ error: "Admin user not found" }, { status: 404 });
    }

    // Check if there's already an existing conversation
    const existingMessage = await sql`
      SELECT id FROM admin_messages 
      WHERE admin_user_id = ${admin_user_id} AND carrier_user_id = ${userId}
      LIMIT 1
    `;

    if (existingMessage.length > 0) {
      return NextResponse.json({ error: "Conversation already exists with this admin" }, { status: 409 });
    }

    // Create a new carrier chat message to start the conversation
    const newMessage = await sql`
      INSERT INTO carrier_chat_messages (carrier_user_id, message, created_at, updated_at)
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
