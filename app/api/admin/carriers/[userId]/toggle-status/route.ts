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
    
    console.log("Toggle status API called for userId:", userId);
    
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

    const body = await request.json();
    const { new_status, reason, review_notes } = body;

    console.log("Processing toggle status for userId:", userId);
    console.log("New status:", new_status);

    // Get current profile data before updating for history
    const currentProfile = await sql`
      SELECT 
        id,
        clerk_user_id,
        company_name,
        legal_name,
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

    // Validate new_status
    if (!['approved', 'declined'].includes(new_status)) {
      return NextResponse.json({ error: "Invalid status. Must be 'approved' or 'declined'" }, { status: 400 });
    }

    // Update profile status
    if (new_status === 'approved') {
      await sql`
        UPDATE carrier_profiles 
        SET 
          profile_status = 'approved',
          reviewed_at = NOW(),
          reviewed_by = ${adminUserId},
          review_notes = ${review_notes || null},
          decline_reason = NULL,
          edits_enabled = false
        WHERE clerk_user_id = ${userId}
      `;
    } else if (new_status === 'declined') {
      await sql`
        UPDATE carrier_profiles 
        SET 
          profile_status = 'declined',
          reviewed_at = NOW(),
          reviewed_by = ${adminUserId},
          review_notes = ${review_notes || null},
          decline_reason = ${reason || null},
          edits_enabled = false
        WHERE clerk_user_id = ${userId}
      `;
    }

    console.log("Profile updated successfully");

    // Create history record
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
        ${new_status},
        ${currentProfile[0].submitted_at || new Date()},
        NOW(),
        ${adminUserId},
        ${review_notes || null},
        ${reason || null},
        (SELECT COALESCE(MAX(version_number), 0) + 1 FROM carrier_profile_history WHERE carrier_user_id = ${userId})
      )
    `;
    
    console.log("History record created successfully");

    console.log("Returning success response");
    return NextResponse.json({ 
      success: true, 
      message: `Profile status changed to ${new_status}` 
    });
  } catch (error) {
    console.error("Error toggling carrier profile status:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: "Failed to toggle carrier profile status" },
      { status: 500 }
    );
  }
}

