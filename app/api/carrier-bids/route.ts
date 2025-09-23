import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { upsertCarrierBid, getCarrierProfile } from "@/lib/auctions";
import { parseMoneyToCents, validateMoneyInput } from "@/lib/format";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { bid_number, amount, notes } = body;

    if (!bid_number || !amount) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: bid_number, amount" },
        { status: 400 }
      );
    }

    // Validate money input
    const validation = validateMoneyInput(amount.toString());
    if (!validation.isValid) {
      return NextResponse.json(
        { ok: false, error: validation.error },
        { status: 400 }
      );
    }

    const amount_cents = validation.cents!;

    // Ensure carrier profile exists
    await getCarrierProfile(userId);

    const bid = await upsertCarrierBid({
      bid_number,
      userId,
      amount_cents,
      notes,
    });

    return NextResponse.json({
      ok: true,
      data: bid,
    });
  } catch (error: any) {
    console.error("Carrier bid API error:", error);
    
    if (error.message.includes("Auction closed")) {
      return NextResponse.json(
        { ok: false, error: "Auction closed - bidding period has expired" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's carrier profile and bids
    const profile = await getCarrierProfile(userId);
    
    if (!profile) {
      return NextResponse.json({
        ok: true,
        data: {
          profile: null,
          bids: [],
        },
      });
    }

    // TODO: Implement getting user's bids summary
    // This would require a new function in auctions.ts

    return NextResponse.json({
      ok: true,
      data: {
        profile,
        bids: [],
      },
    });
  } catch (error: any) {
    console.error("Carrier bids GET API error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
