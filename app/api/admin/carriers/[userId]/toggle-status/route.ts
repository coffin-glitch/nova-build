import sql from "@/lib/db";
import { requireApiAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";
import { clearCarrierRelatedCaches } from "@/lib/cache-invalidation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Await params in Next.js 15
    const { userId } = await params;
    
    console.log("Toggle status API called for userId:", userId);
    
    // Use unified auth (supports Supabase and Clerk)
    const auth = await requireApiAdmin(request);
    const adminUserId = auth.userId;
    console.log("Admin user ID:", adminUserId, "Provider:", auth.provider);

    const body = await request.json();
    const { new_status, reason, review_notes } = body;

    console.log("Processing toggle status for userId:", userId);
    console.log("New status:", new_status);

    // Get current profile data before updating for history (Supabase-only)
    const currentProfile = await sql`
      SELECT 
        supabase_user_id,
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
      WHERE supabase_user_id = ${userId}
    `;

    console.log("Current profile found:", currentProfile.length > 0 ? "Yes" : "No");

    if (currentProfile.length === 0) {
      console.log("Carrier profile not found for userId:", userId);
      return NextResponse.json({ error: "Carrier profile not found" }, { status: 404 });
    }

    const profileUserId = currentProfile[0].supabase_user_id || userId;

    // Validate new_status
    if (!['approved', 'declined'].includes(new_status)) {
      return NextResponse.json({ error: "Invalid status. Must be 'approved' or 'declined'" }, { status: 400 });
    }

    // Update profile status (Supabase-only)
    if (new_status === 'approved') {
      await sql`
        UPDATE carrier_profiles 
        SET 
          profile_status = 'approved',
          reviewed_at = NOW(),
          reviewed_by = ${adminUserId},
          review_notes = ${review_notes || null},
          decline_reason = NULL,
          edits_enabled = false,
          updated_at = NOW()
        WHERE supabase_user_id = ${profileUserId}
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
          edits_enabled = false,
          updated_at = NOW()
        WHERE supabase_user_id = ${profileUserId}
      `;
    }
    
    // Clear caches to ensure updated data appears immediately
    await clearCarrierRelatedCaches(profileUserId);

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
        ${profileUserId},
        ${JSON.stringify(currentProfile[0])}::jsonb,
        ${new_status},
        ${currentProfile[0].submitted_at || new Date()},
        NOW(),
        ${adminUserId},
        ${review_notes || null},
        ${reason || null},
        (SELECT COALESCE(MAX(version_number), 0) + 1 FROM carrier_profile_history WHERE carrier_user_id = ${profileUserId})
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

