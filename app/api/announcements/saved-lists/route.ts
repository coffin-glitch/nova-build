import sql from "@/lib/db";
import { requireApiAuth } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/announcements/saved-lists
 * Get all saved recipient lists for the current admin
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAuth(request);
    
    if (auth.userRole !== 'admin') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const lists = await sql`
      SELECT 
        id,
        name,
        recipient_user_ids,
        created_at,
        updated_at
      FROM saved_recipient_lists
      WHERE created_by = ${auth.userId}::uuid
      ORDER BY updated_at DESC
    `;

    return NextResponse.json({
      success: true,
      data: lists,
    });

  } catch (error) {
    console.error("Error fetching saved recipient lists:", error);
    return NextResponse.json({
      error: "Failed to fetch saved lists"
    }, { status: 500 });
  }
}

/**
 * POST /api/announcements/saved-lists
 * Create a new saved recipient list
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAuth(request);
    
    if (auth.userRole !== 'admin') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { name, recipientUserIds } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!Array.isArray(recipientUserIds) || recipientUserIds.length === 0) {
      return NextResponse.json({ error: "At least one recipient is required" }, { status: 400 });
    }

    // Check if name already exists for this admin
    const existing = await sql`
      SELECT id FROM saved_recipient_lists
      WHERE created_by = ${auth.userId}::uuid
        AND name = ${name.trim()}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return NextResponse.json({ 
        error: "A list with this name already exists" 
      }, { status: 409 });
    }

    // Ensure all IDs are valid UUIDs
    const validUserIds = recipientUserIds.filter((id: string) => {
      // Basic UUID validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(String(id));
    });

    if (validUserIds.length === 0) {
      return NextResponse.json({ error: "No valid user IDs provided" }, { status: 400 });
    }

    // Use parameterized query with ARRAY constructor for safety
    // Build array elements as individual parameters
    const arrayParams = validUserIds.map((_, idx) => `$${idx + 3}::uuid`).join(', ');
    const allParams = [name.trim(), auth.userId, ...validUserIds];
    
    const [savedList] = await sql.unsafe(
      `INSERT INTO saved_recipient_lists (name, created_by, recipient_user_ids)
       VALUES ($1, $2::uuid, ARRAY[${arrayParams}]::uuid[])
       RETURNING *`,
      allParams
    );

    return NextResponse.json({
      success: true,
      data: savedList,
    });

  } catch (error: any) {
    console.error("Error creating saved recipient list:", error);
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      hint: error?.hint,
      name: error?.name,
      recipientUserIds: recipientUserIds?.slice(0, 3), // Log first 3 for debugging
    });
    return NextResponse.json({
      error: error?.message || "Failed to create saved list",
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    }, { status: 500 });
  }
}

