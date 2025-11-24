import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { extractCarrierUrl, parseDirectoryData, parseOverviewData } from "@/lib/carrier-health-parser";
import { calculateHealthScore } from "@/lib/carrier-health-scorer";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * Auto-scrape endpoint for Tampermonkey userscript
 * Accepts scraped HTML from Highway.com and processes it
 */

// Increase timeout for large payloads (60 seconds for Vercel Pro, adjust for your platform)
export const maxDuration = 60;
// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'https://highway.com',
    'https://www.highway.com',
    'http://localhost:3000',
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ].filter(Boolean);
  
  const response = new NextResponse(null, { status: 200 });
  
  if (origin && allowedOrigins.some(allowed => origin.includes(allowed))) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }
  
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Max-Age', '86400');
  
  return response;
}

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication for auto-scrape
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin write operation (scraping is resource-intensive)
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
      // Add CORS headers
      const origin = request.headers.get('origin');
      if (origin) {
        response.headers.set('Access-Control-Allow-Origin', origin);
      }
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }

    // Handle CORS
    const origin = request.headers.get('origin');
    const allowedOrigins = [
      'https://highway.com',
      'https://www.highway.com',
      'http://localhost:3000',
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    ].filter(Boolean);
    
    const body = await request.json();
    const { mcNumber, carrierName, carrierUrl, overviewHtml, directoryHtml } = body;

    // Input validation
    const validation = validateInput(
      { mcNumber, carrierName, carrierUrl, overviewHtml, directoryHtml },
      {
        mcNumber: { required: true, type: 'string', pattern: /^\d+$/, maxLength: 20 },
        carrierName: { type: 'string', maxLength: 500, required: false },
        carrierUrl: { type: 'string', pattern: /^https?:\/\/.+/, maxLength: 500, required: false },
        overviewHtml: { type: 'string', maxLength: 5000000, required: false }, // 5MB max for HTML
        directoryHtml: { type: 'string', maxLength: 5000000, required: false } // 5MB max for HTML
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_auto_scrape_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { ok: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      if (origin && allowedOrigins.some(allowed => origin.includes(allowed))) {
        response.headers.set('Access-Control-Allow-Origin', origin);
      } else {
        response.headers.set('Access-Control-Allow-Origin', '*');
      }
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      return addSecurityHeaders(response, request);
    }
    
    if (!mcNumber) {
      const response = NextResponse.json(
        { ok: false, error: "MC number is required" },
        { status: 400 }
      );
      if (origin && allowedOrigins.some(allowed => origin.includes(allowed))) {
        response.headers.set('Access-Control-Allow-Origin', origin);
      } else {
        response.headers.set('Access-Control-Allow-Origin', '*');
      }
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      return addSecurityHeaders(response, request);
    }
    
    if (!overviewHtml && !directoryHtml) {
      const response = NextResponse.json(
        { ok: false, error: "At least overview HTML or directory HTML is required" },
        { status: 400 }
      );
      if (origin && allowedOrigins.some(allowed => origin.includes(allowed))) {
        response.headers.set('Access-Control-Allow-Origin', origin);
      } else {
        response.headers.set('Access-Control-Allow-Origin', '*');
      }
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      return addSecurityHeaders(response, request);
    }
    
    // Extract URL if not provided
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
        // Check if structured safety data is present
        const hasStructuredSafety = overviewHtml.includes('===STRUCTURED_SAFETY_DATA===');
        console.log('Overview HTML contains structured safety data:', hasStructuredSafety);
        console.log('Overview HTML length:', overviewHtml.length);
        if (hasStructuredSafety) {
          const markerIndex = overviewHtml.indexOf('===STRUCTURED_SAFETY_DATA===');
          console.log('Structured safety data marker found at index:', markerIndex);
          console.log('Marker section preview:', overviewHtml.substring(markerIndex, markerIndex + 300));
          
          const safetyDataMatch = overviewHtml.match(/===STRUCTURED_SAFETY_DATA===\s*([\s\S]*?)(?=\n\n|$)/);
          if (safetyDataMatch) {
            try {
              const safetyData = JSON.parse(safetyDataMatch[1].trim());
              console.log('Structured safety data found:', JSON.stringify(safetyData, null, 2));
            } catch (e) {
              console.error('Failed to parse structured safety data JSON:', e);
              console.error('JSON string was:', safetyDataMatch[1].substring(0, 500));
            }
          } else {
            console.warn('⚠️ Marker found but regex match failed. Trying alternative extraction...');
            // Try extracting JSON directly after marker
            const afterMarker = overviewHtml.substring(markerIndex + '===STRUCTURED_SAFETY_DATA==='.length);
            const jsonMatch = afterMarker.match(/\s*(\{[\s\S]*\})/);
            if (jsonMatch) {
              try {
                const safetyData = JSON.parse(jsonMatch[1].trim());
                console.log('✅ Extracted structured safety data using alternative method:', JSON.stringify(safetyData, null, 2));
              } catch (e) {
                console.error('Failed to parse JSON from alternative extraction:', e);
              }
            }
          }
        } else {
          console.log('⚠️ Structured safety data marker NOT found in overviewHtml');
          console.log('Overview HTML ends with:', overviewHtml.substring(Math.max(0, overviewHtml.length - 500)));
        }
        
        overviewData = parseOverviewData(overviewHtml);
        console.log('Parsed overview data safety section:', JSON.stringify(overviewData?.safety, null, 2));
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
        console.log('Parsed directory data:', JSON.stringify(directoryData, null, 2));
        console.log('Directory data keys:', Object.keys(directoryData || {}));
        if (directoryData) {
          console.log('Verified users:', directoryData.verifiedUsers?.length || 0);
          console.log('Contacts:', directoryData.contacts?.length || 0);
          console.log('Addresses:', directoryData.addresses?.length || 0);
          console.log('Rate confirmation emails:', directoryData.rateConfirmationEmails?.length || 0);
        }
      } catch (error: any) {
        console.error('Error parsing directory:', error);
        return NextResponse.json(
          { ok: false, error: "Failed to parse directory data: " + error.message },
          { status: 400 }
        );
      }
    }
    
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
    }
    
    // Calculate health score - only if we have overview data (health score depends on overview metrics)
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
        console.log('Calculated health score:', healthScore);
      } catch (error: any) {
        console.error('Error calculating health score:', error);
        // If health score calculation fails, use existing score or default
        if (existing.length > 0 && existing[0].health_score) {
          healthScore = {
            score: existing[0].health_score,
            status: (existing[0].health_status as any) || 'Review',
          };
        }
      }
    } else if (existing.length > 0 && existing[0].health_score) {
      // If no overview data, keep existing health score
      healthScore = {
        score: existing[0].health_score,
        status: (existing[0].health_status as any) || 'Review',
      };
    }
    
    // Get carrier name from parsed data or use provided
    const finalCarrierName = carrierName || finalOverviewData?.carrierName || `MC ${mcNumber}`;
    
    // Store in database
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
        ${finalCarrierName},
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
        directory_data = CASE 
          WHEN EXCLUDED.directory_data IS NOT NULL THEN EXCLUDED.directory_data
          ELSE carrier_health_data.directory_data
        END,
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
    
    logSecurityEvent('carrier_health_auto_scraped', userId, { mcNumber });
    
    const response = NextResponse.json({
      ok: true,
      message: "Health data scraped and stored successfully",
      data: {
        id: result[0].id,
        mcNumber: result[0].mc_number,
        healthScore: result[0].health_score,
        healthStatus: result[0].health_status,
        bluewireScore: result[0].bluewire_score,
      },
      healthScore: {
        score: healthScore.score,
        status: healthScore.status,
      },
    });
    
    // Add CORS headers
    if (origin && allowedOrigins.some(allowed => origin.includes(allowed))) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    } else {
      response.headers.set('Access-Control-Allow-Origin', '*');
    }
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    
    return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
  } catch (error: any) {
    console.error("Error auto-scraping carrier health data:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_health_auto_scrape_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    // Add CORS headers even for errors
    const origin = request.headers.get('origin');
    const allowedOrigins = [
      'https://highway.com',
      'https://www.highway.com',
      'http://localhost:3000',
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    ].filter(Boolean);
    
    const errorResponse = NextResponse.json(
      {
        ok: false,
        error: process.env.NODE_ENV === 'development' 
          ? (error.message || "Failed to scrape health data")
          : "Failed to scrape health data",
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
    
    if (origin && allowedOrigins.some(allowed => origin.includes(allowed))) {
      errorResponse.headers.set('Access-Control-Allow-Origin', origin);
    } else {
      errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    }
    errorResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    
    return addSecurityHeaders(errorResponse);
  }
}

