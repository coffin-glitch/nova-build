import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
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
    
    // Use unified auth (supports Supabase and Clerk)
    const auth = await requireApiAdmin(request);
    const adminUserId = auth.userId;

    // Input validation for userId
    const userIdValidation = validateInput(
      { userId },
      {
        userId: { required: true, type: 'string', maxLength: 200 }
      }
    );

    if (!userIdValidation.valid) {
      logSecurityEvent('invalid_toggle_status_userid', adminUserId, { errors: userIdValidation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${userIdValidation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const body = await request.json();
    const { new_status, reason, review_notes } = body;

    // Input validation for body
    const bodyValidation = validateInput(
      { new_status, reason, review_notes },
      {
        new_status: { required: true, type: 'string', enum: ['approved', 'declined'] },
        reason: { type: 'string', maxLength: 500, required: false },
        review_notes: { type: 'string', maxLength: 2000, required: false }
      }
    );

    if (!bodyValidation.valid) {
      logSecurityEvent('invalid_toggle_status_body', adminUserId, { errors: bodyValidation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${bodyValidation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }


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

    if (currentProfile.length === 0) {
      logSecurityEvent('toggle_status_profile_not_found', adminUserId, { targetUserId: userId });
      const response = NextResponse.json(
        { error: "Carrier profile not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    const profileUserId = currentProfile[0].supabase_user_id || userId;

    // Validate new_status (already validated above, but double-check)
    if (!['approved', 'declined'].includes(new_status)) {
      const response = NextResponse.json(
        { error: "Invalid status. Must be 'approved' or 'declined'" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
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
    
    logSecurityEvent('carrier_status_toggled', adminUserId, { 
      targetUserId: profileUserId,
      newStatus: new_status,
      previousStatus: currentProfile[0].profile_status
    });
    
    const response = NextResponse.json({ 
      success: true, 
      message: `Profile status changed to ${new_status}` 
    });
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Error toggling carrier profile status:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('toggle_status_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to toggle carrier profile status",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

