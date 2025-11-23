import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { extractCarrierUrl, parseDirectoryData, parseOverviewData } from "@/lib/carrier-health-parser";
import { calculateHealthScore } from "@/lib/carrier-health-scorer";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId || '';
    
    const body = await request.json();
    const { mcNumber, carrierUrl, overviewHtml, directoryHtml } = body;

    // Input validation
    const validation = validateInput(
      { mcNumber, carrierUrl, overviewHtml, directoryHtml },
      {
        mcNumber: { required: true, type: 'string', pattern: /^\d+$/, maxLength: 20 },
        carrierUrl: { type: 'string', pattern: /^https?:\/\/.+/, maxLength: 500, required: false },
        overviewHtml: { type: 'string', maxLength: 5000000, required: false }, // 5MB max
        directoryHtml: { type: 'string', maxLength: 5000000, required: false } // 5MB max
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_carrier_health_store_input', userId, { errors: validation.errors });
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
    
    if (!carrierUrl && !overviewHtml && !directoryHtml) {
      const response = NextResponse.json(
        { ok: false, error: "At least carrier URL, overview HTML, or directory HTML is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }
    
    // Extract URL from overview/directory if not provided
    let finalUrl = carrierUrl;
    if (!finalUrl && overviewHtml) {
      finalUrl = extractCarrierUrl(overviewHtml) || null;
    }
    if (!finalUrl && directoryHtml) {
      finalUrl = extractCarrierUrl(directoryHtml) || null;
    }
    
    if (!finalUrl) {
      return NextResponse.json(
        { ok: false, error: "Could not extract carrier URL from provided data" },
        { status: 400 }
      );
    }
    
    // Parse the data
    let overviewData = null;
    let directoryData = null;
    
    if (overviewHtml) {
      try {
        overviewData = parseOverviewData(overviewHtml);
        console.log('Parsed overview data:', overviewData);
      } catch (error: any) {
        console.error('Error parsing overview:', error);
        return NextResponse.json(
          { ok: false, error: "Failed to parse overview data: " + error.message },
          { status: 400 }
        );
      }
    }
    
    if (directoryHtml) {
      try {
        directoryData = parseDirectoryData(directoryHtml);
        console.log('Parsed directory data:', directoryData);
      } catch (error: any) {
        console.error('Error parsing directory:', error);
        return NextResponse.json(
          { ok: false, error: "Failed to parse directory data: " + error.message },
          { status: 400 }
        );
      }
    }
    
    // Get carrier name from parsed data or use MC number
    const carrierName = overviewData?.carrierName || `MC ${mcNumber}`;
    
    // Get existing data if it exists (for merging partial updates)
    const existing = await sql`
      SELECT overview_data, directory_data, overview_html, directory_html, health_score, health_status
      FROM carrier_health_data
      WHERE mc_number = ${mcNumber}
      LIMIT 1
    `;
    
    // Merge with existing data if doing partial update
    let finalOverviewData = overviewData;
    let finalDirectoryData = directoryData;
    let finalOverviewHtml = overviewHtml;
    let finalDirectoryHtml = directoryHtml;
    
    if (existing.length > 0) {
      // If only overview is provided, keep existing directory data
      if (overviewData && !directoryData) {
        finalDirectoryData = existing[0].directory_data;
        finalDirectoryHtml = existing[0].directory_html;
      }
      // If only directory is provided, keep existing overview data
      if (directoryData && !overviewData) {
        finalOverviewData = existing[0].overview_data;
        finalOverviewHtml = existing[0].overview_html;
      }
      // If only insurance is provided (in overviewData), merge insurance into existing overview
      if (overviewData && !directoryData && existing[0].overview_data) {
        const existingOverview = existing[0].overview_data as any;
        // Merge insurance data into existing overview
        finalOverviewData = {
          ...existingOverview,
          insurance: overviewData.insurance || existingOverview.insurance,
        };
        // Keep other existing overview fields
        Object.keys(existingOverview).forEach(key => {
          if (key !== 'insurance' && !finalOverviewData[key]) {
            finalOverviewData[key] = existingOverview[key];
          }
        });
      }
    }
    
    // Calculate health score - only if we have overview data
    let healthScore = { score: 0, status: 'Review' as const };
    
    if (finalOverviewData) {
      try {
        healthScore = await calculateHealthScore({
          bluewireScore: finalOverviewData.bluewireScore,
          connectionStatus: finalOverviewData.connectionStatus,
          assessmentStatus: finalOverviewData.assessmentStatus,
          dotStatus: finalOverviewData.dotStatus,
          safetyRating: finalOverviewData.safetyRating,
          powerUnits: finalOverviewData.powerUnits,
          crashes: finalOverviewData.crashes || { count24Months: finalOverviewData.crashCount24Months },
          safety: finalOverviewData.safety,
        });
      } catch (error: any) {
        console.error('Error calculating health score:', error);
        if (existing.length > 0 && existing[0].health_score) {
          healthScore = {
            score: existing[0].health_score,
            status: (existing[0].health_status as any) || 'Review',
          };
        }
      }
    } else if (existing.length > 0 && existing[0].health_score) {
      healthScore = {
        score: existing[0].health_score,
        status: (existing[0].health_status as any) || 'Review',
      };
    }
    
    // Store in database
    // Prepare JSONB data as JSON strings
    const overviewDataJson = finalOverviewData ? JSON.stringify(finalOverviewData) : null;
    const directoryDataJson = finalDirectoryData ? JSON.stringify(finalDirectoryData) : null;
    
    // Delete existing data if we have both overview and directory (full update)
    // Otherwise, update in place (partial update)
    if (overviewData && directoryData) {
      // Full update - delete and insert fresh
      await sql`
        DELETE FROM carrier_health_data WHERE mc_number = ${mcNumber}
      `;
    }
    
    // Insert or update data using INSERT ... ON CONFLICT
    const result = await sql`
      INSERT INTO carrier_health_data (
        mc_number,
        carrier_name,
        carrier_url,
        overview_html,
        overview_data,
        directory_html,
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
        updated_by,
        created_at
      ) VALUES (
        ${mcNumber},
        ${carrierName},
        ${finalUrl},
        ${finalOverviewHtml || null},
        ${overviewDataJson ? sql.unsafe(`'${overviewDataJson.replace(/'/g, "''")}'::jsonb`) : null},
        ${finalDirectoryHtml || null},
        ${directoryDataJson ? sql.unsafe(`'${directoryDataJson.replace(/'/g, "''")}'::jsonb`) : null},
        ${finalOverviewData?.bluewireScore || null},
        ${finalOverviewData?.connectionStatus || null},
        ${finalOverviewData?.assessmentStatus || null},
        ${finalOverviewData?.dotStatus || null},
        ${finalOverviewData?.operatingStatus || null},
        ${finalOverviewData?.safetyRating || null},
        ${finalOverviewData?.eldStatus || null},
        ${finalOverviewData?.eldProvider || null},
        ${healthScore.score},
        ${healthScore.status},
        NOW(),
        ${userId},
        NOW()
      )
      ON CONFLICT (mc_number) DO UPDATE SET
        carrier_name = EXCLUDED.carrier_name,
        carrier_url = EXCLUDED.carrier_url,
        overview_html = COALESCE(EXCLUDED.overview_html, carrier_health_data.overview_html),
        overview_data = COALESCE(EXCLUDED.overview_data, carrier_health_data.overview_data),
        directory_html = COALESCE(EXCLUDED.directory_html, carrier_health_data.directory_html),
        directory_data = COALESCE(EXCLUDED.directory_data, carrier_health_data.directory_data),
        bluewire_score = COALESCE(EXCLUDED.bluewire_score, carrier_health_data.bluewire_score),
        connection_status = COALESCE(EXCLUDED.connection_status, carrier_health_data.connection_status),
        assessment_status = COALESCE(EXCLUDED.assessment_status, carrier_health_data.assessment_status),
        dot_status = COALESCE(EXCLUDED.dot_status, carrier_health_data.dot_status),
        operating_status = COALESCE(EXCLUDED.operating_status, carrier_health_data.operating_status),
        safety_rating = COALESCE(EXCLUDED.safety_rating, carrier_health_data.safety_rating),
        eld_status = COALESCE(EXCLUDED.eld_status, carrier_health_data.eld_status),
        eld_provider = COALESCE(EXCLUDED.eld_provider, carrier_health_data.eld_provider),
        health_score = EXCLUDED.health_score,
        health_status = EXCLUDED.health_status,
        last_updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
      RETURNING id, mc_number, health_score, health_status, bluewire_score
    `;
    
    logSecurityEvent('carrier_health_stored', userId, { mcNumber });
    
    const response = NextResponse.json({
      ok: true,
      message: "Health data stored successfully",
      data: {
        id: result[0].id,
        mcNumber: result[0].mc_number,
        healthScore: result[0].health_score,
        healthStatus: result[0].health_status,
        bluewireScore: result[0].bluewire_score,
      },
      parsedData: {
        overview: finalOverviewData,
        directory: finalDirectoryData,
      },
      healthScore,
    });
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Error storing carrier health data:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_health_store_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        ok: false,
        error: process.env.NODE_ENV === 'development' 
          ? (error.message || "Failed to store health data")
          : "Failed to store health data",
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

