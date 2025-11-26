import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

/**
 * Admin endpoint to delete specific bid numbers
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const bidNumbers = body.bidNumbers || [];
    
    if (!Array.isArray(bidNumbers) || bidNumbers.length === 0) {
      return NextResponse.json(
        { error: 'Please provide bidNumbers array in request body' },
        { status: 400 }
      );
    }
    
    // Delete from telegram_bids
    const deleteTelegramBids = await sql`
      DELETE FROM public.telegram_bids
      WHERE bid_number = ANY(${bidNumbers})
      RETURNING bid_number
    `;

    // Delete from notification_logs
    await sql`
      DELETE FROM public.notification_logs
      WHERE bid_number = ANY(${bidNumbers})
    `;

    // Delete from notifications (in-app notifications)
    await sql`
      DELETE FROM public.notifications
      WHERE data->>'bid_number' = ANY(${bidNumbers})
    `;
    
    console.log(`[Admin Delete] Deleted ${deleteTelegramBids.length} bid(s): ${deleteTelegramBids.map(b => b.bid_number).join(', ')}`);

    return NextResponse.json({
      ok: true,
      message: `Deleted ${deleteTelegramBids.length} bid(s)`,
      deletedBids: deleteTelegramBids.map(b => b.bid_number),
    });

  } catch (error: any) {
    console.error('[Admin Delete] Error:', error);
    return NextResponse.json(
      { 
        error: "Failed to delete bids",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
  }
}

