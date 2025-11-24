import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/announcements/saved-lists
 * Get all saved recipient lists for the current admin
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin read operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'readOnly'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }

    const lists = await sql`
      SELECT 
        id,
        name,
        recipient_user_ids,
        created_at,
        updated_at
      FROM saved_recipient_lists
      WHERE created_by = ${userId}::uuid
      ORDER BY updated_at DESC
    `;

    logSecurityEvent('saved_recipient_lists_accessed', userId);
    
    const response = NextResponse.json({
      success: true,
      data: lists,
    });
    
    return addSecurityHeaders(response, request);

  } catch (error: any) {
    console.error("Error fetching saved recipient lists:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('saved_recipient_lists_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch saved lists",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

/**
 * POST /api/announcements/saved-lists
 * Create a new saved recipient list
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const body = await request.json();
    const { name, recipientUserIds } = body;

    // Input validation
    const validation = validateInput(
      { name, recipientUserIds },
      {
        name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
        recipientUserIds: { required: true, type: 'array', minLength: 1, maxLength: 1000 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_saved_list_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    if (!name || !name.trim()) {
      const response = NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    if (!Array.isArray(recipientUserIds) || recipientUserIds.length === 0) {
      const response = NextResponse.json(
        { error: "At least one recipient is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    // Check if name already exists for this admin
    const existing = await sql`
      SELECT id FROM saved_recipient_lists
      WHERE created_by = ${userId}::uuid
        AND name = ${name.trim()}
      LIMIT 1
    `;

    if (existing.length > 0) {
      logSecurityEvent('saved_list_duplicate_name', userId, { name: name.trim() });
      const response = NextResponse.json(
        { error: "A list with this name already exists" },
        { status: 409 }
      );
      return addSecurityHeaders(response, request);
    }

    // Ensure all IDs are valid UUIDs
    const validUserIds = recipientUserIds.filter((id: string) => {
      // Basic UUID validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(String(id));
    });

    if (validUserIds.length === 0) {
      const response = NextResponse.json(
        { error: "No valid user IDs provided" },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    // Use parameterized query with sql.array() for safety (fixes SQL injection vulnerability)
    const [savedList] = await sql`
      INSERT INTO saved_recipient_lists (name, created_by, recipient_user_ids)
      VALUES (${name.trim()}, ${userId}::uuid, ${sql.array(validUserIds, 'uuid')})
      RETURNING *
    `;

    logSecurityEvent('saved_list_created', userId, { 
      listId: savedList.id,
      recipientCount: validUserIds.length
    });
    
    const response = NextResponse.json({
      success: true,
      data: savedList,
    });
    
    return addSecurityHeaders(response, request);

  } catch (error: any) {
    console.error("Error creating saved recipient list:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('saved_list_creation_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: error?.message || "Failed to create saved list",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

