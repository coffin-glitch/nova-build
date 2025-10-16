import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch carrier responses
    const responses = await sql`
      SELECT 
        cr.id,
        cr.message_id,
        cr.carrier_user_id,
        cr.response,
        cr.is_read,
        cr.read_at,
        cr.created_at,
        cr.updated_at
      FROM carrier_responses cr
      WHERE cr.carrier_user_id = ${userId}
      ORDER BY cr.created_at DESC
    `;

    return NextResponse.json({ 
      ok: true, 
      data: responses || []
    });

  } catch (error) {
    console.error("Error fetching responses:", error);
    return NextResponse.json({ 
      error: "Failed to fetch responses" 
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      message_id,
      response
    } = body;

    if (!message_id || !response) {
      return NextResponse.json({ 
        error: "Missing required fields: message_id, response" 
      }, { status: 400 });
    }

    // Create carrier response
    const result = await sql`
      INSERT INTO carrier_responses (
        message_id,
        carrier_user_id,
        response,
        created_at,
        updated_at
      ) VALUES (${message_id}, ${userId}, ${response}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `;

    return NextResponse.json({ 
      ok: true, 
      message: "Response sent successfully",
      data: { id: result[0].id }
    });

  } catch (error) {
    console.error("Error sending response:", error);
    return NextResponse.json({ 
      error: "Failed to send response" 
    }, { status: 500 });
  }
}
