// ==UserScript==
// @name         Highway Carrier Auto Scraper
// @namespace    http://nova-build.com/
// @version      1.0
// @description  Automatically extract carrier data from Highway.com and send to Nova Health Console
// @author       Nova Build
// @match        https://highway.com/broker/carriers/*
// @match        https://www.highway.com/broker/carriers/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      localhost
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    // Configuration - API Base URL
    // This can be configured via GM_setValue('nova_api_url', 'http://localhost:3000')
    // Or it will default to localhost for development
    function getApiBaseUrl() {
        // Check if user has manually set a preference
        const storedUrl = GM_getValue('nova_api_url', null);
        if (storedUrl) {
            return storedUrl;
        }
        
        // Default to localhost for development
        // Change this to 'https://novefreight.io' for production if needed
        return 'http://localhost:3000';
    }
    
    const API_BASE_URL = getApiBaseUrl();
    const API_ENDPOINT = '/api/admin/carrier-health/auto-scrape';
    
    // Log the API URL being used (for debugging)
    console.log('🚀 Nova Scraper: Using API URL:', API_BASE_URL);

    // Extract MC number from page
    function extractMCNumber() {
        // Try multiple methods to find MC number
        const pageText = document.body.innerText || document.body.textContent || '';
        
        // Pattern 1: MC 1234567
        const mcMatch1 = pageText.match(/MC\s*(\d{7,8})/i);
        if (mcMatch1) return mcMatch1[1];
        
        // Pattern 2: From URL
        const urlMatch = window.location.href.match(/\/carriers\/(\d+)/);
        if (urlMatch) {
            // Try to find MC in page content near carrier ID
            const carrierId = urlMatch[1];
            // This is a fallback - ideally we'd get MC from the page
        }
        
        // Pattern 3: Look in common elements
        const mcElements = document.querySelectorAll('*');
        for (const el of mcElements) {
            const text = el.textContent || '';
            const match = text.match(/MC\s*(\d{7,8})/i);
            if (match) return match[1];
        }
        
        return null;
    }

    // Extract carrier name
    function extractCarrierName() {
        // Look for carrier name in common locations
        const h1 = document.querySelector('h1');
        if (h1 && h1.textContent) {
            const text = h1.textContent.trim();
            if (text && !text.includes('Highway')) return text;
        }
        
        // Look in page title
        const title = document.title;
        if (title && !title.includes('Highway')) {
            return title.split('|')[0].trim();
        }
        
        return null;
    }

    // Extract Overview tab data
    async function extractOverviewData() {
        // Get all text content from the Overview tab
        // This assumes the Overview tab is active or we can switch to it
        const overviewTab = document.querySelector('[data-tab="overview"], .overview, #overview') ||
                           document.querySelector('.carrier-overview') ||
                           document.body;
        
        let content = '';
        let htmlContent = '';
        
        // COMPREHENSIVE EXTRACTION: Get ALL visible text
        const comprehensiveData = extractComprehensiveData(overviewTab);
        console.log('📊 Overview comprehensive extraction:', {
            emailsFound: comprehensiveData.emails.length,
            phonesFound: comprehensiveData.phones.length,
            addressesFound: comprehensiveData.addresses.length,
            mcNumbersFound: comprehensiveData.mcNumbers.length,
            dotNumbersFound: comprehensiveData.dotNumbers.length
        });
        
        if (overviewTab && overviewTab.offsetParent !== null) {
            // Tab is visible - use comprehensive extraction
            content = comprehensiveData.fullText;
            htmlContent = comprehensiveData.fullHtml;
        } else {
            // Fallback: use comprehensive extraction on body
            content = comprehensiveData.fullText;
            htmlContent = comprehensiveData.fullHtml;
        }

        // Extract structured safety & compliance data from HTML
        const structuredSafetyData = {
            unsafeDriving: null,
            hoursOfService: null,
            vehicleMaintenance: null,
            controlledSubstances: null,
            driverFitness: null
        };

        // ROBUST: Find the safety buttons container using multiple strategies
        let safetyButtonsContainer = null;
        
        // Strategy 1: Direct selector with data attribute
        safetyButtonsContainer = document.querySelector('[data-v-0e92ab68] .mb-6.mt-10.flex.gap-6');
        
        // Strategy 2: Find by class pattern
        if (!safetyButtonsContainer) {
            safetyButtonsContainer = Array.from(document.querySelectorAll('div.mb-6.mt-10.flex.gap-6')).find(div => {
                const buttons = div.querySelectorAll('button');
                return buttons.length >= 5;
            });
        }
        
        // Strategy 3: Find by button content pattern
        if (!safetyButtonsContainer) {
            safetyButtonsContainer = Array.from(document.querySelectorAll('div')).find(div => {
                const buttons = div.querySelectorAll('button.group.h-16, button.h-16');
                if (buttons.length < 5) return false;
                const buttonTexts = Array.from(buttons).map(btn => btn.textContent || '');
                const hasUnsafeDriving = buttonTexts.some(t => t.includes('Unsafe Driving'));
                const hasHoursOfService = buttonTexts.some(t => t.includes('Hours-of-Service') || t.includes('HOS'));
                return hasUnsafeDriving && hasHoursOfService;
            });
        }

        if (safetyButtonsContainer) {
            console.log('✅ Found safety buttons container');
            
            // Find all safety category buttons - use multiple selectors
            let buttons = Array.from(safetyButtonsContainer.querySelectorAll('button.group.h-16, button.h-16'));
            
            // Filter to only safety-related buttons
            buttons = buttons.filter(btn => {
                const text = btn.textContent || '';
                return text.includes('Unsafe Driving') || 
                       text.includes('Hours-of-Service') || 
                       text.includes('HOS') ||
                       text.includes('Vehicle Maintenance') ||
                       text.includes('Controlled Substances') ||
                       text.includes('Alcohol') ||
                       text.includes('Driver Fitness');
            });
            
            console.log(`Found ${buttons.length} safety buttons`);
            
            // Enhanced helper function to extract data with multiple strategies
            // NEW APPROACH: Find the category section first, then extract data from within it
            const extractDataFromCurrentSection = () => {
                let percentile = null;
                let score = null;
                let categoryName = '';
                
                console.log('🔍 Starting data extraction...');
                
                // STEP 1: Find the category heading (h4) to confirm we're in the right section
                // This helps us avoid picking up the wrong container (like "ELD Connection Status")
                // Prioritize headings that are in visible/active sections
                const allHeadings = Array.from(document.querySelectorAll('h4, h3, h2'));
                const categoryHeadings = allHeadings.filter(heading => {
                    const text = heading.textContent || '';
                    const safetyCategories = [
                        'Unsafe Driving',
                        'Hours-of-Service',
                        'HOS',
                        'Vehicle Maintenance',
                        'Controlled Substances',
                        'Alcohol',
                        'Driver Fitness'
                    ];
                    if (!safetyCategories.some(cat => text.includes(cat))) return false;
                    
                    // Check if heading is in a visible section
                    const style = window.getComputedStyle(heading);
                    const isVisible = style.display !== 'none' && 
                                     style.visibility !== 'hidden' && 
                                     style.opacity !== '0' &&
                                     heading.offsetParent !== null;
                    
                    return isVisible;
                });
                
                // Sort by visibility - prefer headings that are more prominently displayed
                categoryHeadings.sort((a, b) => {
                    const aRect = a.getBoundingClientRect();
                    const bRect = b.getBoundingClientRect();
                    // Prefer headings that are higher on the page and more visible
                    if (aRect.top < bRect.top) return -1;
                    if (aRect.top > bRect.top) return 1;
                    return 0;
                });
                
                console.log(`Found ${categoryHeadings.length} visible category headings`);
                
                // STEP 2: Find the safety data container by starting from the category heading
                let safetySection = null;
                
                if (categoryHeadings.length > 0) {
                    // Use the first matching heading
                    const heading = categoryHeadings[0];
                    categoryName = heading.textContent.trim();
                    console.log(`✅ Found category heading: "${categoryName}"`);
                    
                    // Find the parent container that holds both the heading and the CSA/BASIC data
                    // Look for a parent that contains both the heading AND the safety data labels
                    let current = heading.parentElement;
                    let depth = 0;
                    const maxDepth = 10; // Prevent infinite loops
                    
                    while (current && depth < maxDepth) {
                        const text = current.textContent || '';
                        const hasCSA = text.includes('CSA Percentile Equivalent') || text.includes('CSA Percentile');
                        const hasBASIC = text.includes('BASIC Score');
                        
                        if (hasCSA && hasBASIC) {
                            safetySection = current;
                            console.log(`✅ Found safety section container at depth ${depth}`);
                            break;
                        }
                        
                        current = current.parentElement;
                        depth++;
                    }
                    
                    // If we didn't find a parent with both labels, try finding siblings or nearby elements
                    if (!safetySection) {
                        // Look for a sibling or nearby div that contains the safety data
                        const headingParent = heading.parentElement;
                        if (headingParent) {
                            // Search within the same parent
                            const candidates = Array.from(headingParent.querySelectorAll('div')).filter(div => {
                                const text = div.textContent || '';
                                return (text.includes('CSA Percentile') || text.includes('CSA')) && 
                                       text.includes('BASIC Score');
                            });
                            
                            if (candidates.length > 0) {
                                safetySection = candidates[0];
                                console.log(`✅ Found safety section as sibling/nearby element`);
                            }
                        }
                    }
                }
                
                // STEP 3: If we still don't have a section, try finding it by content alone
                if (!safetySection) {
                    console.log('⚠️ Could not find section via heading, trying content-based search...');
                    
                    // Try multiple strategies to find the container
                    const strategies = [
                        // Strategy 1: Look for divs containing both CSA and BASIC labels
                        () => {
                            const allDivs = Array.from(document.querySelectorAll('div'));
                            return allDivs.find(div => {
                                const text = div.textContent || '';
                                const hasCSA = text.includes('CSA Percentile Equivalent') || text.includes('CSA Percentile');
                                const hasBASIC = text.includes('BASIC Score');
                                // Exclude containers that have "ELD" or other non-safety content
                                const hasELD = text.includes('ELD Connection');
                                return hasCSA && hasBASIC && !hasELD;
                            });
                        },
                        // Strategy 2: Look for flex containers with the labels
                        () => {
                            const flexDivs = Array.from(document.querySelectorAll('div.flex'));
                            return flexDivs.find(div => {
                                const text = div.textContent || '';
                                return text.includes('CSA Percentile Equivalent') && 
                                       text.includes('BASIC Score') &&
                                       !text.includes('ELD Connection');
                            });
                        },
                        // Strategy 3: Look for specific class patterns
                        () => {
                            return document.querySelector('div.flex.w-full.items-center.gap-6') ||
                                   document.querySelector('div.flex-between-items-center');
                        }
                    ];
                    
                    for (let i = 0; i < strategies.length && !safetySection; i++) {
                        safetySection = strategies[i]();
                        if (safetySection) {
                            console.log(`✅ Found safety section via strategy ${i + 1}`);
                        }
                    }
                }
                
                // STEP 4: Extract data from the found section
                if (safetySection) {
                    const sectionText = safetySection.textContent || '';
                    console.log('✅ Found safety data section');
                    console.log('Section text preview:', sectionText.substring(0, 200));
                    
                    // METHOD 1: Find label elements and extract nearby values
                    // This is the most reliable method - find the label, then find the value next to it
                    
                    // Find "CSA Percentile Equivalent" label
                    const percentileLabel = Array.from(safetySection.querySelectorAll('*')).find(el => {
                        const text = el.textContent || '';
                        return text.trim() === 'CSA Percentile Equivalent' || 
                               text.includes('CSA Percentile Equivalent');
                    });
                    
                    if (percentileLabel) {
                        console.log('✅ Found CSA Percentile Equivalent label');
                        
                        // Find the value - look in the same parent, sibling, or nearby
                        const parent = percentileLabel.parentElement;
                        if (parent) {
                            // Look for yellow divs in the same parent
                            const yellowDivs = Array.from(parent.querySelectorAll('div')).filter(div => {
                                // Check for yellow classes
                                if (div.classList.contains('text-yellow-500') || 
                                    div.classList.contains('text-yellow-600') ||
                                    div.classList.contains('text-yellow-400') ||
                                    div.classList.contains('text-lg')) {
                                    return true;
                                }
                                // Check computed style
                                try {
                                    const style = window.getComputedStyle(div);
                                    const color = style.color;
                                    if (color.includes('rgb(234, 179, 8)') ||   // yellow-600
                                        color.includes('rgb(250, 204, 21)') ||  // yellow-400
                                        color.includes('rgb(251, 191, 36)') ||  // yellow-500
                                        color.includes('rgb(248, 198, 23)')) {   // custom yellow
                                        return true;
                                    }
                                } catch (e) {}
                                return false;
                            });
                            
                            // Extract percentage from yellow divs
                            for (const yellowDiv of yellowDivs) {
                                const text = yellowDiv.textContent.trim();
                                const match = text.match(/(\d+\.?\d*)%/);
                                if (match) {
                                    percentile = match[1];
                                    console.log(`✅ Found percentile: ${percentile} (from "${text}")`);
                                    break;
                                }
                            }
                            
                            // If not found in parent, try regex on parent text
                            if (!percentile) {
                                const parentText = parent.textContent || '';
                                const match = parentText.match(/CSA\s+Percentile\s+Equivalent[:\s]*(\d+\.?\d*)%/i);
                                if (match) {
                                    percentile = match[1];
                                    console.log(`✅ Found percentile via regex: ${percentile}`);
                                }
                            }
                        }
                    }
                    
                    // Find "BASIC Score" label
                    const basicScoreLabel = Array.from(safetySection.querySelectorAll('*')).find(el => {
                        const text = el.textContent || '';
                        return text.trim() === 'BASIC Score' || text.includes('BASIC Score');
                    });
                    
                    if (basicScoreLabel) {
                        console.log('✅ Found BASIC Score label');
                        
                        // Find the value - look in the same parent, sibling, or nearby
                        const parent = basicScoreLabel.parentElement;
                        if (parent) {
                            // Look for yellow divs in the same parent
                            const yellowDivs = Array.from(parent.querySelectorAll('div')).filter(div => {
                                // Check for yellow classes
                                if (div.classList.contains('text-yellow-500') || 
                                    div.classList.contains('text-yellow-600') ||
                                    div.classList.contains('text-yellow-400') ||
                                    div.classList.contains('text-lg')) {
                                    return true;
                                }
                                // Check computed style
                                try {
                                    const style = window.getComputedStyle(div);
                                    const color = style.color;
                                    if (color.includes('rgb(234, 179, 8)') ||   // yellow-600
                                        color.includes('rgb(250, 204, 21)') ||  // yellow-400
                                        color.includes('rgb(251, 191, 36)') ||  // yellow-500
                                        color.includes('rgb(248, 198, 23)')) {   // custom yellow
                                        return true;
                                    }
                                } catch (e) {}
                                return false;
                            });
                            
                            // Extract score from yellow divs (number between 0 and 10)
                            for (const yellowDiv of yellowDivs) {
                                const text = yellowDiv.textContent.trim();
                                const match = text.match(/(\d+\.?\d*)/);
                                if (match) {
                                    const num = parseFloat(match[1]);
                                    if (num > 0 && num < 10) {
                                        score = match[1];
                                        console.log(`✅ Found score: ${score} (from "${text}")`);
                                        break;
                                    }
                                }
                            }
                            
                            // If not found in parent, try regex on parent text
                            if (!score) {
                                const parentText = parent.textContent || '';
                                const match = parentText.match(/BASIC\s+Score[:\s]*(\d+\.?\d*)/i);
                                if (match) {
                                    const num = parseFloat(match[1]);
                                    if (num > 0 && num < 10) {
                                        score = match[1];
                                        console.log(`✅ Found score via regex: ${score}`);
                                    }
                                }
                            }
                        }
                    }
                    
                    // METHOD 2: Fallback - regex on entire section text
                    if (!percentile || !score) {
                        console.log('Trying regex fallback on section text...');
                        const percentileMatch = sectionText.match(/CSA\s+Percentile\s+Equivalent[:\s]*(\d+\.?\d*)%/i) ||
                                               sectionText.match(/CSA\s+Percentile[:\s]*(\d+\.?\d*)%/i);
                        if (percentileMatch && !percentile) {
                            percentile = percentileMatch[1];
                            console.log(`✅ Found percentile via section regex: ${percentile}`);
                        }
                        
                        const basicScoreMatch = sectionText.match(/BASIC\s+Score[:\s]*(\d+\.?\d*)/i);
                        if (basicScoreMatch && !score) {
                            const num = parseFloat(basicScoreMatch[1]);
                            if (num > 0 && num < 10) {
                                score = basicScoreMatch[1];
                                console.log(`✅ Found score via section regex: ${score}`);
                            }
                        }
                    }
                    
                    // Get category name if not already set
                    if (!categoryName && categoryHeadings.length > 0) {
                        categoryName = categoryHeadings[0].textContent.trim();
                    }
                } else {
                    console.warn('⚠️ Safety section not found, trying global fallback...');
                }
                
                // STEP 5: Final fallback - search entire document
                if (!percentile && !score) {
                    console.log('Trying final fallback: searching entire document...');
                    const allVisibleText = getAllVisibleText(document.body);
                    const percentileMatch = allVisibleText.match(/CSA\s+Percentile\s+Equivalent[:\s]*(\d+\.?\d*)%/i);
                    const basicScoreMatch = allVisibleText.match(/BASIC\s+Score[:\s]*(\d+\.?\d*)/i);
                    
                    if (percentileMatch) {
                        percentile = percentileMatch[1];
                        console.log(`✅ Found percentile from global fallback: ${percentile}`);
                    }
                    if (basicScoreMatch) {
                        const num = parseFloat(basicScoreMatch[1]);
                        if (num > 0 && num < 10) {
                            score = basicScoreMatch[1];
                            console.log(`✅ Found score from global fallback: ${score}`);
                        }
                    }
                }
                
                if (percentile || score) {
                    console.log(`✅ Final extraction: category="${categoryName}", percentile=${percentile}, score=${score}`);
                    return {
                        categoryName: categoryName,
                        percentile: percentile,
                        score: score
                    };
                } else {
                    console.warn('❌ Could not extract any data');
                    console.log('Debug: Section found?', !!safetySection);
                    console.log('Debug: Section text length:', safetySection ? safetySection.textContent.length : 0);
                }
                
                return null;
            };
            
            // Wait for category heading to change (confirms section switched)
            // This function waits for the heading to change from the previous one
            const waitForCategoryHeading = (expectedCategory, previousHeading, timeout = 3000) => {
                return new Promise((resolve) => {
                    const startTime = Date.now();
                    let lastHeadingText = previousHeading || '';
                    
                    // Normalize category names for matching
                    const normalizeCategory = (text) => {
                        const lower = text.toLowerCase();
                        // Map button text variations to expected heading text
                        if (lower.includes('unsafe driving')) return 'unsafe driving';
                        if (lower.includes('hours-of-service') || lower.includes('hos')) return ['hours-of-service', 'hos', 'hours of service'];
                        if (lower.includes('vehicle maintenance')) return 'vehicle maintenance';
                        if (lower.includes('controlled substances') || lower.includes('alcohol')) return ['controlled substances', 'alcohol'];
                        if (lower.includes('driver fitness')) return 'driver fitness';
                        return text.toLowerCase();
                    };
                    
                    const expectedMatches = normalizeCategory(expectedCategory);
                    const expectedArray = Array.isArray(expectedMatches) ? expectedMatches : [expectedMatches];
                    
                    const checkInterval = setInterval(() => {
                        // Find all safety category headings
                        const headings = Array.from(document.querySelectorAll('h4, h3, h2')).filter(heading => {
                            const text = (heading.textContent || '').toLowerCase();
                            const safetyCategories = [
                                'unsafe driving',
                                'hours-of-service',
                                'hos',
                                'hours of service',
                                'vehicle maintenance',
                                'controlled substances',
                                'alcohol',
                                'driver fitness'
                            ];
                            return safetyCategories.some(cat => text.includes(cat));
                        });
                        
                        if (headings.length > 0) {
                            const currentHeadingText = headings[0].textContent.trim();
                            const currentHeadingLower = currentHeadingText.toLowerCase();
                            
                            // Check if heading matches expected category
                            const matchesExpected = expectedArray.some(expected => 
                                currentHeadingLower.includes(expected)
                            );
                            
                            // Check if heading actually changed from previous
                            const headingChanged = currentHeadingText !== lastHeadingText;
                            
                            if (matchesExpected && headingChanged) {
                                clearInterval(checkInterval);
                                console.log(`✅ Category heading changed to: "${currentHeadingText}" (was: "${lastHeadingText}")`);
                                resolve(true);
                                return;
                            }
                            
                            // Update last heading text
                            if (headingChanged) {
                                lastHeadingText = currentHeadingText;
                                console.log(`🔄 Heading changed to: "${currentHeadingText}" (waiting for match...)`);
                            }
                        }
                        
                        if (Date.now() - startTime > timeout) {
                            clearInterval(checkInterval);
                            const currentHeadings = Array.from(document.querySelectorAll('h4, h3, h2')).filter(h => {
                                const text = (h.textContent || '').toLowerCase();
                                return text.includes('unsafe') || text.includes('hours') || text.includes('vehicle') || text.includes('controlled') || text.includes('driver');
                            });
                            const currentText = currentHeadings.length > 0 ? currentHeadings[0].textContent.trim() : 'none';
                            console.warn(`⏱️ Category heading timeout after ${timeout}ms. Current heading: "${currentText}", Expected: "${expectedCategory}"`);
                            resolve(false);
                        }
                    }, 150); // Check every 150ms
                });
            };
            
            // Wait for element to appear after click
            const waitForDataToAppear = (timeout = 4000) => {
                return new Promise((resolve) => {
                    const startTime = Date.now();
                    let attempts = 0;
                    const checkInterval = setInterval(() => {
                        attempts++;
                        const data = extractDataFromCurrentSection();
                        if (data && (data.percentile || data.score)) {
                            clearInterval(checkInterval);
                            console.log(`✅ Data appeared after ${attempts} attempts (${Date.now() - startTime}ms)`);
                            resolve(data);
                        } else if (Date.now() - startTime > timeout) {
                            clearInterval(checkInterval);
                            console.warn(`⏱️ Timeout after ${attempts} attempts (${timeout}ms)`);
                            resolve(null);
                        }
                    }, 150); // Check every 150ms
                });
            };
            
            // Map button text to category key
            const getCategoryKey = (buttonText) => {
                const text = buttonText.toLowerCase();
                if (text.includes('unsafe driving')) return 'unsafeDriving';
                if (text.includes('hours-of-service') || text.includes('hos')) return 'hoursOfService';
                if (text.includes('vehicle maintenance')) return 'vehicleMaintenance';
                if (text.includes('controlled substances') || text.includes('alcohol')) return 'controlledSubstances';
                if (text.includes('driver fitness')) return 'driverFitness';
                return null;
            };
            
            // GUIDED STEP-BY-STEP PROCESS: Show UI and wait for user to click buttons
            let previousHeading = null;
            
            // Create guided UI element
            const createGuidedUI = (stepNumber, totalSteps, buttonText, buttonElement) => {
                // Remove existing guided UI
                const existingUI = document.getElementById('nova-safety-guided-ui');
                if (existingUI) existingUI.remove();
                
                // Create main container
                const uiContainer = document.createElement('div');
                uiContainer.id = 'nova-safety-guided-ui';
                uiContainer.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 99999;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 30px 40px;
                    border-radius: 16px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    text-align: center;
                    min-width: 400px;
                    max-width: 500px;
                    animation: slideIn 0.3s ease;
                `;
                
                // Add CSS animation
                if (!document.getElementById('nova-guided-ui-styles')) {
                    const style = document.createElement('style');
                    style.id = 'nova-guided-ui-styles';
                    style.textContent = `
                        @keyframes slideIn {
                            from { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
                            to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                        }
                        @keyframes pulse {
                            0%, 100% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.7); }
                            50% { box-shadow: 0 0 0 10px rgba(102, 126, 234, 0); }
                        }
                        .nova-highlight-button {
                            animation: pulse 2s infinite !important;
                            border: 3px solid #667eea !important;
                            box-shadow: 0 0 20px rgba(102, 126, 234, 0.8) !important;
                        }
                    `;
                    document.head.appendChild(style);
                }
                
                // Step indicator
                const stepIndicator = document.createElement('div');
                stepIndicator.style.cssText = `
                    font-size: 14px;
                    opacity: 0.9;
                    margin-bottom: 10px;
                    font-weight: 600;
                `;
                stepIndicator.textContent = `Safety Step ${stepNumber}/${totalSteps}`;
                uiContainer.appendChild(stepIndicator);
                
                // Main instruction
                const instruction = document.createElement('div');
                instruction.style.cssText = `
                    font-size: 20px;
                    font-weight: bold;
                    margin-bottom: 20px;
                    line-height: 1.4;
                `;
                instruction.textContent = `Click the "${buttonText}" button`;
                uiContainer.appendChild(instruction);
                
                // Status message
                const status = document.createElement('div');
                status.id = 'nova-guided-status';
                status.style.cssText = `
                    font-size: 14px;
                    opacity: 0.8;
                    margin-top: 15px;
                    min-height: 20px;
                `;
                status.textContent = 'Waiting for you to click...';
                uiContainer.appendChild(status);
                
                // Manual Continue button
                const continueBtn = document.createElement('button');
                continueBtn.id = 'nova-guided-continue-btn';
                continueBtn.textContent = 'Continue (Manual)';
                continueBtn.style.cssText = `
                    margin-top: 20px;
                    padding: 12px 24px;
                    background: rgba(255, 255, 255, 0.2);
                    color: white;
                    border: 2px solid white;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s ease;
                `;
                continueBtn.addEventListener('mouseenter', () => {
                    continueBtn.style.background = 'rgba(255, 255, 255, 0.3)';
                    continueBtn.style.transform = 'scale(1.05)';
                });
                continueBtn.addEventListener('mouseleave', () => {
                    continueBtn.style.background = 'rgba(255, 255, 255, 0.2)';
                    continueBtn.style.transform = 'scale(1)';
                });
                uiContainer.appendChild(continueBtn);
                
                // Progress bar
                const progressContainer = document.createElement('div');
                progressContainer.style.cssText = `
                    width: 100%;
                    height: 6px;
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 3px;
                    margin-top: 20px;
                    overflow: hidden;
                `;
                const progressBar = document.createElement('div');
                progressBar.style.cssText = `
                    height: 100%;
                    background: white;
                    width: ${(stepNumber / totalSteps) * 100}%;
                    transition: width 0.3s ease;
                    border-radius: 3px;
                `;
                progressContainer.appendChild(progressBar);
                uiContainer.appendChild(progressContainer);
                
                document.body.appendChild(uiContainer);
                
                // Highlight the target button
                if (buttonElement) {
                    const originalStyle = buttonElement.style.cssText;
                    buttonElement.classList.add('nova-highlight-button');
                    buttonElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Store original style to restore later
                    buttonElement.setAttribute('data-original-style', originalStyle);
                }
                
                // Store resolve function for manual continue (accessible to both button and waitForUserClick)
                let manualResolve = null;
                
                continueBtn.addEventListener('click', () => {
                    if (manualResolve) {
                        guidedUI.updateStatus('⏭️ Manual continue - extracting data...');
                        manualResolve(true);
                    } else {
                        console.log('⚠️ Manual continue clicked but resolve function not set yet');
                    }
                });
                
                return {
                    updateStatus: (message) => {
                        const statusEl = document.getElementById('nova-guided-status');
                        if (statusEl) statusEl.textContent = message;
                    },
                    setManualResolve: (resolveFn) => {
                        manualResolve = resolveFn;
                    },
                    remove: () => {
                        uiContainer.remove();
                        if (buttonElement) {
                            buttonElement.classList.remove('nova-highlight-button');
                            const originalStyle = buttonElement.getAttribute('data-original-style');
                            if (originalStyle) {
                                buttonElement.style.cssText = originalStyle;
                            }
                        }
                        manualResolve = null; // Clean up
                    }
                };
            };
            
            // Process each button with guided UI
            for (let i = 0; i < buttons.length; i++) {
                const button = buttons[i];
                const buttonText = button.textContent || '';
                const category = getCategoryKey(buttonText);
                
                if (category && !structuredSafetyData[category]) {
                    const stepNumber = i + 1;
                    const totalSteps = buttons.length;
                    const isFirstStep = i === 0; // First step is always Unsafe Driving
                    
                    // Get current heading before starting
                    const currentHeadings = Array.from(document.querySelectorAll('h4, h3, h2')).filter(heading => {
                        const text = (heading.textContent || '').toLowerCase();
                        const safetyCategories = [
                            'unsafe driving',
                            'hours-of-service',
                            'hos',
                            'hours of service',
                            'vehicle maintenance',
                            'controlled substances',
                            'alcohol',
                            'driver fitness'
                        ];
                        return safetyCategories.some(cat => text.includes(cat));
                    });
                    const currentHeadingText = currentHeadings.length > 0 ? currentHeadings[0].textContent.trim() : null;
                    
                    // Show guided UI
                    const guidedUI = createGuidedUI(stepNumber, totalSteps, buttonText.trim(), button);
                    
                    // For first step (Unsafe Driving), auto-proceed after a short delay
                    if (isFirstStep) {
                        console.log('✅ First step (Unsafe Driving) - auto-proceeding...');
                        guidedUI.updateStatus('Auto-proceeding for first step...');
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } else {
                        // Wait for user to click the button (detect heading change)
                        const waitForUserClick = () => {
                            return new Promise((resolve) => {
                                let checkInterval = null;
                                const startTime = Date.now();
                                
                                // Store resolve function for manual continue button
                                guidedUI.setManualResolve(() => {
                                    if (checkInterval) clearInterval(checkInterval);
                                    guidedUI.updateStatus('⏭️ Manual continue - extracting data...');
                                    resolve(true);
                                });
                                
                                checkInterval = setInterval(() => {
                                    // Check if heading changed (user clicked)
                                    const newHeadings = Array.from(document.querySelectorAll('h4, h3, h2')).filter(heading => {
                                        const text = (heading.textContent || '').toLowerCase();
                                        const safetyCategories = [
                                            'unsafe driving',
                                            'hours-of-service',
                                            'hos',
                                            'hours of service',
                                            'vehicle maintenance',
                                            'controlled substances',
                                            'alcohol',
                                            'driver fitness'
                                        ];
                                        return safetyCategories.some(cat => text.includes(cat));
                                    });
                                    
                                    if (newHeadings.length > 0) {
                                        const newHeadingText = newHeadings[0].textContent.trim();
                                        const headingChanged = newHeadingText !== (previousHeading || currentHeadingText);
                                        
                                        // Check if it matches expected category (more flexible matching)
                                        const buttonTextLower = buttonText.toLowerCase();
                                        const headingLower = newHeadingText.toLowerCase();
                                        const matchesExpected = 
                                            (buttonTextLower.includes('unsafe') && headingLower.includes('unsafe')) ||
                                            (buttonTextLower.includes('hours') && (headingLower.includes('hours') || headingLower.includes('hos'))) ||
                                            (buttonTextLower.includes('hos') && (headingLower.includes('hours') || headingLower.includes('hos'))) ||
                                            (buttonTextLower.includes('vehicle') && headingLower.includes('vehicle')) ||
                                            (buttonTextLower.includes('controlled') && headingLower.includes('controlled')) ||
                                            (buttonTextLower.includes('alcohol') && headingLower.includes('alcohol')) ||
                                            (buttonTextLower.includes('driver') && headingLower.includes('driver'));
                                        
                                        if (headingChanged && matchesExpected) {
                                            clearInterval(checkInterval);
                                            previousHeading = newHeadingText;
                                            guidedUI.updateStatus('✅ Detected! Extracting data...');
                                            setTimeout(() => resolve(true), 500);
                                            return;
                                        }
                                        
                                        // Also check if heading changed at all (even if not exact match)
                                        if (headingChanged && !previousHeading) {
                                            console.log(`🔄 Heading changed to: "${newHeadingText}" (continuing anyway)`);
                                            clearInterval(checkInterval);
                                            previousHeading = newHeadingText;
                                            guidedUI.updateStatus('✅ Detected change! Extracting data...');
                                            setTimeout(() => resolve(true), 500);
                                            return;
                                        }
                                    }
                                    
                                    // Timeout after 2 minutes (user might be slow, but not too long)
                                    if (Date.now() - startTime > 120000) {
                                        clearInterval(checkInterval);
                                        guidedUI.updateStatus('⏱️ Still waiting... Click "Continue (Manual)" if detection failed');
                                    }
                                }, 300); // Check every 300ms
                            });
                        };
                        
                        // Wait for user to click (or manual continue)
                        await waitForUserClick();
                    }
                    
                    // Wait a bit for content to render
                    await new Promise(resolve => setTimeout(resolve, 800));
                    
                    // Extract data automatically
                    const data = await waitForDataToAppear(4000);
                    
                    if (data && (data.percentile || data.score)) {
                        structuredSafetyData[category] = {
                            percentile: data.percentile,
                            score: data.score
                        };
                        console.log(`✅ Extracted ${category}:`, structuredSafetyData[category]);
                        guidedUI.updateStatus(`✅ Extracted! Percentile: ${data.percentile || 'N/A'}%, Score: ${data.score || 'N/A'}`);
                    } else {
                        console.warn(`⚠️ Could not extract data for ${category}`);
                        guidedUI.updateStatus('⚠️ Could not extract data');
                    }
                    
                    // Update previous heading for next iteration
                    if (data && data.categoryName) {
                        previousHeading = data.categoryName;
                    } else if (currentHeadings.length > 0) {
                        previousHeading = currentHeadings[0].textContent.trim();
                    }
                    
                    // Wait a moment to show success, then remove UI and move to next
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    guidedUI.remove();
                    
                    // Small delay before next step
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }

            console.log('📊 Final extracted safety & compliance data:', structuredSafetyData);
            
            // Add structured data to BOTH content (text) and htmlContent (HTML) for the parser
            const structuredDataMarker = '\n\n===STRUCTURED_SAFETY_DATA===\n' + JSON.stringify(structuredSafetyData, null, 2);
            content = content + structuredDataMarker;
            // Also append to HTML content so the API receives it
            htmlContent = htmlContent + structuredDataMarker;
            console.log('✅ Added structured safety data to both text and HTML content');
            console.log('🔍 HTML content length after adding marker:', htmlContent.length);
            console.log('🔍 HTML content ends with:', htmlContent.substring(Math.max(0, htmlContent.length - 300)));
            console.log('🔍 Marker found in HTML?', htmlContent.includes('===STRUCTURED_SAFETY_DATA==='));
        } else {
            console.warn('⚠️ Safety buttons container not found');
        }
        
        return {
            text: content,
            html: htmlContent,
            url: window.location.href
        };
    }

    // Extract Directory tab data
    // COMPREHENSIVE TEXT EXTRACTION - Gets ALL visible text like "select all and copy"
    function getAllVisibleText(element = document.body) {
        // Remove script and style elements
        const clone = element.cloneNode(true);
        clone.querySelectorAll('script, style, noscript, iframe').forEach(el => el.remove());
        
        // Get all text nodes that are visible
        const walker = document.createTreeWalker(
            clone,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    // Check if parent is visible
                    let parent = node.parentElement;
                    while (parent && parent !== clone) {
                        const style = window.getComputedStyle(parent);
                        if (style.display === 'none' || 
                            style.visibility === 'hidden' || 
                            style.opacity === '0' ||
                            parent.offsetParent === null) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        parent = parent.parentElement;
                    }
                    // Only include non-empty text nodes
                    return node.textContent.trim().length > 0 
                        ? NodeFilter.FILTER_ACCEPT 
                        : NodeFilter.FILTER_REJECT;
                }
            }
        );
        
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node.textContent.trim());
        }
        
        return textNodes.join('\n');
    }
    
    // Enhanced comprehensive extraction - extracts structured data from ALL visible text
    function extractComprehensiveData(container) {
        const allText = getAllVisibleText(container);
        const allHtml = container.innerHTML || container.outerHTML || '';
        
        // Extract all emails
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi;
        const allEmails = [...new Set((allText.match(emailRegex) || []).filter(email => 
            !email.includes('example.com') && 
            !email.includes('test.com') &&
            !email.includes('localhost') &&
            !email.includes('highway.com')
        ))];
        
        // Extract all phone numbers
        const phoneRegex = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
        const allPhones = [...new Set(allText.match(phoneRegex) || [])];
        
        // Extract addresses (common patterns)
        const addressRegex = /\d+\s+[A-Za-z0-9\s,.-]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Circle|Cir|Parkway|Pkwy)[\s,]+[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?/gi;
        const addresses = [...new Set(allText.match(addressRegex) || [])];
        
        // Extract names (capitalized words, 2-4 words, common name patterns)
        const nameRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;
        const potentialNames = [...new Set((allText.match(nameRegex) || []).filter(name => 
            name.length > 3 && 
            name.length < 50 &&
            !name.includes('Highway') &&
            !name.includes('Carrier') &&
            !name.includes('Directory') &&
            !name.includes('Overview')
        ))];
        
        // Extract dates
        const dateRegex = /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|[A-Z][a-z]+\s+\d{1,2},?\s+\d{4})\b/g;
        const dates = [...new Set(allText.match(dateRegex) || [])];
        
        // Extract MC/DOT numbers
        const mcRegex = /MC\s*:?\s*(\d{7,8})/gi;
        const mcNumbers = [...new Set((allText.match(mcRegex) || []).map(m => m.replace(/MC\s*:?\s*/i, '')))];
        
        const dotRegex = /DOT\s*:?\s*(\d{6,8})/gi;
        const dotNumbers = [...new Set((allText.match(dotRegex) || []).map(d => d.replace(/DOT\s*:?\s*/i, '')))];
        
        return {
            fullText: allText,
            fullHtml: allHtml,
            emails: allEmails,
            phones: allPhones,
            addresses: addresses,
            names: potentialNames,
            dates: dates,
            mcNumbers: mcNumbers,
            dotNumbers: dotNumbers,
            rawData: {
                text: allText,
                html: allHtml
            }
        };
    }
    
    // Helper function to extract emails using regex
    function extractEmailsFromText(text) {
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const emails = text.match(emailRegex) || [];
        // Remove duplicates and filter out common false positives
        return [...new Set(emails)].filter(email => 
            !email.includes('example.com') && 
            !email.includes('test.com') &&
            !email.includes('localhost') &&
            !email.includes('highway.com')
        );
    }
    
    // Helper function to extract phone numbers using regex
    function extractPhonesFromText(text) {
        const phoneRegex = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
        const phones = text.match(phoneRegex) || [];
        return [...new Set(phones)];
    }
    
    // Wait for element to appear with MutationObserver
    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }
            
            const observer = new MutationObserver((mutations, obs) => {
                const element = document.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    }

    async function extractDirectoryData() {
        // Try to click Directory tab if it exists
        // Try multiple selectors to find the Directory tab
        let directoryTab = document.querySelector('button[data-tab="directory"]') ||
                          document.querySelector('.directory-tab') ||
                          document.querySelector('[aria-label*="Directory" i]');
        
        // If not found, try to find by text content
        if (!directoryTab) {
            const allButtons = document.querySelectorAll('button');
            for (const btn of allButtons) {
                const text = btn.textContent || '';
                if (text.includes('Directory') && !text.includes('Overview') && !text.includes('Classifications')) {
                    directoryTab = btn;
                    break;
                }
            }
        }
        
        if (directoryTab && !directoryTab.classList.contains('active') && !directoryTab.getAttribute('aria-selected')) {
            directoryTab.click();
            // Wait for content to load - give it more time for dynamic content
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Try to wait for the directory container to appear
            try {
                await waitForElement('.carrier-directory', 5000);
            } catch (e) {
                console.log('Directory container not found, continuing anyway...');
            }
        }
        
        // Wait a bit more to ensure all content is loaded
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Find the carrier-directory container - this is the main container for directory data
        const directoryContainer = document.querySelector('.carrier-directory');
        
        let directoryContent = '';
        let directoryHtml = '';
        
        if (directoryContainer) {
            // COMPREHENSIVE EXTRACTION: Get ALL visible text first
            const comprehensiveData = extractComprehensiveData(directoryContainer);
            console.log('📊 Comprehensive extraction results:', {
                emailsFound: comprehensiveData.emails.length,
                phonesFound: comprehensiveData.phones.length,
                addressesFound: comprehensiveData.addresses.length,
                namesFound: comprehensiveData.names.length,
                fullTextLength: comprehensiveData.fullText.length
            });
            
            // Clone the element to avoid including scripts
            const clone = directoryContainer.cloneNode(true);
            // Remove any script tags from the clone
            clone.querySelectorAll('script').forEach(script => script.remove());
            clone.querySelectorAll('style').forEach(style => style.remove());
            
            // Extract structured data from the HTML
            const structuredData = {
                verifiedUsers: [],
                contacts: [],
                rateConfirmationEmails: [],
                addresses: [],
                // Add comprehensive data
                comprehensive: {
                    allEmails: comprehensiveData.emails,
                    allPhones: comprehensiveData.phones,
                    allAddresses: comprehensiveData.addresses,
                    allNames: comprehensiveData.names,
                    allDates: comprehensiveData.dates,
                    fullText: comprehensiveData.fullText.substring(0, 50000) // Limit size
                }
            };
            
            // Extract Verified Users
            const verifiedUsersSection = clone.querySelector('section#verified-users');
            if (verifiedUsersSection) {
                const userRows = verifiedUsersSection.querySelectorAll('[id^="user-row-"]');
                userRows.forEach(row => {
                    const nameEl = row.querySelector('.col-span-5 span.font-normal');
                    const phoneEl = row.querySelector('.col-span-4 span.font-normal');
                    const emailEl = row.querySelector('.col-span-9 span.truncate');
                    const firstSeenEl = row.querySelector('.col-span-4 .flex-col span:first-child');
                    const firstSeenLocationEl = row.querySelector('.col-span-4 .flex-col span:last-child');
                    const lastSeenEl = row.querySelectorAll('.col-span-4 .flex-col')[1]?.querySelector('span:first-child');
                    const lastSeenLocationEl = row.querySelectorAll('.col-span-4 .flex-col')[1]?.querySelector('span:last-child');
                    const countryEl = row.querySelector('.col-span-5 span.font-normal:last-child');
                    
                    if (nameEl || phoneEl || emailEl) {
                        structuredData.verifiedUsers.push({
                            name: nameEl?.textContent?.trim() || '',
                            phone: phoneEl?.textContent?.trim() || '',
                            email: emailEl?.textContent?.trim() || '',
                            firstSeen: firstSeenEl?.textContent?.trim() || '',
                            firstSeenLocation: firstSeenLocationEl?.textContent?.trim() || '',
                            lastSeen: lastSeenEl?.textContent?.trim() || '',
                            lastSeenLocation: lastSeenLocationEl?.textContent?.trim() || '',
                            country: countryEl?.textContent?.trim() || ''
                        });
                    }
                });
            }
            
            // Extract Contacts
            const contactsSection = Array.from(clone.querySelectorAll('section')).find(s => {
                const h2 = s.querySelector('h2');
                const text = s.textContent || '';
                return (h2 && h2.textContent.includes('Contacts')) || 
                       (text.includes('Contacts') && text.includes('Billing') && text.includes('Dispatch'));
            });
            
            console.log('Contacts section found:', !!contactsSection);
            
            if (contactsSection) {
                // Try multiple selectors for contact rows
                let contactRows = contactsSection.querySelectorAll('.my-2.rounded-md.border-2');
                
                // If no rows found, try alternative selectors
                if (contactRows.length === 0) {
                    contactRows = contactsSection.querySelectorAll('[class*="my-2"][class*="rounded-md"][class*="border-2"]');
                }
                if (contactRows.length === 0) {
                    contactRows = contactsSection.querySelectorAll('div[class*="grid"][class*="grid-cols-20"]');
                }
                if (contactRows.length === 0) {
                    // Try to find rows by looking for elements with "Billing", "Dispatch", or "Claims"
                    const allDivs = contactsSection.querySelectorAll('div');
                    contactRows = Array.from(allDivs).filter(div => {
                        const text = div.textContent || '';
                        return (text.includes('Billing') || text.includes('Dispatch') || text.includes('Claims')) &&
                               (text.includes('@') || text.match(/\(?\d{3}\)?\s*\d{3}[\s.-]\d{4}/));
                    });
                }
                
                console.log('Contact rows found:', contactRows.length);
                
                contactRows.forEach((row, idx) => {
                    // Try multiple selectors for each field
                    const roleEl = row.querySelector('.col-span-2 p') || 
                                  row.querySelector('p[class*="rounded-full"]') ||
                                  Array.from(row.querySelectorAll('p')).find(p => {
                                      const text = p.textContent || '';
                                      return text.includes('Billing') || text.includes('Dispatch') || text.includes('Claims');
                                  });
                    
                    // Extract name - look for capitalized words that aren't roles, emails, or phones
                    const nameEl = row.querySelector('.col-span-2 span.font-normal') ||
                                  Array.from(row.querySelectorAll('span')).find(span => {
                                      const text = span.textContent?.trim() || '';
                                      return text && 
                                             text.length > 2 && 
                                             text.length < 50 &&
                                             !text.includes('@') && 
                                             !text.match(/\(?\d{3}\)?\s*\d{3}[\s.-]\d{4}/) &&
                                             !text.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}/) && // Not a date
                                             !text.includes('Billing') && 
                                             !text.includes('Dispatch') && 
                                             !text.includes('Claims') &&
                                             /^[A-Z]/.test(text); // Starts with capital letter
                                  });
                    
                    // Extract phone - look for phone number pattern
                    const phoneEl = row.querySelector('.col-span-4 span.font-normal') ||
                                   Array.from(row.querySelectorAll('span')).find(span => {
                                       const text = span.textContent?.trim() || '';
                                       return text.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
                                   });
                    
                    // Extract email - look for email pattern, make sure it's not the name
                    const emailEl = row.querySelector('.col-span-5 span.font-normal') ||
                                   Array.from(row.querySelectorAll('span')).find(span => {
                                       const text = span.textContent?.trim() || '';
                                       return text.includes('@') && 
                                              text.includes('.') &&
                                              text.match(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/);
                                   });
                    
                    const createdEl = row.querySelector('.col-span-3 span.whitespace-nowrap') ||
                                     Array.from(row.querySelectorAll('span')).find(span => {
                                         const text = span.textContent || '';
                                         return text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}\s+at\s+\d{1,2}:\d{2}(?:am|pm)?/);
                                     });
                    
                    const role = roleEl?.textContent?.trim() || '';
                    const name = nameEl?.textContent?.trim() || '';
                    const phone = phoneEl?.textContent?.trim() || '';
                    const email = emailEl?.textContent?.trim() || '';
                    const created = createdEl?.textContent?.trim() || '';
                    
                    // Only add if we have at least role and name, or name and contact info
                    if ((role && name) || (name && (phone || email))) {
                        structuredData.contacts.push({
                            role: role,
                            name: name,
                            phone: phone,
                            email: email,
                            created: created
                        });
                        console.log(`Contact ${idx + 1} extracted:`, { role, name, phone, email, created });
                    }
                });
                
                console.log('Total contacts extracted:', structuredData.contacts.length);
            } else {
                console.log('Contacts section not found. Available sections:', 
                    Array.from(clone.querySelectorAll('section')).map(s => {
                        const h2 = s.querySelector('h2');
                        return h2 ? h2.textContent : 'No h2';
                    })
                );
            }
            
            // FALLBACK: Extract contacts using regex from entire directory text
            // This catches contacts even if DOM structure is different
            // Use comprehensive data if available, otherwise fall back to clone text
            const directoryText = comprehensiveData?.fullText || structuredData.comprehensive?.fullText || clone.textContent || clone.innerText || '';
            
            // Use comprehensive extraction results if available
            const allEmails = comprehensiveData?.emails || structuredData.comprehensive?.allEmails || extractEmailsFromText(directoryText);
            const allPhones = comprehensiveData?.phones || structuredData.comprehensive?.allPhones || extractPhonesFromText(directoryText);
            
            console.log('📧 Found emails via comprehensive extraction:', allEmails);
            console.log('📞 Found phones via comprehensive extraction:', allPhones);
            
            // Get emails already captured by DOM extraction
            const capturedEmails = new Set(
                structuredData.contacts
                    .map(c => c.email.toLowerCase())
                    .filter(e => e)
            );
            
            // If we have fewer contacts than emails found, try regex extraction
            if (structuredData.contacts.length === 0 || allEmails.length > capturedEmails.size) {
                console.log('Trying regex fallback to find missing contacts...');
                
                // Split directory text into lines for better parsing
                const lines = directoryText.split('\n').map(l => l.trim()).filter(l => l);
                
                // Look for contact patterns: Role, Name, Phone, Email
                // Pattern 1: "Billing/Dispatch/Claims" followed by name, phone, email
                const contactPattern1 = /(Billing|Dispatch|Claims)\s+([A-Z][A-Za-z\s]{2,40}?)(?:\s+(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}))?\s+([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})/gi;
                
                let match;
                while ((match = contactPattern1.exec(directoryText)) !== null) {
                    const role = match[1]?.trim() || '';
                    const name = match[2]?.trim() || '';
                    const phone = match[3]?.trim() || '';
                    const email = match[4]?.trim() || '';
                    
                    if (email && !capturedEmails.has(email.toLowerCase())) {
                        structuredData.contacts.push({
                            role: role,
                            name: name,
                            phone: phone,
                            email: email,
                            created: ''
                        });
                        capturedEmails.add(email.toLowerCase());
                        console.log('Contact extracted via regex pattern 1:', { role, name, phone, email });
                    }
                }
                
                // Pattern 2: Find emails and look backwards/forwards for role and name
                allEmails.forEach(email => {
                    if (capturedEmails.has(email.toLowerCase())) return;
                    
                    const emailIndex = directoryText.indexOf(email);
                    if (emailIndex === -1) return;
                    
                    // Get context around the email (500 chars before and after)
                    const start = Math.max(0, emailIndex - 500);
                    const end = Math.min(directoryText.length, emailIndex + 500);
                    const context = directoryText.substring(start, end);
                    
                    // Look for role keywords
                    const roleMatch = context.match(/\b(Billing|Dispatch|Claims)\b/i);
                    
                    // Look for name (capitalized words, 2-4 words, before the email)
                    const beforeEmail = context.substring(0, context.indexOf(email));
                    const nameMatch = beforeEmail.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s+(?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\s+)?[A-Za-z0-9._%+-]+@/);
                    
                    // Look for phone near the email
                    const phoneMatch = context.match(/(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
                    
                    if (roleMatch || nameMatch) {
                        structuredData.contacts.push({
                            role: roleMatch ? roleMatch[1] : '',
                            name: nameMatch ? nameMatch[1].trim() : '',
                            phone: phoneMatch ? phoneMatch[1] : '',
                            email: email,
                            created: ''
                        });
                        capturedEmails.add(email.toLowerCase());
                        console.log('Contact matched from context:', { 
                            role: roleMatch?.[1] || '', 
                            name: nameMatch?.[1] || '', 
                            phone: phoneMatch?.[1] || '', 
                            email 
                        });
                    }
                });
                
                console.log('Total contacts after regex fallback:', structuredData.contacts.length);
            }
            
            // Extract Rate Confirmation Emails
            const rateEmailSection = Array.from(clone.querySelectorAll('section')).find(s => {
                const h2 = s.querySelector('h2');
                return h2 && h2.textContent.includes('Rate Confirmation');
            });
            if (rateEmailSection) {
                const emailRows = rateEmailSection.querySelectorAll('.my-2.rounded-md.border-2');
                emailRows.forEach(row => {
                    const emailEl = row.querySelector('.col-span-1 span.font-normal');
                    const aliasEl = row.querySelectorAll('.col-span-1 span.font-normal')[1];
                    const descEl = row.querySelector('.col-span-2 span.font-normal');
                    
                    if (emailEl) {
                        structuredData.rateConfirmationEmails.push({
                            email: emailEl?.textContent?.trim() || '',
                            alias: aliasEl?.textContent?.trim() || '',
                            description: descEl?.textContent?.trim() || ''
                        });
                    }
                });
            }
            
            // Extract Addresses
            const addressesSection = Array.from(clone.querySelectorAll('section')).find(s => {
                const span = s.querySelector('span.text-xs');
                return span && span.textContent.includes('Addresses');
            });
            if (addressesSection) {
                const addressCards = addressesSection.querySelectorAll('.mb-2.rounded-lg.border-2');
                addressCards.forEach(card => {
                    const typeEl = card.querySelector('p.text-xs.font-normal');
                    const statusEl = card.querySelector('.rounded-full div');
                    const addressEl = card.querySelector('.mr-4 p');
                    const firstSeenEl = card.querySelector('p.text-xs.font-normal:last-child');
                    
                    if (typeEl || addressEl) {
                        structuredData.addresses.push({
                            type: typeEl?.textContent?.trim() || '',
                            status: statusEl?.parentElement?.textContent?.trim() || '',
                            address: addressEl?.textContent?.trim() || '',
                            firstSeen: firstSeenEl?.textContent?.replace('First Seen:', '').trim() || ''
                        });
                    }
                });
            }
            
            // Convert structured data to JSON format for the parser
            // The parser expects JSON in the directoryHtml field
            directoryContent = JSON.stringify(structuredData, null, 2);
            directoryHtml = JSON.stringify(structuredData, null, 2); // Send JSON, not HTML
            
            console.log('Extracted directory data (structured):', {
                verifiedUsers: structuredData.verifiedUsers.length,
                contacts: structuredData.contacts.length,
                rateConfirmationEmails: structuredData.rateConfirmationEmails.length,
                addresses: structuredData.addresses.length,
                structuredData: structuredData
            });
        } else {
            // Fallback: Get body content but exclude scripts
            const bodyClone = document.body.cloneNode(true);
            bodyClone.querySelectorAll('script').forEach(script => script.remove());
            bodyClone.querySelectorAll('style').forEach(style => style.remove());
            directoryContent = bodyClone.innerText || bodyClone.textContent || '';
            directoryHtml = bodyClone.innerHTML || '';
        }
        
        // Clean up the HTML - remove script tags and other unwanted content
        directoryHtml = directoryHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
        directoryHtml = directoryHtml.replace(/<style[\s\S]*?<\/style>/gi, '');
        directoryHtml = directoryHtml.replace(/window\["__f__[\s\S]*?<\/script>/gi, ''); // Remove Tampermonkey wrapper
        
        return {
            text: directoryContent,
            html: directoryHtml,
            url: window.location.href
        };
    }

    // Send data to API
    async function sendToAPI(mcNumber, carrierName, overviewData, directoryData) {
        return new Promise((resolve, reject) => {
            const payload = {
                mcNumber: mcNumber,
                carrierName: carrierName,
                carrierUrl: window.location.href,
                overviewHtml: overviewData.html,
                directoryHtml: directoryData.html
            };

            const payloadSize = JSON.stringify(payload).length;
            console.log(`Sending combined data: ${(payloadSize / 1024).toFixed(2)} KB`);

            GM_xmlhttpRequest({
                method: 'POST',
                url: `${API_BASE_URL}${API_ENDPOINT}`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: JSON.stringify(payload),
                timeout: 120000, // 120 seconds timeout for large payloads
                onload: function(response) {
                    try {
                        if (response.status === 0 || response.status >= 400) {
                            reject(new Error(`HTTP ${response.status}: ${response.statusText || 'Request failed'}`));
                            return;
                        }
                        
                        const data = JSON.parse(response.responseText);
                        if (data.ok) {
                            resolve(data);
                        } else {
                            reject(new Error(data.error || 'API error'));
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${e.message}`));
                    }
                },
                onerror: function(error) {
                    reject(new Error(`Network error: ${error.message || 'Connection failed'}`));
                },
                ontimeout: function() {
                    reject(new Error('Request timeout: The server took too long to respond. The data may be too large.'));
                }
            });
        });
    }

    // Send Overview data to API
    async function sendOverviewToAPI(mcNumber, carrierName, overviewData) {
        return new Promise((resolve, reject) => {
            // Verify structured data marker is in the HTML before sending
            const hasMarker = overviewData.html && overviewData.html.includes('===STRUCTURED_SAFETY_DATA===');
            console.log('📤 Sending Overview to API - Marker present?', hasMarker);
            if (hasMarker) {
                const markerIndex = overviewData.html.indexOf('===STRUCTURED_SAFETY_DATA===');
                console.log('📤 Marker found at index:', markerIndex);
                console.log('📤 Marker section preview:', overviewData.html.substring(markerIndex, markerIndex + 200));
            } else {
                console.warn('⚠️ WARNING: Structured safety data marker NOT found in HTML before sending!');
            }
            
            const payload = {
                mcNumber: mcNumber,
                carrierName: carrierName,
                carrierUrl: window.location.href,
                overviewHtml: overviewData.html,
                directoryHtml: null // Only overview
            };

            const payloadSize = JSON.stringify(payload).length;
            console.log(`Sending Overview data: ${(payloadSize / 1024).toFixed(2)} KB`);

            GM_xmlhttpRequest({
                method: 'POST',
                url: `${API_BASE_URL}${API_ENDPOINT}`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: JSON.stringify(payload),
                timeout: 120000, // 120 seconds timeout for large payloads
                onload: function(response) {
                    try {
                        if (response.status === 0 || response.status >= 400) {
                            reject(new Error(`HTTP ${response.status}: ${response.statusText || 'Request failed'}`));
                            return;
                        }
                        
                        const data = JSON.parse(response.responseText);
                        if (data.ok) {
                            resolve(data);
                        } else {
                            reject(new Error(data.error || 'API error'));
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${e.message}`));
                    }
                },
                onerror: function(error) {
                    reject(new Error(`Network error: ${error.message || 'Connection failed'}`));
                },
                ontimeout: function() {
                    reject(new Error('Request timeout: The server took too long to respond. The data may be too large.'));
                }
            });
        });
    }

    // Send Directory data to API
    async function sendDirectoryToAPI(mcNumber, carrierName, directoryData) {
        return new Promise((resolve, reject) => {
            const payload = {
                mcNumber: mcNumber,
                carrierName: carrierName,
                carrierUrl: window.location.href,
                overviewHtml: null, // Only directory
                directoryHtml: directoryData.html
            };

            const payloadSize = JSON.stringify(payload).length;
            console.log(`Sending Directory data: ${(payloadSize / 1024).toFixed(2)} KB`);

            GM_xmlhttpRequest({
                method: 'POST',
                url: `${API_BASE_URL}${API_ENDPOINT}`,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: JSON.stringify(payload),
                timeout: 120000, // 120 seconds timeout for large payloads
                onload: function(response) {
                    try {
                        if (response.status === 0 || response.status >= 400) {
                            reject(new Error(`HTTP ${response.status}: ${response.statusText || 'Request failed'}`));
                            return;
                        }
                        
                        const data = JSON.parse(response.responseText);
                        if (data.ok) {
                            resolve(data);
                        } else {
                            reject(new Error(data.error || 'API error'));
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${e.message}`));
                    }
                },
                onerror: function(error) {
                    reject(new Error(`Network error: ${error.message || 'Connection failed'}`));
                },
                ontimeout: function() {
                    reject(new Error('Request timeout: The server took too long to respond. The data may be too large.'));
                }
            });
        });
    }

    // Create UI buttons
    function createScrapeButtons() {
        // Remove existing buttons if present
        const existingContainer = document.getElementById('nova-scrape-buttons');
        if (existingContainer) existingContainer.remove();

        // Create container for buttons
        const container = document.createElement('div');
        container.id = 'nova-scrape-buttons';
        container.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        
        // Add API URL indicator (for debugging)
        const apiIndicator = document.createElement('div');
        apiIndicator.textContent = `API: ${API_BASE_URL}`;
        apiIndicator.style.cssText = `
            padding: 4px 8px;
            background: rgba(0, 0, 0, 0.7);
            color: #fff;
            border-radius: 4px;
            font-size: 10px;
            font-family: monospace;
            text-align: center;
            margin-bottom: 5px;
        `;
        container.appendChild(apiIndicator);

        // Create Overview button
        const overviewBtn = document.createElement('button');
        overviewBtn.id = 'nova-scrape-overview-btn';
        overviewBtn.innerHTML = '🚀 Scrape to Nova - Overview';
        overviewBtn.style.cssText = `
            padding: 12px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: bold;
            font-size: 14px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            transition: all 0.3s ease;
            white-space: nowrap;
        `;

        overviewBtn.addEventListener('mouseenter', () => {
            overviewBtn.style.transform = 'translateY(-2px)';
            overviewBtn.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
        });

        overviewBtn.addEventListener('mouseleave', () => {
            overviewBtn.style.transform = 'translateY(0)';
            overviewBtn.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
        });

        overviewBtn.addEventListener('click', async () => {
            overviewBtn.disabled = true;
            overviewBtn.innerHTML = '⏳ Scraping Overview...';
            overviewBtn.style.opacity = '0.7';

            try {
                const mcNumber = extractMCNumber();
                const carrierName = extractCarrierName();
                
                if (!mcNumber) {
                    alert('❌ Could not find MC number on this page. Please navigate to a carrier detail page.');
                    overviewBtn.disabled = false;
                    overviewBtn.innerHTML = '🚀 Scrape to Nova - Overview';
                    overviewBtn.style.opacity = '1';
                    return;
                }

                // Make sure we're on Overview tab
                const overviewTab = document.querySelector('button[data-tab="overview"], .overview-tab, [aria-label*="Overview" i]');
                if (overviewTab && !overviewTab.classList.contains('active')) {
                    overviewTab.click();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                const overviewData = await extractOverviewData();
                const result = await sendOverviewToAPI(mcNumber, carrierName, overviewData);

                overviewBtn.innerHTML = '✅ Overview Scraped!';
                overviewBtn.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
                
                setTimeout(() => {
                    overviewBtn.innerHTML = '🚀 Scrape to Nova - Overview';
                    overviewBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                    overviewBtn.disabled = false;
                    overviewBtn.style.opacity = '1';
                }, 2000);

                showNotification(`✅ Successfully scraped Overview for ${carrierName || `MC ${mcNumber}`}!`);

            } catch (error) {
                console.error('Overview scraping error:', error);
                const errorMsg = error.message || 'Unknown error';
                
                // Check if it's a timeout error
                if (errorMsg.includes('timeout') || errorMsg.includes('408')) {
                    alert(`⏱️ Request Timeout\n\nThe Overview data is very large and the server took too long to respond.\n\nTry:\n1. Refresh the page and try again\n2. Check your internet connection\n3. Contact support if the issue persists\n\nError: ${errorMsg}`);
                } else if (errorMsg.includes('Network error') || errorMsg.includes('Failed to fetch')) {
                    alert(`🌐 Network Error\n\nCould not connect to the server.\n\nCheck:\n1. Your internet connection\n2. The API URL is correct (${API_BASE_URL})\n3. The server is running\n\nError: ${errorMsg}`);
                } else {
                    alert(`❌ Error scraping Overview\n\n${errorMsg}\n\nPlease try again or contact support.`);
                }
                
                overviewBtn.innerHTML = '❌ Error';
                overviewBtn.style.background = 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)';
                
                setTimeout(() => {
                    overviewBtn.innerHTML = '🚀 Scrape to Nova - Overview';
                    overviewBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                    overviewBtn.disabled = false;
                    overviewBtn.style.opacity = '1';
                }, 3000);
            }
        });

        // Create Directory button
        const directoryBtn = document.createElement('button');
        directoryBtn.id = 'nova-scrape-directory-btn';
        directoryBtn.innerHTML = '🚀 Scrape to Nova - Directory';
        directoryBtn.style.cssText = `
            padding: 12px 20px;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: bold;
            font-size: 14px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(245, 87, 108, 0.4);
            transition: all 0.3s ease;
            white-space: nowrap;
        `;

        directoryBtn.addEventListener('mouseenter', () => {
            directoryBtn.style.transform = 'translateY(-2px)';
            directoryBtn.style.boxShadow = '0 6px 20px rgba(245, 87, 108, 0.6)';
        });

        directoryBtn.addEventListener('mouseleave', () => {
            directoryBtn.style.transform = 'translateY(0)';
            directoryBtn.style.boxShadow = '0 4px 15px rgba(245, 87, 108, 0.4)';
        });

        directoryBtn.addEventListener('click', async () => {
            directoryBtn.disabled = true;
            directoryBtn.innerHTML = '⏳ Scraping Directory...';
            directoryBtn.style.opacity = '0.7';

            try {
                const mcNumber = extractMCNumber();
                const carrierName = extractCarrierName();
                
                if (!mcNumber) {
                    alert('❌ Could not find MC number on this page. Please navigate to a carrier detail page.');
                    directoryBtn.disabled = false;
                    directoryBtn.innerHTML = '🚀 Scrape to Nova - Directory';
                    directoryBtn.style.opacity = '1';
                    return;
                }

                // Switch to Directory tab
                const directoryTab = document.querySelector('button[data-tab="directory"], .directory-tab, [aria-label*="Directory" i]');
                if (directoryTab && !directoryTab.classList.contains('active')) {
                    directoryTab.click();
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

                const directoryData = await extractDirectoryData();
                const result = await sendDirectoryToAPI(mcNumber, carrierName, directoryData);

                directoryBtn.innerHTML = '✅ Directory Scraped!';
                directoryBtn.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
                
                setTimeout(() => {
                    directoryBtn.innerHTML = '🚀 Scrape to Nova - Directory';
                    directoryBtn.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
                    directoryBtn.disabled = false;
                    directoryBtn.style.opacity = '1';
                }, 2000);

                showNotification(`✅ Successfully scraped Directory for ${carrierName || `MC ${mcNumber}`}!`);

            } catch (error) {
                console.error('Directory scraping error:', error);
                const errorMsg = error.message || 'Unknown error';
                
                // Check if it's a timeout error
                if (errorMsg.includes('timeout') || errorMsg.includes('408')) {
                    alert(`⏱️ Request Timeout\n\nThe Directory data is very large and the server took too long to respond.\n\nTry:\n1. Refresh the page and try again\n2. Check your internet connection\n3. Contact support if the issue persists\n\nError: ${errorMsg}`);
                } else if (errorMsg.includes('Network error') || errorMsg.includes('Failed to fetch')) {
                    alert(`🌐 Network Error\n\nCould not connect to the server.\n\nCheck:\n1. Your internet connection\n2. The API URL is correct (${API_BASE_URL})\n3. The server is running\n\nError: ${errorMsg}`);
                } else {
                    alert(`❌ Error scraping Directory\n\n${errorMsg}\n\nPlease try again or contact support.`);
                }
                
                directoryBtn.innerHTML = '❌ Error';
                directoryBtn.style.background = 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)';
                
                setTimeout(() => {
                    directoryBtn.innerHTML = '🚀 Scrape to Nova - Directory';
                    directoryBtn.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
                    directoryBtn.disabled = false;
                    directoryBtn.style.opacity = '1';
                }, 3000);
            }
        });

        container.appendChild(overviewBtn);
        container.appendChild(directoryBtn);
        document.body.appendChild(container);
    }

    // Show notification
    function showNotification(message) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 140px;
            right: 20px;
            z-index: 10001;
            padding: 15px 20px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            border-radius: 8px;
            font-size: 14px;
            max-width: 300px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // Initialize when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createScrapeButtons);
    } else {
        createScrapeButtons();
    }

    // Re-create buttons if page content changes (SPA navigation)
    const observer = new MutationObserver(() => {
        if (!document.getElementById('nova-scrape-buttons')) {
            createScrapeButtons();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();

