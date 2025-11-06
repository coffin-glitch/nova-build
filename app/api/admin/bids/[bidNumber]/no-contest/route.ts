import { markBidAsNoContest } from '@/lib/auctions';
import { requireApiAdmin } from '@/lib/auth-api-helper';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bidNumber: string }> }
) {
  try {
    // Use unified auth (supports Supabase and Clerk)
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const { bidNumber } = await params;
    const body = await request.json();
    const { admin_notes } = body;

    await markBidAsNoContest({
      bid_number: bidNumber,
      awarded_by: userId,
      admin_notes: admin_notes || undefined,
    });

    return NextResponse.json({ 
      success: true,
      message: `Bid #${bidNumber} marked as "No Contest". All carriers have been notified.`
    });
  } catch (error: any) {
    console.error('Error marking bid as no contest:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to mark bid as no contest',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

