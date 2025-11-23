import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const mcNumber = searchParams.get("mc");

    // Input validation
    const validation = validateInput(
      { mcNumber },
      {
        mcNumber: { required: true, type: 'string', pattern: /^\d+$/, maxLength: 20 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_highway_carrier_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { ok: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!mcNumber) {
      const response = NextResponse.json(
        { ok: false, error: "MC number is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
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
      logSecurityEvent('highway_carrier_not_found', userId, { mcNumber });
      const response = NextResponse.json(
        { ok: false, error: "No cached data found for this MC number" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    const record = cached[0];

    logSecurityEvent('highway_carrier_accessed', userId, { mcNumber });
    
    const response = NextResponse.json({
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
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Error fetching Highway carrier data:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('highway_carrier_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        ok: false,
        error: process.env.NODE_ENV === 'development' 
          ? (error.message || "Failed to fetch carrier data")
          : "Failed to fetch carrier data",
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

