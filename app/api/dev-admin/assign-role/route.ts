import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { userId, role } = await request.json();
    
    if (!userId || !role || !["admin", "carrier"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid userId or role" },
        { status: 400 }
      );
    }
    
    console.log("🎯 Assigning role:", role, "to user:", userId);
    
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
    console.log("✅ Role assigned successfully to user_roles_cache");
    
    return NextResponse.json({ 
      success: true, 
      message: `Role ${role} assigned to user ${userId}` 
    });
  } catch (error: any) {
    console.error("Assign role error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
