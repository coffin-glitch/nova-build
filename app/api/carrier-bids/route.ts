import { getCarrierProfile, upsertCarrierBid, validateCarrierProfileComplete } from "@/lib/auctions";
import { validateMoneyInput } from "@/lib/format";
import { requireApiCarrier } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Ensure user is carrier (Supabase-only)
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

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

    // Validate that carrier profile is 100% complete before allowing bidding
    const profileValidation = await validateCarrierProfileComplete(userId);
    if (!profileValidation.isComplete) {
      const missingFieldsText = profileValidation.missingFields.join(', ');
      return NextResponse.json(
        { ok: false, error: `Profile incomplete. Please complete the following required fields: ${missingFieldsText}. Go to your profile page to update your information.` },
        { status: 400 }
      );
    }

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
    // Ensure user is carrier (Supabase-only)
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

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
