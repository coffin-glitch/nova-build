import { requireApiAdmin, requireApiCarrier } from "@/lib/auth-api-helper";
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

    return NextResponse.json({
      ok: true,
      comments: comments
    });

  } catch (error) {
    console.error("Error fetching offer comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
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

    if (!comment_text || comment_text.trim().length === 0) {
      return NextResponse.json(
        { error: "Comment text is required" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "Failed to create comment" },
        { status: 500 }
      );
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

    return NextResponse.json({
      ok: true,
      comment: newComment[0]
    });

  } catch (error) {
    console.error("Error creating offer comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
