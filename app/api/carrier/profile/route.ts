import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

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
    
    // Get carrier profile from database (Supabase-only)
    const profiles = await sql`
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
      WHERE cp.supabase_user_id = ${userId}
    `;

    const profile = profiles[0] || null;

    logSecurityEvent('carrier_profile_accessed', userId);
    
    const response = NextResponse.json({ 
      ok: true, 
      data: profile 
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching carrier profile:", error);
    logSecurityEvent('carrier_profile_error', undefined, { error: error instanceof Error ? error.message : String(error) });
    
    // Handle authentication errors properly - return JSON instead of HTML
    if (error instanceof Error) {
      if (error.message === "Unauthorized" || error.message.includes("Unauthorized")) {
        const response = NextResponse.json({ 
          error: "Authentication required" 
        }, { status: 401 });
        return addSecurityHeaders(response);
      }
      if (error.message === "Carrier access required" || error.message.includes("Carrier access")) {
        const response = NextResponse.json({ 
          error: "Carrier access required" 
        }, { status: 403 });
        return addSecurityHeaders(response);
      }
    }
    
    const response = NextResponse.json({ 
      error: "Failed to fetch profile",
      details: error?.message || String(error)
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;
    
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
            is_first_login = false
          WHERE supabase_user_id = ${userId}
        `;
      } else {
        // Regular update - only update if edits are enabled
        await sql`
          UPDATE carrier_profiles SET
            legal_name = ${companyName},
            company_name = ${companyName},
            mc_number = ${mcNumber},
            dot_number = ${dotNumber},
            contact_name = ${contactName},
            phone = ${formattedPhone}
          WHERE supabase_user_id = ${userId} AND edits_enabled = true
        `;
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
    }

    const message = submit_for_approval
      ? (existingProfile ? "Profile submitted for approval!" : "Profile created and submitted for approval!")
      : (existingProfile ? "Profile updated successfully!" : "Profile created successfully!");

    logSecurityEvent('carrier_profile_updated', userId, { 
      action: existingProfile ? 'update' : 'create',
      submit_for_approval 
    });
    
    const response = NextResponse.json({ 
      ok: true, 
      message: message,
      submitted_for_approval: submit_for_approval
    });
    
    return addSecurityHeaders(response);

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
    
    return addSecurityHeaders(response);
  }
}
