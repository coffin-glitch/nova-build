import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Format phone number to 10 digits only
function formatPhoneNumber(phone: string): string | null {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return cleaned;
  }
  return null;
}

// Handle profile name suggestions
async function handleGetSuggestions(request: NextRequest, searchParams: URLSearchParams) {
  try {
    const auth = await requireApiCarrier(request);
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

    const driverName = searchParams.get('driverName');
    const driverPhone = searchParams.get('driverPhone');
    const driverLicenseNumber = searchParams.get('driverLicenseNumber');

    // Input validation
    const validation = validateInput(
      { driverName, driverPhone, driverLicenseNumber },
      {
        driverName: { required: true, type: 'string', minLength: 1, maxLength: 100 },
        driverPhone: { type: 'string', maxLength: 20, required: false },
        driverLicenseNumber: { type: 'string', maxLength: 50, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_driver_suggestions_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    // Format phone number if provided
    const formattedPhone = driverPhone ? formatPhoneNumber(driverPhone) : null;

    // Get suggestions from the database function
    const suggestions = await sql`
      SELECT * FROM suggest_profile_names(
        ${userId}, 
        ${driverName.trim()}, 
        ${formattedPhone}, 
        ${driverLicenseNumber?.trim() || null}
      )
    `;

    logSecurityEvent('driver_suggestions_accessed', userId);
    
    const response = NextResponse.json({
      ok: true,
      suggestions: suggestions.map(s => ({
        name: s.suggested_name,
        reason: s.reason
      }))
    });
    
    return addSecurityHeaders(response, request);

  } catch (error: any) {
    console.error("Error getting profile suggestions:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('driver_suggestions_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to get profile suggestions",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

// GET - Fetch all driver profiles for a carrier or get suggestions
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  // Handle profile name suggestions
  if (action === 'suggestions') {
    return handleGetSuggestions(request, searchParams);
  }
  try {
    const auth = await requireApiCarrier(request);
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

    const profiles = await sql`
      SELECT 
        id,
        profile_name,
        driver_name,
        driver_phone,
        driver_email,
        driver_license_number,
        driver_license_state,
        truck_number,
        trailer_number,
        second_driver_name,
        second_driver_phone,
        second_driver_email,
        second_driver_license_number,
        second_driver_license_state,
        second_truck_number,
        second_trailer_number,
        display_order,
        last_used_at,
        is_active,
        created_at,
        updated_at
      FROM driver_profiles 
      WHERE carrier_user_id = ${userId}
        AND is_active = true
      ORDER BY display_order ASC, last_used_at DESC NULLS LAST, profile_name ASC
    `;

    logSecurityEvent('driver_profiles_accessed', userId);
    
    const response = NextResponse.json({
      ok: true,
      profiles: profiles.map(profile => ({
        id: profile.id,
        profile_name: profile.profile_name,
        driver_name: profile.driver_name,
        driver_phone: profile.driver_phone,
        driver_email: profile.driver_email,
        driver_license_number: profile.driver_license_number,
        driver_license_state: profile.driver_license_state,
        truck_number: profile.truck_number,
        trailer_number: profile.trailer_number,
        second_driver_name: profile.second_driver_name,
        second_driver_phone: profile.second_driver_phone,
        second_driver_email: profile.second_driver_email,
        second_driver_license_number: profile.second_driver_license_number,
        second_driver_license_state: profile.second_driver_license_state,
        second_truck_number: profile.second_truck_number,
        second_trailer_number: profile.second_trailer_number,
        display_order: profile.display_order,
        last_used_at: profile.last_used_at,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      }))
    });
    
    return addSecurityHeaders(response, request);

  } catch (error: any) {
    console.error("Error fetching driver profiles:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('driver_profiles_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch driver profiles",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

// PATCH - Update profile order, name, or mark as used
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const body = await request.json();
    const { action, profileId, newName, profileOrders } = body;

    // Input validation
    const validation = validateInput(
      { action, profileId, newName, profileOrders },
      {
        action: { 
          required: true, 
          type: 'string', 
          enum: ['updateOrder', 'updateName', 'markUsed']
        },
        profileId: { type: 'string', maxLength: 50, required: false },
        newName: { type: 'string', maxLength: 100, required: false },
        profileOrders: { type: 'array', required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_driver_profile_patch_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    switch (action) {
      case 'updateOrder':
        if (!profileOrders || !Array.isArray(profileOrders)) {
          const response = NextResponse.json({ 
            error: "Profile orders array is required" 
          }, { status: 400 });
          return addSecurityHeaders(response, request);
        }

        // Update each profile's display order individually
        for (const profileOrder of profileOrders) {
          await sql`
            UPDATE driver_profiles 
            SET display_order = ${profileOrder.order}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${profileOrder.id} AND carrier_user_id = ${userId}
          `;
        }

        logSecurityEvent('driver_profile_order_updated', userId);
        const orderResponse = NextResponse.json({
          ok: true,
          message: "Profile order updated successfully"
        });
        return addSecurityHeaders(orderResponse);

      case 'updateName':
        if (!profileId || !newName?.trim()) {
          const response = NextResponse.json({ 
            error: "Profile ID and new name are required" 
          }, { status: 400 });
          return addSecurityHeaders(response, request);
        }

        const nameResult = await sql`
          SELECT update_profile_name(${profileId}, ${userId}, ${newName.trim()})
        `;

        if (!nameResult[0].update_profile_name) {
          const response = NextResponse.json({ 
            error: "A profile with this name already exists" 
          }, { status: 400 });
          return addSecurityHeaders(response, request);
        }

        logSecurityEvent('driver_profile_name_updated', userId, { profileId, newName });
        const nameResponse = NextResponse.json({
          ok: true,
          message: "Profile name updated successfully"
        });
        return addSecurityHeaders(nameResponse);

      case 'markUsed':
        if (!profileId) {
          const response = NextResponse.json({ 
            error: "Profile ID is required" 
          }, { status: 400 });
          return addSecurityHeaders(response, request);
        }

        await sql`
          SELECT mark_profile_used(${profileId}, ${userId})
        `;

        logSecurityEvent('driver_profile_marked_used', userId, { profileId });
        const usedResponse = NextResponse.json({
          ok: true,
          message: "Profile usage tracked successfully"
        });
        return addSecurityHeaders(usedResponse);

      default:
        const defaultResponse = NextResponse.json({ 
          error: "Invalid action" 
        }, { status: 400 });
        return addSecurityHeaders(defaultResponse);
    }

  } catch (error: any) {
    console.error("Error updating driver profile:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('driver_profile_update_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to update driver profile",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

// POST - Create a new driver profile
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const {
      profile_name,
      driver_name,
      driver_phone,
      driver_email,
      driver_license_number,
      driver_license_state,
      truck_number,
      trailer_number,
      second_driver_name,
      second_driver_phone,
      second_driver_email,
      second_driver_license_number,
      second_driver_license_state,
      second_truck_number,
      second_trailer_number
    } = await request.json();

    // Input validation
    const validation = validateInput(
      { profile_name, driver_name, driver_phone, driver_email, driver_license_number, driver_license_state },
      {
        profile_name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
        driver_name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
        driver_phone: { required: true, type: 'string', pattern: /^[\d\s\-\(\)]+$/, maxLength: 20 },
        driver_email: { type: 'string', maxLength: 255, required: false },
        driver_license_number: { type: 'string', maxLength: 50, required: false },
        driver_license_state: { type: 'string', maxLength: 2, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_driver_profile_create_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    // Format and validate phone number
    const formattedPhone = formatPhoneNumber(driver_phone);
    if (!formattedPhone) {
      return NextResponse.json({ 
        error: "Driver phone number must be exactly 10 digits" 
      }, { status: 400 });
    }

    // Format secondary phone if provided
    let formattedSecondPhone = null;
    if (second_driver_phone) {
      formattedSecondPhone = formatPhoneNumber(second_driver_phone);
      if (!formattedSecondPhone) {
        return NextResponse.json({ 
          error: "Secondary driver phone number must be exactly 10 digits" 
        }, { status: 400 });
      }
    }

    // Check if this exact driver combination already exists (composite unique constraint)
    const existingDriver = await sql`
      SELECT id, profile_name FROM driver_profiles 
      WHERE carrier_user_id = ${userId}
        AND driver_name = ${driver_name.trim()}
        AND driver_phone = ${formattedPhone}
        AND driver_license_number = ${driver_license_number?.trim() || null}
        AND is_active = true
    `;

    if (existingDriver.length > 0) {
      return NextResponse.json({ 
        error: `A profile for ${driver_name.trim()} with this phone number and license already exists as "${existingDriver[0].profile_name}"`,
        existingProfile: existingDriver[0].profile_name
      }, { status: 400 });
    }

    // Generate a unique profile name if the requested name already exists
    let finalProfileName = profile_name.trim();
    const existingProfileName = await sql`
      SELECT id FROM driver_profiles 
      WHERE carrier_user_id = ${userId}
        AND profile_name = ${finalProfileName}
        AND is_active = true
    `;

    if (existingProfileName.length > 0) {
      // Use the enhanced carrier-aware function to generate a unique name
      const uniqueNameResult = await sql`
        SELECT generate_carrier_aware_profile_name(
          ${userId}, 
          ${driver_name.trim()}, 
          ${formattedPhone}, 
          ${driver_license_number?.trim() || null}
        ) as unique_name
      `;
      finalProfileName = uniqueNameResult[0].unique_name;
    }

    // Check for potential cross-carrier duplicates (informational only)
    const crossCarrierMatches = await sql`
      SELECT * FROM check_cross_carrier_driver(
        ${userId}, 
        ${driver_name.trim()}, 
        ${formattedPhone}, 
        ${driver_license_number?.trim() || null}
      )
    `;

    // Create the profile
    const result = await sql`
      INSERT INTO driver_profiles (
        carrier_user_id,
        profile_name,
        driver_name,
        driver_phone,
        driver_email,
        driver_license_number,
        driver_license_state,
        truck_number,
        trailer_number,
        second_driver_name,
        second_driver_phone,
        second_driver_email,
        second_driver_license_number,
        second_driver_license_state,
        second_truck_number,
        second_trailer_number,
        created_at,
        updated_at
      ) VALUES (
        ${userId},
        ${finalProfileName},
        ${driver_name.trim()},
        ${formattedPhone},
        ${driver_email?.trim() || null},
        ${driver_license_number?.trim() || null},
        ${driver_license_state?.trim() || null},
        ${truck_number?.trim() || null},
        ${trailer_number?.trim() || null},
        ${second_driver_name?.trim() || null},
        ${formattedSecondPhone},
        ${second_driver_email?.trim() || null},
        ${second_driver_license_number?.trim() || null},
        ${second_driver_license_state?.trim() || null},
        ${second_truck_number?.trim() || null},
        ${second_trailer_number?.trim() || null},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ) RETURNING id, profile_name, created_at
    `;

    logSecurityEvent('driver_profile_created', userId, { 
      profile_id: result[0].id,
      profile_name: finalProfileName
    });
    
    const response = NextResponse.json({
      ok: true,
      profile: result[0],
      message: finalProfileName !== profile_name.trim() 
        ? `Profile created successfully as "${finalProfileName}" (name was adjusted to avoid duplicates)`
        : "Driver profile created successfully",
      originalName: profile_name.trim(),
      finalName: finalProfileName,
      nameWasAdjusted: finalProfileName !== profile_name.trim(),
      crossCarrierMatches: crossCarrierMatches.length > 0 ? {
        count: crossCarrierMatches.length,
        matches: crossCarrierMatches.map(match => ({
          carrierId: match.other_carrier_id,
          profileName: match.profile_name,
          similarityScore: match.similarity_score
        })),
        message: crossCarrierMatches.length > 0 
          ? `Found ${crossCarrierMatches.length} similar driver(s) in other carrier accounts. This might be the same driver working for multiple carriers.`
          : null
      } : null
    });
    
    return addSecurityHeaders(response, request);

  } catch (error: any) {
    console.error("Error creating driver profile:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('driver_profile_create_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to create driver profile",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

// PUT - Update an existing driver profile
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const {
      id,
      profile_name,
      driver_name,
      driver_phone,
      driver_email,
      driver_license_number,
      driver_license_state,
      truck_number,
      trailer_number,
      second_driver_name,
      second_driver_phone,
      second_driver_email,
      second_driver_license_number,
      second_driver_license_state,
      second_truck_number,
      second_trailer_number
    } = await request.json();

    // Input validation
    const validation = validateInput(
      { id, profile_name, driver_name, driver_phone },
      {
        id: { required: true, type: 'string', maxLength: 50 },
        profile_name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
        driver_name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
        driver_phone: { required: true, type: 'string', pattern: /^[\d\s\-\(\)]+$/, maxLength: 20 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_driver_profile_update_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    // Format and validate phone number
    const formattedPhone = formatPhoneNumber(driver_phone);
    if (!formattedPhone) {
      return NextResponse.json({ 
        error: "Driver phone number must be exactly 10 digits" 
      }, { status: 400 });
    }

    // Format secondary phone if provided
    let formattedSecondPhone = null;
    if (second_driver_phone) {
      formattedSecondPhone = formatPhoneNumber(second_driver_phone);
      if (!formattedSecondPhone) {
        return NextResponse.json({ 
          error: "Secondary driver phone number must be exactly 10 digits" 
        }, { status: 400 });
      }
    }

    // Check if profile exists and belongs to user
    const existingProfile = await sql`
      SELECT id FROM driver_profiles 
      WHERE id = ${id} 
        AND carrier_user_id = ${userId}
        AND is_active = true
    `;

    if (existingProfile.length === 0) {
      return NextResponse.json({ 
        error: "Profile not found or access denied" 
      }, { status: 404 });
    }

    // Check if profile name already exists for this carrier (excluding current profile)
    const duplicateProfile = await sql`
      SELECT id FROM driver_profiles 
      WHERE carrier_user_id = ${userId}
        AND profile_name = ${profile_name.trim()}
        AND id != ${id}
        AND is_active = true
    `;

    if (duplicateProfile.length > 0) {
      return NextResponse.json({ 
        error: "A profile with this name already exists" 
      }, { status: 400 });
    }

    // Update the profile
    const result = await sql`
      UPDATE driver_profiles SET
        profile_name = ${profile_name.trim()},
        driver_name = ${driver_name.trim()},
        driver_phone = ${formattedPhone},
        driver_email = ${driver_email?.trim() || null},
        driver_license_number = ${driver_license_number?.trim() || null},
        driver_license_state = ${driver_license_state?.trim() || null},
        truck_number = ${truck_number?.trim() || null},
        trailer_number = ${trailer_number?.trim() || null},
        second_driver_name = ${second_driver_name?.trim() || null},
        second_driver_phone = ${formattedSecondPhone},
        second_driver_email = ${second_driver_email?.trim() || null},
        second_driver_license_number = ${second_driver_license_number?.trim() || null},
        second_driver_license_state = ${second_driver_license_state?.trim() || null},
        second_truck_number = ${second_truck_number?.trim() || null},
        second_trailer_number = ${second_trailer_number?.trim() || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id} 
        AND carrier_user_id = ${userId}
      RETURNING id, profile_name, updated_at
    `;

    logSecurityEvent('driver_profile_updated', userId, { profile_id: id });
    
    const response = NextResponse.json({
      ok: true,
      profile: result[0],
      message: "Driver profile updated successfully"
    });
    
    return addSecurityHeaders(response, request);

  } catch (error: any) {
    console.error("Error updating driver profile:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('driver_profile_update_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to update driver profile",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

// DELETE - Soft delete a driver profile
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Input validation
    const validation = validateInput(
      { id },
      {
        id: { required: true, type: 'string', maxLength: 50 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_driver_profile_delete_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    // Check if profile exists and belongs to user
    const existingProfile = await sql`
      SELECT id FROM driver_profiles 
      WHERE id = ${id} 
        AND carrier_user_id = ${userId}
        AND is_active = true
    `;

    if (existingProfile.length === 0) {
      return NextResponse.json({ 
        error: "Profile not found or access denied" 
      }, { status: 404 });
    }

    // Soft delete the profile
    await sql`
      UPDATE driver_profiles SET
        is_active = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id} 
        AND carrier_user_id = ${userId}
    `;

    logSecurityEvent('driver_profile_deleted', userId, { profile_id: id });
    
    const response = NextResponse.json({
      ok: true,
      message: "Driver profile deleted successfully"
    });
    
    return addSecurityHeaders(response, request);

  } catch (error: any) {
    console.error("Error deleting driver profile:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('driver_profile_delete_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to delete driver profile",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}
