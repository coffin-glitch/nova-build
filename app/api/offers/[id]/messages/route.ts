import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const MessageSchema = z.object({
  message: z.string().min(1).max(1000),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get offer messages
    const messages = await sql`
      SELECT 
        om.id,
        om.offer_id,
        om.sender_id,
        om.sender_role,
        om.message,
        om.created_at,
        om.read_at
      FROM offer_messages om
      WHERE om.offer_id = ${id}
      ORDER BY om.created_at ASC
    `;

    return NextResponse.json({
      ok: true,
      data: messages
    });

  } catch (error) {
    console.error("Error fetching offer messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { message } = MessageSchema.parse(body);

    // Get user role
    const userRoleResult = await sql`
      SELECT role FROM user_roles_cache WHERE clerk_user_id = ${userId}
    `;
    
    if (userRoleResult.length === 0) {
      return NextResponse.json({ error: "User role not found" }, { status: 403 });
    }

    const userRole = userRoleResult[0].role;

    // Verify user has access to this offer
    const offerResult = await sql`
      SELECT id FROM load_offers 
      WHERE id = ${id} AND (
        carrier_user_id = ${userId} OR 
        EXISTS (
          SELECT 1 FROM user_roles_cache 
          WHERE clerk_user_id = ${userId} AND role = 'admin'
        )
      )
    `;

    if (offerResult.length === 0) {
      return NextResponse.json({ error: "Offer not found or access denied" }, { status: 404 });
    }

    // Create message
    const messageResult = await sql`
      INSERT INTO offer_messages (
        offer_id,
        sender_id,
        sender_role,
        message,
        created_at
      ) VALUES (
        ${id},
        ${userId},
        ${userRole},
        ${message},
        NOW()
      ) RETURNING id, created_at
    `;

    // Create notification for the other party
    const otherPartyRole = userRole === 'admin' ? 'carrier' : 'admin';
    const otherPartyId = userRole === 'admin' 
      ? (await sql`SELECT carrier_user_id FROM load_offers WHERE id = ${id}`)[0]?.carrier_user_id
      : null; // For admin notifications, we'll handle this differently

    if (otherPartyId) {
      await sql`
        INSERT INTO carrier_notifications (
          carrier_user_id,
          type,
          title,
          message,
          priority,
          load_id,
          action_url
        ) VALUES (
          ${otherPartyId},
          'offer_message',
          'New Message',
          'You have received a new message about your offer.',
          'medium',
          ${id}::uuid,
          '/carrier/my-loads'
        )
      `;
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: messageResult[0].id,
        created_at: messageResult[0].created_at
      }
    });

  } catch (error) {
    console.error("Error sending offer message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
