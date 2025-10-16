import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get carrier profile from database
    const profiles = await sql`
      SELECT 
        id,
        clerk_user_id,
        COALESCE(company_name, legal_name) as legal_name,
        mc_number,
        dot_number,
        contact_name,
        phone,
        is_locked,
        locked_at,
        locked_by,
        lock_reason,
        created_at,
        updated_at
      FROM carrier_profiles 
      WHERE clerk_user_id = ${userId}
    `;

    const profile = profiles[0] || null;

    return NextResponse.json({ 
      ok: true, 
      data: profile 
    });

  } catch (error) {
    console.error("Error fetching carrier profile:", error);
    return NextResponse.json({ 
      error: "Failed to fetch profile" 
    }, { status: 500 });
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
      phone
    } = body;

    // Check if profile exists and is locked
    const existingProfiles = await sql`
      SELECT clerk_user_id, is_locked FROM carrier_profiles WHERE clerk_user_id = ${userId}
    `;

    const existingProfile = existingProfiles[0];

    if (existingProfile && existingProfile.is_locked) {
      return NextResponse.json({ 
        error: "Profile is locked and cannot be modified. Contact an administrator for changes." 
      }, { status: 403 });
    }

    if (existingProfile) {
      // Update existing profile
      await sql`
        UPDATE carrier_profiles SET
          company_name = ${companyName},
          legal_name = ${companyName},
          mc_number = ${mcNumber},
          dot_number = ${dotNumber},
          contact_name = ${contactName},
          phone = ${phone},
          updated_at = CURRENT_TIMESTAMP
        WHERE clerk_user_id = ${userId}
      `;
    } else {
      // Create new profile
      await sql`
        INSERT INTO carrier_profiles (
          clerk_user_id,
          company_name,
          legal_name,
          mc_number,
          dot_number,
          contact_name,
          phone,
          created_at,
          updated_at
        ) VALUES (${userId}, ${companyName}, ${companyName}, ${mcNumber}, ${dotNumber}, ${contactName}, ${phone}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
    }

    return NextResponse.json({ 
      ok: true, 
      message: "Profile updated successfully" 
    });

  } catch (error) {
    console.error("Error updating carrier profile:", error);
    return NextResponse.json({ 
      error: "Failed to update profile" 
    }, { status: 500 });
  }
}
