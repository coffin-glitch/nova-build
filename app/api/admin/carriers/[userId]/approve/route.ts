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
    
    const { userId: adminUserId } = await auth();
    
    if (!adminUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = await getClerkUserRole(adminUserId);
    if (userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { review_notes } = await request.json();

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

    // Update carrier profile status to approved
    await sql`
      UPDATE carrier_profiles 
      SET 
        profile_status = 'approved',
        reviewed_at = NOW(),
        reviewed_by = ${adminUserId},
        review_notes = ${review_notes || null},
        edits_enabled = false
      WHERE clerk_user_id = ${userId}
    `;

    // Create history record for approval
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
        ${JSON.stringify(currentProfile[0])},
        'approved',
        ${currentProfile[0].submitted_at || NOW()},
        NOW(),
        ${adminUserId},
        ${review_notes || null},
        (SELECT COALESCE(MAX(version_number), 0) + 1 FROM carrier_profile_history WHERE carrier_user_id = ${userId})
      )
    `;

    return NextResponse.json({ 
      success: true, 
      message: "Carrier profile approved successfully" 
    });
  } catch (error) {
    console.error("Error approving carrier profile:", error);
    return NextResponse.json(
      { error: "Failed to approve carrier profile" },
      { status: 500 }
    );
  }
}
