import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const adminUserId = auth.userId;

    // Check rate limit for admin write operation (bulk operations are critical)
    const rateLimit = await checkApiRateLimit(request, {
      userId: adminUserId,
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
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }
    
    const body = await request.json();
    const { action, loadIds, confirmAction } = body;

    // Input validation
    const validation = validateInput(
      { action, loadIds, confirmAction },
      {
        action: { required: true, type: 'string', enum: ['clear_all', 'archive', 'delete'] },
        loadIds: { type: 'array', maxLength: 1000, required: false },
        confirmAction: { type: 'string', maxLength: 50, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_bulk_load_action', adminUserId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    // Validate action enum
    if (!["clear_all", "archive", "delete"].includes(action)) {
      const response = NextResponse.json(
        { error: "Invalid action. Must be 'clear_all', 'archive', or 'delete'" },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    // For clear_all, we need confirmation
    if (action === "clear_all" && confirmAction !== "CLEAR_ALL_LOADS") {
      logSecurityEvent('bulk_load_clear_all_confirmation_missing', adminUserId);
      const response = NextResponse.json(
        { error: "Confirmation required. Please type 'CLEAR_ALL_LOADS' to confirm." },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    let result;
    let message;

    switch (action) {
      case "clear_all":
        // Delete all loads
        result = await sql`DELETE FROM loads`;
        message = `Successfully cleared all loads`;
        break;

      case "archive":
        if (!loadIds || !Array.isArray(loadIds) || loadIds.length === 0) {
          logSecurityEvent('bulk_load_archive_no_ids', adminUserId);
          const response = NextResponse.json(
            { error: "Load IDs required for archive action" },
            { status: 400 }
          );
          return addSecurityHeaders(response, request);
        }
        // Archive selected loads by setting published to false and adding archived flag
        result = await sql`
          UPDATE loads 
          SET published = false, 
              archived = true, 
              updated_at = NOW()
          WHERE rr_number = ANY(${sql(loadIds)})
        `;
        message = `Successfully archived loads`;
        break;

      case "delete":
        if (!loadIds || !Array.isArray(loadIds) || loadIds.length === 0) {
          logSecurityEvent('bulk_load_delete_no_ids', adminUserId);
          const response = NextResponse.json(
            { error: "Load IDs required for delete action" },
            { status: 400 }
          );
          return addSecurityHeaders(response, request);
        }
        // Delete selected loads
        result = await sql`
          DELETE FROM loads 
          WHERE rr_number = ANY(${sql(loadIds)})
        `;
        message = `Successfully deleted loads`;
        break;

      default:
        const defaultResponse = NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
        return addSecurityHeaders(defaultResponse);
    }

    logSecurityEvent('bulk_load_operation', adminUserId, { 
      action, 
      affectedRows: loadIds?.length || 0 
    });
    
    const response = NextResponse.json({
      success: true,
      message,
      affectedRows: loadIds?.length || 0
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);

  } catch (error: any) {
    console.error("Bulk operation error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('bulk_load_operation_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to perform bulk operation",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

