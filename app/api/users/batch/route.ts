import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAuth, unauthorizedResponse } from "@/lib/auth-api-helper";
import { getSupabaseUserInfo } from "@/lib/auth-unified";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Require authentication for batch user info access
    const auth = await requireApiAuth(request);
    const requesterUserId = auth.userId;
    
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids');

    // Check rate limit for authenticated read operation (batch operations can be resource-intensive)
    const rateLimit = await checkApiRateLimit(request, {
      userId: requesterUserId,
      routeType: 'readOnly'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }
    
    // Input validation
    const validation = validateInput(
      { ids },
      {
        ids: { required: true, type: 'string', maxLength: 2000 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_batch_user_input', requesterUserId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }
    
    if (!ids) {
      const response = NextResponse.json(
        { error: "User IDs are required" },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    // Parse and validate user IDs (limit to 100 IDs max)
    const userIds = ids.split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0 && id.length <= 200)
      .slice(0, 100); // Limit to 100 user IDs
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
    
    logSecurityEvent('batch_user_info_accessed', requesterUserId, { 
      requestedCount: userIds.length,
      returnedCount: Object.keys(userInfos).length
    });
    
    const response = NextResponse.json(userInfos);
    return addSecurityHeaders(response, request);
    
  } catch (error: any) {
    console.error("Error fetching batch user info:", error);
    
    if (error.message === "Unauthorized" || error.message === "Authentication required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('batch_user_info_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch user information",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}
