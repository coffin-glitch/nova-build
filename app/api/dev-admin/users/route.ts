import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log("🔍 Dev Admin API: Starting user fetch");
    console.log("🔑 Supabase URL exists:", !!supabaseUrl);
    console.log("🔑 Supabase Key exists:", !!supabaseKey);
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("❌ Supabase credentials not configured");
      return NextResponse.json(
        { error: "Supabase credentials not configured" },
        { status: 500 }
      );
    }

    console.log("📡 Fetching users from Supabase...");
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch users from Supabase Auth
    const { data: { users: supabaseUsers }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error("❌ Supabase API Error:", usersError);
      throw new Error(`Supabase API error: ${usersError.message}`);
    }

    console.log("👥 Found Supabase Users:", supabaseUsers?.length || 0);

    // Get user roles from user_roles_cache (Supabase-only)
    console.log("🗄️ Fetching user roles from database...");
    const userRolesCache = await sql`
      SELECT 
        supabase_user_id as user_id,
        role,
        email,
        last_synced as created_at
      FROM user_roles_cache
    `;
    console.log("📊 Found cached user roles:", userRolesCache.length);

    // Create a map of user roles from user_roles_cache only
    const roleMap = new Map();
    userRolesCache.forEach((ur: any) => {
      roleMap.set(ur.user_id, ur.role);
    });

    // Combine Supabase user data with our role data
    console.log("🔄 Combining Supabase data with role data...");
    const users = (supabaseUsers || []).map((supabaseUser: any) => {
      const firstName = supabaseUser.user_metadata?.first_name || supabaseUser.user_metadata?.name?.split(' ')[0] || '';
      const lastName = supabaseUser.user_metadata?.last_name || supabaseUser.user_metadata?.name?.split(' ').slice(1).join(' ') || '';
      
      const user = {
        id: supabaseUser.id,
        email: supabaseUser.email || 'No email',
        firstName,
        lastName,
        role: roleMap.get(supabaseUser.id) || 'none',
        createdAt: supabaseUser.created_at,
        lastSignIn: supabaseUser.last_sign_in_at,
        profileImageUrl: supabaseUser.user_metadata?.avatar_url || null,
        hasImage: !!supabaseUser.user_metadata?.avatar_url
      };
      console.log("👤 Processed user:", user.email, "Role:", user.role);
      return user;
    });

    console.log("✅ Returning", users.length, "users to frontend");
    return NextResponse.json({ users });
  } catch (error: any) {
    console.error("Get users error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
