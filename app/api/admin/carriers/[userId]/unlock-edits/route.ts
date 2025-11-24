import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
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
      logSecurityEvent('invalid_carrier_unlock_edits_userid', undefined, { errors: userIdValidation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${userIdValidation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }
    
    // Use unified auth (supports Supabase and Clerk)
    const auth = await requireApiAdmin(request);
    const adminUserId = auth.userId;

    // Check rate limit for admin write operation
    const rateLimit = await checkApiRateLimit(request, {
      userId: adminUserId,
      routeType: 'admin'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
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
      logSecurityEvent('carrier_unlock_edits_not_found', adminUserId, { userId });
      const response = NextResponse.json(
        { error: "Carrier profile not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response, request);
    }

    const profileUserId = currentProfile[0].supabase_user_id || userId;
    const currentStatus = currentProfile[0].profile_status;

    // Enable edits and set status to 'open' for declined carriers
    if (currentStatus === 'declined') {
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
        WHERE supabase_user_id = ${profileUserId}
      `;

      // Create history record for reset
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
          'declined',
          ${currentProfile[0].submitted_at || new Date()},
          ${currentProfile[0].reviewed_at},
          ${currentProfile[0].reviewed_by},
          ${currentProfile[0].review_notes},
          ${currentProfile[0].decline_reason},
          (SELECT COALESCE(MAX(version_number), 0) + 1 FROM carrier_profile_history WHERE carrier_user_id = ${profileUserId})
        )
      `;
    } else if (currentStatus === 'approved') {
      // For approved carriers, enable edits and set status to 'open'
      await sql`
        UPDATE carrier_profiles 
        SET 
          edits_enabled = true,
          edits_enabled_by = ${adminUserId},
          edits_enabled_at = ${new Date()},
          profile_status = 'open'
        WHERE supabase_user_id = ${profileUserId}
      `;

      // Create history record for edit unlock
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
          'approved',
          ${currentProfile[0].submitted_at || new Date()},
          ${currentProfile[0].reviewed_at},
          ${currentProfile[0].reviewed_by},
          ${currentProfile[0].review_notes},
          (SELECT COALESCE(MAX(version_number), 0) + 1 FROM carrier_profile_history WHERE carrier_user_id = ${profileUserId})
        )
      `;
    }

    logSecurityEvent('carrier_edits_unlocked', adminUserId, { 
      carrierUserId: profileUserId,
      previousStatus: currentStatus
    });
    
    const response = NextResponse.json({ 
      success: true, 
      message: currentStatus === 'declined' 
        ? "Profile edits unlocked and approval process reset successfully" 
        : "Carrier profile edits enabled successfully" 
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    
  } catch (error: any) {
    console.error("Error enabling carrier profile edits:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    if (error.message?.includes("Forbidden")) {
      return forbiddenResponse(error.message);
    }
    
    logSecurityEvent('carrier_unlock_edits_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to enable carrier profile edits",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}
