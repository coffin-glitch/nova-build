import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db.server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Ensure user is admin (Supabase-only)
    await requireApiAdmin(request);
    
    const body = await request.json();
    const { action, loadIds, confirmAction } = body;

    // Validate action
    if (!["clear_all", "archive", "delete"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'clear_all', 'archive', or 'delete'" },
        { status: 400 }
      );
    }

    // For clear_all, we need confirmation
    if (action === "clear_all" && confirmAction !== "CLEAR_ALL_LOADS") {
      return NextResponse.json(
        { error: "Confirmation required. Please type 'CLEAR_ALL_LOADS' to confirm." },
        { status: 400 }
      );
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
          return NextResponse.json(
            { error: "Load IDs required for archive action" },
            { status: 400 }
          );
        }
        // Archive selected loads by setting published to false and adding archived flag
        result = await sql`
          UPDATE loads 
          SET published = false, 
              archived = true, 
              updated_at = NOW()
          WHERE rr_number = ANY(${loadIds})
        `;
        message = `Successfully archived loads`;
        break;

      case "delete":
        if (!loadIds || !Array.isArray(loadIds) || loadIds.length === 0) {
          return NextResponse.json(
            { error: "Load IDs required for delete action" },
            { status: 400 }
          );
        }
        // Delete selected loads
        result = await sql`
          DELETE FROM loads 
          WHERE rr_number = ANY(${loadIds})
        `;
        message = `Successfully deleted loads`;
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message,
      affectedRows: loadIds?.length || 0
    });

  } catch (error) {
    console.error("Bulk operation error:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk operation", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

