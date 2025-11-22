import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import sql from "@/lib/db";
import { getApiAuth, requireApiAdmin, forbiddenResponse, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    console.log("🔍 Admin carriers API called");
    
    // Use unified auth (supports Supabase and Clerk)
    const auth = await requireApiAdmin(request);
    console.log("👤 User ID:", auth.userId, "Role:", auth.userRole, "Provider:", auth.provider);

    console.log("✅ User is admin, fetching carrier profiles...");

    // Fetch carrier profiles with approval workflow data (Supabase-only)
    const carriers = await sql`
      SELECT 
        cp.supabase_user_id as id,
        cp.supabase_user_id as user_id,
        cp.supabase_user_id,
        cp.company_name,
        cp.legal_name,
        cp.mc_number,
        cp.dot_number,
        cp.contact_name,
        cp.phone,
        cp.profile_status,
        cp.submitted_at,
        cp.reviewed_at,
        cp.reviewed_by,
        cp.review_notes,
        cp.decline_reason,
        cp.is_first_login,
        cp.profile_completed_at,
        cp.edits_enabled,
        cp.edits_enabled_by,
        cp.edits_enabled_at,
        cp.created_at,
        cp.updated_at
      FROM carrier_profiles cp
      WHERE cp.supabase_user_id IS NOT NULL
      ORDER BY cp.created_at DESC
    `;

    console.log("📊 Carriers query result:", carriers.length, "carriers found");

    // Fetch emails from Supabase for each carrier
    const carriersWithEmails = await Promise.all(
      carriers.map(async (carrier) => {
        try {
          const userId = carrier.supabase_user_id || carrier.user_id;
          console.log(`🔍 Fetching email for user: ${userId}`);
          
          // Skip placeholder/test user IDs
          if (!userId || userId.includes('testcarrier') || 
              userId.includes('placeholder') || 
              userId.includes('YOUR_USER_ID')) {
            console.log(`⏭️ Skipping placeholder user ID: ${userId}`);
            return {
              ...carrier,
              email: 'Test Account',
              company_name: carrier.legal_name || carrier.company_name || 'N/A'
            };
          }
          
          // Get email from user_roles_cache or Supabase Auth
          try {
            // First try user_roles_cache (fastest)
            const cacheResult = await sql`
              SELECT email FROM user_roles_cache WHERE supabase_user_id = ${userId} LIMIT 1
            `;
            
            if (cacheResult.length > 0 && cacheResult[0].email) {
              console.log(`✅ Found email in cache for ${userId}: ${cacheResult[0].email}`);
              return {
                ...carrier,
                email: cacheResult[0].email,
                company_name: carrier.legal_name || carrier.company_name || 'N/A'
              };
            }
            
            // Fallback to Supabase Auth
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            
            if (supabaseUrl && supabaseKey) {
              const { createClient } = await import('@supabase/supabase-js');
              const supabase = createClient(supabaseUrl, supabaseKey);
              const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);
              
              if (!error && user?.email) {
                console.log(`✅ Found email from Supabase for ${userId}: ${user.email}`);
                return {
                  ...carrier,
                  email: user.email,
                  company_name: carrier.legal_name || carrier.company_name || 'N/A'
                };
              }
            }
            
            // Final fallback
            return {
              ...carrier,
              email: 'N/A',
              company_name: carrier.legal_name || carrier.company_name || 'N/A'
            };
          } catch (error) {
            console.error(`❌ Error fetching email for user ${userId}:`, error);
            return {
              ...carrier,
              email: 'N/A',
              company_name: carrier.legal_name || carrier.company_name || 'N/A'
            };
          }
        } catch (error) {
          console.error(`❌ Error processing carrier:`, error);
          return {
            ...carrier,
            email: 'N/A',
            company_name: carrier.legal_name || carrier.company_name || 'N/A'
          };
        }
      })
    );

    console.log("✅ Returning carriers data with emails");
    
    logSecurityEvent('admin_carriers_accessed', auth.userId);
    
    const response = NextResponse.json({ data: carriersWithEmails || [] });
    return addSecurityHeaders(response);
  } catch (error: any) {
    console.error("❌ Error fetching carriers:", error);
    
    // Handle auth errors
    if (error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    if (error.message === "Admin access required" || error.message?.includes("Forbidden")) {
      return forbiddenResponse(error.message || "Admin access required");
    }
    
    logSecurityEvent('admin_carriers_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch carriers",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : "Unknown error")
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}