import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/announcements/saved-lists/[id]
 * Get a specific saved recipient list
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
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
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }

    const { id: listId } = await Promise.resolve(params);

    // Input validation
    const validation = validateInput(
      { listId },
      {
        listId: { required: true, type: 'string', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, maxLength: 50 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_saved_list_id_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    const [list] = await sql`
      SELECT 
        id,
        name,
        recipient_user_ids,
        created_at,
        updated_at
      FROM saved_recipient_lists
      WHERE id = ${listId}::uuid
        AND created_by = ${userId}::uuid
      LIMIT 1
    `;

    if (!list) {
      logSecurityEvent('saved_list_not_found', userId, { listId });
      const response = NextResponse.json(
        { error: "List not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response, request);
    }

    logSecurityEvent('saved_list_accessed', userId, { listId });
    
    const response = NextResponse.json({
      success: true,
      data: list,
    });
    
    return addSecurityHeaders(response, request);

  } catch (error: any) {
    console.error("Error fetching saved recipient list:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('saved_list_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: error?.message || "Failed to fetch saved list",
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
 * PUT /api/announcements/saved-lists/[id]
 * Update a saved recipient list
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const { id: listId } = await Promise.resolve(params);
    const body = await request.json();
    const { name, recipientUserIds } = body;

    // Input validation
    const validation = validateInput(
      { listId, name, recipientUserIds },
      {
        listId: { required: true, type: 'string', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, maxLength: 50 },
        name: { type: 'string', minLength: 1, maxLength: 100, required: false },
        recipientUserIds: { type: 'array', minLength: 1, maxLength: 1000, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_saved_list_update_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    // Check if list exists and belongs to user
    const [existing] = await sql`
      SELECT id FROM saved_recipient_lists
      WHERE id = ${listId}::uuid
        AND created_by = ${userId}::uuid
      LIMIT 1
    `;

    if (!existing) {
      logSecurityEvent('saved_list_update_unauthorized', userId, { listId });
      const response = NextResponse.json(
        { error: "List not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response, request);
    }

    // If name is being changed, check for duplicates
    if (name && name.trim()) {
      const duplicate = await sql`
        SELECT id FROM saved_recipient_lists
        WHERE created_by = ${userId}::uuid
          AND name = ${name.trim()}
          AND id != ${listId}::uuid
        LIMIT 1
      `;

      if (duplicate.length > 0) {
        logSecurityEvent('saved_list_update_duplicate_name', userId, { listId, name: name.trim() });
        const response = NextResponse.json(
          { error: "A list with this name already exists" },
          { status: 409 }
        );
        return addSecurityHeaders(response, request);
      }
    }

    // Build update query with proper parameterization for UUID arrays
    if (name !== undefined && recipientUserIds !== undefined) {
      if (!Array.isArray(recipientUserIds) || recipientUserIds.length === 0) {
        const response = NextResponse.json(
          { error: "At least one recipient is required" },
          { status: 400 }
        );
        return addSecurityHeaders(response, request);
      }
      
      // Validate UUIDs
      const validUserIds = recipientUserIds.filter((id: string) => {
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
      
      const [updatedList] = await sql`
        UPDATE saved_recipient_lists
        SET 
          name = ${name.trim()},
          recipient_user_ids = ${sql.array(validUserIds, 'uuid')},
          updated_at = NOW()
        WHERE id = ${listId}::uuid
        RETURNING *
      `;
      
      logSecurityEvent('saved_list_updated', userId, { listId, recipientCount: validUserIds.length });
      
      const response = NextResponse.json({
        success: true,
        data: updatedList,
      });
      
      return addSecurityHeaders(response, request);
    } else if (name !== undefined) {
      const [updatedList] = await sql`
        UPDATE saved_recipient_lists
        SET 
          name = ${name.trim()},
          updated_at = NOW()
        WHERE id = ${listId}::uuid
        RETURNING *
      `;
      
      logSecurityEvent('saved_list_name_updated', userId, { listId });
      
      const response = NextResponse.json({
        success: true,
        data: updatedList,
      });
      
      return addSecurityHeaders(response, request);
    } else if (recipientUserIds !== undefined) {
      if (!Array.isArray(recipientUserIds) || recipientUserIds.length === 0) {
        const response = NextResponse.json(
          { error: "At least one recipient is required" },
          { status: 400 }
        );
        return addSecurityHeaders(response, request);
      }
      
      // Validate UUIDs
      const validUserIds = recipientUserIds.filter((id: string) => {
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
      
      const [updatedList] = await sql`
        UPDATE saved_recipient_lists
        SET 
          recipient_user_ids = ${sql.array(validUserIds, 'uuid')},
          updated_at = NOW()
        WHERE id = ${listId}::uuid
        RETURNING *
      `;
      
      logSecurityEvent('saved_list_recipients_updated', userId, { listId, recipientCount: validUserIds.length });
      
      const response = NextResponse.json({
        success: true,
        data: updatedList,
      });
      
      return addSecurityHeaders(response, request);
    }

    const response = NextResponse.json({ success: true, message: "No changes provided" });
    return addSecurityHeaders(response, request);

  } catch (error: any) {
    console.error("Error updating saved recipient list:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('saved_list_update_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: error?.message || "Failed to update saved list",
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
 * DELETE /api/announcements/saved-lists/[id]
 * Delete a saved recipient list
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const { id: listId } = await Promise.resolve(params);

    // Input validation
    const validation = validateInput(
      { listId },
      {
        listId: { required: true, type: 'string', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, maxLength: 50 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_saved_list_delete_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    const result = await sql`
      DELETE FROM saved_recipient_lists
      WHERE id = ${listId}::uuid
        AND created_by = ${userId}::uuid
      RETURNING id
    `;

    if (result.length === 0) {
      logSecurityEvent('saved_list_delete_unauthorized', userId, { listId });
      const response = NextResponse.json(
        { error: "List not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response, request);
    }

    logSecurityEvent('saved_list_deleted', userId, { listId });
    
    const response = NextResponse.json({
      success: true,
      message: "List deleted successfully",
    });
    
    return addSecurityHeaders(response, request);

  } catch (error: any) {
    console.error("Error deleting saved recipient list:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('saved_list_delete_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: error?.message || "Failed to delete saved list",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

