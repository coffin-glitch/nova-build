import { getClerkUserRole } from "@/lib/clerk-server";
import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId: adminUserId } = await auth();
    
    if (!adminUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = await getClerkUserRole(adminUserId);
    if (userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = params;
    const { decline_reason, review_notes } = await request.json();

    if (!decline_reason) {
      return NextResponse.json(
        { error: "Decline reason is required" },
        { status: 400 }
      );
    }

    // Get current profile data before updating for history
    const currentProfile = await sql`
      SELECT 
        clerk_user_id,
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
        created_at
      FROM carrier_profiles 
      WHERE clerk_user_id = ${userId}
    `;

    if (currentProfile.length === 0) {
      return NextResponse.json({ error: "Carrier profile not found" }, { status: 404 });
    }

    // Update carrier profile status to declined
    await sql`
      UPDATE carrier_profiles 
      SET 
        profile_status = 'declined',
        reviewed_at = NOW(),
        reviewed_by = ${adminUserId},
        review_notes = ${review_notes || null},
        decline_reason = ${decline_reason},
        edits_enabled = false
      WHERE clerk_user_id = ${userId}
    `;

    // Create history record for decline
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
        ${JSON.stringify(currentProfile[0])},
        'declined',
        ${currentProfile[0].submitted_at || NOW()},
        NOW(),
        ${adminUserId},
        ${review_notes || null},
        ${decline_reason},
        (SELECT COALESCE(MAX(version_number), 0) + 1 FROM carrier_profile_history WHERE carrier_user_id = ${userId})
      )
    `;

    return NextResponse.json({ 
      success: true, 
      message: "Carrier profile declined successfully" 
    });
  } catch (error) {
    console.error("Error declining carrier profile:", error);
    return NextResponse.json(
      { error: "Failed to decline carrier profile" },
      { status: 500 }
    );
  }
}
