import { generateEmbedding } from "@/lib/ai-embeddings";
import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { findRelatedFiles, getCodebaseStructure, listDirectory, readFile, searchCode } from "@/lib/codebase-reader";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define available functions the AI can call
const functions = [
  {
    name: "get_bid_overview",
    description: "Get overview statistics about AUCTIONS/BID OPPORTUNITIES (telegram bids). Use this for questions like 'how many bids did we get today', 'how many auctions', 'bid opportunities received'. Returns total_auctions, active_auctions, total_carrier_bids, unique_carriers. This is about the BID OPPORTUNITIES received, not carrier bids placed.",
    parameters: {
      type: "object",
      properties: {
        timeframe: {
          type: "string",
          description: "Time period: 'today', 'week', 'month', '30', 'all'",
        },
      },
    },
  },
  {
    name: "get_carrier_stats",
    description: "Get statistics about CARRIER BIDS (bids placed by carriers on auctions). Use this for questions like 'did we receive any carrier bids today', 'how many carrier bids', 'carrier bidding activity'. Returns total_bids, unique_carriers, avg_bid_amount, won_bids, lost_bids.",
    parameters: {
      type: "object",
      properties: {
        timeframe: {
          type: "string",
          description: "Time period: 'today', 'week', 'month', '30', 'all'",
        },
        carrier_id: {
          type: "string",
          description: "Optional: Specific carrier user ID to get stats for",
        },
      },
    },
  },
  {
    name: "get_auction_insights",
    description: "Get detailed insights about auction competition and bidding patterns",
    parameters: {
      type: "object",
      properties: {
        timeframe: {
          type: "string",
          description: "Time period: 'today', 'week', 'month', '30', 'all'",
        },
      },
    },
  },
  {
    name: "query_bids",
    description: "Query specific bids with filters (bid number, date range, status, etc.)",
    parameters: {
      type: "object",
      properties: {
        bid_number: {
          type: "string",
          description: "Optional: Specific bid number to search for",
        },
        date_from: {
          type: "string",
          description: "Optional: Start date (ISO format)",
        },
        date_to: {
          type: "string",
          description: "Optional: End date (ISO format)",
        },
        is_archived: {
          type: "boolean",
          description: "Optional: Filter by archived status",
        },
        limit: {
          type: "number",
          description: "Optional: Maximum number of results (default 50)",
        },
      },
    },
  },
  {
    name: "calculate_metrics",
    description: "Calculate custom metrics or comparisons",
    parameters: {
      type: "object",
      properties: {
        metric_type: {
          type: "string",
          description: "Type of metric: 'win_rate', 'avg_bid', 'revenue', 'competition', 'carrier_activity'",
        },
        timeframe: {
          type: "string",
          description: "Time period: 'today', 'week', 'month', '30', 'all'",
        },
        compare_with: {
          type: "string",
          description: "Optional: Compare with another timeframe",
        },
      },
    },
  },
  {
    name: "query_expired_auctions",
    description: "Query expired auctions with filters (state tag, date range, etc.). Returns total count and list of expired auctions. When date_from or date_to is 'today', it filters by expiration date (when the auction expired), not when it was received. If no date filters are provided, returns ALL currently expired auctions.",
    parameters: {
      type: "object",
      properties: {
        state_tag: {
          type: "string",
          description: "Optional: Filter by state tag (e.g., 'CA', 'TX', 'FL')",
        },
        date_from: {
          type: "string",
          description: "Optional: Start date filter. Use 'today' to filter by expiration date today, or ISO format for received_at date. If not provided, returns all expired auctions.",
        },
        date_to: {
          type: "string",
          description: "Optional: End date filter. Use 'today' to filter by expiration date today, or ISO format for received_at date.",
        },
        limit: {
          type: "number",
          description: "Optional: Maximum number of results to return (default 1000, use 0 for all)",
        },
        get_all: {
          type: "boolean",
          description: "Optional: Get all expired auctions without limit (default false). Use this when user asks for 'all' expired auctions.",
        },
      },
    },
  },
  {
    name: "get_bids_by_state_tag",
    description: "Get bid counts and statistics grouped by state tag",
    parameters: {
      type: "object",
      properties: {
        timeframe: {
          type: "string",
          description: "Time period: 'today', 'week', 'month', '30', 'all'",
        },
        include_expired: {
          type: "boolean",
          description: "Optional: Include expired auctions (default false)",
        },
      },
    },
  },
  {
    name: "get_system_health",
    description: "Get system health status including database, API endpoints, and service status",
    parameters: {
      type: "object",
      properties: {
        check_database: {
          type: "boolean",
          description: "Optional: Check database health (default true)",
        },
        check_railway: {
          type: "boolean",
          description: "Optional: Check Railway service health (default false)",
        },
      },
    },
  },
  {
    name: "query_all_carriers",
    description: "Query all carrier information with filters (status, MC number, name, etc.)",
    parameters: {
      type: "object",
      properties: {
        profile_status: {
          type: "string",
          description: "Optional: Filter by profile status ('pending', 'approved', 'declined')",
        },
        mc_number: {
          type: "string",
          description: "Optional: Filter by MC number",
        },
        search: {
          type: "string",
          description: "Optional: Search by company name or contact name",
        },
        limit: {
          type: "number",
          description: "Optional: Maximum number of results (default 100)",
        },
      },
    },
  },
  {
    name: "get_carrier_details",
    description: "Get detailed information about a specific carrier including profile, health data, and bid history",
    parameters: {
      type: "object",
      properties: {
        carrier_id: {
          type: "string",
          description: "Required: Carrier user ID",
        },
        include_health: {
          type: "boolean",
          description: "Optional: Include carrier health data (default true)",
        },
        include_bids: {
          type: "boolean",
          description: "Optional: Include bid history (default true)",
        },
      },
    },
  },
  {
    name: "query_all_bids",
    description: "Comprehensive bid query with all filters (state, date range, status, carrier, etc.)",
    parameters: {
      type: "object",
      properties: {
        state_tag: {
          type: "string",
          description: "Optional: Filter by state tag",
        },
        date_from: {
          type: "string",
          description: "Optional: Start date (ISO format)",
        },
        date_to: {
          type: "string",
          description: "Optional: End date (ISO format)",
        },
        is_archived: {
          type: "boolean",
          description: "Optional: Filter by archived status",
        },
        is_expired: {
          type: "boolean",
          description: "Optional: Filter by expired status",
        },
        has_bids: {
          type: "boolean",
          description: "Optional: Filter by whether bids exist",
        },
        carrier_id: {
          type: "string",
          description: "Optional: Filter by carrier user ID",
        },
        limit: {
          type: "number",
          description: "Optional: Maximum number of results (default 100)",
        },
      },
    },
  },
  {
    name: "get_system_analytics",
    description: "Get comprehensive system analytics including user counts, bid statistics, carrier statistics, and system metrics",
    parameters: {
      type: "object",
      properties: {
        timeframe: {
          type: "string",
          description: "Time period: 'today', 'week', 'month', '30', 'all'",
        },
        include_users: {
          type: "boolean",
          description: "Optional: Include user statistics (default true)",
        },
        include_bids: {
          type: "boolean",
          description: "Optional: Include bid statistics (default true)",
        },
        include_carriers: {
          type: "boolean",
          description: "Optional: Include carrier statistics (default true)",
        },
      },
    },
  },
  {
    name: "read_file",
    description: "Read the contents of a file in the codebase. Use this to understand how code works, find implementations, or analyze specific files.",
    parameters: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Path to the file relative to project root (e.g., 'app/api/admin/bids/route.ts', 'lib/db.ts', 'components/admin/AIAssistant.tsx')",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "list_directory",
    description: "List files and directories in a path. Use this to explore the codebase structure, find files, or understand directory organization.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory path relative to project root (e.g., 'app/api/admin', 'components', 'lib'). Use '.' or empty for root.",
        },
      },
    },
  },
  {
    name: "search_code",
    description: "Search for code patterns, functions, variables, or text across the codebase. Use this to find where things are implemented, find usages, or locate specific code.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query - can be function names, variable names, text patterns, etc. (e.g., 'archiveExpiredBids', 'carrier_bids', 'how are bids archived')",
        },
        file_type: {
          type: "string",
          description: "Optional: Filter by file type ('ts', 'tsx', 'js', 'jsx', 'sql'). If not provided, searches TypeScript/JavaScript files.",
        },
        limit: {
          type: "number",
          description: "Optional: Maximum number of results (default 50)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_codebase_structure",
    description: "Get an overview of the codebase architecture, framework, main directories, key files, and patterns. Use this to understand the overall structure of the project.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "find_related_files",
    description: "Find files related to a given file - either files it imports, files that import it, or similar files. Use this to understand dependencies and relationships between files.",
    parameters: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Path to the file relative to project root",
        },
        relationship_type: {
          type: "string",
          description: "Type of relationship: 'imports' (files this file imports), 'imported_by' (files that import this file), or 'similar' (similar files)",
          enum: ["imports", "imported_by", "similar"],
        },
      },
      required: ["file_path"],
    },
  },
];

// Function implementations
async function getBidOverview(timeframe: string = "30") {
  let startDate: Date;
  if (timeframe === "all") {
    startDate = new Date('2000-01-01');
  } else if (timeframe === "today") {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  } else if (timeframe === "week") {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
  } else if (timeframe === "month") {
    startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
  } else {
    const days = parseInt(timeframe) || 30;
    startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
  }

  const stats = await sql`
    WITH bid_stats AS (
      SELECT 
        COUNT(tb.id) as total_auctions,
        COUNT(CASE WHEN NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes') THEN 1 END) as active_auctions,
        COUNT(CASE WHEN tb.received_at >= ${startDate.toISOString()} THEN 1 END) as recent_auctions,
        COUNT(cb.id) as total_carrier_bids,
        COUNT(DISTINCT cb.supabase_user_id) as unique_carriers,
        COALESCE(AVG(cb.amount_cents), 0) as avg_bid_amount,
        COALESCE(AVG(tb.distance_miles), 0) as avg_distance
      FROM telegram_bids tb
      LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
    ),
    winning_stats AS (
      SELECT 
        COUNT(aa.id) as total_wins,
        COALESCE(AVG(aa.winner_amount_cents), 0) as avg_winning_bid,
        COALESCE(SUM(aa.winner_amount_cents), 0) as total_winnings_value
      FROM auction_awards aa
      WHERE aa.awarded_at >= ${startDate.toISOString()}
    )
    SELECT 
      bs.*,
      ws.total_wins,
      ws.avg_winning_bid,
      ws.total_winnings_value
    FROM bid_stats bs
    CROSS JOIN winning_stats ws
  `;

  return stats[0] || {};
}

async function getCarrierStats(timeframe: string = "30", carrierId?: string) {
  let startDate: Date;
  if (timeframe === "all") {
    startDate = new Date('2000-01-01');
  } else if (timeframe === "today") {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  } else if (timeframe === "week") {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
  } else if (timeframe === "month") {
    startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
  } else {
    const days = parseInt(timeframe) || 30;
    startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
  }

  const whereClause = carrierId 
    ? sql`WHERE cb.supabase_user_id = ${carrierId} AND cb.created_at >= ${startDate.toISOString()}`
    : sql`WHERE cb.created_at >= ${startDate.toISOString()}`;

  const stats = await sql`
    SELECT 
      COUNT(DISTINCT cb.supabase_user_id) as unique_carriers,
      COUNT(cb.id) as total_bids,
      COALESCE(AVG(cb.amount_cents), 0) as avg_bid_amount,
      COUNT(CASE WHEN cb.bid_outcome = 'won' THEN 1 END) as won_bids,
      COUNT(CASE WHEN cb.bid_outcome = 'lost' THEN 1 END) as lost_bids
    FROM carrier_bids cb
    ${whereClause}
  `;

  return stats[0] || {};
}

async function getAuctionInsights(timeframe: string = "30") {
  let startDate: Date;
  if (timeframe === "all") {
    startDate = new Date('2000-01-01');
  } else if (timeframe === "today") {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  } else if (timeframe === "week") {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
  } else if (timeframe === "month") {
    startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
  } else {
    const days = parseInt(timeframe) || 30;
    startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
  }

  const insights = await sql`
    SELECT 
      COUNT(tb.id) as total_auctions,
      COUNT(CASE WHEN bid_counts.bids_count = 0 THEN 1 END) as no_bid_auctions,
      COUNT(CASE WHEN bid_counts.bids_count = 1 THEN 1 END) as single_bid_auctions,
      COUNT(CASE WHEN bid_counts.bids_count > 5 THEN 1 END) as high_competition_auctions,
      COALESCE(AVG(bid_counts.bids_count), 0) as avg_bids_per_auction,
      COALESCE(MAX(bid_counts.bids_count), 0) as max_bids_per_auction
    FROM telegram_bids tb
    LEFT JOIN (
      SELECT bid_number, COUNT(*) as bids_count
      FROM carrier_bids
      GROUP BY bid_number
    ) bid_counts ON tb.bid_number = bid_counts.bid_number
    WHERE tb.received_at >= ${startDate.toISOString()}
  `;

  return insights[0] || {};
}

async function queryBids(params: any) {
  const { bid_number, date_from, date_to, is_archived, limit = 50 } = params;
  
  // Build query conditions
  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (bid_number) {
    conditions.push(`bid_number = $${paramIndex++}`);
    values.push(bid_number);
  }
  if (date_from) {
    conditions.push(`received_at >= $${paramIndex++}`);
    values.push(date_from);
  }
  if (date_to) {
    conditions.push(`received_at <= $${paramIndex++}`);
    values.push(date_to);
  }
  if (is_archived !== undefined) {
    conditions.push(`is_archived = $${paramIndex++}`);
    values.push(is_archived);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `SELECT * FROM telegram_bids ${whereClause} ORDER BY received_at DESC LIMIT $${paramIndex}`;
  values.push(limit);
  
  const results = await sql.unsafe(query, values);
  return results;
}

async function calculateMetrics(params: any) {
  const { metric_type, timeframe, compare_with } = params;
  
  // Calculate for primary timeframe
  const primary = await getBidOverview(timeframe);
  
  // Calculate for comparison if provided
  let comparison = null;
  if (compare_with) {
    comparison = await getBidOverview(compare_with);
  }
  
  return {
    metric_type,
    timeframe,
    primary,
    comparison,
  };
}

async function queryExpiredAuctions(params: any) {
  const { state_tag, date_from, date_to, limit = 1000, get_all = false } = params;
  
  // Build base WHERE conditions for expired auctions
  // Expired means: archived_at IS NULL AND expiration time (received_at + 25 min) has passed
  let whereQuery = sql`
    WHERE tb.archived_at IS NULL
      AND NOW() > (tb.received_at::timestamp + INTERVAL '25 minutes')
  `;
  
  if (state_tag) {
    whereQuery = sql`${whereQuery} AND tb.tag = ${state_tag.toUpperCase()}`;
  }
  
  // Handle date filters - these can filter by received_at OR expiration date
  // If "today" is specified, filter by expiration date falling within today
  if (date_from === 'today' || date_to === 'today') {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    // Filter by expiration date (received_at + 25 minutes) being within today
    whereQuery = sql`
      ${whereQuery}
      AND (tb.received_at::timestamp + INTERVAL '25 minutes') >= ${todayStart.toISOString()}::timestamp
      AND (tb.received_at::timestamp + INTERVAL '25 minutes') <= ${todayEnd.toISOString()}::timestamp
    `;
  } else {
    // Regular date filters on received_at
    if (date_from && date_from !== 'today') {
      whereQuery = sql`${whereQuery} AND tb.received_at >= ${date_from}::timestamp`;
    }
    
    if (date_to && date_to !== 'today') {
      whereQuery = sql`${whereQuery} AND tb.received_at <= ${date_to}::timestamp`;
    }
  }
  
  // First, get the total count of expired auctions
  let countQuery = sql`
    SELECT COUNT(DISTINCT tb.bid_number) as total_count
    FROM telegram_bids tb
    ${whereQuery}
  `;
  
  const totalCountResult = await countQuery;
  const totalCount = parseInt(totalCountResult[0]?.total_count || '0');
  
  // Now get the actual expired auctions with bid statistics
  let query = sql`
    SELECT 
      tb.id,
      tb.bid_number,
      tb.tag as state_tag,
      tb.distance_miles,
      tb.received_at,
      (tb.received_at::timestamp + INTERVAL '25 minutes') as expired_at,
      tb.pickup_timestamp,
      tb.delivery_timestamp,
      COUNT(cb.id) as bid_count,
      COALESCE(MIN(cb.amount_cents), 0) as lowest_bid_cents,
      COALESCE(MAX(cb.amount_cents), 0) as highest_bid_cents
    FROM telegram_bids tb
    LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
    ${whereQuery}
    GROUP BY tb.id, tb.bid_number, tb.tag, tb.distance_miles, tb.received_at, tb.pickup_timestamp, tb.delivery_timestamp
    ORDER BY tb.received_at DESC
  `;
  
  // Apply limit only if not getting all and limit is specified
  const actualLimit = get_all ? 0 : (limit > 0 ? limit : 10000);
  if (actualLimit > 0) {
    query = sql`${query} LIMIT ${actualLimit}`;
  }
  
  const results = await query;
  
  return {
    total_count: totalCount,
    returned_count: results.length,
    has_more: totalCount > results.length,
    expired_auctions: results.map((r: any) => ({
      bid_number: r.bid_number,
      state_tag: r.state_tag || 'UNKNOWN',
      distance_miles: r.distance_miles,
      received_at: r.received_at,
      expired_at: r.expired_at,
      bid_count: parseInt(r.bid_count) || 0,
      lowest_bid: r.lowest_bid_cents ? r.lowest_bid_cents / 100 : null,
      highest_bid: r.highest_bid_cents ? r.highest_bid_cents / 100 : null,
    })),
  };
}

async function getBidsByStateTag(params: any) {
  const { timeframe = "today", include_expired = false } = params;
  
  let startDate: Date;
  if (timeframe === "all") {
    startDate = new Date('2000-01-01');
  } else if (timeframe === "today") {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  } else if (timeframe === "week") {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
  } else if (timeframe === "month") {
    startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
  } else {
    const days = parseInt(timeframe) || 30;
    startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
  }
  
  let query = sql`
    SELECT 
      COALESCE(tb.tag, 'UNKNOWN') as state_tag,
      COUNT(DISTINCT tb.bid_number) as auction_count,
      COUNT(cb.id) as total_bids,
      COUNT(DISTINCT cb.supabase_user_id) as unique_carriers,
      COALESCE(AVG(cb.amount_cents), 0) as avg_bid_cents,
      COALESCE(MIN(cb.amount_cents), 0) as min_bid_cents,
      COALESCE(MAX(cb.amount_cents), 0) as max_bid_cents
    FROM telegram_bids tb
    LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
    WHERE tb.received_at >= ${startDate.toISOString()}
  `;
  
  if (!include_expired) {
    // Only active auctions
    query = sql`
      ${query}
      AND tb.is_archived = false
      AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes')
    `;
  }
  
  query = sql`
    ${query}
    GROUP BY tb.tag
    ORDER BY total_bids DESC, auction_count DESC
  `;
  
  const results = await query;
  
  return {
    timeframe,
    include_expired,
    state_tags: results.map((r: any) => ({
      state_tag: r.state_tag,
      auction_count: parseInt(r.auction_count) || 0,
      total_bids: parseInt(r.total_bids) || 0,
      unique_carriers: parseInt(r.unique_carriers) || 0,
      avg_bid: r.avg_bid_cents ? r.avg_bid_cents / 100 : 0,
      min_bid: r.min_bid_cents ? r.min_bid_cents / 100 : 0,
      max_bid: r.max_bid_cents ? r.max_bid_cents / 100 : 0,
    })),
  };
}

async function getSystemHealth(params: any) {
  const { check_database = true, check_railway = false } = params;
  const health: any = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
  };

  if (check_database) {
    try {
      // Test database connection
      const dbTest = await sql`SELECT 1 as ok, version() as version`;
      const dbSize = await sql`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `;
      
      // Check key tables
      const tableCounts = await sql`
        SELECT 
          (SELECT COUNT(*) FROM telegram_bids) as telegram_bids,
          (SELECT COUNT(*) FROM carrier_bids) as carrier_bids,
          (SELECT COUNT(*) FROM carrier_profiles) as carrier_profiles,
          (SELECT COUNT(*) FROM auction_awards) as auction_awards
      `;

      health.database = {
        status: 'healthy',
        connected: true,
        version: dbTest[0]?.version || 'Unknown',
        size: dbSize[0]?.size || 'Unknown',
        table_counts: tableCounts[0] || {},
      };
    } catch (error: any) {
      health.database = {
        status: 'unhealthy',
        connected: false,
        error: error.message,
      };
      health.status = 'degraded';
    }
  }

  if (check_railway) {
    try {
      const railwayUrl = process.env.RAILWAY_URL || process.env.NEXT_PUBLIC_RAILWAY_URL;
      if (railwayUrl) {
        const response = await fetch(`${railwayUrl}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const data = await response.json();
          health.railway = {
            status: 'healthy',
            ...data,
          };
        } else {
          health.railway = {
            status: 'unhealthy',
            http_status: response.status,
          };
          health.status = 'degraded';
        }
      } else {
        health.railway = {
          status: 'not_configured',
        };
      }
    } catch (error: any) {
      health.railway = {
        status: 'unhealthy',
        error: error.message,
      };
      health.status = 'degraded';
    }
  }

  return health;
}

async function queryAllCarriers(params: any) {
  const { profile_status, mc_number, search, limit = 100 } = params;
  
  let query = sql`
    SELECT 
      cp.supabase_user_id as carrier_id,
      cp.company_name,
      cp.legal_name,
      cp.mc_number,
      cp.dot_number,
      cp.contact_name,
      cp.phone,
      cp.profile_status,
      cp.submitted_at,
      cp.reviewed_at,
      cp.reviewed_by,
      cp.created_at,
      COUNT(DISTINCT cb.id) as total_bids,
      COUNT(DISTINCT CASE WHEN cb.bid_outcome = 'won' THEN cb.id END) as won_bids,
      COUNT(DISTINCT aa.id) as total_awards
    FROM carrier_profiles cp
    LEFT JOIN carrier_bids cb ON cp.supabase_user_id = cb.supabase_user_id
    LEFT JOIN auction_awards aa ON cp.supabase_user_id = aa.supabase_winner_user_id
    WHERE cp.supabase_user_id IS NOT NULL
  `;

  if (profile_status) {
    query = sql`${query} AND cp.profile_status = ${profile_status}`;
  }

  if (mc_number) {
    query = sql`${query} AND cp.mc_number = ${mc_number}`;
  }

  if (search) {
    query = sql`${query} AND (cp.company_name ILIKE ${`%${search}%`} OR cp.contact_name ILIKE ${`%${search}%`})`;
  }

  query = sql`
    ${query}
    GROUP BY cp.supabase_user_id, cp.company_name, cp.legal_name, cp.mc_number, cp.dot_number, 
             cp.contact_name, cp.phone, cp.profile_status, cp.submitted_at, cp.reviewed_at, 
             cp.reviewed_by, cp.created_at
    ORDER BY cp.created_at DESC
    LIMIT ${limit}
  `;

  const results = await query;
  
  return {
    count: results.length,
    carriers: results.map((r: any) => ({
      carrier_id: r.carrier_id,
      company_name: r.company_name,
      legal_name: r.legal_name,
      mc_number: r.mc_number,
      dot_number: r.dot_number,
      contact_name: r.contact_name,
      phone: r.phone,
      profile_status: r.profile_status,
      submitted_at: r.submitted_at,
      reviewed_at: r.reviewed_at,
      reviewed_by: r.reviewed_by,
      created_at: r.created_at,
      total_bids: parseInt(r.total_bids) || 0,
      won_bids: parseInt(r.won_bids) || 0,
      total_awards: parseInt(r.total_awards) || 0,
    })),
  };
}

async function getCarrierDetails(params: any) {
  const { carrier_id, include_health = true, include_bids = true } = params;
  
  if (!carrier_id) {
    return { error: "carrier_id is required" };
  }

  const result: any = {};

  // Get carrier profile
  const profile = await sql`
    SELECT 
      cp.*,
      urc.email
    FROM carrier_profiles cp
    LEFT JOIN user_roles_cache urc ON cp.supabase_user_id = urc.supabase_user_id
    WHERE cp.supabase_user_id = ${carrier_id}
    LIMIT 1
  `;

  if (profile.length === 0) {
    return { error: "Carrier not found" };
  }

  result.profile = profile[0];

  // Get health data if requested
  if (include_health && profile[0].mc_number) {
    try {
      const health = await sql`
        SELECT *
        FROM carrier_health_data
        WHERE mc_number = ${profile[0].mc_number}
        ORDER BY last_updated_at DESC
        LIMIT 1
      `;
      result.health = health[0] || null;
    } catch (error) {
      result.health = null;
    }
  }

  // Get bid history if requested
  if (include_bids) {
    const bids = await sql`
      SELECT 
        cb.*,
        tb.bid_number,
        tb.distance_miles,
        tb.tag as state_tag,
        tb.pickup_timestamp,
        tb.delivery_timestamp
      FROM carrier_bids cb
      LEFT JOIN telegram_bids tb ON cb.bid_number = tb.bid_number
      WHERE cb.supabase_user_id = ${carrier_id}
      ORDER BY cb.created_at DESC
      LIMIT 100
    `;

    const awards = await sql`
      SELECT 
        aa.*,
        tb.bid_number,
        tb.distance_miles,
        tb.tag as state_tag
      FROM auction_awards aa
      LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
      WHERE aa.supabase_winner_user_id = ${carrier_id}
      ORDER BY aa.awarded_at DESC
      LIMIT 100
    `;

    result.bids = {
      total: bids.length,
      recent_bids: bids.map((b: any) => ({
        bid_number: b.bid_number,
        amount: b.amount_cents ? b.amount_cents / 100 : null,
        status: b.status,
        bid_outcome: b.bid_outcome,
        distance_miles: b.distance_miles,
        state_tag: b.state_tag,
        created_at: b.created_at,
      })),
    };

    result.awards = {
      total: awards.length,
      recent_awards: awards.map((a: any) => ({
        bid_number: a.bid_number,
        amount: a.winner_amount_cents ? a.winner_amount_cents / 100 : null,
        awarded_at: a.awarded_at,
        distance_miles: a.distance_miles,
        state_tag: a.state_tag,
      })),
    };
  }

  return result;
}

async function queryAllBids(params: any) {
  const { 
    state_tag, 
    date_from, 
    date_to, 
    is_archived, 
    is_expired, 
    has_bids, 
    carrier_id,
    limit = 100 
  } = params;

  let query = sql`
    SELECT 
      tb.*,
      COUNT(cb.id) as bid_count,
      COUNT(DISTINCT cb.supabase_user_id) as carrier_count,
      COALESCE(MIN(cb.amount_cents), 0) as lowest_bid_cents,
      COALESCE(MAX(cb.amount_cents), 0) as highest_bid_cents,
      COALESCE(AVG(cb.amount_cents), 0) as avg_bid_cents,
      CASE WHEN aa.id IS NOT NULL THEN true ELSE false END as is_awarded
    FROM telegram_bids tb
    LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
    LEFT JOIN auction_awards aa ON tb.bid_number = aa.bid_number
    WHERE 1=1
  `;

  if (state_tag) {
    query = sql`${query} AND tb.tag = ${state_tag.toUpperCase()}`;
  }

  if (date_from) {
    query = sql`${query} AND tb.received_at >= ${date_from}::timestamp`;
  }

  if (date_to) {
    query = sql`${query} AND tb.received_at <= ${date_to}::timestamp`;
  }

  if (is_archived !== undefined) {
    query = sql`${query} AND tb.is_archived = ${is_archived}`;
  }

  if (is_expired !== undefined) {
    if (is_expired) {
      query = sql`${query} AND tb.archived_at IS NULL AND NOW() > (tb.received_at::timestamp + INTERVAL '25 minutes')`;
    } else {
      query = sql`${query} AND (tb.archived_at IS NOT NULL OR NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes'))`;
    }
  }

  if (carrier_id) {
    query = sql`${query} AND cb.supabase_user_id = ${carrier_id}`;
  }

  query = sql`
    ${query}
    GROUP BY tb.id, tb.bid_number, tb.distance_miles, tb.tag, tb.received_at, 
             tb.pickup_timestamp, tb.delivery_timestamp, tb.is_archived, tb.archived_at, aa.id
  `;

  if (has_bids !== undefined) {
    if (has_bids) {
      query = sql`${query} HAVING COUNT(cb.id) > 0`;
    } else {
      query = sql`${query} HAVING COUNT(cb.id) = 0`;
    }
  }

  query = sql`
    ${query}
    ORDER BY tb.received_at DESC
    LIMIT ${limit}
  `;

  const results = await query;

  return {
    count: results.length,
    bids: results.map((r: any) => ({
      bid_number: r.bid_number,
      state_tag: r.tag || 'UNKNOWN',
      distance_miles: r.distance_miles,
      received_at: r.received_at,
      pickup_timestamp: r.pickup_timestamp,
      delivery_timestamp: r.delivery_timestamp,
      is_archived: r.is_archived,
      is_expired: r.archived_at === null && new Date() > new Date(new Date(r.received_at).getTime() + 25 * 60 * 1000),
      bid_count: parseInt(r.bid_count) || 0,
      carrier_count: parseInt(r.carrier_count) || 0,
      lowest_bid: r.lowest_bid_cents ? r.lowest_bid_cents / 100 : null,
      highest_bid: r.highest_bid_cents ? r.highest_bid_cents / 100 : null,
      avg_bid: r.avg_bid_cents ? r.avg_bid_cents / 100 : null,
      is_awarded: r.is_awarded,
    })),
  };
}

async function getSystemAnalytics(params: any) {
  const { timeframe = "30", include_users = true, include_bids = true, include_carriers = true } = params;
  
  let startDate: Date;
  if (timeframe === "all") {
    startDate = new Date('2000-01-01');
  } else if (timeframe === "today") {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  } else if (timeframe === "week") {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
  } else if (timeframe === "month") {
    startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
  } else {
    const days = parseInt(timeframe) || 30;
    startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
  }

  const analytics: any = {
    timeframe,
    timestamp: new Date().toISOString(),
  };

  if (include_users) {
    const userStats = await sql`
      SELECT 
        COUNT(DISTINCT urc.supabase_user_id) as total_users,
        COUNT(DISTINCT CASE WHEN urc.role = 'admin' THEN urc.supabase_user_id END) as admin_count,
        COUNT(DISTINCT CASE WHEN urc.role = 'carrier' THEN urc.supabase_user_id END) as carrier_count,
        COUNT(DISTINCT CASE WHEN urc.created_at >= ${startDate.toISOString()} THEN urc.supabase_user_id END) as new_users
      FROM user_roles_cache urc
    `;
    analytics.users = userStats[0] || {};
  }

  if (include_bids) {
    const bidStats = await sql`
      SELECT 
        COUNT(DISTINCT tb.bid_number) as total_auctions,
        COUNT(cb.id) as total_bids,
        COUNT(DISTINCT cb.supabase_user_id) as unique_bidders,
        COUNT(DISTINCT aa.id) as total_awards,
        COALESCE(AVG(cb.amount_cents), 0) as avg_bid_amount,
        COALESCE(SUM(aa.winner_amount_cents), 0) as total_award_value
      FROM telegram_bids tb
      LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number AND cb.created_at >= ${startDate.toISOString()}
      LEFT JOIN auction_awards aa ON tb.bid_number = aa.bid_number AND aa.awarded_at >= ${startDate.toISOString()}
      WHERE tb.received_at >= ${startDate.toISOString()}
    `;
    analytics.bids = bidStats[0] || {};
  }

  if (include_carriers) {
    const carrierStats = await sql`
      SELECT 
        COUNT(*) as total_carriers,
        COUNT(CASE WHEN profile_status = 'approved' THEN 1 END) as approved_carriers,
        COUNT(CASE WHEN profile_status = 'pending' THEN 1 END) as pending_carriers,
        COUNT(CASE WHEN profile_status = 'declined' THEN 1 END) as declined_carriers,
        COUNT(CASE WHEN created_at >= ${startDate.toISOString()} THEN 1 END) as new_carriers
      FROM carrier_profiles
    `;
    analytics.carriers = carrierStats[0] || {};
  }

  return analytics;
}

// GET endpoint to retrieve conversation history
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversation_id");

    // Input validation
    if (conversationId) {
      const validation = validateInput(
        { conversationId },
        {
          conversationId: { type: 'string', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, maxLength: 50 }
        }
      );

      if (!validation.valid) {
        logSecurityEvent('invalid_ai_assistant_get_input', userId, { errors: validation.errors });
        const response = NextResponse.json(
          { error: `Invalid input: ${validation.errors.join(', ')}` },
          { status: 400 }
        );
        return addSecurityHeaders(response);
      }
    }

    if (conversationId) {
      // Get specific conversation with messages
      const conversation = await sql`
        SELECT 
          c.id,
          c.title,
          c.created_at,
          c.updated_at,
          json_agg(
            json_build_object(
              'id', m.id,
              'role', m.role,
              'content', m.content,
              'created_at', m.created_at,
              'metadata', m.metadata
            ) ORDER BY m.created_at
          ) as messages
        FROM ai_assistant_conversations c
        LEFT JOIN ai_assistant_messages m ON m.conversation_id = c.id
        WHERE c.id = ${conversationId}::uuid AND c.admin_user_id = ${userId}
        GROUP BY c.id, c.title, c.created_at, c.updated_at
      `;

      if (conversation.length === 0) {
        logSecurityEvent('ai_assistant_conversation_not_found', userId, { conversationId });
        const response = NextResponse.json({ error: "Conversation not found" }, { status: 404 });
        return addSecurityHeaders(response);
      }

      logSecurityEvent('ai_assistant_conversation_retrieved', userId, { conversationId });
      
      const response = NextResponse.json({
        conversation: conversation[0],
      });
      
      return addSecurityHeaders(response);
      
    } else {
      // Get all conversations for this admin
      const conversations = await sql`
        SELECT 
          c.id,
          c.title,
          c.created_at,
          c.updated_at,
          (
            SELECT m.content 
            FROM ai_assistant_messages m 
            WHERE m.conversation_id = c.id 
            ORDER BY m.created_at ASC 
            LIMIT 1
          ) as first_message
        FROM ai_assistant_conversations c
        WHERE c.admin_user_id = ${userId}
        ORDER BY c.updated_at DESC
        LIMIT 50
      `;

      logSecurityEvent('ai_assistant_conversations_listed', userId);
      
      const response = NextResponse.json({
        conversations: conversations || [],
      });
      
      return addSecurityHeaders(response);
    }
  } catch (error: any) {
    console.error("AI Assistant GET error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('ai_assistant_get_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        error: "Failed to retrieve conversations",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : "Unknown error")
          : undefined,
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin write operation (AI operations can be resource-intensive)
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'admin'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      logSecurityEvent('ai_assistant_openai_key_not_configured', userId);
      const response = NextResponse.json(
        { error: "OpenAI API key not configured. Add OPENAI_API_KEY to .env.local" },
        { status: 500 }
      );
      return addSecurityHeaders(response);
    }

    const body = await request.json();
    const { message, conversationId, conversationHistory = [] } = body;

    // Input validation
    const validation = validateInput(
      { message, conversationId },
      {
        message: { required: true, type: 'string', minLength: 1, maxLength: 10000 },
        conversationId: { type: 'string', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, maxLength: 50, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_ai_assistant_post_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!message) {
      const response = NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Handle conversation reset requests
    const resetKeywords = ['reset conversation', 'new conversation', 'start over', 'clear chat'];
    const shouldReset = resetKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );

    if (shouldReset) {
      // Create a new conversation for reset
      const newConversation = await sql`
        INSERT INTO ai_assistant_conversations (admin_user_id, title)
        VALUES (${userId}, 'New Conversation')
        RETURNING id
      `;
      return NextResponse.json({
        response: "Conversation reset. Starting fresh! How can I help you?",
        conversationId: newConversation[0].id,
      });
    }

    // Get or create conversation
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      // Create new conversation
      const newConversation = await sql`
        INSERT INTO ai_assistant_conversations (admin_user_id, title)
        VALUES (${userId}, ${message.substring(0, 100)})
        RETURNING id
      `;
      currentConversationId = newConversation[0].id;
    } else {
      // Verify conversation belongs to this user
      const existing = await sql`
        SELECT id FROM ai_assistant_conversations 
        WHERE id = ${currentConversationId}::uuid AND admin_user_id = ${userId}
      `;
      if (existing.length === 0) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
    }

    // Generate embedding for user message
    let userMessageEmbedding: number[] | null = null;
    try {
      userMessageEmbedding = await generateEmbedding(message);
    } catch (error) {
      console.warn("Failed to generate embedding for user message:", error);
    }

    // Save user message to database with embedding (if vector extension is available)
    try {
      if (userMessageEmbedding) {
        // Format embedding array as PostgreSQL ARRAY for pgvector
        // pgvector expects: ARRAY[1,2,3]::vector
        // We need to properly escape and format the array values
        const embeddingValues = userMessageEmbedding.join(',');
        
        // Use unsafe SQL with ARRAY syntax for pgvector
        await sql.unsafe(`
          INSERT INTO ai_assistant_messages (conversation_id, role, content, embedding)
          VALUES (
            $1::uuid, 
            $2,
            $3,
            ARRAY[${embeddingValues}]::vector
          )
        `, [
          currentConversationId, 
          'user',
          message
        ]);
      } else {
        await sql`
          INSERT INTO ai_assistant_messages (conversation_id, role, content)
          VALUES (
            ${currentConversationId}::uuid, 
            'user', 
            ${message}
          )
        `;
      }
    } catch (embeddingError: any) {
      // If vector extension not available, save without embedding
      const errorMsg = embeddingError?.message || String(embeddingError);
      const errorCode = embeddingError?.code;
      
      if (errorMsg.includes("vector") || 
          errorMsg.includes("operator does not exist") ||
          errorMsg.includes("type") ||
          errorMsg.includes("does not exist") ||
          errorCode === "42883" ||
          errorCode === "42P01") {
        console.warn("Vector extension not available, saving message without embedding:", errorMsg);
        await sql`
          INSERT INTO ai_assistant_messages (conversation_id, role, content)
          VALUES (
            ${currentConversationId}::uuid, 
            'user', 
            ${message}
          )
        `;
      } else {
        console.error("Error saving message with embedding:", {
          message: errorMsg,
          code: errorCode,
          stack: embeddingError?.stack
        });
        throw embeddingError; // Re-throw if it's a different error
      }
    }

    // Retrieve relevant memories and knowledge before generating response
    // Note: This requires pgvector extension. If not available, skip memory recall.
    let memoryContext = "";
    if (userMessageEmbedding) {
      try {
        // Check if vector extension is available by trying a simple query
        // Get personal memories using vector similarity search (if available)
        const queryEmbeddingValues = userMessageEmbedding.join(',');
        
        try {
          const personalMemories = await sql.unsafe(`
            SELECT chunk_text, chunk_type, metadata
            FROM ai_memory_chunks
            WHERE admin_user_id = $1
            AND embedding IS NOT NULL
            AND 1 - (embedding <=> ARRAY[${queryEmbeddingValues}]::vector) > 0.7
            ORDER BY embedding <=> ARRAY[${queryEmbeddingValues}]::vector
            LIMIT 3
          `, [userId]);

          // Get shared knowledge base
          const knowledgeBase = await sql.unsafe(`
            SELECT content, category
            FROM ai_knowledge_base
            WHERE embedding IS NOT NULL
            AND 1 - (embedding <=> ARRAY[${queryEmbeddingValues}]::vector) > 0.7
            ORDER BY embedding <=> ARRAY[${queryEmbeddingValues}]::vector
            LIMIT 3
          `);

          if (personalMemories.length > 0 || knowledgeBase.length > 0) {
            memoryContext = "\n\nRelevant context from previous conversations:\n";
            
            if (personalMemories.length > 0) {
              memoryContext += "Personal insights:\n";
              personalMemories.forEach((mem: any) => {
                memoryContext += `- ${mem.chunk_text}\n`;
              });
            }

            if (knowledgeBase.length > 0) {
              memoryContext += "\nShared knowledge:\n";
              knowledgeBase.forEach((kb: any) => {
                memoryContext += `- ${kb.content}\n`;
              });
            }
          }
        } catch (vectorError: any) {
          // Vector extension might not be enabled - skip memory recall
          if (vectorError?.message?.includes("vector") || vectorError?.message?.includes("operator does not exist")) {
            console.warn("Vector extension not available, skipping memory recall:", vectorError.message);
          } else {
            throw vectorError; // Re-throw if it's a different error
          }
        }
      } catch (error) {
        console.warn("Failed to retrieve memories:", error);
      }
    }

    // Load conversation history from database if not provided
    // Use a sliding window approach: get last 10 messages for context
    // This prevents context from getting too long and causing repetition
    let dbConversationHistory = conversationHistory;
    if (conversationHistory.length === 0 && currentConversationId) {
      const dbMessages = await sql`
        SELECT role, content
        FROM ai_assistant_messages
        WHERE conversation_id = ${currentConversationId}::uuid
        ORDER BY created_at DESC
        LIMIT 10
      `;
      // Reverse to get chronological order
      dbConversationHistory = dbMessages.reverse().map((m: any) => ({
        role: m.role,
        content: m.content,
      }));
    }

    // Build system prompt with context about the system and memory
    const systemPrompt = `You are an AI assistant for a freight/logistics bidding platform. You help admins analyze bid data, carrier performance, auction insights, and system health.

CRITICAL INSTRUCTIONS:
- ALWAYS answer the user's CURRENT question directly. Do NOT repeat previous answers.
- Each question requires a NEW query using the appropriate function. Never reuse data from previous responses.
- If the user asks a different question, use a DIFFERENT function that matches the question.
- Be concise and direct. Only provide details when specifically asked.
- When asked about HOW something works in the code, use read_file or search_code to find and read the relevant code.

AVAILABLE FUNCTIONS - Use the RIGHT function for each question type:

CODEBASE ACCESS FUNCTIONS (NEW):
- **read_file** - Read any code file to understand implementation
  - "How does X work?" → FIRST use search_code to find the file, THEN read_file to see the code
  - "Show me the code for Y" → search_code to find file, then read_file
  - "What's in file Z?" → read_file with exact path (e.g., "lib/archive-migration.ts")
  - IMPORTANT: For "how does X work" questions, FIRST search_code to find relevant files, THEN read_file on those files
  
- **search_code** - Search for code patterns, functions, or text
  - "Where is function X defined?" → search_code with function name
  - "Find all uses of Y" → search_code
  - "How is Z implemented?" → search_code to find files, then read_file
  - Use specific terms: "archiveExpiredBids", "bid archiving", "archived_bids"
  
- **list_directory** - Explore codebase structure
  - "What files are in app/api/admin?" → list_directory
  - "Show me the structure" → list_directory
  
- **get_codebase_structure** - Get architecture overview
  - "What's the project structure?" → get_codebase_structure
  - "What framework is used?" → get_codebase_structure
  
- **find_related_files** - Find file dependencies
  - "What files does X import?" → find_related_files with relationship_type='imports'
  - "What files use Y?" → find_related_files with relationship_type='imported_by'

WORKFLOW FOR "HOW DOES X WORK" QUESTIONS:
For questions like "how does bid archiving work":
1. Use search_code with the function name (e.g., "archiveExpiredBids") to find the main file
2. Read ONLY ONE file first - the main implementation (usually lib/archive-migration.ts or similar)
3. Give a concise explanation based on that ONE file
4. If user wants more detail, THEN read additional files

SIMPLIFIED APPROACH:
- For "how does X work" → search_code("X") → read_file(most_relevant_file) → explain briefly
- Don't read multiple files in one response
- Keep explanations under 300 words unless asked for details
- If search returns many files, pick the ONE most relevant (usually in lib/ or app/api/)

DATA QUERY FUNCTIONS:

1. **query_expired_auctions** - For questions about expired auctions:
   - "how many expired auctions" → Use with NO date filters to get ALL expired
   - "expired auctions from CA" → Use with state_tag='CA'
   - "expired for today" → Use with date_from='today' (filters by expiration date)
   - Returns: total_count (actual total), returned_count, expired_auctions list

2. **get_carrier_stats** - For questions about carrier bidding activity:
   - "did we receive any carrier bids today" → Use with timeframe='today'
   - "carrier bid statistics" → Use with timeframe
   - Returns: total_bids, unique_carriers, avg_bid_amount, won_bids, lost_bids

3. **get_bid_overview** - For general bid/auction statistics:
   - "how many bids did we get today" → Use with timeframe='today'
   - "bid statistics" → Use with timeframe
   - Returns: total_auctions, active_auctions, total_carrier_bids, unique_carriers

4. **get_bids_by_state_tag** - For questions about bids by state:
   - "which state has most bids" → Use with timeframe='today', include_expired=true
   - "bids by state today" → Use with timeframe='today'
   - Returns: state_tags array with auction_count, total_bids per state

5. **query_all_carriers** - For questions about carriers:
   - "show me all carriers" → Use with appropriate filters
   - Returns: carriers list with profile info and bid stats

6. **get_system_analytics** - For comprehensive system statistics:
   - "system analytics" → Use with timeframe
   - Returns: users, bids, carriers statistics

7. **get_system_health** - For system health questions:
   - "system health" → Use with check_database=true
   - Returns: database status, service health

FUNCTION SELECTION GUIDE:
- Questions about "expired auctions" → query_expired_auctions
- Questions about "carrier bids received" → get_carrier_stats
- Questions about "bids we got/received" → get_bid_overview
- Questions about "state with most bids" → get_bids_by_state_tag
- Questions about "carriers" → query_all_carriers or get_carrier_details
- Questions about "system" → get_system_health or get_system_analytics

RESPONSE GUIDELINES:
- Answer the CURRENT question only. Do not repeat previous answers.
- Use the appropriate function for each NEW question.
- Report numbers accurately from function results.
- Be concise unless asked for details.
- If asked a follow-up question, treat it as NEW and query again.

${memoryContext}`;

    // Prepare messages for OpenAI
    // Only include recent conversation history to prevent repetition
    // Add the current user message at the end
    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...dbConversationHistory.slice(-8), // Only last 8 messages for context (4 exchanges)
      { role: "user", content: message }, // Add current message
    ];

    // Call OpenAI with function calling
    // Increased temperature to reduce repetition and encourage varied responses
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using gpt-4o-mini (cheapest GPT-4 model)
      messages,
      functions,
      function_call: "auto",
      temperature: 0.7, // Reduced for more focused responses
      top_p: 0.9, // Reduced for more focused responses
      frequency_penalty: 0.3, // Reduced
      presence_penalty: 0.2, // Reduced
      max_tokens: 2000, // Limit response length
    });

    const responseMessage = completion.choices[0].message;

    // If AI wants to call a function, execute it
    if (responseMessage.function_call) {
      const functionName = responseMessage.function_call.name;
      const functionArgs = JSON.parse(responseMessage.function_call.arguments || "{}");

      let functionResult: any;

      switch (functionName) {
        case "get_bid_overview":
          functionResult = await getBidOverview(functionArgs.timeframe);
          break;
        case "get_carrier_stats":
          functionResult = await getCarrierStats(functionArgs.timeframe, functionArgs.carrier_id);
          break;
        case "get_auction_insights":
          functionResult = await getAuctionInsights(functionArgs.timeframe);
          break;
        case "query_bids":
          functionResult = await queryBids(functionArgs);
          break;
        case "calculate_metrics":
          functionResult = await calculateMetrics(functionArgs);
          break;
        case "query_expired_auctions":
          functionResult = await queryExpiredAuctions(functionArgs);
          break;
        case "get_bids_by_state_tag":
          functionResult = await getBidsByStateTag(functionArgs);
          break;
        case "get_system_health":
          functionResult = await getSystemHealth(functionArgs);
          break;
        case "query_all_carriers":
          functionResult = await queryAllCarriers(functionArgs);
          break;
        case "get_carrier_details":
          functionResult = await getCarrierDetails(functionArgs);
          break;
        case "query_all_bids":
          functionResult = await queryAllBids(functionArgs);
          break;
        case "get_system_analytics":
          functionResult = await getSystemAnalytics(functionArgs);
          break;
        case "read_file":
          functionResult = readFile(functionArgs.file_path);
          break;
        case "list_directory":
          functionResult = listDirectory(functionArgs.path);
          break;
        case "search_code":
          functionResult = searchCode(functionArgs.query, functionArgs.file_type, functionArgs.limit);
          break;
        case "get_codebase_structure":
          functionResult = getCodebaseStructure();
          break;
        case "find_related_files":
          functionResult = findRelatedFiles(functionArgs.file_path, functionArgs.relationship_type);
          break;
        default:
          functionResult = { error: `Unknown function: ${functionName}` };
      }

      // Log function call for debugging
      console.log(`[AI Assistant] Function called: ${functionName}`, {
        hasResult: !!functionResult,
        resultType: typeof functionResult,
        resultKeys: functionResult && typeof functionResult === 'object' ? Object.keys(functionResult) : null,
        resultSize: functionResult ? JSON.stringify(functionResult).length : 0,
      });

      // Call OpenAI again with function result
      // Keep message context manageable to prevent repetition
      const messagesForSecondCall = [
        ...messages.slice(-8), // Keep last 8 messages for context
        responseMessage,
        {
          role: "function",
          name: functionName,
          content: JSON.stringify(functionResult),
        },
      ];

      const secondCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messagesForSecondCall,
        functions,
        function_call: "auto",
        temperature: 0.9, // Increased from 0.7 to reduce repetitive responses
        top_p: 0.95,
        frequency_penalty: 0.5, // Penalize repetition
        presence_penalty: 0.3, // Encourage new topics
      });

      const aiResponse = secondCompletion.choices[0].message.content || "";
      
      // Log response for debugging
      console.log(`[AI Assistant] Response generated:`, {
        hasResponse: !!aiResponse,
        responseLength: aiResponse?.length || 0,
        functionCalled: functionName,
        usage: secondCompletion.usage,
      });
      
      // If no response and function was called, provide helpful error
      if (!aiResponse && functionName) {
        console.warn(`[AI Assistant] AI generated empty response after calling function: ${functionName}`, {
          functionResult: functionResult,
          completionChoices: secondCompletion.choices,
        });
        
        // Return a helpful message based on function result
        if (functionResult && typeof functionResult === 'object') {
          if ('error' in functionResult) {
            return NextResponse.json({
              response: `I encountered an error while trying to access the codebase: ${functionResult.error}. Please try rephrasing your question or asking about a specific file.`,
              usage: secondCompletion.usage,
              conversationId: currentConversationId,
            });
          }
          if ('success' in functionResult && !functionResult.success) {
            return NextResponse.json({
              response: `I couldn't access the requested information: ${functionResult.error || 'Unknown error'}. Please try a different approach or specify the exact file path.`,
              usage: secondCompletion.usage,
              conversationId: currentConversationId,
            });
          }
        }
        
        // If we have function results but no response, provide a fallback
        return NextResponse.json({
          response: `I found the information but had trouble generating a response. The function ${functionName} returned results. Please try asking a more specific question, or ask me to read a specific file directly (e.g., "read lib/archive-migration.ts").`,
          usage: secondCompletion.usage,
          conversationId: currentConversationId,
        });
      }
      
      // If response is empty and no function was called, that's a different issue
      if (!aiResponse && !functionName) {
        console.error(`[AI Assistant] AI generated empty response with no function call`);
        return NextResponse.json({
          response: "I'm having trouble generating a response. Please try rephrasing your question or asking something more specific.",
          usage: secondCompletion.usage,
          conversationId: currentConversationId,
        });
      }

      // Generate embedding for AI response
      let aiResponseEmbedding: number[] | null = null;
      try {
        aiResponseEmbedding = await generateEmbedding(aiResponse);
      } catch (error) {
        console.warn("Failed to generate embedding for AI response:", error);
      }

      // Save AI response to database with embedding (if available)
      try {
        if (aiResponseEmbedding) {
          const aiEmbeddingValues = aiResponseEmbedding.join(',');
          await sql.unsafe(`
            INSERT INTO ai_assistant_messages (conversation_id, role, content, embedding, metadata)
            VALUES (
              $1::uuid, 
              'assistant', 
              $2,
              ARRAY[${aiEmbeddingValues}]::vector,
              $3::jsonb
            )
          `, [
            currentConversationId, 
            aiResponse,
            JSON.stringify({ usage: secondCompletion.usage, function_called: functionName })
          ]);
        } else {
          await sql`
            INSERT INTO ai_assistant_messages (conversation_id, role, content, metadata)
            VALUES (
              ${currentConversationId}::uuid, 
              'assistant', 
              ${aiResponse},
              ${JSON.stringify({ usage: secondCompletion.usage, function_called: functionName })}
            )
          `;
        }
      } catch (embeddingError: any) {
        // If vector extension not available, save without embedding
        if (embeddingError?.message?.includes("vector") || 
            embeddingError?.message?.includes("operator does not exist") ||
            embeddingError?.message?.includes("type") ||
            embeddingError?.code === "42883") {
          console.warn("Vector extension not available, saving response without embedding:", embeddingError.message);
          await sql`
            INSERT INTO ai_assistant_messages (conversation_id, role, content, metadata)
            VALUES (
              ${currentConversationId}::uuid, 
              'assistant', 
              ${aiResponse},
              ${JSON.stringify({ usage: secondCompletion.usage, function_called: functionName })}
            )
          `;
        } else {
          console.error("Error saving AI response with embedding:", embeddingError);
          throw embeddingError;
        }
      }

      logSecurityEvent('ai_assistant_message_sent', userId, { conversationId: currentConversationId, hasFunctionCall: !!functionName });
      
      const response = NextResponse.json({
        response: aiResponse,
        usage: secondCompletion.usage,
        conversationId: currentConversationId,
      });
      
      return addSecurityHeaders(response);
    }

    // Generate embedding for AI response
    const aiResponse = responseMessage.content || "";
    let aiResponseEmbedding: number[] | null = null;
    try {
      aiResponseEmbedding = await generateEmbedding(aiResponse);
    } catch (error) {
      console.warn("Failed to generate embedding for AI response:", error);
    }

    // Save AI response to database with embedding (if available)
    try {
      if (aiResponseEmbedding) {
        const finalEmbeddingValues = aiResponseEmbedding.join(',');
        await sql.unsafe(`
          INSERT INTO ai_assistant_messages (conversation_id, role, content, embedding, metadata)
          VALUES (
            $1::uuid, 
            'assistant', 
            $2,
            ARRAY[${finalEmbeddingValues}]::vector,
            $3::jsonb
          )
        `, [
          currentConversationId, 
          aiResponse,
          JSON.stringify({ usage: completion.usage })
        ]);
      } else {
        await sql`
          INSERT INTO ai_assistant_messages (conversation_id, role, content, metadata)
          VALUES (
            ${currentConversationId}::uuid, 
            'assistant', 
            ${aiResponse},
            ${JSON.stringify({ usage: completion.usage })}
          )
        `;
      }
    } catch (embeddingError: any) {
      // If vector extension not available, save without embedding
      if (embeddingError?.message?.includes("vector") || 
          embeddingError?.message?.includes("operator does not exist") ||
          embeddingError?.message?.includes("type") ||
          embeddingError?.code === "42883") {
        console.warn("Vector extension not available, saving response without embedding:", embeddingError.message);
        await sql`
          INSERT INTO ai_assistant_messages (conversation_id, role, content, metadata)
          VALUES (
            ${currentConversationId}::uuid, 
            'assistant', 
            ${aiResponse},
            ${JSON.stringify({ usage: completion.usage })}
          )
        `;
      } else {
        console.error("Error saving AI response with embedding:", embeddingError);
        throw embeddingError;
      }
    }

    logSecurityEvent('ai_assistant_message_sent', userId, { conversationId: currentConversationId });
    
    const response = NextResponse.json({
      response: aiResponse,
      usage: completion.usage,
      conversationId: currentConversationId,
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("AI Assistant API error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('ai_assistant_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    // Check for specific error types
    if (error instanceof Error) {
      // OpenAI API errors
      if (error.message.includes("API key") || error.message.includes("authentication")) {
        const response = NextResponse.json(
          {
            error: "OpenAI API authentication failed",
            details: "Please check your OPENAI_API_KEY in .env.local",
          },
          { status: 500 }
        );
        return addSecurityHeaders(response);
      }
      
      // Database errors (like vector extension not enabled)
      if (error.message.includes("vector") || error.message.includes("extension")) {
        const response = NextResponse.json(
          {
            error: "Database vector extension error",
            details: "The pgvector extension may not be enabled. Run the migration: db/migrations/112_ai_assistant_advanced_memory.sql",
          },
          { status: 500 }
        );
        return addSecurityHeaders(response);
      }
    }
    
    const response = NextResponse.json(
      {
        error: "Failed to process AI request",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : "Unknown error")
          : undefined,
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

