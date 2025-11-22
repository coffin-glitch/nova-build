import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * DNU Check API
 * Check if MC or DOT numbers are on the active DNU list
 */

export async function POST(request: NextRequest) {
  try {
    const { mc_numbers, dot_numbers } = await request.json();

    if ((!mc_numbers || !Array.isArray(mc_numbers)) && (!dot_numbers || !Array.isArray(dot_numbers))) {
      return NextResponse.json(
        { ok: false, error: "mc_numbers or dot_numbers array required" },
        { status: 400 }
      );
    }

    // Clean and prepare MC and DOT numbers
    const cleanMC: string[] = [];
    const cleanDOT: string[] = [];
    
    if (mc_numbers && Array.isArray(mc_numbers) && mc_numbers.length > 0) {
      mc_numbers.forEach(mc => {
        const cleaned = String(mc).replace(/\D/g, '');
        if (cleaned.length > 0) {
          cleanMC.push(cleaned);
        }
      });
    }

    if (dot_numbers && Array.isArray(dot_numbers) && dot_numbers.length > 0) {
      dot_numbers.forEach(dot => {
        const cleaned = String(dot).replace(/\D/g, '');
        if (cleaned.length > 0) {
          cleanDOT.push(cleaned);
        }
      });
    }

    if (cleanMC.length === 0 && cleanDOT.length === 0) {
      return NextResponse.json({
        ok: true,
        data: {
          is_dnu: false,
          matching_entries: []
        }
      });
    }

    // Build query to check for active DNU entries
    let query;
    if (cleanMC.length > 0 && cleanDOT.length > 0) {
      query = sql`
        SELECT DISTINCT mc_number, dot_number
        FROM dnu_tracking
        WHERE status = 'active'
        AND (
          mc_number = ANY(${cleanMC})
          OR dot_number = ANY(${cleanDOT})
        )
      `;
    } else if (cleanMC.length > 0) {
      query = sql`
        SELECT DISTINCT mc_number, dot_number
        FROM dnu_tracking
        WHERE status = 'active'
        AND mc_number = ANY(${cleanMC})
      `;
    } else {
      query = sql`
        SELECT DISTINCT mc_number, dot_number
        FROM dnu_tracking
        WHERE status = 'active'
        AND dot_number = ANY(${cleanDOT})
      `;
    }

    const result = await query;

    return NextResponse.json({
      ok: true,
      data: {
        is_dnu: result.length > 0,
        matching_entries: result
      }
    });

  } catch (error: any) {
    console.error("Error checking DNU status:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to check DNU status" },
      { status: 500 }
    );
  }
}

