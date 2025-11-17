import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    await requireApiAdmin(request);
    
    const { searchParams } = new URL(request.url);
    const mcsParam = searchParams.get("mcs");
    
    if (!mcsParam) {
      return NextResponse.json({
        ok: true,
        scores: {},
      });
    }
    
    const mcNumbers = mcsParam.split(',').filter(Boolean);
    
    if (mcNumbers.length === 0) {
      return NextResponse.json({
        ok: true,
        scores: {},
      });
    }
    
    const result = await sql`
      SELECT 
        mc_number,
        health_score,
        health_status,
        bluewire_score,
        connection_status,
        assessment_status
      FROM carrier_health_data
      WHERE mc_number = ANY(${mcNumbers})
    `;
    
    const scores: Record<string, {
      healthScore: number;
      healthStatus: string;
      bluewireScore: number | null;
      connectionStatus: string | null;
      assessmentStatus: string | null;
    }> = {};
    
    for (const row of result) {
      scores[row.mc_number] = {
        healthScore: row.health_score || 0,
        healthStatus: row.health_status || 'Unknown',
        bluewireScore: row.bluewire_score ? parseFloat(String(row.bluewire_score)) : null,
        connectionStatus: row.connection_status || null,
        assessmentStatus: row.assessment_status || null,
      };
    }
    
    return NextResponse.json({
      ok: true,
      scores,
    });
  } catch (error: any) {
    console.error("Error retrieving health scores:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to retrieve health scores",
        scores: {},
      },
      { status: 500 }
    );
  }
}

