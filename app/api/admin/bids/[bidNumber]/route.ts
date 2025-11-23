import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ bidNumber: string }> }
) {
  try {
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
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    const { bidNumber } = await params;

    // Input validation
    const validation = validateInput(
      { bidNumber },
      {
        bidNumber: { required: true, type: 'string', pattern: /^[A-Z0-9\-_]+$/, maxLength: 100 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_bid_delete_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!bidNumber) {
      const response = NextResponse.json(
        { error: "Bid number is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // First delete carrier bids for this bid number
    await sql`
      DELETE FROM carrier_bids 
      WHERE bid_number = ${bidNumber}
    `;

    // Then delete the telegram bid
    const result = await sql`
      DELETE FROM telegram_bids 
      WHERE bid_number = ${bidNumber}
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Bid not found" },
        { status: 404 }
      );
    }

    logSecurityEvent('bid_deleted', userId, { bidNumber });
    
    const response = NextResponse.json({
      success: true,
      message: `Bid ${bidNumber} deleted successfully`
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Delete bid error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('bid_delete_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        error: "Failed to delete bid",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
