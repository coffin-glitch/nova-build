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
          
          // If user is an admin, check for display name from admin_profiles
          if (userInfo.role === 'admin') {
            try {
              const adminProfile = await sql`
                SELECT 
                  ap.display_name,
                  ap.display_email,
                  ur.email as system_email
                FROM user_roles_cache ur
                LEFT JOIN admin_profiles ap ON ur.supabase_user_id = ap.supabase_user_id
                WHERE ur.supabase_user_id = ${userId.trim()}
                  AND ur.role = 'admin'
                LIMIT 1
              `;
              
              if (adminProfile.length > 0) {
                const admin = adminProfile[0];
                // Override fullName with display name (with fallback chain)
                const displayName = admin.display_name 
                  || admin.display_email 
                  || admin.system_email 
                  || userInfo.fullName;
                
                userInfo.fullName = displayName;
                // Also update firstName/lastName if display_name exists
                if (admin.display_name) {
                  const nameParts = admin.display_name.split(' ');
                  userInfo.firstName = nameParts[0] || null;
                  userInfo.lastName = nameParts.slice(1).join(' ') || null;
                }
              }
            } catch (adminError) {
              console.error(`Error fetching admin profile for ${userId}:`, adminError);
              // Continue with original userInfo if admin profile fetch fails
            }
          }
          
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
