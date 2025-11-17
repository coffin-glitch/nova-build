import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * DELETE /api/admin/carrier-health/wipe
 * Wipes all health data for a given MC number
 */
export async function DELETE(request: NextRequest) {
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
    
    // Delete all health data for this MC number
    const result = await sql`
      DELETE FROM carrier_health_data
      WHERE mc_number = ${mcNumber}
      RETURNING id, mc_number
    `;
    
    if (result.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "No health data found for this MC number",
      });
    }
    
    return NextResponse.json({
      ok: true,
      message: `Successfully wiped all health data for MC ${mcNumber}`,
      deletedCount: result.length,
    });
  } catch (error: any) {
    console.error("Error wiping carrier health data:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to wipe health data",
      },
      { status: 500 }
    );
  }
}

