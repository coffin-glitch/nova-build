import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { awardAuction } from "@/lib/auctions";
import { getUserRoleAction } from "@/lib/actions";

export async function POST(
  request: NextRequest,
  { params }: { params: { bid_number: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const userRole = await getUserRoleAction();
    if (userRole !== "admin") {
      return NextResponse.json(
        { ok: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { winner_user_id } = body;

    if (!winner_user_id) {
      return NextResponse.json(
        { ok: false, error: "Missing required field: winner_user_id" },
        { status: 400 }
      );
    }

    const award = await awardAuction({
      bid_number: params.bid_number,
      winner_user_id,
      awarded_by: userId,
    });

    return NextResponse.json({
      ok: true,
      data: award,
    });
  } catch (error: any) {
    console.error("Award auction API error:", error);
    
    if (error.message.includes("already awarded")) {
      return NextResponse.json(
        { ok: false, error: "Auction already awarded" },
        { status: 409 }
      );
    }

    if (error.message.includes("must have an existing bid")) {
      return NextResponse.json(
        { ok: false, error: "Winner must have an existing bid for this auction" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
