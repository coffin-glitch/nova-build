import { requireApiAdmin } from "@/lib/auth-api-helper";
import { calculateHealthScore } from "@/lib/carrier-health-scorer";
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
    
    const result = await sql`
      SELECT 
        id,
        mc_number,
        carrier_name,
        carrier_url,
        overview_data,
        directory_data,
        bluewire_score,
        connection_status,
        assessment_status,
        dot_status,
        operating_status,
        safety_rating,
        eld_status,
        eld_provider,
        health_score,
        health_status,
        last_updated_at,
        updated_by
      FROM carrier_health_data
      WHERE mc_number = ${mcNumber}
      LIMIT 1
    `;
    
    if (result.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "No health data found for this MC number",
        data: null,
      });
    }
    
    // Calculate health score breakdown if overview_data exists
    let breakdown = null;
    if (result[0].overview_data) {
      try {
        const healthScoreResult = await calculateHealthScore(result[0].overview_data);
        breakdown = healthScoreResult.breakdown;
      } catch (error) {
        console.error('Error calculating health score breakdown:', error);
      }
    }
    
    return NextResponse.json({
      ok: true,
      data: {
        ...result[0],
        breakdown,
      },
    });
  } catch (error: any) {
    console.error("Error retrieving carrier health data:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to retrieve health data",
      },
      { status: 500 }
    );
  }
}

