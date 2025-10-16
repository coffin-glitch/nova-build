import { getClerkUserRole } from "@/lib/clerk-server";
import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = await getClerkUserRole(userId);
    if (userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
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