import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

          // Get carrier profile from database with correct column names
          const profiles = await sql`
            SELECT 
              clerk_user_id as id,
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

    const profile = profiles[0] || null;

    logSecurityEvent('carrier_profile_accessed', userId);
    
    const response = NextResponse.json({ 
      ok: true, 
      data: profile 
    });
    
    return addSecurityHeaders(response);

  } catch (error) {
    console.error("Error fetching carrier profile:", error);
    logSecurityEvent('carrier_profile_error', undefined, { error: error instanceof Error ? error.message : String(error) });
    
    const response = NextResponse.json({ 
      error: "Failed to fetch profile" 
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
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

    // Check if profile exists
    const existingProfiles = await sql`
      SELECT 
        clerk_user_id
      FROM carrier_profiles 
      WHERE clerk_user_id = ${userId}
    `;

    const existingProfile = existingProfiles[0];

    if (existingProfile) {
      // Update existing profile
      if (submit_for_approval) {
        // If submitting for approval, lock edits and set status to pending
        await sql`
          UPDATE carrier_profiles SET
            legal_name = ${companyName},
            mc_number = ${mcNumber},
            dot_number = ${dotNumber},
            contact_name = ${contactName},
            phone = ${formattedPhone},
            profile_status = 'pending',
            submitted_at = NOW(),
            edits_enabled = false
          WHERE clerk_user_id = ${userId}
        `;
      } else {
        // Regular update - only update if edits are enabled
        await sql`
          UPDATE carrier_profiles SET
            legal_name = ${companyName},
            mc_number = ${mcNumber},
            dot_number = ${dotNumber},
            contact_name = ${contactName},
            phone = ${formattedPhone}
          WHERE clerk_user_id = ${userId} AND edits_enabled = true
        `;
      }
    } else {
      // Create new profile
      await sql`
        INSERT INTO carrier_profiles (
          clerk_user_id,
          legal_name,
          mc_number,
          dot_number,
          contact_name,
          phone,
          profile_status,
          submitted_at,
          edits_enabled
        ) VALUES (
          ${userId}, 
          ${companyName}, 
          ${mcNumber}, 
          ${dotNumber}, 
          ${contactName}, 
          ${formattedPhone},
          'pending',
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
    logSecurityEvent('carrier_profile_update_error', undefined, { error: error instanceof Error ? error.message : String(error) });
    
    const response = NextResponse.json({ 
      error: "Failed to update profile" 
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}
