import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const targetDate = body?.targetDate || '2025-10-26';

    // Reset archived_at to NULL and set is_archived = false for bids from the specified date
    const result = await sql`
      UPDATE telegram_bids
      SET 
        archived_at = NULL,
        is_archived = false
      WHERE received_at::date = ${targetDate}::date
      RETURNING id
    `;

    const updatedCount = result.length;

    return NextResponse.json({
      ok: true,
      updated: updatedCount,
      message: `Reset archived_at and is_archived for ${updatedCount} bids from ${targetDate}`
    });
  } catch (error) {
    console.error("Error resetting archived_at:", error);
    return NextResponse.json(
      { error: "Failed to reset archived_at", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

