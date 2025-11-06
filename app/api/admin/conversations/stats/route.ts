import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Supabase auth only
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Calculate average response time for admin messages
    // This calculates the time between a carrier message and the next admin response
    // Simplified query to avoid prepared statement issues
    const responseTimeStats = await sql`
      SELECT 
        AVG(response_minutes) as avg_response_minutes
      FROM (
        SELECT 
          cm1.conversation_id,
          cm1.created_at as carrier_time,
          (
            SELECT cm2.created_at
            FROM conversation_messages cm2
            WHERE cm2.conversation_id = cm1.conversation_id
              AND cm2.sender_type = 'admin'
              AND cm2.created_at > cm1.created_at
            ORDER BY cm2.created_at ASC
            LIMIT 1
          ) as admin_time,
          EXTRACT(EPOCH FROM (
            (
              SELECT cm2.created_at
              FROM conversation_messages cm2
              WHERE cm2.conversation_id = cm1.conversation_id
                AND cm2.sender_type = 'admin'
                AND cm2.created_at > cm1.created_at
              ORDER BY cm2.created_at ASC
              LIMIT 1
            ) - cm1.created_at
          )) / 60 as response_minutes
        FROM conversation_messages cm1
        JOIN conversations c ON c.id = cm1.conversation_id
        WHERE c.supabase_admin_user_id = ${userId}
          AND cm1.sender_type = 'carrier'
      ) subquery
      WHERE admin_time IS NOT NULL
    `;

    const avgResponseMinutes = responseTimeStats[0]?.avg_response_minutes || 0;

    return NextResponse.json({ 
      ok: true, 
      avg_response_minutes: avgResponseMinutes
    });

  } catch (error: any) {
    console.error("Error calculating response time stats:", error);
    return NextResponse.json({ 
      ok: true,
      avg_response_minutes: 0
    });
  }
}

