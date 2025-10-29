import { getClerkUserRole } from "@/lib/clerk-server";
import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Await params in Next.js 15
    const { userId } = await params;
    
    console.log("Unlock edits API called for userId:", userId);
    
    const { userId: adminUserId } = await auth();
    
    if (!adminUserId) {
      console.log("No admin user ID found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Admin user ID:", adminUserId);

    // Check if user is admin
    const userRole = await getClerkUserRole(adminUserId);
    console.log("User role:", userRole);
    
    if (userRole !== "admin") {
      console.log("User is not admin");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.log("Processing unlock edits for userId:", userId);

    // Get current profile data before updating for history
    const currentProfile = await sql`
      SELECT 
        clerk_user_id,
        legal_name,
        company_name,
        mc_number,
        dot_number,
        contact_name,
        phone,
        profile_status,
        submitted_at,
        reviewed_at,
        reviewed_by,
        review_notes,
        decline_reason,
        is_first_login,
        profile_completed_at,
        edits_enabled,
        edits_enabled_by,
        edits_enabled_at,
        created_at,
        updated_at
      FROM carrier_profiles 
      WHERE clerk_user_id = ${userId}
    `;

    console.log("Current profile found:", currentProfile.length > 0 ? "Yes" : "No");

    if (currentProfile.length === 0) {
      console.log("Carrier profile not found for userId:", userId);
      return NextResponse.json({ error: "Carrier profile not found" }, { status: 404 });
    }

    const currentStatus = currentProfile[0].profile_status;
    console.log("Current profile status:", currentStatus);

    // Enable edits and set status to 'open' for declined carriers
    if (currentStatus === 'declined') {
      console.log("Processing declined carrier - resetting approval process");
      
      await sql`
        UPDATE carrier_profiles 
        SET 
          edits_enabled = true,
          edits_enabled_by = ${adminUserId},
          edits_enabled_at = ${new Date()},
          profile_status = 'open',
          submitted_at = NULL,
          reviewed_at = NULL,
          reviewed_by = NULL,
          review_notes = NULL,
          decline_reason = NULL
        WHERE clerk_user_id = ${userId}
      `;

      console.log("Profile updated successfully");

      // Create history record for reset (don't specify id, let it auto-increment)
      await sql`
        INSERT INTO carrier_profile_history (
          carrier_user_id,
          profile_data,
          profile_status,
          submitted_at,
          reviewed_at,
          reviewed_by,
          review_notes,
          decline_reason,
          version_number
        ) VALUES (
          ${userId},
          ${JSON.stringify(currentProfile[0])}::jsonb,
          'declined',
          ${currentProfile[0].submitted_at || new Date()},
          ${currentProfile[0].reviewed_at},
          ${currentProfile[0].reviewed_by},
          ${currentProfile[0].review_notes},
          ${currentProfile[0].decline_reason},
          (SELECT COALESCE(MAX(version_number), 0) + 1 FROM carrier_profile_history WHERE carrier_user_id = ${userId})
        )
      `;
      
      console.log("History record created successfully");
    } else if (currentStatus === 'approved') {
      console.log("Processing approved carrier - enabling edits");
      
      // For approved carriers, enable edits and set status to 'open'
      await sql`
        UPDATE carrier_profiles 
        SET 
          edits_enabled = true,
          edits_enabled_by = ${adminUserId},
          edits_enabled_at = ${new Date()},
          profile_status = 'open'
        WHERE clerk_user_id = ${userId}
      `;

      console.log("Profile updated successfully");

      // Create history record for edit unlock (don't specify id, let it auto-increment)
      await sql`
        INSERT INTO carrier_profile_history (
          carrier_user_id,
          profile_data,
          profile_status,
          submitted_at,
          reviewed_at,
          reviewed_by,
          review_notes,
          version_number
        ) VALUES (
          ${userId},
          ${JSON.stringify(currentProfile[0])}::jsonb,
          'approved',
          ${currentProfile[0].submitted_at || new Date()},
          ${currentProfile[0].reviewed_at},
          ${currentProfile[0].reviewed_by},
          ${currentProfile[0].review_notes},
          (SELECT COALESCE(MAX(version_number), 0) + 1 FROM carrier_profile_history WHERE carrier_user_id = ${userId})
        )
      `;
      
      console.log("History record created successfully");
    } else {
      console.log("Unknown profile status:", currentStatus);
    }

    console.log("Returning success response");
    return NextResponse.json({ 
      success: true, 
      message: currentStatus === 'declined' 
        ? "Profile edits unlocked and approval process reset successfully" 
        : "Carrier profile edits enabled successfully" 
    });
  } catch (error) {
    console.error("Error enabling carrier profile edits:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: "Failed to enable carrier profile edits" },
      { status: 500 }
    );
  }
}
