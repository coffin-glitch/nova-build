import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const targetDate = body?.targetDate || '2025-10-26';

    // Reset archived_at to NULL and set is_archived = false for bids from the specified date
    // Simple UTC-based logic:
    // 1. Bids with received_at::date = targetDate
    // 2. Bids with received_at::date = (targetDate + 1) before 05:00:00 UTC
    //    (Cutoff is always 05:00:00 UTC - no DST complexity)
    
    const dateObj = new Date(targetDate);
    const nextDate = new Date(dateObj);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().split('T')[0];
    
    // Part 1: Reset bids with received_at date = targetDate
    const result = await sql`
      UPDATE telegram_bids
      SET 
        archived_at = NULL,
        is_archived = false
      WHERE received_at::date = ${targetDate}::date
      RETURNING id
    `;
    let updatedCount = result.length;
    
    // Part 2: ALSO reset bids from next day (UTC) before 05:00:00 UTC
    const result2 = await sql`
      UPDATE telegram_bids
      SET 
        archived_at = NULL,
        is_archived = false
      WHERE received_at::date = ${nextDateStr}::date
        AND received_at::time < '05:00:00'::time
        AND archived_at IS NOT NULL
      RETURNING id
    `;
    updatedCount += result2.length;

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

