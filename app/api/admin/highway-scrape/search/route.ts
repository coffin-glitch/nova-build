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
        // New format: Playwright storageState
        return storageState;
      } else if (Array.isArray(storageState)) {
        // Old format: just cookies array
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
    const { mcNumber } = body;

    // Input validation
    const validation = validateInput(
      { mcNumber },
      {
        mcNumber: { required: true, type: 'string', pattern: /^\d+$/, maxLength: 20 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_highway_scrape_search_input', userId, { errors: validation.errors });
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

    // Launch browser
    const browser = await chromium.launch({
      headless: true,
    });

    try {
      // Get stored storageState for this user (Playwright format)
      const storageState = await getStoredStorageState(userId);
      
      // Use Playwright's storageState option (industry standard approach)
      // This automatically loads cookies, localStorage, and sessionStorage
      const contextOptions: any = {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };
      
      if (storageState) {
        // Use Playwright's built-in storageState support
        contextOptions.storageState = storageState;
        console.log(`Using storageState with ${storageState.cookies?.length || 0} cookies`);
        
        // Also set localStorage if available
        if (storageState.origins && storageState.origins.length > 0) {
          console.log(`StorageState includes ${storageState.origins.length} origins with localStorage`);
        }
      } else {
        console.log('No storageState found, proceeding without authentication');
      }
      
      const context = await browser.newContext(contextOptions);

      const page = await context.newPage();

      // Navigate to carriers global search page to use the search form
      console.log('Navigating to Highway carriers global search page...');
      await page.goto('https://highway.com/broker/carriers/global-search', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // Wait for page to be interactive and JavaScript to load
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
        console.log('Network idle timeout, continuing...');
      });
      await page.waitForTimeout(5000); // Give extra time for dynamic content
      
      // Check if we're on a login page
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/sign-in')) {
        // Instead of throwing, return a helpful message
        await browser.close();
        return NextResponse.json({
          ok: false,
          error: 'Highway requires authentication. Please search for the carrier manually in your browser and provide the carrier URL or ID.',
          requiresManualSearch: true,
          instructions: 'After logging into Highway, search for the carrier, then copy the carrier URL (e.g., https://highway.com/broker/carriers/154445) and provide it.',
        }, { status: 401 });
      }
      
      // Find the search input - try multiple methods
      console.log('Looking for search input...');
      let searchInput = null;
      
      // Method 1: Try specific selectors
      const searchSelectors = [
        'input[type="text"][placeholder*="carrier"]',
        'input[type="text"][placeholder*="identifier"]',
        'input[type="text"][placeholder*="VIN"]',
        'input.h-9.w-72',
        'input[class*="h-9"][class*="w-72"]',
        'input[placeholder*="Type carrier"]',
        'input[placeholder*="carrier name"]',
      ];
      
      for (const selector of searchSelectors) {
        try {
          searchInput = await page.waitForSelector(selector, { timeout: 3000 });
          if (searchInput) {
            console.log(`Found search input with selector: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      // Method 2: Try finding by evaluating the page and getting selector
      if (!searchInput) {
        console.log('Trying to find input by evaluating page...');
        const inputSelector = await page.evaluate(() => {
          // Look for input with placeholder containing "carrier", "identifier", or "VIN"
          const inputs = Array.from(document.querySelectorAll('input[type="text"]')) as HTMLInputElement[];
          const found = inputs.find(input => {
            const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
            return placeholder.includes('carrier') || 
                   placeholder.includes('identifier') || 
                   placeholder.includes('vin') ||
                   input.classList.contains('h-9') ||
                   input.classList.contains('w-72');
          });
          
          if (found) {
            // Generate a unique selector
            if (found.id) return `#${found.id}`;
            if (found.className) {
              const classes = found.className.split(' ').filter(c => c).join('.');
              if (classes) return `input.${classes}`;
            }
            // Fallback: use placeholder
            if (found.placeholder) {
              return `input[placeholder="${found.placeholder.replace(/"/g, '\\"')}"]`;
            }
          }
          return null;
        });
        
        if (inputSelector) {
          try {
            searchInput = await page.waitForSelector(inputSelector, { timeout: 3000 });
            if (searchInput) {
              console.log('Found search input via page evaluation');
            }
          } catch (e) {
            // Continue to next method
          }
        }
      }
      
      // Method 3: Try finding any text input that might be the search
      if (!searchInput) {
        console.log('Trying to find any text input...');
        const allInputs = await page.$$('input[type="text"]');
        if (allInputs.length > 0) {
          // Try the first text input (often the search)
          searchInput = allInputs[0];
          console.log('Using first text input found');
        }
      }
      
      if (!searchInput) {
        // Take a screenshot and get page info for debugging
        await page.screenshot({ path: '/tmp/highway-search-debug.png', fullPage: true }).catch(() => null);
        
        const pageInfo = await page.evaluate(() => ({
          url: window.location.href,
          title: document.title,
          inputs: Array.from(document.querySelectorAll('input')).map(i => {
            const input = i as HTMLInputElement;
            return {
              type: input.type,
              placeholder: input.placeholder,
              class: input.className,
              id: input.id
            };
          })
        })).catch(() => ({ url: '', title: '', inputs: [] }));
        
        console.error('Page URL:', (pageInfo as any).url || page.url());
        console.error('Page title:', (pageInfo as any).title || 'Unknown');
        console.error('Inputs found:', (pageInfo as any).inputs || []);
        
        throw new Error('Could not find search input on Highway carriers page. The page may require login or the structure has changed. Check /tmp/highway-search-debug.png for a screenshot.');
      }
      
      // Clear and type the MC number
      console.log(`Entering MC number: ${mcNumber}`);
      await searchInput.click({ clickCount: 3 }); // Select all existing text
      await searchInput.fill(mcNumber);
      await page.waitForTimeout(1000);
      
      // Submit the search - try pressing Enter
      console.log('Submitting search...');
      await searchInput.press('Enter');
      await page.waitForTimeout(4000);
      
      // Wait for results to load - the page might navigate or update dynamically
      console.log('Waiting for search results...');
      try {
        await page.waitForSelector('a[href*="/broker/carriers/"], .carrier-card, .carrier-item, [data-carrier-id], table tr, .search-result', {
          timeout: 15000,
        });
        console.log('Search results found!');
      } catch (e) {
        console.log('No results selector found, but continuing to extract...');
        // Wait a bit more for dynamic content
        await page.waitForTimeout(2000);
      }

      // Extract carrier results from the page
      const results = await page.evaluate((mcNum) => {
        const carriers: Array<{ name: string; mc: string; id: string; url: string }> = [];
        
        // Get all links that might be carrier links
        const allLinks = Array.from(document.querySelectorAll('a'));
        const carrierLinks = allLinks.filter(link => {
          const href = link.href || link.getAttribute('href') || '';
          return href.includes('/broker/carriers/') && /\d+/.test(href);
        });

        // Also check for any divs or elements that might contain carrier info
        const allElements = Array.from(document.querySelectorAll('div, tr, li, article, section'));
        
        carrierLinks.forEach((link) => {
          const href = link.href || link.getAttribute('href') || '';
          
          // Extract carrier ID from URL (e.g., /broker/carriers/154445)
          const match = href.match(/\/broker\/carriers\/(\d+)/);
          if (match) {
            const carrierId = match[1];
            
            // Try to find the carrier name from the link or nearby elements
            let carrierName = link.textContent?.trim() || '';
            
            // If link text is empty or just a number, look for parent/child elements
            if (!carrierName || carrierName === carrierId || carrierName.length < 3) {
              const parent = link.closest('div, tr, li, article, section');
              if (parent) {
                // Look for text that might be the carrier name
                const nameElement = parent.querySelector('h1, h2, h3, h4, .name, .carrier-name, [class*="name"]');
                if (nameElement) {
                  carrierName = nameElement.textContent?.trim() || '';
                } else {
                  // Get all text from parent and try to extract name
                  const parentText = parent.textContent || '';
                  const lines = parentText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                  // Usually the first substantial line is the name
                  carrierName = lines.find(l => l.length > 3 && !l.match(/^\d+$/)) || carrierName;
                }
              }
            }
            
            if (!carrierName || carrierName.length < 2) {
              carrierName = `Carrier ${carrierId}`;
            }
            
            // Try to extract MC number from the element or nearby
            let mc = '';
            const elementText = (link.closest('div, tr, li')?.textContent || link.textContent || '').toUpperCase();
            const mcMatch = elementText.match(/MC[:\s#]*(\d{7,8})/i);
            if (mcMatch) {
              mc = mcMatch[1];
            } else if (elementText.includes(mcNum)) {
              // If the MC number appears in the text, use it
              mc = mcNum;
            }

            // Only add if we haven't seen this carrier ID before
            if (!carriers.find(c => c.id === carrierId)) {
              carriers.push({
                name: carrierName,
                mc: mc || mcNum || '',
                id: carrierId,
                url: href.startsWith('http') ? href : `https://highway.com${href}`,
              });
            }
          }
        });

        // If still no results, try to find any text that mentions the MC number
        if (carriers.length === 0) {
          const pageText = document.body.innerText || '';
          if (pageText.includes(mcNum)) {
            // MC number is on the page, but we couldn't find structured results
            // This might mean the page requires login or has a different structure
            console.log('MC number found on page but no structured carrier results');
          }
        }

        return carriers;
      }, mcNumber);

      await browser.close();

      if (results.length === 0) {
        logSecurityEvent('highway_carrier_search_no_results', userId, { mcNumber });
        const response = NextResponse.json(
          { 
            ok: false, 
            error: "No carriers found for this MC number",
            results: []
          },
          { status: 404 }
        );
        return addSecurityHeaders(response);
      }

      logSecurityEvent('highway_carrier_search_success', userId, { mcNumber, resultCount: results.length });
      
      const response = NextResponse.json({
        ok: true,
        results,
      });
      
      return addSecurityHeaders(response);
      
    } catch (error: any) {
      await browser.close();
      throw error;
    }
  } catch (error: any) {
    console.error("Error searching Highway carriers:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('highway_carrier_search_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        ok: false,
        error: process.env.NODE_ENV === 'development' 
          ? (error.message || "Failed to search for carriers")
          : "Failed to search for carriers",
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

