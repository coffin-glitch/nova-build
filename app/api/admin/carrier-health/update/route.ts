import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { calculateHealthScore } from "@/lib/carrier-health-scorer";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * PUT /api/admin/carrier-health/update
 * Manually update carrier health data
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin write operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'admin'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          ok: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }
    
    const body = await request.json();
    const {
      mcNumber,
      overviewData,
      directoryData,
      // Direct field updates
      bluewireScore,
      connectionStatus,
      assessmentStatus,
      dotStatus,
      operatingStatus,
      safetyRating,
      eldStatus,
      eldProvider,
      powerUnits,
      trailers,
      crashes24Months,
      driverFitnessPercentile,
    } = body;

    // Input validation
    const validation = validateInput(
      { mcNumber },
      {
        mcNumber: { required: true, type: 'string', pattern: /^\d+$/, maxLength: 20 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_carrier_health_update_input', userId, { errors: validation.errors });
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
    
    // Get existing data
    const existing = await sql`
      SELECT overview_data, directory_data
      FROM carrier_health_data
      WHERE mc_number = ${mcNumber}
      LIMIT 1
    `;
    
    let finalOverviewData = existing[0]?.overview_data || {};
    let finalDirectoryData = existing[0]?.directory_data || {};
    
    // Merge overview data updates
    if (overviewData) {
      finalOverviewData = { ...finalOverviewData, ...overviewData };
    }
    
    // Merge directory data updates
    if (directoryData) {
      finalDirectoryData = { ...finalDirectoryData, ...directoryData };
    }
    
    // Update direct fields if provided
    if (bluewireScore !== undefined) finalOverviewData.bluewireScore = bluewireScore;
    if (connectionStatus !== undefined) finalOverviewData.connectionStatus = connectionStatus;
    if (assessmentStatus !== undefined) finalOverviewData.assessmentStatus = assessmentStatus;
    if (dotStatus !== undefined) finalOverviewData.dotStatus = dotStatus;
    if (operatingStatus !== undefined) finalOverviewData.operatingStatus = operatingStatus;
    if (safetyRating !== undefined) finalOverviewData.safetyRating = safetyRating;
    if (eldStatus !== undefined) finalOverviewData.eldStatus = eldStatus;
    if (eldProvider !== undefined) finalOverviewData.eldProvider = eldProvider;
    if (powerUnits !== undefined) finalOverviewData.powerUnits = powerUnits;
    if (trailers !== undefined) finalOverviewData.trailers = trailers;
    if (crashes24Months !== undefined) {
      if (!finalOverviewData.crashes) finalOverviewData.crashes = {};
      finalOverviewData.crashes.count24Months = crashes24Months;
    }
    if (driverFitnessPercentile !== undefined) {
      if (!finalOverviewData.safety) finalOverviewData.safety = {};
      if (!finalOverviewData.safety.driverFitness) finalOverviewData.safety.driverFitness = {};
      finalOverviewData.safety.driverFitness.percentile = driverFitnessPercentile;
    }
    
    // Calculate new health score
    const healthScore = await calculateHealthScore(finalOverviewData);
    
    // Prepare JSONB data
    const overviewDataJson = JSON.stringify(finalOverviewData);
    const directoryDataJson = JSON.stringify(finalDirectoryData);
    
    // Update database
    const result = await sql`
      UPDATE carrier_health_data
      SET
        overview_data = ${sql.unsafe(`'${overviewDataJson.replace(/'/g, "''")}'::jsonb`)},
        directory_data = ${directoryDataJson ? sql.unsafe(`'${directoryDataJson.replace(/'/g, "''")}'::jsonb`) : null},
        bluewire_score = ${finalOverviewData.bluewireScore || null},
        connection_status = ${finalOverviewData.connectionStatus || null},
        assessment_status = ${finalOverviewData.assessmentStatus || null},
        dot_status = ${finalOverviewData.dotStatus || null},
        operating_status = ${finalOverviewData.operatingStatus || null},
        safety_rating = ${finalOverviewData.safetyRating || null},
        eld_status = ${finalOverviewData.eldStatus || null},
        eld_provider = ${finalOverviewData.eldProvider || null},
        health_score = ${healthScore.score},
        health_status = ${healthScore.status},
        last_updated_at = NOW(),
        updated_by = ${userId}
      WHERE mc_number = ${mcNumber}
      RETURNING id, mc_number, health_score, health_status, bluewire_score
    `;
    
    if (result.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No health data found for this MC number" },
        { status: 404 }
      );
    }
    
    logSecurityEvent('carrier_health_updated', userId, { mcNumber });
    
    const response = NextResponse.json({
      ok: true,
      message: "Health data updated successfully",
      data: {
        id: result[0].id,
        mcNumber: result[0].mc_number,
        healthScore: result[0].health_score,
        healthStatus: result[0].health_status,
        bluewireScore: result[0].bluewire_score,
        breakdown: healthScore.breakdown,
      },
      parsedData: {
        overview: finalOverviewData,
        directory: finalDirectoryData,
      },
      healthScore: {
        score: healthScore.score,
        status: healthScore.status,
        breakdown: healthScore.breakdown,
      },
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    
  } catch (error: any) {
    console.error("Error updating carrier health data:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_health_update_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        ok: false,
        error: process.env.NODE_ENV === 'development' 
          ? (error.message || "Failed to update health data")
          : "Failed to update health data",
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

