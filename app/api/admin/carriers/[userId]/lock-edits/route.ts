import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
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

    // Input validation for userId
    const userIdValidation = validateInput(
      { userId },
      {
        userId: { required: true, type: 'string', maxLength: 200 }
      }
    );

    if (!userIdValidation.valid) {
      logSecurityEvent('invalid_carrier_lock_edits_userid', undefined, { errors: userIdValidation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${userIdValidation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }
    
    // Use unified auth (supports Supabase and Clerk)
    const auth = await requireApiAdmin(request);
    const adminUserId = auth.userId;

    const body = await request.json();
    const { restore_status } = body; // approved or declined

    // Input validation for body
    const bodyValidation = validateInput(
      { restore_status },
      {
        restore_status: { type: 'string', enum: ['approved', 'declined'], required: false }
      }
    );

    if (!bodyValidation.valid) {
      logSecurityEvent('invalid_carrier_lock_edits_body', adminUserId, { errors: bodyValidation.errors });
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
      logSecurityEvent('carrier_lock_edits_not_found', adminUserId, { userId });
      const response = NextResponse.json(
        { error: "Carrier profile not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    const profileUserId = currentProfile[0].supabase_user_id || userId;

    // Lock edits and restore to original status (Supabase-only)
    const finalStatus = restore_status || currentProfile[0].profile_status;
    
    await sql`
      UPDATE carrier_profiles 
      SET 
        edits_enabled = false,
        profile_status = ${finalStatus}
      WHERE supabase_user_id = ${profileUserId}
    `;

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
        ${finalStatus},
        ${currentProfile[0].submitted_at || new Date()},
        ${currentProfile[0].reviewed_at},
        ${currentProfile[0].reviewed_by},
        ${currentProfile[0].review_notes},
        (SELECT COALESCE(MAX(version_number), 0) + 1 FROM carrier_profile_history WHERE carrier_user_id = ${profileUserId})
      )
    `;

    logSecurityEvent('carrier_edits_locked', adminUserId, { 
      carrierUserId: profileUserId,
      restoreStatus: finalStatus,
      previousStatus: currentProfile[0].profile_status
    });
    
    const response = NextResponse.json({ 
      success: true, 
      message: `Profile edits locked and status restored to ${finalStatus}` 
    });
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Error locking carrier profile edits:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    if (error.message?.includes("Forbidden")) {
      return forbiddenResponse(error.message);
    }
    
    logSecurityEvent('carrier_lock_edits_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to lock carrier profile edits",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

