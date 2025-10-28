import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/bids?limit=200
 * Returns recent telegram_bids rows for the admin table.
 */
export async function GET(req: Request) {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 1000);

  const rows = await sql/*sql*/`
    select
      bid_number,
      distance_miles,
      pickup_timestamp,
      delivery_timestamp,
      tag,
      received_at,
      expires_at,
      0 as stop_count
    from telegram_bids
    order by received_at desc
    limit ${limit}
  `;
  return NextResponse.json(rows);
}
