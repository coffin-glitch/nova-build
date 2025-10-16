import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function PUT(
  req: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId: adminUserId } = await auth();
    
    if (!adminUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: Add admin role check here

    const carrierUserId = params.userId;
    const body = await req.json();
    const {
      company_name,
      mc_number,
      dot_number,
      contact_name,
      phone
    } = body;

    // Update carrier profile
    await sql`
      UPDATE carrier_profiles SET
        company_name = ${company_name},
        legal_name = ${company_name},
        mc_number = ${mc_number},
        dot_number = ${dot_number},
        contact_name = ${contact_name},
        phone = ${phone},
        updated_at = CURRENT_TIMESTAMP
      WHERE clerk_user_id = ${carrierUserId}
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
