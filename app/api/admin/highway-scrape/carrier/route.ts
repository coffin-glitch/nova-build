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
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
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
      logSecurityEvent('invalid_highway_scrape_carrier_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { ok: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    if (!mcNumber || !carrierId || !carrierUrl) {
      const response = NextResponse.json(
        { ok: false, error: "MC number, carrier ID, and carrier URL are required" },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
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

      // Scrape all carrier data from the page
      const scrapedData = await page.evaluate(() => {
        const data: Record<string, any> = {};

        // Helper function to extract text content
        const getText = (selector: string): string => {
          const element = document.querySelector(selector);
          return element?.textContent?.trim() || '';
        };

        // Helper function to extract all matching text
        const getAllText = (selector: string): string[] => {
          const elements = Array.from(document.querySelectorAll(selector));
          return elements.map(el => el.textContent?.trim() || '').filter(Boolean);
        };

        // Helper function to find text in nearby elements
        const findNearbyValue = (labelText: string, maxDistance: number = 3): string => {
          const allText = document.body.innerText || '';
          const labelIndex = allText.toLowerCase().indexOf(labelText.toLowerCase());
          if (labelIndex === -1) return '';
          
          // Try to find value after label
          const afterLabel = allText.substring(labelIndex + labelText.length, labelIndex + labelText.length + 100);
          // Use RegExp constructor to avoid escaping issues
          const valueMatch = afterLabel.match(new RegExp('(\\d+[.%]?\\d*%?)|(Yes|No|N/A)', 'i'));
          return valueMatch ? valueMatch[0] : '';
        };

        // Extract carrier name - try multiple methods
        data.carrierName = getText('h1, .carrier-name, [data-carrier-name]') || 
                         getText('.header-title, .page-title') ||
                         getText('h2, h3') ||
                         '';
        
        // Extract MC number if visible
        const mcMatch = document.body.innerText?.match(/MC[:\s#]*(\d{7,8})/i);
        if (mcMatch) {
          data.mcNumber = mcMatch[1];
        }
        
        // Extract DOT number if visible
        const dotMatch = document.body.innerText?.match(/DOT[:\s#]*(\d{6,8})/i);
        if (dotMatch) {
          data.dotNumber = dotMatch[1];
        }

        // Extract health metrics - try multiple selectors
        const metricSelectors = {
          totalCrashes24Months: [
            '[data-crashes]',
            '.crashes',
            '.crash-count',
            '*:contains("Crashes")',
          ],
          mcs150PowerUnits: [
            '[data-power-units]',
            '.power-units',
            '*:contains("Power Units")',
          ],
          highwayObservedUnits: [
            '[data-observed-units]',
            '.observed-units',
            '*:contains("Observed Units")',
          ],
          inspectionCount: [
            '[data-inspections]',
            '.inspections',
            '*:contains("Inspections")',
          ],
          fmcsaDate: [
            '[data-fmcsa-date]',
            '.fmcsa-date',
            '*:contains("FMCSA Date")',
          ],
          authorityAge: [
            '[data-authority-age]',
            '.authority-age',
            '*:contains("Authority Age")',
          ],
          oosGaps: [
            '[data-oos-gaps]',
            '.oos-gaps',
            '*:contains("OOS Gaps")',
          ],
          crashIndicator: [
            '[data-crash-indicator]',
            '.crash-indicator',
            '*:contains("Crash Indicator")',
          ],
          driverFitness: [
            '[data-driver-fitness]',
            '.driver-fitness',
            '*:contains("Driver Fitness")',
          ],
          hos: [
            '[data-hos]',
            '.hos',
            '*:contains("HOS")',
          ],
          drugAlcohol: [
            '[data-drug-alcohol]',
            '.drug-alcohol',
            '*:contains("Drug & Alcohol")',
          ],
          unsafeDriving: [
            '[data-unsafe-driving]',
            '.unsafe-driving',
            '*:contains("Unsafe Driving")',
          ],
          vehicleMaintenance: [
            '[data-vehicle-maintenance]',
            '.vehicle-maintenance',
            '*:contains("Vehicle Maintenance")',
          ],
          oosDriverFitness: [
            '[data-oos-driver-fitness]',
            '.oos-driver-fitness',
            '*:contains("Driver Fitness OOS")',
          ],
          oosVehiclesFitness: [
            '[data-oos-vehicles-fitness]',
            '.oos-vehicles-fitness',
            '*:contains("Vehicles Fitness OOS")',
          ],
          bluewireScore: [
            '[data-bluewire-score]',
            '.bluewire-score',
            '*:contains("BlueWire")',
          ],
        };

        // Extract each metric
        for (const [key, selectors] of Object.entries(metricSelectors)) {
          let value = '';
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
              value = element.textContent?.trim() || '';
              // If it's a parent element, try to get the value from a child
              if (!value || value.length > 100) {
                const valueElement = element.querySelector('.value, .metric-value, .score, .count');
                value = valueElement?.textContent?.trim() || value;
              }
              if (value) break;
            }
          }
          data[key] = value;
        }

        // Try to extract from tables or structured data
        const tables = Array.from(document.querySelectorAll('table'));
        tables.forEach(table => {
          const rows = Array.from(table.querySelectorAll('tr'));
          rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td, th'));
            if (cells.length >= 2) {
              const label = cells[0].textContent?.trim().toLowerCase() || '';
              const value = cells[1].textContent?.trim() || '';
              
              // Map labels to data keys with more comprehensive matching
              if (label.includes('crash') && (label.includes('24') || label.includes('month'))) {
                data.totalCrashes24Months = value || findNearbyValue('crashes 24');
              } else if (label.includes('power unit') || label.includes('mcs-150')) {
                data.mcs150PowerUnits = value || findNearbyValue('power units');
              } else if (label.includes('observed unit') || label.includes('observed vehicles')) {
                data.highwayObservedUnits = value || findNearbyValue('observed units');
              } else if (label.includes('inspection') && !label.includes('oos')) {
                data.inspectionCount = value || findNearbyValue('inspections');
              } else if (label.includes('fmcsa date') || label.includes('authority date')) {
                data.fmcsaDate = value || findNearbyValue('fmcsa date');
              } else if (label.includes('authority age') || label.includes('years in business')) {
                data.authorityAge = value || findNearbyValue('authority age');
              } else if (label.includes('oos gap') || label.includes('out of service gap')) {
                data.oosGaps = value || findNearbyValue('oos gaps');
              } else if (label.includes('crash indicator') || (label.includes('crash') && label.includes('basic'))) {
                data.crashIndicator = value || findNearbyValue('crash indicator');
              } else if (label.includes('driver fitness') && !label.includes('oos') && !label.includes('%')) {
                data.driverFitness = value || findNearbyValue('driver fitness');
              } else if (label.includes('hos') || label.includes('hours of service')) {
                data.hos = value || findNearbyValue('hos compliance');
              } else if (label.includes('drug') || label.includes('alcohol') || label.includes('controlled substance')) {
                data.drugAlcohol = value || findNearbyValue('drug alcohol');
              } else if (label.includes('unsafe driving') || label.includes('unsafe')) {
                data.unsafeDriving = value || findNearbyValue('unsafe driving');
              } else if (label.includes('vehicle maintenance') || label.includes('vehicle condition')) {
                data.vehicleMaintenance = value || findNearbyValue('vehicle maintenance');
              } else if ((label.includes('driver fitness') || label.includes('driver')) && (label.includes('oos') || label.includes('%'))) {
                data.oosDriverFitness = value || findNearbyValue('driver fitness oos');
              } else if (label.includes('vehicle') && (label.includes('oos') || label.includes('%'))) {
                data.oosVehiclesFitness = value || findNearbyValue('vehicles fitness oos');
              } else if (label.includes('bluewire') || label.includes('score')) {
                data.bluewireScore = value || findNearbyValue('bluewire');
              }
            }
          });
        });
        
        // Also try to extract from divs, spans, and other structured elements
        const allDivs = Array.from(document.querySelectorAll('div, span, p'));
        allDivs.forEach(element => {
          const text = element.textContent?.toLowerCase() || '';
          const value = element.textContent?.trim() || '';
          
          // Look for key-value pairs in text
          if (text.includes('crashes') && text.includes('24')) {
            const match = value.match(/(\d+)/);
            if (match && !data.totalCrashes24Months) data.totalCrashes24Months = match[1];
          }
          if (text.includes('power units') && !data.mcs150PowerUnits) {
            const match = value.match(/(\d+)/);
            if (match) data.mcs150PowerUnits = match[1];
          }
          if (text.includes('bluewire') && !data.bluewireScore) {
            const match = value.match(/(\d+\.?\d*)/);
            if (match) data.bluewireScore = match[1];
          }
        });

        // Extract any additional data from the page
        data.pageTitle = document.title;
        data.pageUrl = window.location.href;

        return data;
      });

      await browser.close();

      // Extract carrier name from scraped data or use a fallback
      const carrierName = scrapedData.carrierName || `MC ${mcNumber}`;

      // Save to database
      await sql`
        INSERT INTO highway_carrier_data (
          mc_number,
          carrier_name,
          carrier_id,
          carrier_url,
          scraped_data,
          scraped_at,
          updated_at
        ) VALUES (
          ${mcNumber},
          ${carrierName},
          ${carrierId},
          ${carrierUrl},
          ${JSON.stringify(scrapedData)}::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT (mc_number, carrier_id) 
        DO UPDATE SET
          carrier_name = EXCLUDED.carrier_name,
          carrier_url = EXCLUDED.carrier_url,
          scraped_data = EXCLUDED.scraped_data,
          scraped_at = NOW(),
          updated_at = NOW()
      `;

      logSecurityEvent('highway_carrier_scraped', userId, { mcNumber, carrierId });
      
      const response = NextResponse.json({
        ok: true,
        data: {
          mc_number: mcNumber,
          carrier_name: carrierName,
          carrier_id: carrierId,
          carrier_url: carrierUrl,
          scraped_at: new Date().toISOString(),
          data: scrapedData,
        },
      });
      
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
      
    } catch (error: any) {
      await browser.close();
      throw error;
    }
  } catch (error: any) {
    console.error("Error scraping Highway carrier:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('highway_carrier_scrape_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        ok: false,
        error: process.env.NODE_ENV === 'development' 
          ? (error.message || "Failed to scrape carrier data")
          : "Failed to scrape carrier data",
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

