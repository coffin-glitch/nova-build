import { requireApiAuth } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/announcements/[id]
 * Get a single announcement by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = await requireApiAuth(request);
    const userId = auth.userId;
    const userRole = auth.userRole;
    const { id: announcementId } = await Promise.resolve(params);

    if (userRole === 'admin') {
      // Admin gets full details with read statistics
      const [announcement] = await sql`
        SELECT 
          a.*,
          COUNT(ar.id) as read_count,
          (SELECT COUNT(*) FROM announcement_reads WHERE announcement_id = a.id) as total_reads
        FROM announcements a
        LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id
        WHERE a.id = ${announcementId}::uuid
        GROUP BY a.id
      `;

      if (!announcement) {
        return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: announcement,
      });
    }

    // Carrier gets announcement with their read status
    const [announcement] = await sql`
      SELECT 
        a.*,
        CASE WHEN ar.id IS NOT NULL THEN true ELSE false END as is_read,
        ar.read_at
      FROM announcements a
      LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.carrier_user_id = ${userId}
      WHERE a.id = ${announcementId}::uuid
        AND a.is_active = true
    `;

    if (!announcement) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: announcement,
    });

  } catch (error) {
    console.error("Error fetching announcement:", error);
    return NextResponse.json({
      error: "Failed to fetch announcement"
    }, { status: 500 });
  }
}

/**
 * PUT /api/announcements/[id]
 * Update an announcement (admin only)
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

    const body = await request.json();
    const { title, message, priority, expiresAt, isActive, targetAudience, metadata } = body;
    const { id: announcementId } = await Promise.resolve(params);

    // Build update query - only update provided fields
    const updates: any = {};
    
    if (title !== undefined) updates.title = title;
    if (message !== undefined) updates.message = message;
    if (priority !== undefined) updates.priority = priority;
    if (expiresAt !== undefined) updates.expires_at = expiresAt || null;
    if (isActive !== undefined) updates.is_active = isActive;
    if (targetAudience !== undefined) updates.target_audience = targetAudience;
    if (metadata !== undefined) updates.metadata = JSON.stringify(metadata);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    // Build SQL update query
    const setClauses = Object.keys(updates).map((key, index) => {
      return `${key} = $${index + 1}`;
    }).join(', ');

    const values = Object.values(updates);
    values.push(announcementId);

    const [announcement] = await sql.unsafe(
      `UPDATE announcements SET ${setClauses}, updated_at = NOW() WHERE id = $${values.length}::uuid RETURNING *`,
      values
    );

    return NextResponse.json({
      success: true,
      data: announcement,
    });

  } catch (error) {
    console.error("Error updating announcement:", error);
    return NextResponse.json({
      error: "Failed to update announcement"
    }, { status: 500 });
  }
}

/**
 * DELETE /api/announcements/[id]
 * Delete an announcement (admin only)
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

    const { id: announcementId } = await Promise.resolve(params);

    await sql`
      DELETE FROM announcements
      WHERE id = ${announcementId}::uuid
    `;

    return NextResponse.json({
      success: true,
      message: "Announcement deleted",
    });

  } catch (error) {
    console.error("Error deleting announcement:", error);
    return NextResponse.json({
      error: "Failed to delete announcement"
    }, { status: 500 });
  }
}

