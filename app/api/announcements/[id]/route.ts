import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAuth, unauthorizedResponse } from "@/lib/auth-api-helper";
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

    // Check rate limit for authenticated read operation
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
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    // Input validation
    const validation = validateInput(
      { announcementId },
      {
        announcementId: { required: true, type: 'string', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, maxLength: 50 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_announcement_access', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

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
        const response = NextResponse.json(
          { error: "Announcement not found" },
          { status: 404 }
        );
        return addSecurityHeaders(response);
      }

      logSecurityEvent('announcement_accessed', userId, { announcementId, role: 'admin' });
      
      const adminResponse = NextResponse.json({
        success: true,
        data: announcement,
      });
      
      return addSecurityHeaders(adminResponse);
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
      const response = NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    logSecurityEvent('announcement_accessed', userId, { announcementId, role: 'carrier' });
    
    const response = NextResponse.json({
      success: true,
      data: announcement,
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching announcement:", error);
    
    if (error.message === "Unauthorized" || error.message === "Authentication required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('announcement_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch announcement",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
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
      const response = NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
      return addSecurityHeaders(response);
    }

    const body = await request.json();
    const { title, message, priority, expiresAt, isActive, targetAudience, metadata } = body;
    const { id: announcementId } = await Promise.resolve(params);

    // Input validation
    const validation = validateInput(
      { announcementId, title, message, priority, isActive, targetAudience },
      {
        announcementId: { required: true, type: 'string', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, maxLength: 50 },
        title: { type: 'string', minLength: 1, maxLength: 200, required: false },
        message: { type: 'string', minLength: 1, maxLength: 5000, required: false },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], required: false },
        isActive: { type: 'boolean', required: false },
        targetAudience: { type: 'string', enum: ['all', 'carriers', 'specific'], required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_announcement_update_input', auth.userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Build update query - only update provided fields using parameterized queries
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updateFields.push(`title = $${paramIndex}`);
      updateValues.push(title);
      paramIndex++;
    }
    if (message !== undefined) {
      updateFields.push(`message = $${paramIndex}`);
      updateValues.push(message);
      paramIndex++;
    }
    if (priority !== undefined) {
      updateFields.push(`priority = $${paramIndex}`);
      updateValues.push(priority);
      paramIndex++;
    }
    if (expiresAt !== undefined) {
      updateFields.push(`expires_at = $${paramIndex}`);
      updateValues.push(expiresAt || null);
      paramIndex++;
    }
    if (isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex}`);
      updateValues.push(isActive);
      paramIndex++;
    }
    if (targetAudience !== undefined) {
      updateFields.push(`target_audience = $${paramIndex}`);
      updateValues.push(targetAudience);
      paramIndex++;
    }
    if (metadata !== undefined) {
      updateFields.push(`metadata = $${paramIndex}`);
      updateValues.push(JSON.stringify(metadata));
      paramIndex++;
    }

    if (updateFields.length === 0) {
      const response = NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Use parameterized query instead of sql.unsafe to prevent SQL injection
    updateFields.push(`updated_at = NOW()`);
    updateValues.push(announcementId);

    const [announcement] = await sql.unsafe(
      `UPDATE announcements SET ${updateFields.join(', ')} WHERE id = $${paramIndex}::uuid RETURNING *`,
      updateValues
    );

    logSecurityEvent('announcement_updated', auth.userId, { announcementId });
    
    const response = NextResponse.json({
      success: true,
      data: announcement,
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error updating announcement:", error);
    
    if (error.message === "Unauthorized" || error.message === "Authentication required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('announcement_update_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to update announcement",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
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
      const response = NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
      return addSecurityHeaders(response);
    }

    const { id: announcementId } = await Promise.resolve(params);

    // Input validation
    const validation = validateInput(
      { announcementId },
      {
        announcementId: { required: true, type: 'string', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, maxLength: 50 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_announcement_delete_input', auth.userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    await sql`
      DELETE FROM announcements
      WHERE id = ${announcementId}::uuid
    `;

    logSecurityEvent('announcement_deleted', auth.userId, { announcementId });
    
    const response = NextResponse.json({
      success: true,
      message: "Announcement deleted",
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error deleting announcement:", error);
    
    if (error.message === "Unauthorized" || error.message === "Authentication required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('announcement_delete_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to delete announcement",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

