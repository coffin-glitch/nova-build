import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    await requireApiAdmin(request);

    const { searchParams } = new URL(request.url);
    const mcNumber = searchParams.get("mc");

    if (!mcNumber) {
      return NextResponse.json(
        { ok: false, error: "MC number is required" },
        { status: 400 }
      );
    }

    // Check if we have cached data for this MC
    const cached = await sql`
      SELECT 
        mc_number,
        carrier_name,
        carrier_id,
        carrier_url,
        scraped_data as data,
        scraped_at,
        created_at,
        updated_at
      FROM highway_carrier_data
      WHERE mc_number = ${mcNumber}
      ORDER BY scraped_at DESC
      LIMIT 1
    `;

    if (cached.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No cached data found for this MC number" },
        { status: 404 }
      );
    }

    const record = cached[0];

    return NextResponse.json({
      ok: true,
      data: {
        mc_number: record.mc_number,
        carrier_name: record.carrier_name,
        carrier_id: record.carrier_id,
        carrier_url: record.carrier_url,
        scraped_at: record.scraped_at,
        data: record.data,
      },
    });
  } catch (error: any) {
    console.error("Error fetching Highway carrier data:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to fetch carrier data",
      },
      { status: 500 }
    );
  }
}

