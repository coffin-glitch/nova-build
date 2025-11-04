import {
    archiveExpiredBids,
    cleanupOldArchiveTables,
    getArchiveStatistics,
    verifyArchiveIntegrity
} from "@/lib/archive-migration";
import { requireApiAdmin } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    await requireApiAdmin(request);

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    switch (action) {
      case "statistics":
        const stats = await getArchiveStatistics();
        return NextResponse.json({ ok: true, data: stats });

      case "integrity":
        const integrity = await verifyArchiveIntegrity();
        return NextResponse.json({ ok: true, data: integrity });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

  } catch (error) {
    console.error("Archive management API error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const { action } = await request.json();

    switch (action) {
      case "archive":
        const archiveResult = await archiveExpiredBids();
        return NextResponse.json({ 
          ok: true, 
          data: archiveResult,
          message: `Successfully archived ${archiveResult.archived} bids`
        });

      case "cleanup":
        const cleanupResult = await cleanupOldArchiveTables();
        return NextResponse.json({ 
          ok: true, 
          data: cleanupResult,
          message: `Cleanup completed. Cleaned: ${cleanupResult.cleaned.length} tables`
        });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

  } catch (error) {
    console.error("Archive management API error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
