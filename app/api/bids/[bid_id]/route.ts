import { requireApiAuth } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";
import { getBidSummary } from "@/lib/auctions";

export async function GET(
  request: NextRequest,
  { params }: { params: { bid_number: string } }
) {
  try {
    // Ensure user is authenticated (Supabase-only)
    const auth = await requireApiAuth(request);
    const userId = auth.userId;
    const { bid_number } = params;

    const summary = await getBidSummary(bid_number, userId);

    if (!summary) {
      return NextResponse.json(
        { ok: false, error: "Bid not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: summary,
    });
  } catch (error: any) {
    console.error("Bid details API error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
