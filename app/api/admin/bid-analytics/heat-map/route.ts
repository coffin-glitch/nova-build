import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { parseAddress, extractCityStateForMatching } from "@/lib/format";

/**
 * API endpoint for heat map analytics
 * Aggregates bid data by state and city from stops information
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;
    
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get("timeframe") || "all"; // Default to "all" to show all bids
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Input validation
    const validation = validateInput(
      { timeframe, startDate, endDate },
      {
        timeframe: { type: 'string', enum: ['all', '7', '30', '90', '365'], required: false },
        startDate: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/, maxLength: 10, required: false },
        endDate: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/, maxLength: 10, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_heat_map_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }
    
    // Calculate date threshold - support both timeframe and custom date range
    let dateThreshold: string | null = null;
    let dateEnd: string | null = null;
    const days = timeframe === "all" ? 0 : parseInt(timeframe);
    
    if (startDate && endDate) {
      // Custom date range provided
      dateThreshold = new Date(startDate).toISOString();
      // Set end date to end of day
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);
      dateEnd = endDateObj.toISOString();
    } else {
      // Use timeframe
      dateThreshold = days > 0 
        ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
        : null;
    }

    // Fetch all bids with stops data
    let bidsQuery;
    if (dateThreshold && dateEnd) {
      // Custom date range
      bidsQuery = sql`
        SELECT 
          bid_number,
          stops,
          distance_miles,
          received_at,
          tag
        FROM telegram_bids
        WHERE received_at >= ${dateThreshold}
          AND received_at <= ${dateEnd}
          AND stops IS NOT NULL
        ORDER BY received_at DESC
      `;
    } else if (dateThreshold) {
      // Timeframe-based
      bidsQuery = sql`
        SELECT 
          bid_number,
          stops,
          distance_miles,
          received_at,
          tag
        FROM telegram_bids
        WHERE received_at >= ${dateThreshold}
          AND stops IS NOT NULL
        ORDER BY received_at DESC
      `;
    } else {
      // All time
      bidsQuery = sql`
        SELECT 
          bid_number,
          stops,
          distance_miles,
          received_at,
          tag
        FROM telegram_bids
        WHERE stops IS NOT NULL
        ORDER BY received_at DESC
      `;
    }

    const bids = await bidsQuery;
    
    // Get actual total bid count (all bids, not just those with valid state extraction)
    let totalBidsCountQuery;
    if (dateThreshold && dateEnd) {
      totalBidsCountQuery = sql`
        SELECT COUNT(*) as count
        FROM telegram_bids
        WHERE received_at >= ${dateThreshold}
          AND received_at <= ${dateEnd}
      `;
    } else if (dateThreshold) {
      totalBidsCountQuery = sql`
        SELECT COUNT(*) as count
        FROM telegram_bids
        WHERE received_at >= ${dateThreshold}
      `;
    } else {
      totalBidsCountQuery = sql`
        SELECT COUNT(*) as count
        FROM telegram_bids
      `;
    }
    const totalBidsResult = await totalBidsCountQuery;
    const actualTotalBids = totalBidsResult[0]?.count || 0;

    // Get all awarded bids with route information for lowest bid calculation
    const awardedBidsWithRoutes = await sql`
      SELECT 
        aa.bid_number,
        aa.winner_amount_cents,
        aa.supabase_winner_user_id,
        tb.stops
      FROM auction_awards aa
      INNER JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
      WHERE aa.supabase_winner_user_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM carrier_bids cb 
          WHERE cb.bid_number = aa.bid_number
        )
    `;

    // Helper function to extract state from stop string using improved address parsing
    const extractState = (stop: string): string | null => {
      if (!stop) return null;
      try {
        // Use the improved parseAddress function which handles full addresses
        const parsed = parseAddress(stop);
        return parsed.state || null;
      } catch (error) {
        console.warn('[HeatMap] Error parsing address:', stop, error);
        return null;
      }
    };

    // Helper function to extract city from stop string using improved address parsing
    const extractCity = (stop: string): string | null => {
      if (!stop) return null;
      try {
        // Use extractCityStateForMatching which includes city name cleaning
        const cityState = extractCityStateForMatching(stop);
        return cityState?.city || null;
      } catch (error) {
        console.warn('[HeatMap] Error extracting city:', stop, error);
        // Fallback to parseAddress
        try {
          const parsed = parseAddress(stop);
          return parsed.city || null;
        } catch {
          return null;
        }
      }
    };

    // Track all state pairs for backhaul matching (origin -> destination)
    const statePairs: Array<{
      originState: string;
      destinationState: string | null;
      bidNumber: string;
      distanceMiles: number | null;
      receivedAt: string;
      tag: string | null;
      originCity: string | null;
      destinationCity: string | null;
    }> = [];

    // Parse stops and aggregate by state
    const stateData: Record<string, {
      bidCount: number;
      totalRevenue: number;
      cities: Record<string, {
        bidCount: number;
        totalRevenue: number;
        bids: Array<{
          bidNumber: string;
          distanceMiles: number | null;
          receivedAt: string;
          tag: string | null;
        }>;
      }>;
      originStates: Set<string>;
      destinationStates: Set<string>;
    }> = {};

    // Track processing statistics
    let bidsProcessed = 0;
    let bidsSkippedNoStops = 0;
    let bidsSkippedNoState = 0;
    let bidsWithValidState = 0;

    // Process each bid
    for (const bid of bids) {
      bidsProcessed++;
      let stops: string[] = [];
      
      // Parse stops field
      if (bid.stops) {
        if (Array.isArray(bid.stops)) {
          stops = bid.stops;
        } else if (typeof bid.stops === 'string') {
          try {
            const parsed = JSON.parse(bid.stops);
            stops = Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            stops = [bid.stops];
          }
        }
      }

      if (stops.length === 0) {
        bidsSkippedNoStops++;
        continue;
      }

      // Extract origin and destination states
      const originStop = stops[0];
      const destinationStop = stops[stops.length - 1];
      const originState = extractState(originStop);
      const destinationState = extractState(destinationStop);

      if (!originState) {
        bidsSkippedNoState++;
        continue;
      }

      bidsWithValidState++;

      // Track state pairs for backhaul matching (store all pairs regardless of stateData initialization)
      // IMPORTANT: We need to track pairs even if destination state extraction fails,
      // but we still need a valid origin state to know where the bid is coming from
      const originCity = extractCity(originStop);
      const destinationCity = destinationState ? extractCity(destinationStop) : null;
      
      // Also try to extract destination state from the last stop if it wasn't extracted yet
      let finalDestinationState = destinationState;
      if (!finalDestinationState && stops.length > 1) {
        finalDestinationState = extractState(stops[stops.length - 1]);
      }
      
      statePairs.push({
        originState,
        destinationState: finalDestinationState,
        bidNumber: bid.bid_number,
        distanceMiles: bid.distance_miles,
        receivedAt: bid.received_at,
        tag: bid.tag,
        originCity,
        destinationCity,
      });

      // Initialize state if not exists
      if (!stateData[originState]) {
        stateData[originState] = {
          bidCount: 0,
          totalRevenue: 0,
          cities: {},
          originStates: new Set(),
          destinationStates: new Set(),
        };
      }

      // Count bid for origin state
      stateData[originState].bidCount++;
      
      // Extract origin city
      if (originCity) {
        if (!stateData[originState].cities[originCity]) {
          stateData[originState].cities[originCity] = {
            bidCount: 0,
            totalRevenue: 0,
            bids: [],
          };
        }
        stateData[originState].cities[originCity].bidCount++;
        stateData[originState].cities[originCity].bids.push({
          bidNumber: bid.bid_number,
          distanceMiles: bid.distance_miles,
          receivedAt: bid.received_at,
          tag: bid.tag,
        });
      }

      // Track state pairs for backhaul matching
      if (destinationState) {
        stateData[originState].destinationStates.add(destinationState);
        // Initialize destination state if it doesn't exist yet (for backhaul tracking)
        if (!stateData[destinationState]) {
          stateData[destinationState] = {
            bidCount: 0,
            totalRevenue: 0,
            cities: {},
            originStates: new Set(),
            destinationStates: new Set(),
          };
        }
        stateData[destinationState].originStates.add(originState);
      }
    }

    // Get revenue data from auction_awards (matching offers-bids page calculation)
    // This ensures consistency with the Total Revenue shown on /admin/offers-bids
    let revenueQuery;
    if (dateThreshold && dateEnd) {
      revenueQuery = sql`
        SELECT 
          aa.bid_number,
          aa.winner_amount_cents,
          tb.stops
        FROM auction_awards aa
        INNER JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
        WHERE tb.received_at >= ${dateThreshold}
          AND tb.received_at <= ${dateEnd}
          AND tb.stops IS NOT NULL
      `;
    } else if (dateThreshold) {
      revenueQuery = sql`
        SELECT 
          aa.bid_number,
          aa.winner_amount_cents,
          tb.stops
        FROM auction_awards aa
        INNER JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
        WHERE tb.received_at >= ${dateThreshold}
          AND tb.stops IS NOT NULL
      `;
    } else {
      revenueQuery = sql`
        SELECT 
          aa.bid_number,
          aa.winner_amount_cents,
          tb.stops
        FROM auction_awards aa
        INNER JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
        WHERE tb.stops IS NOT NULL
      `;
    }
    const revenueData = await revenueQuery;

    // Calculate revenue per bid from auction_awards (matches offers-bids page)
    const bidRevenue: Record<string, number> = {};
    for (const award of revenueData) {
      const bidNumber = award.bid_number;
      // Sum all awards for the same bid (in case of re-awards)
      bidRevenue[bidNumber] = (bidRevenue[bidNumber] || 0) + (award.winner_amount_cents || 0);
    }

    // Add revenue to state and city data
    for (const bid of bids) {
      let stops: string[] = [];
      if (bid.stops) {
        if (Array.isArray(bid.stops)) {
          stops = bid.stops;
        } else if (typeof bid.stops === 'string') {
          try {
            const parsed = JSON.parse(bid.stops);
            stops = Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            stops = [bid.stops];
          }
        }
      }

      if (stops.length === 0) continue;

      const originStop = stops[0];
      const originState = extractState(originStop);
      const originCity = extractCity(originStop);
      const revenue = bidRevenue[bid.bid_number] || 0;

      if (originState && stateData[originState]) {
        stateData[originState].totalRevenue += revenue;
        if (originCity && stateData[originState].cities[originCity]) {
          stateData[originState].cities[originCity].totalRevenue += revenue;
        }
      }
    }

    // Debug: Log state pairs summary
    if (process.env.NODE_ENV === 'development') {
      const statePairSummary = new Map<string, number>();
      for (const pair of statePairs) {
        if (pair.originState && pair.destinationState) {
          const key = `${pair.originState} -> ${pair.destinationState}`;
          statePairSummary.set(key, (statePairSummary.get(key) || 0) + 1);
        }
      }
      const tnToNcCount = statePairs.filter(p => p.originState === 'TN' && p.destinationState === 'NC').length;
      const ncToTnCount = statePairs.filter(p => p.originState === 'NC' && p.destinationState === 'TN').length;
      console.log(`[HeatMap Debug] ========== STATE PAIRS SUMMARY ==========`);
      console.log(`[HeatMap Debug] Total statePairs: ${statePairs.length}`);
      console.log(`[HeatMap Debug] TN -> NC pairs: ${tnToNcCount}`);
      console.log(`[HeatMap Debug] NC -> TN pairs: ${ncToTnCount}`);
      
      // Find bids with TN origin or NC destination to debug extraction
      const bidsWithTn = bids.filter((bid: any) => {
        let stops: string[] = [];
        if (bid.stops) {
          if (Array.isArray(bid.stops)) {
            stops = bid.stops;
          } else if (typeof bid.stops === 'string') {
            try {
              const parsed = JSON.parse(bid.stops);
              stops = Array.isArray(parsed) ? parsed : [parsed];
            } catch {
              stops = [bid.stops];
            }
          }
        }
        return stops.some((stop: string) => stop && stop.toUpperCase().includes('TN'));
      });
      
      const bidsWithNc = bids.filter((bid: any) => {
        let stops: string[] = [];
        if (bid.stops) {
          if (Array.isArray(bid.stops)) {
            stops = bid.stops;
          } else if (typeof bid.stops === 'string') {
            try {
              const parsed = JSON.parse(bid.stops);
              stops = Array.isArray(parsed) ? parsed : [parsed];
            } catch {
              stops = [bid.stops];
            }
          }
        }
        return stops.some((stop: string) => stop && stop.toUpperCase().includes('NC'));
      });
      
      console.log(`[HeatMap Debug] Bids containing 'TN': ${bidsWithTn.length}`);
      console.log(`[HeatMap Debug] Bids containing 'NC': ${bidsWithNc.length}`);
      
      // Sample some bids with TN or NC to see their format
      if (bidsWithTn.length > 0) {
        const sampleBid = bidsWithTn[0];
        let stops: string[] = [];
        if (sampleBid.stops) {
          if (Array.isArray(sampleBid.stops)) {
            stops = sampleBid.stops;
          } else if (typeof sampleBid.stops === 'string') {
            try {
              const parsed = JSON.parse(sampleBid.stops);
              stops = Array.isArray(parsed) ? parsed : [parsed];
            } catch {
              stops = [sampleBid.stops];
            }
          }
        }
        console.log(`[HeatMap Debug] Sample bid with TN - bid_number: ${sampleBid.bid_number}, stops:`, stops);
        if (stops.length > 0) {
          const originState = extractState(stops[0]);
          const destState = stops.length > 1 ? extractState(stops[stops.length - 1]) : null;
          console.log(`[HeatMap Debug] Extracted states - origin: ${originState}, destination: ${destState}`);
        }
      }
      
      if (tnToNcCount > 0) {
        const sample = statePairs.find(p => p.originState === 'TN' && p.destinationState === 'NC');
        console.log(`[HeatMap Debug] Sample TN -> NC pair:`, sample);
      } else {
        console.log(`[HeatMap Debug] ⚠️  NO TN -> NC pairs found! This is the issue.`);
      }
      console.log(`[HeatMap Debug] =========================================`);
    }

    // Convert to response format
    const stateStats = Object.entries(stateData).map(([state, data]) => {
      // Sort cities by bid count
      const topCities = Object.entries(data.cities)
        .map(([city, cityData]) => ({
          city,
          bidCount: cityData.bidCount,
          totalRevenue: cityData.totalRevenue,
          averageRevenue: cityData.bidCount > 0 ? cityData.totalRevenue / cityData.bidCount : 0,
          bids: cityData.bids.slice(0, 10), // Limit to top 10 for performance
        }))
        .sort((a, b) => b.bidCount - a.bidCount)
        .slice(0, 20); // Top 20 cities

      // Calculate backhaul opportunities with detailed bid information
      // Find all states that have bids going TO this state (potential backhauls)
      // Use statePairs to find all matching routes, not just those in stateData
      const backhaulMap = new Map<string, Array<{
        bidNumber: string;
        distanceMiles: number | null;
        receivedAt: string;
        tag: string | null;
        originCity: string | null;
        destinationCity: string | null;
        originState: string;
        destinationState: string;
        lowestAwardedBidForRoute: number | null;
      }>>();

      // Find all bids going TO this state
      // Debug: Log state pairs for troubleshooting (for any state, not just NC)
      if (process.env.NODE_ENV === 'development') {
        const allPairsToState = statePairs.filter(p => p.destinationState === state);
        const uniqueOriginStates = [...new Set(allPairsToState.map(p => p.originState))];
        console.log(`[HeatMap Debug] Processing state: ${state}`);
        console.log(`[HeatMap Debug] Total pairs going TO ${state}: ${allPairsToState.length}`);
        console.log(`[HeatMap Debug] Unique origin states going TO ${state}: ${uniqueOriginStates.length}`);
        if (uniqueOriginStates.length > 0 && uniqueOriginStates.length <= 30) {
          console.log(`[HeatMap Debug] Origin states:`, uniqueOriginStates.sort());
        }
      }
      
      // Process ALL state pairs to find backhaul opportunities
      // This includes pairs where destination state might be null (we'll handle those separately)
      for (const pair of statePairs) {
        // Only process pairs where:
        // 1. Destination state matches the current state we're processing
        // 2. Origin state is different (not same-state routes)
        // 3. Both states are valid (not null)
        if (pair.destinationState === state && pair.originState !== state && pair.originState && pair.destinationState) {
          if (!backhaulMap.has(pair.originState)) {
            backhaulMap.set(pair.originState, []);
          }
          
          // Calculate lowest awarded bid for this specific route
          let lowestAwardedBidForRoute: number | null = null;
          
          for (const awardedBid of awardedBidsWithRoutes) {
            let awardedStops: string[] = [];
            if (awardedBid.stops) {
              if (Array.isArray(awardedBid.stops)) {
                awardedStops = awardedBid.stops;
              } else if (typeof awardedBid.stops === 'string') {
                try {
                  const parsed = JSON.parse(awardedBid.stops);
                  awardedStops = Array.isArray(parsed) ? parsed : [parsed];
                } catch {
                  awardedStops = [awardedBid.stops];
                }
              }
            }
            
            if (awardedStops.length > 0) {
              const awardedOriginState = extractState(awardedStops[0]);
              const awardedDestinationState = extractState(awardedStops[awardedStops.length - 1]);
              
              // Check if this awarded bid matches the exact route
              if (awardedOriginState === pair.originState && awardedDestinationState === pair.destinationState) {
                // Update lowest if this is lower or if we haven't found one yet
                if (lowestAwardedBidForRoute === null || awardedBid.winner_amount_cents < lowestAwardedBidForRoute) {
                  lowestAwardedBidForRoute = awardedBid.winner_amount_cents;
                }
              }
            }
          }

          backhaulMap.get(pair.originState)!.push({
            bidNumber: pair.bidNumber,
            distanceMiles: pair.distanceMiles,
            receivedAt: pair.receivedAt,
            tag: pair.tag,
            originCity: pair.originCity,
            destinationCity: pair.destinationCity,
            originState: pair.originState,
            destinationState: pair.destinationState || '',
            lowestAwardedBidForRoute: lowestAwardedBidForRoute,
          });
        }
      }

      // Convert to backhaul opportunities array
      const backhaulOpportunities: Array<{
        state: string;
        bidCount: number;
        matchScore: number;
        lowestAwardedBid: number | null;
        bids: Array<{
          bidNumber: string;
          distanceMiles: number | null;
          receivedAt: string;
          tag: string | null;
          originCity: string | null;
          destinationCity: string | null;
          originState: string;
          destinationState: string;
          lowestAwardedBidForRoute: number | null;
        }>;
        laneFrequencies?: Array<{
          lane: string;
          count: number;
          firstSeen: string;
          lastSeen: string;
          timeSpanDays: number;
          expectedFrequencyPerDay: number;
          expectedFrequencyPerWeek: number;
          expectedFrequencyPerMonth: number;
        }>;
      }> = [];

      for (const [otherState, matchingBidsList] of backhaulMap.entries()) {
        // Include ALL backhaul opportunities, even if they have just 1 bid
        // This ensures no potential routes are missed
        if (matchingBidsList.length > 0) {
          // Calculate lowest awarded bid for this route (otherState → state)
          let lowestAwardedBid: number | null = null;
          
          for (const awardedBid of awardedBidsWithRoutes) {
            let stops: string[] = [];
            if (awardedBid.stops) {
              if (Array.isArray(awardedBid.stops)) {
                stops = awardedBid.stops;
              } else if (typeof awardedBid.stops === 'string') {
                try {
                  const parsed = JSON.parse(awardedBid.stops);
                  stops = Array.isArray(parsed) ? parsed : [parsed];
                } catch {
                  stops = [awardedBid.stops];
                }
              }
            }
            
            if (stops.length > 0) {
              const originState = extractState(stops[0]);
              const destinationState = extractState(stops[stops.length - 1]);
              
              // Check if this awarded bid matches the route (otherState → state)
              if (originState === otherState && destinationState === state) {
                // Update lowest if this is lower or if we haven't found one yet
                if (lowestAwardedBid === null || awardedBid.winner_amount_cents < lowestAwardedBid) {
                  lowestAwardedBid = awardedBid.winner_amount_cents;
                }
              }
            }
          }

          // Calculate lane frequencies for each unique city-to-city route
          const laneFrequencyMap = new Map<string, {
            count: number;
            firstSeen: Date;
            lastSeen: Date;
            dates: Date[];
          }>();

          for (const bid of matchingBidsList) {
            if (bid.originCity && bid.destinationCity) {
              const laneKey = `${bid.originCity}, ${bid.originState} → ${bid.destinationCity}, ${bid.destinationState}`;
              const receivedDate = new Date(bid.receivedAt);
              
              if (!laneFrequencyMap.has(laneKey)) {
                laneFrequencyMap.set(laneKey, {
                  count: 0,
                  firstSeen: receivedDate,
                  lastSeen: receivedDate,
                  dates: [],
                });
              }
              
              const laneData = laneFrequencyMap.get(laneKey)!;
              laneData.count++;
              laneData.dates.push(receivedDate);
              if (receivedDate < laneData.firstSeen) {
                laneData.firstSeen = receivedDate;
              }
              if (receivedDate > laneData.lastSeen) {
                laneData.lastSeen = receivedDate;
              }
            }
          }

          // Calculate expected frequency for each lane
          const laneFrequencies = Array.from(laneFrequencyMap.entries()).map(([lane, data]) => {
            const timeSpanDays = Math.max(1, Math.ceil((data.lastSeen.getTime() - data.firstSeen.getTime()) / (1000 * 60 * 60 * 24)));
            const expectedFrequencyPerDay = data.count / timeSpanDays;
            const expectedFrequencyPerWeek = expectedFrequencyPerDay * 7;
            const expectedFrequencyPerMonth = expectedFrequencyPerDay * 30;
            
            return {
              lane,
              count: data.count,
              firstSeen: data.firstSeen.toISOString(),
              lastSeen: data.lastSeen.toISOString(),
              timeSpanDays,
              expectedFrequencyPerDay: Number(expectedFrequencyPerDay.toFixed(2)),
              expectedFrequencyPerWeek: Number(expectedFrequencyPerWeek.toFixed(2)),
              expectedFrequencyPerMonth: Number(expectedFrequencyPerMonth.toFixed(2)),
            };
          }).sort((a, b) => b.count - a.count); // Sort by count, highest first

          backhaulOpportunities.push({
            state: otherState,
            bidCount: matchingBidsList.length,
            matchScore: Math.min(100, (matchingBidsList.length / data.bidCount) * 100),
            lowestAwardedBid: lowestAwardedBid,
            bids: matchingBidsList.slice(0, 20), // Limit to top 20 for performance
            laneFrequencies: laneFrequencies, // Add lane frequency data
          });
        }
      }
      
      // Debug: Log backhaul opportunities count for this state
      if (process.env.NODE_ENV === 'development') {
        console.log(`[HeatMap Debug] ${state} - Backhaul opportunities found: ${backhaulOpportunities.length}`);
        if (backhaulOpportunities.length > 0) {
          console.log(`[HeatMap Debug] ${state} - Top 5 backhaul states:`, 
            backhaulOpportunities.slice(0, 5).map(b => `${b.state} (${b.bidCount} bids, ${b.matchScore.toFixed(1)}%)`));
        }
      }

      // Sort by match score (highest first), then by bid count (highest first) as tiebreaker
      backhaulOpportunities.sort((a, b) => {
        if (Math.abs(b.matchScore - a.matchScore) > 0.1) {
          return b.matchScore - a.matchScore;
        }
        return b.bidCount - a.bidCount;
      });

      return {
        state,
        bidCount: data.bidCount,
        totalRevenue: data.totalRevenue,
        averageRevenue: data.bidCount > 0 ? data.totalRevenue / data.bidCount : 0,
        topCities,
        // Show all backhaul opportunities (no limit) so users can see all potential routes
        backhaulOpportunities: backhaulOpportunities,
        totalCities: Object.keys(data.cities).length,
        originStates: Array.from(data.originStates),
        destinationStates: Array.from(data.destinationStates),
      };
    }).sort((a, b) => b.bidCount - a.bidCount);

    // Calculate overall statistics
    // Count bids that were actually processed and had valid state extraction
    const totalBidsWithValidState = stateStats.reduce((sum, s) => sum + s.bidCount, 0);
    const totalRevenue = stateStats.reduce((sum, s) => sum + s.totalRevenue, 0);
    const statesWithBids = stateStats.length;

    // Verification: Ensure bidsWithValidState matches the sum of state bidCounts
    if (bidsWithValidState !== totalBidsWithValidState) {
      console.error('[HeatMap] MISMATCH DETECTED!');
      console.error(`  bidsWithValidState (from loop): ${bidsWithValidState}`);
      console.error(`  totalBidsWithValidState (sum of states): ${totalBidsWithValidState}`);
      console.error(`  Difference: ${Math.abs(bidsWithValidState - totalBidsWithValidState)}`);
    }

    // Log processing statistics for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('[HeatMap] Processing Statistics:');
      console.log(`  Total bids in timeframe: ${actualTotalBids}`);
      console.log(`  Bids processed: ${bidsProcessed}`);
      console.log(`  Bids skipped (no stops): ${bidsSkippedNoStops}`);
      console.log(`  Bids skipped (no state): ${bidsSkippedNoState}`);
      console.log(`  Bids with valid state (from loop): ${bidsWithValidState}`);
      console.log(`  Sum of state bidCounts: ${totalBidsWithValidState}`);
      console.log(`  Verification: ${bidsWithValidState === totalBidsWithValidState ? '✓ MATCH' : '✗ MISMATCH'}`);
      console.log(`  Unmapped bids: ${actualTotalBids - totalBidsWithValidState}`);
      
      // Log state breakdown for verification
      if (stateStats.length > 0) {
        const topStates = stateStats.slice(0, 10).map(s => `${s.state}: ${s.bidCount}`).join(', ');
        console.log(`  Top 10 states: ${topStates}`);
      }
    }

    logSecurityEvent('heat_map_analytics_accessed', userId, { 
      timeframe,
      startDate: startDate || null,
      endDate: endDate || null
    });
    
    const response = NextResponse.json({
      success: true,
      data: {
        stateStats,
        summary: {
          totalBids: totalBidsWithValidState, // Use count of bids with valid state extraction
          totalBidsInTimeframe: Number(actualTotalBids), // Total bids in timeframe (including those without valid state)
          bidsWithoutValidState: Number(actualTotalBids) - totalBidsWithValidState, // Bids that couldn't be mapped
          totalRevenue,
          statesWithBids,
          averageBidsPerState: statesWithBids > 0 ? totalBidsWithValidState / statesWithBids : 0,
          timeframe: startDate && endDate 
            ? `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`
            : days > 0 ? `${days} days` : 'all time',
          startDate: startDate || null,
          endDate: endDate || null,
        },
      },
    });
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Error fetching heat map analytics:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('heat_map_analytics_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        success: false,
        error: process.env.NODE_ENV === 'development' 
          ? (error.message || "Failed to fetch heat map analytics")
          : "Failed to fetch heat map analytics",
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
