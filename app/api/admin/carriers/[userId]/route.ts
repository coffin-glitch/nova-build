import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Ensure user is admin (Supabase-only)
    await requireApiAdmin(request);

    const { userId } = await params;

    // Get carrier profile with email
    const profiles = await sql`
      SELECT 
        cp.supabase_user_id as id,
        cp.supabase_user_id as user_id,
        cp.legal_name,
        cp.company_name,
        cp.mc_number,
        cp.dot_number,
        cp.contact_name,
        cp.phone,
        cp.profile_status,
        cp.created_at,
        cp.updated_at
      FROM carrier_profiles cp
      WHERE cp.supabase_user_id = ${userId}
      LIMIT 1
    `;

    if (profiles.length === 0) {
      return NextResponse.json({ 
        error: "Carrier not found" 
      }, { status: 404 });
    }

    const carrier = profiles[0];

    // Get email from user_roles_cache or Supabase
    let email = 'N/A';
    try {
      const cacheResult = await sql`
        SELECT email FROM user_roles_cache WHERE supabase_user_id = ${userId} LIMIT 1
      `;
      
      if (cacheResult.length > 0 && cacheResult[0].email) {
        email = cacheResult[0].email;
      } else {
        // Fallback to Supabase Auth
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (supabaseUrl && supabaseKey) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);
          
          if (!error && user?.email) {
            email = user.email;
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching email for user ${userId}:`, error);
    }

    return NextResponse.json({ 
      ok: true, 
      data: {
        ...carrier,
        email,
        company_name: carrier.legal_name || carrier.company_name || 'N/A'
      }
    });

  } catch (error) {
    console.error("Error fetching carrier profile:", error);
    return NextResponse.json({ 
      error: "Failed to fetch profile" 
    }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Ensure user is admin (Supabase-only)
    await requireApiAdmin(request);

    const { userId: carrierUserId } = await params;
    const body = await request.json();
    const {
      company_name,
      mc_number,
      dot_number,
      contact_name,
      phone
    } = body;

    // Update carrier profile (Supabase-only)
    await sql`
      UPDATE carrier_profiles SET
        legal_name = ${company_name},
        mc_number = ${mc_number},
        dot_number = ${dot_number},
        contact_name = ${contact_name},
        phone = ${phone}
      WHERE supabase_user_id = ${carrierUserId}
    `;

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
