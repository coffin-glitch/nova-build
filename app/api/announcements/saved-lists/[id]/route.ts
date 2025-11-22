import sql from "@/lib/db";
import { requireApiAuth } from "@/lib/auth-api-helper";
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
    const auth = await requireApiAuth(request);
    
    if (auth.userRole !== 'admin') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id: listId } = await Promise.resolve(params);

    const [list] = await sql`
      SELECT 
        id,
        name,
        recipient_user_ids,
        created_at,
        updated_at
      FROM saved_recipient_lists
      WHERE id = ${listId}::uuid
        AND created_by = ${auth.userId}::uuid
      LIMIT 1
    `;

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: list,
    });

  } catch (error: any) {
    console.error("Error fetching saved recipient list:", error);
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
    });
    return NextResponse.json({
      error: error?.message || "Failed to fetch saved list"
    }, { status: 500 });
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
    const auth = await requireApiAuth(request);
    
    if (auth.userRole !== 'admin') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id: listId } = await Promise.resolve(params);
    const body = await request.json();
    const { name, recipientUserIds } = body;

    // Check if list exists and belongs to user
    const [existing] = await sql`
      SELECT id FROM saved_recipient_lists
      WHERE id = ${listId}::uuid
        AND created_by = ${auth.userId}::uuid
      LIMIT 1
    `;

    if (!existing) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    // If name is being changed, check for duplicates
    if (name && name.trim()) {
      const duplicate = await sql`
        SELECT id FROM saved_recipient_lists
        WHERE created_by = ${auth.userId}::uuid
          AND name = ${name.trim()}
          AND id != ${listId}::uuid
        LIMIT 1
      `;

      if (duplicate.length > 0) {
        return NextResponse.json({ 
          error: "A list with this name already exists" 
        }, { status: 409 });
      }
    }

    // Build update query with proper parameterization for UUID arrays
    if (name !== undefined && recipientUserIds !== undefined) {
      if (!Array.isArray(recipientUserIds) || recipientUserIds.length === 0) {
        return NextResponse.json({ error: "At least one recipient is required" }, { status: 400 });
      }
      const [updatedList] = await sql`
        UPDATE saved_recipient_lists
        SET 
          name = ${name.trim()},
          recipient_user_ids = ${sql.array(recipientUserIds, 'uuid')},
          updated_at = NOW()
        WHERE id = ${listId}::uuid
        RETURNING *
      `;
      return NextResponse.json({
        success: true,
        data: updatedList,
      });
    } else if (name !== undefined) {
      const [updatedList] = await sql`
        UPDATE saved_recipient_lists
        SET 
          name = ${name.trim()},
          updated_at = NOW()
        WHERE id = ${listId}::uuid
        RETURNING *
      `;
      return NextResponse.json({
        success: true,
        data: updatedList,
      });
    } else if (recipientUserIds !== undefined) {
      if (!Array.isArray(recipientUserIds) || recipientUserIds.length === 0) {
        return NextResponse.json({ error: "At least one recipient is required" }, { status: 400 });
      }
      const [updatedList] = await sql`
        UPDATE saved_recipient_lists
        SET 
          recipient_user_ids = ${sql.array(recipientUserIds, 'uuid')},
          updated_at = NOW()
        WHERE id = ${listId}::uuid
        RETURNING *
      `;
      return NextResponse.json({
        success: true,
        data: updatedList,
      });
    }

    return NextResponse.json({ success: true, message: "No changes provided" });

  } catch (error: any) {
    console.error("Error updating saved recipient list:", error);
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
    });
    return NextResponse.json({
      error: error?.message || "Failed to update saved list"
    }, { status: 500 });
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
    const auth = await requireApiAuth(request);
    
    if (auth.userRole !== 'admin') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id: listId } = await Promise.resolve(params);

    const result = await sql`
      DELETE FROM saved_recipient_lists
      WHERE id = ${listId}::uuid
        AND created_by = ${auth.userId}::uuid
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "List deleted successfully",
    });

  } catch (error: any) {
    console.error("Error deleting saved recipient list:", error);
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
    });
    return NextResponse.json({
      error: error?.message || "Failed to delete saved list"
    }, { status: 500 });
  }
}

