import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
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

    // Input validation for userId
    const userIdValidation = validateInput(
      { userId },
      {
        userId: { required: true, type: 'string', maxLength: 200 }
      }
    );

    if (!userIdValidation.valid) {
      logSecurityEvent('invalid_carrier_approve_userid', undefined, { errors: userIdValidation.errors });
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

    const body = await request.json();
    const { review_notes } = body;

    // Input validation for body
    const bodyValidation = validateInput(
      { review_notes },
      {
        review_notes: { type: 'string', maxLength: 2000, required: false }
      }
    );

    if (!bodyValidation.valid) {
      logSecurityEvent('invalid_carrier_approve_body', adminUserId, { errors: bodyValidation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${bodyValidation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
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
      logSecurityEvent('carrier_approve_not_found', adminUserId, { userId });
      const response = NextResponse.json(
        { error: "Carrier profile not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response, request);
    }

    const profileUserId = currentProfile[0].supabase_user_id || userId;
    
    // Update carrier profile status to approved (Supabase-only)
    await sql`
      UPDATE carrier_profiles 
      SET 
        profile_status = 'approved',
        reviewed_at = NOW(),
        reviewed_by = ${adminUserId},
        review_notes = ${review_notes || null},
        edits_enabled = false,
        updated_at = NOW()
      WHERE supabase_user_id = ${profileUserId}
    `;
    
    // Clear caches to ensure updated data appears immediately
    await clearCarrierRelatedCaches(profileUserId);

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
        ${profileUserId},
        ${JSON.stringify(currentProfile[0])},
        'approved',
        ${currentProfile[0].submitted_at || new Date().toISOString()},
        NOW(),
        ${adminUserId},
        ${review_notes || null},
        (SELECT COALESCE(MAX(version_number), 0) + 1 FROM carrier_profile_history WHERE carrier_user_id = ${profileUserId})
      )
    `;

    // Notify carrier about profile approval
    try {
      const { createNotification } = await import('@/lib/notifications');
      
      const companyName = currentProfile[0]?.legal_name || currentProfile[0]?.company_name || 'Your company';
      
      await createNotification(
        profileUserId,
        'profile_approved',
        '✅ Profile Approved',
        `Your profile has been approved! You can now place bids and access all carrier features.${review_notes ? ` Notes: ${review_notes}` : ''}`,
        {
          carrier_user_id: profileUserId,
          company_name: companyName,
          reviewed_by: adminUserId,
          review_notes: review_notes || null,
          reviewed_at: new Date().toISOString()
        }
      );
    } catch (notificationError) {
      console.error('Failed to create carrier notification for profile approval:', notificationError);
      // Don't throw - profile approval should still succeed
    }

    // Get updated profile to return in response (for client cache update)
    const updatedProfile = await sql`
      SELECT 
        cp.supabase_user_id as id,
        cp.supabase_user_id,
        cp.legal_name,
        cp.mc_number,
        cp.dot_number,
        cp.contact_name,
        cp.phone,
        cp.profile_status,
        cp.submitted_at,
        cp.reviewed_at,
        cp.reviewed_by,
        cp.review_notes,
        cp.decline_reason,
        cp.is_first_login,
        cp.profile_completed_at,
        cp.edits_enabled,
        cp.edits_enabled_by,
        cp.edits_enabled_at,
        cp.created_at
      FROM carrier_profiles cp
      WHERE cp.supabase_user_id = ${profileUserId}
    `;

    logSecurityEvent('carrier_profile_approved', adminUserId, { carrierUserId: profileUserId });
    
    const response = NextResponse.json({ 
      success: true, 
      message: "Carrier profile approved successfully",
      profile: updatedProfile[0] || null
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    
  } catch (error: any) {
    console.error("Error approving carrier profile:", error);
    
    // Handle auth errors
    if (error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    if (error.message === "Admin access required" || error.message?.includes("Forbidden")) {
      return forbiddenResponse(error.message || "Admin access required");
    }
    
    logSecurityEvent('carrier_approve_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to approve carrier profile",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}
