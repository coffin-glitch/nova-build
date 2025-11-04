import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Ensure user is admin (Supabase-only)
    await requireApiAdmin(request);

    const carrierUserId = params.userId;
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
