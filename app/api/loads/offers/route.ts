import { requireApiCarrier } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET list offers for a load
export async function GET(
  request: NextRequest
) {
  const { searchParams } = new URL(request.url);
  const rr = searchParams.get('rrNumber');
  
  if (!rr) {
    return NextResponse.json({ error: "rrNumber parameter is required" }, { status: 400 });
  }

  // Get offers (Supabase-only)
  const offers = await sql`
    select o.id, o.amount_cents, o.note, o.created_at, o.supabase_user_id as user_id
      from load_offers o
     where o.load_rr_number = ${rr}
     order by o.offer_amount asc, o.created_at asc
     limit 500
  `;
  return NextResponse.json({ offers });
}

// POST place offer
export async function POST(
  request: NextRequest
) {
  // Ensure user is carrier (Supabase-only)
  const auth = await requireApiCarrier(request);
  const userId = auth.userId;
  
  const { searchParams } = new URL(request.url);
  const rr = searchParams.get('rrNumber');
  
  if (!rr) return new NextResponse("Bad request", { status: 400 });

  const body = await request.json().catch(()=>({}));
  const amount = Number(body.amount);
  const note = (body.note || "").toString().slice(0, 500);
  if (!Number.isFinite(amount) || amount <= 0) {
    return new NextResponse("Invalid amount", { status: 400 });
  }

  // Insert offer (Supabase-only)
  const inserted = await sql`
    insert into load_offers (load_rr_number, supabase_user_id, offer_amount, notes)
    values (${rr}, ${userId}, ${Math.round(amount * 100)}, ${note})
    returning id, load_rr_number, supabase_user_id as user_id, offer_amount as amount_cents, notes as note, created_at
  `;
  return NextResponse.json(inserted[0], { status: 201 });
}
