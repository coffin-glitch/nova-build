import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    console.log("🔍 Admin carriers API called");
    
    const { userId } = await auth();
    console.log("👤 User ID:", userId);
    
    if (!userId) {
      console.log("❌ No user ID, returning 401");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin using database
    console.log("🔍 Checking user role in database...");
    const userRole = await sql`
      SELECT role FROM user_roles_cache WHERE clerk_user_id = ${userId}
    `;
    console.log("📊 User role query result:", userRole);
    
    if (userRole.length === 0 || userRole[0].role !== 'admin') {
      console.log("❌ User is not admin, returning 403");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.log("✅ User is admin, fetching carrier profiles...");

    // Fetch carrier profiles with approval workflow data
    const carriers = await sql`
      SELECT 
        cp.clerk_user_id as id,
        cp.clerk_user_id as user_id,
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
        cp.created_at
      FROM carrier_profiles cp
      ORDER BY cp.created_at DESC
    `;

    console.log("📊 Carriers query result:", carriers.length, "carriers found");

    // Fetch emails from Clerk for each carrier
    const carriersWithEmails = await Promise.all(
      carriers.map(async (carrier) => {
        try {
          console.log(`🔍 Fetching email for user: ${carrier.user_id}`);
          
          // Skip placeholder/test user IDs that don't exist in Clerk
          if (carrier.user_id.includes('testcarrier') || 
              carrier.user_id.includes('placeholder') || 
              carrier.user_id.includes('YOUR_CLERK_USER_ID')) {
            console.log(`⏭️ Skipping placeholder user ID: ${carrier.user_id}`);
            return {
              ...carrier,
              email: 'Test Account'
            };
          }
          
          // Make direct API call to Clerk
          const clerkSecretKey = process.env.CLERK_SECRET_KEY;
          if (!clerkSecretKey) {
            console.error('❌ CLERK_SECRET_KEY not found in environment');
            return {
              ...carrier,
              email: 'N/A'
            };
          }
          
          const response = await fetch(`https://api.clerk.com/v1/users/${carrier.user_id}`, {
            headers: {
              'Authorization': `Bearer ${clerkSecretKey}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!response.ok) {
            console.error(`❌ Clerk API error for ${carrier.user_id}: ${response.status} ${response.statusText}`);
            return {
              ...carrier,
              email: 'N/A'
            };
          }
          
          const clerkUser = await response.json();
          const email = clerkUser.email_addresses?.[0]?.email_address || 'N/A';
          console.log(`✅ Found email for ${carrier.user_id}: ${email}`);
          return {
            ...carrier,
            email
          };
        } catch (error) {
          console.error(`❌ Error fetching email for user ${carrier.user_id}:`, error);
          return {
            ...carrier,
            email: 'N/A'
          };
        }
      })
    );

    console.log("✅ Returning carriers data with emails");
    return NextResponse.json({ data: carriersWithEmails || [] });
  } catch (error) {
    console.error("❌ Error fetching carriers:", error);
    return NextResponse.json(
      { error: "Failed to fetch carriers", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}