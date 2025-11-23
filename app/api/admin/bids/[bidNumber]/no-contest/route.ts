import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { markBidAsNoContest } from '@/lib/auctions';
import { requireApiAdmin, unauthorizedResponse } from '@/lib/auth-api-helper';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bidNumber: string }> }
) {
  try {
    // Use unified auth (supports Supabase and Clerk)
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin write operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'admin'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    const { bidNumber } = await params;
    const body = await request.json();
    const { admin_notes } = body;

    // Input validation
    const validation = validateInput(
      { bidNumber, admin_notes },
      {
        bidNumber: { required: true, type: 'string', pattern: /^[A-Z0-9\-_]+$/, maxLength: 100 },
        admin_notes: { type: 'string', maxLength: 2000, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_no_contest_input', userId, { errors: validation.errors, bidNumber });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    await markBidAsNoContest({
      bid_number: bidNumber,
      awarded_by: userId,
      admin_notes: admin_notes || undefined,
    });

    logSecurityEvent('bid_marked_no_contest', userId, { bidNumber });
    
    const response = NextResponse.json({ 
      success: true,
      message: `Bid #${bidNumber} marked as "No Contest". All carriers have been notified.`
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    
  } catch (error: any) {
    console.error('Error marking bid as no contest:', error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('no_contest_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to mark bid as no contest",
        details: process.env.NODE_ENV === 'development' 
          ? (error.message || 'Failed to mark bid as no contest')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

