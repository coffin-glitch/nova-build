import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
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
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const driverName = searchParams.get('driverName');
    const driverPhone = searchParams.get('driverPhone');
    const driverLicenseNumber = searchParams.get('driverLicenseNumber');

    if (!driverName) {
      return NextResponse.json({ 
        error: "Driver name is required for suggestions" 
      }, { status: 400 });
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

    return NextResponse.json({
      ok: true,
      suggestions: suggestions.map(s => ({
        name: s.suggested_name,
        reason: s.reason
      }))
    });

  } catch (error) {
    console.error("Error getting profile suggestions:", error);
    return NextResponse.json(
      { error: "Failed to get profile suggestions" },
      { status: 500 }
    );
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
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    return NextResponse.json({
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

  } catch (error) {
    console.error("Error fetching driver profiles:", error);
    return NextResponse.json(
      { error: "Failed to fetch driver profiles" },
      { status: 500 }
    );
  }
}

// PATCH - Update profile order, name, or mark as used
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action, profileId, newName, profileOrders } = await request.json();

    switch (action) {
      case 'updateOrder':
        if (!profileOrders || !Array.isArray(profileOrders)) {
          return NextResponse.json({ 
            error: "Profile orders array is required" 
          }, { status: 400 });
        }

        // Update each profile's display order individually
        for (const profileOrder of profileOrders) {
          await sql`
            UPDATE driver_profiles 
            SET display_order = ${profileOrder.order}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${profileOrder.id} AND carrier_user_id = ${userId}
          `;
        }

        return NextResponse.json({
          ok: true,
          message: "Profile order updated successfully"
        });

      case 'updateName':
        if (!profileId || !newName?.trim()) {
          return NextResponse.json({ 
            error: "Profile ID and new name are required" 
          }, { status: 400 });
        }

        const nameResult = await sql`
          SELECT update_profile_name(${profileId}, ${userId}, ${newName.trim()})
        `;

        if (!nameResult[0].update_profile_name) {
          return NextResponse.json({ 
            error: "A profile with this name already exists" 
          }, { status: 400 });
        }

        return NextResponse.json({
          ok: true,
          message: "Profile name updated successfully"
        });

      case 'markUsed':
        if (!profileId) {
          return NextResponse.json({ 
            error: "Profile ID is required" 
          }, { status: 400 });
        }

        await sql`
          SELECT mark_profile_used(${profileId}, ${userId})
        `;

        return NextResponse.json({
          ok: true,
          message: "Profile usage tracked successfully"
        });

      default:
        return NextResponse.json({ 
          error: "Invalid action" 
        }, { status: 400 });
    }

  } catch (error) {
    console.error("Error updating driver profile:", error);
    return NextResponse.json(
      { error: "Failed to update driver profile" },
      { status: 500 }
    );
  }
}

// POST - Create a new driver profile
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Validate required fields
    if (!profile_name?.trim()) {
      return NextResponse.json({ 
        error: "Profile name is required" 
      }, { status: 400 });
    }

    if (!driver_name?.trim()) {
      return NextResponse.json({ 
        error: "Driver name is required" 
      }, { status: 400 });
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

    return NextResponse.json({
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

  } catch (error) {
    console.error("Error creating driver profile:", error);
    return NextResponse.json(
      { error: "Failed to create driver profile" },
      { status: 500 }
    );
  }
}

// PUT - Update an existing driver profile
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Validate required fields
    if (!id) {
      return NextResponse.json({ 
        error: "Profile ID is required" 
      }, { status: 400 });
    }

    if (!profile_name?.trim()) {
      return NextResponse.json({ 
        error: "Profile name is required" 
      }, { status: 400 });
    }

    if (!driver_name?.trim()) {
      return NextResponse.json({ 
        error: "Driver name is required" 
      }, { status: 400 });
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

    return NextResponse.json({
      ok: true,
      profile: result[0],
      message: "Driver profile updated successfully"
    });

  } catch (error) {
    console.error("Error updating driver profile:", error);
    return NextResponse.json(
      { error: "Failed to update driver profile" },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete a driver profile
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ 
        error: "Profile ID is required" 
      }, { status: 400 });
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

    return NextResponse.json({
      ok: true,
      message: "Driver profile deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting driver profile:", error);
    return NextResponse.json(
      { error: "Failed to delete driver profile" },
      { status: 500 }
    );
  }
}
