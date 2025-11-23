import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // CRITICAL: Require admin authentication for role assignment
    const auth = await requireApiAdmin(request);
    const adminUserId = auth.userId;
    
    const body = await request.json();
    const { userId, role } = body;
    
    // Input validation
    const validation = validateInput(
      { userId, role },
      {
        userId: { required: true, type: 'string', minLength: 1, maxLength: 200 },
        role: { required: true, type: 'string', enum: ['admin', 'carrier'] }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_assign_role_input', adminUserId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }
    
    if (!userId || !role || !["admin", "carrier"].includes(role)) {
      logSecurityEvent('invalid_assign_role_values', adminUserId, { userId, role });
      const response = NextResponse.json(
        { error: "Invalid userId or role" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }
    
    // Log role assignment attempt
    logSecurityEvent('role_assignment_attempt', adminUserId, { targetUserId: userId, role });
    
    // Get user email from Supabase Auth or existing record
    let userEmail = '';
    
    // First, try to get email from existing record
    const existingRecord = await sql`
      SELECT email FROM user_roles_cache WHERE supabase_user_id = ${userId} LIMIT 1
    `;
    
    if (existingRecord.length > 0 && existingRecord[0].email) {
      userEmail = existingRecord[0].email;
    } else {
      // Fallback: Get email from Supabase Auth
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (supabaseUrl && supabaseKey) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);
          
          if (!error && user?.email) {
            userEmail = user.email;
          }
        }
      } catch (supabaseError) {
        console.error("Error fetching email from Supabase:", supabaseError);
      }
    }
    
    // If still no email, use a placeholder (shouldn't happen, but prevent constraint violation)
    if (!userEmail) {
      userEmail = `user_${userId.substring(0, 8)}@placeholder.local`;
    }
    
    // Update user_roles_cache (Supabase-only)
    await sql`
      INSERT INTO user_roles_cache (supabase_user_id, role, email, last_synced)
      VALUES (${userId}, ${role}, ${userEmail}, NOW())
      ON CONFLICT (supabase_user_id)
      DO UPDATE SET 
        role = ${role},
        email = COALESCE(EXCLUDED.email, user_roles_cache.email),
        last_synced = NOW()
    `;
    logSecurityEvent('role_assigned', adminUserId, { targetUserId: userId, role });
    
    const response = NextResponse.json({ 
      success: true, 
      message: `Role ${role} assigned to user ${userId}` 
    });
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Assign role error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('role_assignment_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to assign role",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
