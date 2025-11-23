import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;
    
    const { searchParams } = new URL(request.url);
    const mcsParam = searchParams.get("mcs");

    // Input validation
    if (mcsParam) {
      const validation = validateInput(
        { mcsParam },
        {
          mcsParam: { type: 'string', pattern: /^[\d,]+$/, maxLength: 1000 } // Max 1000 chars for comma-separated MCs
        }
      );

      if (!validation.valid) {
        logSecurityEvent('invalid_carrier_health_scores_input', userId, { errors: validation.errors });
        const response = NextResponse.json(
          { ok: false, error: `Invalid input: ${validation.errors.join(', ')}` },
          { status: 400 }
        );
        return addSecurityHeaders(response);
      }
    }
    
    if (!mcsParam) {
      const response = NextResponse.json({
        ok: true,
        scores: {},
      });
      return addSecurityHeaders(response);
    }
    
    const mcNumbers = mcsParam.split(',').filter(Boolean).map(mc => mc.trim());
    
    // Validate each MC number and limit count
    if (mcNumbers.length === 0) {
      const response = NextResponse.json({
        ok: true,
        scores: {},
      });
      return addSecurityHeaders(response);
    }

    // Limit to max 100 MC numbers per request
    if (mcNumbers.length > 100) {
      logSecurityEvent('carrier_health_scores_too_many', userId, { count: mcNumbers.length });
      const response = NextResponse.json(
        { ok: false, error: "Too many MC numbers (max 100)" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Validate each MC number format
    const invalidMCs = mcNumbers.filter(mc => !/^\d+$/.test(mc) || mc.length > 20);
    if (invalidMCs.length > 0) {
      logSecurityEvent('invalid_carrier_health_scores_mc_format', userId, { invalidMCs });
      const response = NextResponse.json(
        { ok: false, error: `Invalid MC number format: ${invalidMCs.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
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
    
    logSecurityEvent('carrier_health_scores_retrieved', userId, { mcCount: mcNumbers.length });
    
    const response = NextResponse.json({
      ok: true,
      scores,
    });
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Error retrieving health scores:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_health_scores_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        ok: false,
        error: process.env.NODE_ENV === 'development' 
          ? (error.message || "Failed to retrieve health scores")
          : "Failed to retrieve health scores",
        scores: {},
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

