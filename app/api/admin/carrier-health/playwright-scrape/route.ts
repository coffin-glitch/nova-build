import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { parseDirectoryData, parseOverviewData } from "@/lib/carrier-health-parser";
import { calculateHealthScore } from "@/lib/carrier-health-scorer";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";

/**
 * Get stored storageState for Playwright authentication
 */
async function getStoredStorageState(userId: string): Promise<any | null> {
  try {
    const result = await sql`
      SELECT storage_state
      FROM highway_user_cookies
      WHERE user_id = ${userId}
      AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    if (result.length > 0 && result[0].storage_state) {
      return result[0].storage_state;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching storage state:', error);
    return null;
  }
}

/**
 * Fully automated Playwright scraping endpoint
 * Uses stored cookies to authenticate and scrape carrier data
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId || '';

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
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }
    
    const body = await request.json();
    const { mcNumber, carrierUrl } = body;

    // Input validation
    const validation = validateInput(
      { mcNumber, carrierUrl },
      {
        mcNumber: { type: 'string', pattern: /^\d+$/, maxLength: 20, required: false },
        carrierUrl: { type: 'string', pattern: /^https?:\/\/.+/, maxLength: 500, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_playwright_scrape_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { ok: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }
    
    if (!mcNumber && !carrierUrl) {
      const response = NextResponse.json(
        { ok: false, error: "MC number or carrier URL is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }
    
    // Launch browser
    const browser = await chromium.launch({
      headless: true,
    });
    
    try {
      // Get stored storageState for authentication
      const storageState = await getStoredStorageState(userId);
      
      const contextOptions: any = {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };
      
      if (storageState) {
        contextOptions.storageState = storageState;
        console.log(`Using storageState with ${storageState.cookies?.length || 0} cookies`);
      } else {
        console.log('No storageState found, proceeding without authentication');
      }
      
      const context = await browser.newContext(contextOptions);
      const page = await context.newPage();
      
      // Determine URL
      let finalUrl = carrierUrl;
      if (!finalUrl && mcNumber) {
        // Try to construct URL or search for carrier
        finalUrl = `https://highway.com/broker/carriers/global-search?q=${mcNumber}`;
        
        // Navigate to search page
        await page.goto(finalUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);
        
        // Try to find and click first result
        try {
          const firstResult = await page.waitForSelector('a[href*="/carriers/"]', { timeout: 5000 });
          if (firstResult) {
            const href = await firstResult.getAttribute('href');
            if (href) {
              finalUrl = href.startsWith('http') ? href : `https://highway.com${href}`;
            }
          }
        } catch (e) {
          console.log('Could not find search results, using provided URL');
        }
      }
      
      if (!finalUrl || !finalUrl.includes('/carriers/')) {
        return NextResponse.json(
          { ok: false, error: "Could not determine carrier URL" },
          { status: 400 }
        );
      }
      
      // Navigate to carrier page
      console.log('Navigating to carrier page:', finalUrl);
      await page.goto(finalUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(4000);
      
      // Check if we're on login page (redirected)
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        return NextResponse.json(
          { ok: false, error: "Authentication expired. Please update cookies using the bookmarklet." },
          { status: 401 }
        );
      }
      
      // Extract Overview data
      const overviewHtml = await page.content();
      
      // Try to click Directory tab if it exists
      try {
        const directoryTab = await page.waitForSelector(
          'button[data-tab="directory"], .directory-tab, [aria-label*="Directory" i], button:has-text("Directory")',
          { timeout: 3000 }
        );
        if (directoryTab) {
          await directoryTab.click();
          await page.waitForTimeout(2000);
        }
      } catch (e) {
        console.log('Directory tab not found or already active');
      }
      
      // Extract Directory data
      const directoryHtml = await page.content();
      
      // Extract MC number from page if not provided
      let finalMcNumber = mcNumber;
      if (!finalMcNumber) {
        const pageText = await page.textContent('body');
        const mcMatch = pageText?.match(/MC\s*(\d{7,8})/i);
        if (mcMatch) {
          finalMcNumber = mcMatch[1];
        }
      }
      
      if (!finalMcNumber) {
        return NextResponse.json(
          { ok: false, error: "Could not extract MC number from page" },
          { status: 400 }
        );
      }
      
      // Parse the data
      let overviewData = null;
      let directoryData = null;
      
      if (overviewHtml) {
        try {
          overviewData = parseOverviewData(overviewHtml);
        } catch (error: any) {
          console.error('Error parsing overview:', error);
        }
      }
      
      if (directoryHtml) {
        try {
          directoryData = parseDirectoryData(directoryHtml);
        } catch (error: any) {
          console.error('Error parsing directory:', error);
        }
      }
      
      // Calculate health score
      const healthScore = await calculateHealthScore({
        bluewireScore: overviewData?.bluewireScore,
        connectionStatus: overviewData?.connectionStatus,
        assessmentStatus: overviewData?.assessmentStatus,
        dotStatus: overviewData?.dotStatus,
        safetyRating: overviewData?.safetyRating,
        powerUnits: overviewData?.powerUnits,
        crashes: overviewData?.crashes || { count24Months: overviewData?.crashCount24Months },
        safety: overviewData?.safety,
      });
      
      // Get carrier name
      const carrierName = overviewData?.carrierName || `MC ${finalMcNumber}`;
      
      // Store in database
      const overviewDataJson = overviewData ? JSON.stringify(overviewData) : null;
      const directoryDataJson = directoryData ? JSON.stringify(directoryData) : null;
      
      // First, delete any existing data for this MC number to ensure complete replacement
      await sql`
        DELETE FROM carrier_health_data WHERE mc_number = ${finalMcNumber}
      `;
      
      // Now insert fresh data
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
          ${finalMcNumber},
          ${carrierName},
          ${finalUrl},
          ${overviewHtml || null},
          ${overviewDataJson ? sql.unsafe(`'${overviewDataJson.replace(/'/g, "''")}'::jsonb`) : null},
          ${directoryHtml || null},
          ${directoryDataJson ? sql.unsafe(`'${directoryDataJson.replace(/'/g, "''")}'::jsonb`) : null},
          ${overviewData?.bluewireScore || null},
          ${overviewData?.connectionStatus || null},
          ${overviewData?.assessmentStatus || null},
          ${overviewData?.dotStatus || null},
          ${overviewData?.operatingStatus || null},
          ${overviewData?.safetyRating || null},
          ${overviewData?.eldStatus || null},
          ${overviewData?.eldProvider || null},
          ${healthScore.score},
          ${healthScore.status},
          NOW(),
          ${userId},
          NOW()
        )
        RETURNING id, mc_number, health_score, health_status, bluewire_score
      `;
      
      await browser.close();
      
      logSecurityEvent('carrier_health_playwright_scraped', userId, { mcNumber: finalMcNumber });
      
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
      
      return addSecurityHeaders(response, request);
      
    } catch (error: any) {
      await browser.close();
      throw error;
    }
  } catch (error: any) {
    console.error("Error Playwright scraping carrier health data:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_health_playwright_scrape_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        ok: false,
        error: process.env.NODE_ENV === 'development' 
          ? (error.message || "Failed to scrape health data")
          : "Failed to scrape health data",
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

