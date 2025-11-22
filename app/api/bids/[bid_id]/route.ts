import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { getBidSummary } from "@/lib/auctions";
import { requireApiAuth, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bid_id: string }> }
) {
  try {
    // Ensure user is authenticated (Supabase-only)
    const auth = await requireApiAuth(request);
    const userId = auth.userId;
    const { bid_id } = await params;
    const bid_number = bid_id;

    // Input validation
    const validation = validateInput(
      { bid_id },
      {
        bid_id: { required: true, type: 'string', maxLength: 100 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_bid_details_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { ok: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const summary = await getBidSummary(bid_number, userId);

    if (!summary) {
      const response = NextResponse.json(
        { ok: false, error: "Bid not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    logSecurityEvent('bid_details_accessed', userId, { bidNumber: bid_number });
    
    const response = NextResponse.json({
      ok: true,
      data: summary,
    });
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Bid details API error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Authentication required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('bid_details_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        ok: false,
        error: process.env.NODE_ENV === 'development' 
          ? error.message
          : "Failed to fetch bid details"
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
