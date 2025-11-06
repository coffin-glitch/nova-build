import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bidNumber: string }> }
) {
  try {
    await requireApiAdmin(request);
    const { bidNumber } = await params;

    if (!bidNumber) {
      return NextResponse.json(
        { error: "Bid number is required" },
        { status: 400 }
      );
    }

    // Get all documents for this bid with carrier information
    const documents = await sql`
      SELECT 
        bd.*,
        cp.legal_name as carrier_name,
        cp.company_name as carrier_company_name,
        cp.mc_number as carrier_mc_number
      FROM bid_documents bd
      LEFT JOIN carrier_profiles cp ON bd.carrier_user_id = cp.supabase_user_id
      WHERE bd.bid_number = ${bidNumber}
      ORDER BY bd.uploaded_at DESC
    `;

    return NextResponse.json({
      success: true,
      data: documents
    });

  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch documents",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


