import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

/**
 * Admin endpoint to cleanup test bids
 */
export async function POST(request: NextRequest) {
  try {
    // Delete all test bids (including specific test bid numbers)
    const result = await sql`
      DELETE FROM public.telegram_bids
      WHERE bid_number LIKE 'TEST%'
         OR source_channel = 'test-script'
         OR bid_number IN ('93513961', '93513733')
      RETURNING bid_number
    `;
    
    return NextResponse.json({
      ok: true,
      message: `Cleaned up ${result.length} test bid(s)`,
      deletedBids: result.map(r => r.bid_number),
    });
    
  } catch (error: any) {
    console.error('[Admin Cleanup] Error:', error);
    return NextResponse.json(
      { 
        error: "Failed to cleanup test bids",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
  }
}

