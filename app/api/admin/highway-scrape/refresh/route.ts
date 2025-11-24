import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";

async function getStoredStorageState(userId: string): Promise<any | null> {
  try {
    const result = await sql`
      SELECT cookies_data
      FROM highway_user_cookies
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    
    if (result.length > 0 && result[0].cookies_data) {
      const storageState = result[0].cookies_data;
      
      // Support both new storageState format and old cookie-only format
      if (storageState.cookies && Array.isArray(storageState.cookies)) {
        return storageState;
      } else if (Array.isArray(storageState)) {
        return { cookies: storageState, origins: [] };
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting stored storage state:', error);
    return null;
  }
}

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
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    const body = await request.json();
    const { mcNumber, carrierId, carrierUrl } = body;

    // Input validation
    const validation = validateInput(
      { mcNumber, carrierId, carrierUrl },
      {
        mcNumber: { required: true, type: 'string', pattern: /^\d+$/, maxLength: 20 },
        carrierId: { required: true, type: 'string', pattern: /^\d+$/, maxLength: 20 },
        carrierUrl: { required: true, type: 'string', pattern: /^https?:\/\/.+/, maxLength: 500 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_highway_scrape_refresh_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { ok: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!mcNumber || !carrierId || !carrierUrl) {
      const response = NextResponse.json(
        { ok: false, error: "MC number, carrier ID, and carrier URL are required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Launch browser
    const browser = await chromium.launch({
      headless: true,
    });

    try {
      // Get stored storageState for this user (Playwright format)
      const storageState = await getStoredStorageState(userId);
      
      // Use Playwright's storageState option (industry standard approach)
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

      // Navigate to carrier detail page
      await page.goto(carrierUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // Wait for page to be interactive
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(4000);
      
      // Try to wait for content, but don't fail if it doesn't appear
      try {
        await page.waitForSelector('table, h1, h2, .carrier-name, [data-carrier-name]', {
          timeout: 5000,
        });
      } catch (e) {
        console.log('Content selector not found, continuing with extraction...');
      }

      // Scrape all carrier data from the page (same logic as carrier route)
      const scrapedData = await page.evaluate(() => {
        const data: Record<string, any> = {};

        // Helper function to extract text content
        const getText = (selector: string): string => {
          const element = document.querySelector(selector);
          return element?.textContent?.trim() || '';
        };

        // Extract carrier name
        data.carrierName = getText('h1, .carrier-name, [data-carrier-name]') || 
                         getText('.header-title, .page-title') || '';

        // Try to extract from tables or structured data
        const tables = Array.from(document.querySelectorAll('table'));
        tables.forEach(table => {
          const rows = Array.from(table.querySelectorAll('tr'));
          rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td, th'));
            if (cells.length >= 2) {
              const label = cells[0].textContent?.trim().toLowerCase() || '';
              const value = cells[1].textContent?.trim() || '';
              
              // Map labels to data keys
              if (label.includes('crash') && label.includes('24')) {
                data.totalCrashes24Months = value;
              } else if (label.includes('power unit')) {
                data.mcs150PowerUnits = value;
              } else if (label.includes('observed unit')) {
                data.highwayObservedUnits = value;
              } else if (label.includes('inspection')) {
                data.inspectionCount = value;
              } else if (label.includes('fmcsa date')) {
                data.fmcsaDate = value;
              } else if (label.includes('authority age')) {
                data.authorityAge = value;
              } else if (label.includes('oos gap')) {
                data.oosGaps = value;
              } else if (label.includes('crash indicator')) {
                data.crashIndicator = value;
              } else if (label.includes('driver fitness') && !label.includes('oos')) {
                data.driverFitness = value;
              } else if (label.includes('hos')) {
                data.hos = value;
              } else if (label.includes('drug') || label.includes('alcohol')) {
                data.drugAlcohol = value;
              } else if (label.includes('unsafe driving')) {
                data.unsafeDriving = value;
              } else if (label.includes('vehicle maintenance')) {
                data.vehicleMaintenance = value;
              } else if (label.includes('driver fitness') && label.includes('oos')) {
                data.oosDriverFitness = value;
              } else if (label.includes('vehicle') && label.includes('oos')) {
                data.oosVehiclesFitness = value;
              } else if (label.includes('bluewire')) {
                data.bluewireScore = value;
              }
            }
          });
        });

        data.pageTitle = document.title;
        data.pageUrl = window.location.href;

        return data;
      });

      await browser.close();

      // Extract carrier name from scraped data or use a fallback
      const carrierName = scrapedData.carrierName || `MC ${mcNumber}`;

      // Update database
      await sql`
        UPDATE highway_carrier_data
        SET
          carrier_name = ${carrierName},
          carrier_url = ${carrierUrl},
          scraped_data = ${JSON.stringify(scrapedData)}::jsonb,
          scraped_at = NOW(),
          updated_at = NOW()
        WHERE mc_number = ${mcNumber} AND carrier_id = ${carrierId}
      `;

      // Fetch updated record
      const updated = await sql`
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
        WHERE mc_number = ${mcNumber} AND carrier_id = ${carrierId}
      `;

      if (updated.length === 0) {
        logSecurityEvent('highway_carrier_refresh_failed', userId, { mcNumber, carrierId });
        const response = NextResponse.json(
          { ok: false, error: "Failed to update carrier data" },
          { status: 500 }
        );
        return addSecurityHeaders(response);
      }

      const record = updated[0];

      logSecurityEvent('highway_carrier_refreshed', userId, { mcNumber, carrierId });
      
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
      await browser.close();
      throw error;
    }
  } catch (error: any) {
    console.error("Error refreshing Highway carrier data:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('highway_carrier_refresh_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        ok: false,
        error: process.env.NODE_ENV === 'development' 
          ? (error.message || "Failed to refresh carrier data")
          : "Failed to refresh carrier data",
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

