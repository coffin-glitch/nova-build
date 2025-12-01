import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import { clearCarrierRelatedCaches } from "@/lib/cache-invalidation";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Helper function to parse contact name and extract firstName/lastName
function parseContactNameToFullName(contactName: string): { firstName: string; lastName: string } {
  if (!contactName || !contactName.trim()) {
    return { firstName: '', lastName: '' };
  }
  
  // If contact_name is an email, extract the part before @
  let nameToUse = contactName.trim();
  if (contactName.includes('@')) {
    nameToUse = contactName.split('@')[0].trim();
  }
  
  // Split into firstName and lastName
  const nameParts = nameToUse.split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  return { firstName, lastName };
}

// Helper function to sync contact_name to Supabase user metadata
async function syncContactNameToUserMetadata(userId: string, contactName: string): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn('[Carrier Profile] Supabase credentials not configured, skipping user metadata update');
      return;
    }
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { firstName, lastName } = parseContactNameToFullName(contactName);
    
    // Get existing user metadata to preserve other fields
    const { data: { user }, error: getUserError } = await supabase.auth.admin.getUserById(userId);
    
    if (getUserError || !user) {
      console.warn(`[Carrier Profile] Could not get user ${userId} for metadata update:`, getUserError);
      return;
    }
    
    // Update user metadata with firstName and lastName
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...user.user_metadata,
        first_name: firstName || null,
        last_name: lastName || null,
        full_name: contactName || null,
      }
    });
    
    if (updateError) {
      console.warn(`[Carrier Profile] Could not update user metadata for ${userId}:`, updateError);
    } else {
      console.log(`[Carrier Profile] Successfully synced contact_name to user metadata for ${userId}`);
    }
  } catch (error: any) {
    console.error(`[Carrier Profile] Error syncing contact_name to user metadata:`, error?.message);
    // Don't throw - this is a best-effort sync
  }
}

export async function GET(request: NextRequest) {
  try {
    let auth;
    try {
      auth = await requireApiCarrier(request);
    } catch (authError: any) {
      console.error("[carrier/profile] Auth error:", authError);
      return unauthorizedResponse();
    }
    const userId = auth.userId;
    
    // Check rate limit for authenticated read operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'readOnly'
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
    
    // Get carrier profile from database (Supabase-only)
    // Check if notification_tier column exists
    const columnCheck = await sql`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'carrier_profiles' 
        AND column_name = 'notification_tier'
      ) as column_exists
    `;
    const hasNotificationTier = columnCheck[0]?.column_exists === true;

    const profiles = hasNotificationTier
      ? await sql`
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
            COALESCE(cp.notification_tier, 'new') as notification_tier,
            COALESCE(cp.notifications_disabled, false) as notifications_disabled,
            cp.created_at
          FROM carrier_profiles cp
          WHERE cp.supabase_user_id = ${userId}
        `
      : await sql`
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
            'new'::text as notification_tier,
            false::boolean as notifications_disabled,
            cp.created_at
          FROM carrier_profiles cp
          WHERE cp.supabase_user_id = ${userId}
        `;

    const profile = profiles[0] || null;

    logSecurityEvent('carrier_profile_accessed', userId);
    
    const response = NextResponse.json({ 
      ok: true, 
      data: profile 
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);

  } catch (error: any) {
    console.error("Error fetching carrier profile:", error);
    logSecurityEvent('carrier_profile_error', undefined, { error: error instanceof Error ? error.message : String(error) });
    
    // Handle authentication errors properly - return JSON instead of HTML
    if (error instanceof Error) {
      if (error.message === "Unauthorized" || error.message.includes("Unauthorized")) {
        const response = NextResponse.json({ 
          error: "Authentication required" 
        }, { status: 401 });
        return addSecurityHeaders(response, request);
      }
      if (error.message === "Carrier access required" || error.message.includes("Carrier access")) {
        const response = NextResponse.json({ 
          error: "Carrier access required" 
        }, { status: 403 });
        return addSecurityHeaders(response, request);
      }
    }
    
    const response = NextResponse.json({ 
      error: "Failed to fetch profile",
      details: error?.message || String(error)
    }, { status: 500 });
    
    return addSecurityHeaders(response, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Validate request size
    const { validateRequestSize, getMaxSizeForContentType } = await import('@/lib/api-security');
    const contentType = request.headers.get('content-type');
    const maxSize = getMaxSizeForContentType(contentType);
    const sizeError = await validateRequestSize(request, maxSize);
    if (sizeError) {
      return sizeError;
    }

    // Check rate limit for authenticated write operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'authenticated'
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
    const {
      legal_name: companyName,
      mc_number: mcNumber,
      dot_number: dotNumber,
      contact_name: contactName,
      phone,
      submit_for_approval = false
    } = body;

    // Format phone number - remove all non-numeric characters and ensure it's a valid US phone number
    const formattedPhone = phone?.replace(/\D/g, '') || '';
    const isValidPhone = formattedPhone.length >= 10 && formattedPhone.length <= 11;

    // Input validation
    const validation = validateInput({ 
      companyName, 
      mcNumber, 
      contactName, 
      phone, 
      submit_for_approval 
    }, {
      companyName: { required: true, type: 'string', minLength: 2, maxLength: 100 },
      mcNumber: { required: true, type: 'string', pattern: /^\d+$/ },
      contactName: { required: true, type: 'string', minLength: 2, maxLength: 50 },
      phone: { required: true, type: 'string', minLength: 10 },
      submit_for_approval: { type: 'boolean' }
    });

    // Add custom phone validation error
    if (!isValidPhone) {
      validation.valid = false;
      validation.errors.push('phone format is invalid');
    }

    if (!validation.valid) {
      logSecurityEvent('invalid_profile_input', userId, { errors: validation.errors });
      return NextResponse.json({ 
        error: `Invalid input: ${validation.errors.join(', ')}` 
      }, { status: 400 });
    }

    // Check if MC is disabled in access control
    const mcAccessCheck = await sql`
      SELECT is_active, disabled_reason
      FROM mc_access_control
      WHERE mc_number = ${mcNumber}
      LIMIT 1
    `;
    
    // Check if MC or DOT is on DNU list
    const dnuCheck = await sql`
      SELECT id, mc_number, dot_number, status
      FROM dnu_tracking
      WHERE status = 'active'
      AND (
        mc_number = ${mcNumber}
        OR (${dotNumber || null} IS NOT NULL AND dot_number = ${dotNumber || null})
      )
      LIMIT 1
    `;
    
    if (dnuCheck.length > 0) {
      logSecurityEvent('dnu_profile_blocked', userId, { 
        mc_number: mcNumber, 
        dot_number: dotNumber,
        dnu_entry: dnuCheck[0]
      });
      return NextResponse.json({ 
        error: "This MC or DOT number is on the Do Not Use (DNU) list and cannot be registered. Please contact support if you believe this is an error." 
      }, { status: 403 });
    }
    
    if (mcAccessCheck.length > 0 && mcAccessCheck[0].is_active === false) {
      const reason = mcAccessCheck[0].disabled_reason || 'DNU by USPS';
      logSecurityEvent('blocked_signup_disabled_mc', userId, { mc_number: mcNumber, reason });
      return NextResponse.json({ 
        error: `Your MC number (${mcNumber}) is not allowed access to the bid board. ${reason}. Please contact support if you believe this is an error.` 
      }, { status: 403 });
    }

    // Check if profile exists (Supabase-only)
    const existingProfiles = await sql`
      SELECT 
        cp.supabase_user_id
      FROM carrier_profiles cp
      WHERE cp.supabase_user_id = ${userId}
    `;

    const existingProfile = existingProfiles[0];

    if (existingProfile) {
      // Update existing profile
      if (submit_for_approval) {
        // If submitting for approval, lock edits and set status to pending
        // Also set profile_completed_at and is_first_login=false for first-time submissions
        await sql`
          UPDATE carrier_profiles SET
            legal_name = ${companyName},
            company_name = ${companyName},
            mc_number = ${mcNumber},
            dot_number = ${dotNumber},
            contact_name = ${contactName},
            phone = ${formattedPhone},
            profile_status = 'pending',
            submitted_at = NOW(),
            edits_enabled = false,
            profile_completed_at = COALESCE(profile_completed_at, NOW()),
            is_first_login = false,
            updated_at = NOW()
          WHERE supabase_user_id = ${userId}
        `;
        
        // Sync contact_name to Supabase user metadata (firstName/lastName)
        if (contactName) {
          await syncContactNameToUserMetadata(userId, contactName);
        }
        
        // Clear caches to ensure updated data appears immediately
        clearCarrierRelatedCaches(userId);
      } else {
        // Regular update - only update if edits are enabled
        await sql`
          UPDATE carrier_profiles SET
            legal_name = ${companyName},
            company_name = ${companyName},
            mc_number = ${mcNumber},
            dot_number = ${dotNumber},
            contact_name = ${contactName},
            phone = ${formattedPhone},
            updated_at = NOW()
          WHERE supabase_user_id = ${userId} AND edits_enabled = true
        `;
        
        // Sync contact_name to Supabase user metadata (firstName/lastName)
        if (contactName) {
          await syncContactNameToUserMetadata(userId, contactName);
        }
        
        // Clear caches to ensure updated data appears immediately
        clearCarrierRelatedCaches(userId);
      }
    } else {
      // Create new profile (Supabase-only)
      await sql`
        INSERT INTO carrier_profiles (
          supabase_user_id,
          legal_name,
          company_name,
          mc_number,
          dot_number,
          contact_name,
          phone,
          profile_status,
          submitted_at,
          edits_enabled,
          profile_completed_at,
          is_first_login
        ) VALUES (
          ${userId},
          ${companyName},
          ${companyName}, 
          ${mcNumber}, 
          ${dotNumber || null}, 
          ${contactName}, 
          ${formattedPhone},
          ${submit_for_approval ? 'pending' : 'open'},
          ${submit_for_approval ? new Date() : null},
          ${submit_for_approval ? false : true},
          ${submit_for_approval ? new Date() : null},
          ${submit_for_approval ? false : true}
        )
      `;
      
      // Sync contact_name to Supabase user metadata (firstName/lastName)
      if (contactName) {
        await syncContactNameToUserMetadata(userId, contactName);
      }
    }

    const message = submit_for_approval
      ? (existingProfile ? "Profile submitted for approval!" : "Profile created and submitted for approval!")
      : (existingProfile ? "Profile updated successfully!" : "Profile created successfully!");

    // Notify all admins about profile submission
    if (submit_for_approval) {
      try {
        const { notifyAllAdmins } = await import('@/lib/notifications');
        
        // Use variables already extracted from body
        const companyNameForNotification = companyName || 'Unknown Company';
        const mcNumberForNotification = mcNumber || 'N/A';
        const dotNumberForNotification = dotNumber || null;
        
        await notifyAllAdmins(
          'profile_submission',
          '📋 New Profile Submission',
          `${companyName} (MC: ${mcNumber})${dotNumber ? `, DOT: ${dotNumber}` : ''} submitted their profile for approval`,
          {
            carrier_user_id: userId,
            company_name: companyNameForNotification,
            legal_name: companyNameForNotification,
            mc_number: mcNumberForNotification,
            dot_number: dotNumberForNotification,
            submitted_at: new Date().toISOString()
          }
        );
      } catch (notificationError) {
        console.error('Failed to create admin notification for profile submission:', notificationError);
        // Don't throw - profile submission should still succeed
      }
    }

    logSecurityEvent('carrier_profile_updated', userId, { 
      action: existingProfile ? 'update' : 'create',
      submit_for_approval 
    });
    
    const response = NextResponse.json({ 
      ok: true, 
      message: message,
      submitted_for_approval: submit_for_approval
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);

  } catch (error) {
    console.error("Error updating carrier profile:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    logSecurityEvent('carrier_profile_update_error', undefined, { error: error instanceof Error ? error.message : String(error) });
    
    const errorMessage = error instanceof Error 
      ? (error.message || "Failed to update profile")
      : "Failed to update profile";
    
    const response = NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.stack : String(error))
        : undefined
    }, { status: 500 });
    
    return addSecurityHeaders(response, request);
  }
}
