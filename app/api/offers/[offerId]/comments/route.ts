import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/offers/[id]/comments - Get all comments for an offer
export async function GET(
  request: Request,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const resolvedParams = await params;
    const offerId = resolvedParams.offerId;

    // Input validation
    const validation = validateInput(
      { offerId },
      {
        offerId: { required: true, type: 'string', maxLength: 50 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_offer_comments_input', undefined, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Get comments with author information
    const comments = await sql`
      SELECT 
        oc.id,
        oc.offer_id,
        oc.author_id,
        oc.author_role,
        oc.comment_text,
        oc.is_internal,
        oc.created_at,
        oc.updated_at,
        urc.email as author_email,
        urc.role as author_role_from_cache,
        CASE 
          WHEN oc.author_role = 'admin' THEN 'Admin'
          WHEN oc.author_role = 'carrier' THEN cp.company_name
          ELSE 'Unknown'
        END as author_display_name
      FROM offer_comments oc
      LEFT JOIN user_roles_cache urc ON oc.author_id = urc.supabase_user_id
      LEFT JOIN carrier_profiles cp ON oc.author_id = cp.supabase_user_id
      WHERE oc.offer_id = ${offerId}
      ORDER BY oc.created_at ASC
    `;

    const response = NextResponse.json({
      ok: true,
      comments: comments
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching offer comments:", error);
    
    logSecurityEvent('offer_comments_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch comments",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

// POST /api/offers/[id]/comments - Create a new comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const resolvedParams = await params;
    const offerId = resolvedParams.offerId;

    const body = await request.json();
    const { comment_text, is_internal = false } = body;

    // Input validation
    const validation = validateInput(
      { offerId, comment_text, is_internal },
      {
        offerId: { required: true, type: 'string', maxLength: 50 },
        comment_text: { required: true, type: 'string', minLength: 1, maxLength: 2000 },
        is_internal: { type: 'boolean', required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_offer_comment_create_input', undefined, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!comment_text || comment_text.trim().length === 0) {
      const response = NextResponse.json(
        { error: "Comment text is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Check if user is admin or carrier (Supabase-only)
    let userId: string;
    let userRole: 'admin' | 'carrier';
    
    try {
      const adminAuth = await requireApiAdmin(request);
      userId = adminAuth.userId;
      userRole = 'admin';
    } catch {
      // Not admin, try carrier
      const carrierAuth = await requireApiCarrier(request);
      userId = carrierAuth.userId;
      userRole = 'carrier';
    }
    
    const result = await sql`
      INSERT INTO offer_comments (offer_id, author_id, author_role, comment_text, is_internal)
      VALUES (${offerId}, ${userId}, ${userRole}, ${comment_text.trim()}, ${is_internal})
      RETURNING id, created_at
    `;

    if (result.length === 0) {
      const response = NextResponse.json(
        { error: "Failed to create comment" },
        { status: 500 }
      );
      return addSecurityHeaders(response);
    }

    // Get the full comment with author details (Supabase-only)
    const newComment = await sql`
      SELECT 
        oc.id,
        oc.offer_id,
        oc.author_id,
        oc.author_role,
        oc.comment_text,
        oc.is_internal,
        oc.created_at,
        oc.updated_at,
        urc.email as author_email,
        CASE 
          WHEN oc.author_role = 'admin' THEN 'Admin'
          ELSE 'Unknown'
        END as author_display_name
      FROM offer_comments oc
      LEFT JOIN user_roles_cache urc ON oc.author_id = urc.supabase_user_id
      WHERE oc.id = ${result[0].id}
    `;

    logSecurityEvent('offer_comment_created', userId, { 
      offerId,
      isInternal: is_internal
    });
    
    const response = NextResponse.json({
      ok: true,
      comment: newComment[0]
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error creating offer comment:", error);
    
    if (error.message === "Unauthorized" || error.message === "Authentication required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('offer_comment_create_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to create comment",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
