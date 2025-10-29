import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { getClerkUserRole } from "@/lib/clerk-server";
import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = await getClerkUserRole(userId);
    if (userRole !== "admin") {
      logSecurityEvent('unauthorized_admin_access_attempt', userId);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all carrier chat messages with correct column names
    const chatMessages = await sql`
      SELECT 
        id,
        carrier_user_id,
        message,
        admin_user_id,
        is_from_admin,
        created_at
      FROM carrier_chat_messages 
      ORDER BY created_at DESC
    `;

    logSecurityEvent('admin_chat_messages_accessed', userId);
    
    const response = NextResponse.json({ 
      ok: true, 
      data: chatMessages 
    });
    
    return addSecurityHeaders(response);

  } catch (error) {
    console.error("Error fetching all chat messages:", error);
    logSecurityEvent('admin_chat_messages_error', undefined, { error: error instanceof Error ? error.message : String(error) });
    
    const response = NextResponse.json({ 
      error: "Failed to fetch chat messages" 
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}
