import { forbiddenResponse, requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { clearCarrierRelatedCaches } from "@/lib/cache-invalidation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Await params in Next.js 15
    const { userId } = await params;
    
    // Use unified auth (supports Supabase and Clerk)
    const auth = await requireApiAdmin(request);
    const adminUserId = auth.userId;

    const { decline_reason, review_notes } = await request.json();

    if (!decline_reason) {
      return NextResponse.json(
        { error: "Decline reason is required" },
        { status: 400 }
      );
    }

    // Get current profile data before updating for history (Supabase-only)
    const currentProfile = await sql`
      SELECT 
        supabase_user_id,
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
      WHERE supabase_user_id = ${userId}
    `;

    if (currentProfile.length === 0) {
      return NextResponse.json({ error: "Carrier profile not found" }, { status: 404 });
    }

    const profileUserId = currentProfile[0].supabase_user_id || userId;

    // Update carrier profile status to declined (Supabase-only)
    await sql`
      UPDATE carrier_profiles 
      SET 
        profile_status = 'declined',
        reviewed_at = NOW(),
        reviewed_by = ${adminUserId},
        review_notes = ${review_notes || null},
        decline_reason = ${decline_reason},
        edits_enabled = false,
        updated_at = NOW()
      WHERE supabase_user_id = ${profileUserId}
    `;
    
    // Clear caches to ensure updated data appears immediately
    clearCarrierRelatedCaches(profileUserId);

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
        ${profileUserId},
        ${JSON.stringify(currentProfile[0])},
        'declined',
        ${currentProfile[0].submitted_at || NOW()},
        NOW(),
        ${adminUserId},
        ${review_notes || null},
        ${decline_reason},
        (SELECT COALESCE(MAX(version_number), 0) + 1 FROM carrier_profile_history WHERE carrier_user_id = ${profileUserId})
      )
    `;

    // Notify carrier about profile decline
    try {
      const { createNotification } = await import('@/lib/notifications');
      
      const companyName = currentProfile[0]?.legal_name || currentProfile[0]?.company_name || 'Your company';
      
      await createNotification(
        profileUserId,
        'profile_declined',
        '❌ Profile Declined',
        `Your profile has been declined. Reason: ${decline_reason}${review_notes ? ` Additional notes: ${review_notes}` : ''}. Please update your profile and resubmit.`,
        {
          carrier_user_id: profileUserId,
          company_name: companyName,
          reviewed_by: adminUserId,
          decline_reason: decline_reason,
          review_notes: review_notes || null,
          reviewed_at: new Date().toISOString()
        }
      );
    } catch (notificationError) {
      console.error('Failed to create carrier notification for profile decline:', notificationError);
      // Don't throw - profile decline should still succeed
    }

    return NextResponse.json({ 
      success: true, 
      message: "Carrier profile declined successfully" 
    });
  } catch (error: any) {
    console.error("Error declining carrier profile:", error);
    
    // Handle auth errors
    if (error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    if (error.message === "Admin access required" || error.message?.includes("Forbidden")) {
      return forbiddenResponse(error.message || "Admin access required");
    }
    
    return NextResponse.json(
      { error: "Failed to decline carrier profile" },
      { status: 500 }
    );
  }
}
