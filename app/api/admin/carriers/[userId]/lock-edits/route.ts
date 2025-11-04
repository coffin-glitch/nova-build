import sql from "@/lib/db";
import { requireApiAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Await params in Next.js 15
    const { userId } = await params;
    
    console.log("Lock edits API called for userId:", userId);
    
    // Use unified auth (supports Supabase and Clerk)
    const auth = await requireApiAdmin(request);
    const adminUserId = auth.userId;
    console.log("Admin user ID:", adminUserId, "Provider:", auth.provider);

    const body = await request.json();
    const { restore_status } = body; // approved or declined

    console.log("Processing lock edits for userId:", userId);
    console.log("Restore status:", restore_status);

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

    // Lock edits and restore to original status (Supabase-only)
    await sql`
      UPDATE carrier_profiles 
      SET 
        edits_enabled = false,
        profile_status = ${restore_status || currentProfile[0].profile_status}
      WHERE supabase_user_id = ${profileUserId}
    `;

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
        version_number
      ) VALUES (
        ${profileUserId},
        ${JSON.stringify(currentProfile[0])}::jsonb,
        ${restore_status || currentProfile[0].profile_status},
        ${currentProfile[0].submitted_at || new Date()},
        ${currentProfile[0].reviewed_at},
        ${currentProfile[0].reviewed_by},
        ${currentProfile[0].review_notes},
        (SELECT COALESCE(MAX(version_number), 0) + 1 FROM carrier_profile_history WHERE carrier_user_id = ${profileUserId})
      )
    `;
    
    console.log("History record created successfully");

    console.log("Returning success response");
    return NextResponse.json({ 
      success: true, 
      message: `Profile edits locked and status restored to ${restore_status || currentProfile[0].profile_status}` 
    });
  } catch (error) {
    console.error("Error locking carrier profile edits:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: "Failed to lock carrier profile edits" },
      { status: 500 }
    );
  }
}

