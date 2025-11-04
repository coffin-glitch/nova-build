import { getSupabaseUserInfo } from "@/lib/auth-unified";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids');
    
    if (!ids) {
      return NextResponse.json({ error: "User IDs are required" }, { status: 400 });
    }

    const userIds = ids.split(',');
    const userInfos: Record<string, any> = {};
    
    // Fetch user info for each ID
    for (const userId of userIds) {
      if (userId.trim()) {
        // Handle special case for admin_system
        if (userId.trim() === 'admin_system') {
          userInfos[userId.trim()] = {
            id: 'admin_system',
            firstName: 'Admin',
            lastName: 'System',
            fullName: 'Admin System',
            emailAddresses: [],
            username: 'admin_system',
            role: "admin"
          };
          continue;
        }
        
        try {
          // Get user info from Supabase
          const userInfo = await getSupabaseUserInfo(userId.trim());
          userInfos[userId.trim()] = userInfo;
          } catch (error) {
          console.error(`Error fetching user info from Supabase for ${userId}:`, error);
          
          // Fallback: try to get user info from local database (shouldn't be needed but kept for safety)
          try {
              const localUser = await sql`
              SELECT 
                cp.supabase_user_id,
                cp.contact_name,
                cp.legal_name,
                urc.role,
                urc.email
              FROM carrier_profiles cp
              LEFT JOIN user_roles_cache urc ON cp.supabase_user_id = urc.supabase_user_id
              WHERE cp.supabase_user_id = ${userId.trim()}
            `;
            
            if (localUser.length > 0) {
              const user = localUser[0];
              userInfos[userId.trim()] = {
                id: userId.trim(),
                firstName: user.contact_name?.split(' ')[0] || null,
                lastName: user.contact_name?.split(' ').slice(1).join(' ') || null,
                fullName: user.contact_name || user.company_name || userId.trim(),
                emailAddresses: user.email ? [{ emailAddress: user.email }] : [],
                username: user.company_name || userId.trim(),
                role: user.role || "carrier"
              };
            } else {
              // Final fallback
              userInfos[userId.trim()] = {
                id: userId.trim(),
                firstName: null,
                lastName: null,
                fullName: userId.trim(),
                emailAddresses: [],
                username: userId.trim(),
                role: "carrier"
              };
            }
          } catch (dbError) {
            console.error(`Error fetching user info from database for ${userId}:`, dbError);
            // Final fallback
            userInfos[userId.trim()] = {
              id: userId.trim(),
              firstName: null,
              lastName: null,
              fullName: userId.trim(),
              emailAddresses: [],
              username: userId.trim(),
              role: "carrier"
            };
          }
        }
      }
    }
    
    return NextResponse.json(userInfos);
  } catch (error) {
    console.error("Error fetching batch user info:", error);
    return NextResponse.json(
      { error: "Failed to fetch user information" },
      { status: 500 }
    );
  }
}
