import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Ensure user is admin (Supabase-only)
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Get all carrier chat messages with correct column names
    // Note: carrier_user_id was removed in migration 078, only supabase_carrier_user_id exists
    // Note: admin_user_id column still exists (not removed), but supabase_admin_user_id was never added to this table
    const chatMessages = await sql`
      SELECT 
        id,
        supabase_carrier_user_id as carrier_user_id,
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

  } catch (error: any) {
    console.error("Error fetching all chat messages:", error);
    logSecurityEvent('admin_chat_messages_error', undefined, { error: error instanceof Error ? error.message : String(error) });
    
    // Handle authentication/authorization errors properly
    if (error instanceof Error) {
      if (error.message === "Unauthorized" || error.message.includes("Unauthorized")) {
        const response = NextResponse.json({ 
          error: "Authentication required" 
        }, { status: 401 });
        return addSecurityHeaders(response);
      }
      if (error.message === "Admin access required" || error.message.includes("Admin access")) {
        const response = NextResponse.json({ 
          error: "Admin access required" 
        }, { status: 403 });
        return addSecurityHeaders(response);
      }
    }
    
    const response = NextResponse.json({ 
      error: "Failed to fetch chat messages",
      details: error?.message || String(error)
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}
