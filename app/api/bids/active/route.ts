import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET() {
  const rows = await sql.unsafe(`
    select id, bid_code, distance_miles, message_posted_at, expires_at, is_usps, tags
      from public.bids
     where status='ACTIVE' and expires_at > now()
     order by message_posted_at desc
     limit 200
  `);
  return NextResponse.json({ bids: rows });
}
