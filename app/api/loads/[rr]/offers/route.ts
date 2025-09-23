import { requireSignedIn } from "@/lib/auth";
import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// GET list offers for a load
export async function GET(
  _req: Request,
  { params }: { params: { rr: string } }
) {
  const rr = decodeURIComponent(params.rr);
  const offers = await sql/*sql*/`
    select o.id, o.amount_cents, o.note, o.created_at, o.user_id
      from public.load_offers o
     where o.rr_number = ${rr}
     order by o.amount_cents asc, o.created_at asc
     limit 500
  `;
  return NextResponse.json({ offers });
}

// POST place offer
export async function POST(
  req: Request,
  { params }: { params: { rr: string } }
) {
  await requireSignedIn();
  const { userId } = auth();
  const rr = decodeURIComponent(params.rr);
  if (!userId || !rr) return new NextResponse("Bad request", { status: 400 });

  const body = await req.json().catch(()=>({}));
  const amount = Number(body.amount);
  const note = (body.note || "").toString().slice(0, 500);
  if (!Number.isFinite(amount) || amount <= 0) {
    return new NextResponse("Invalid amount", { status: 400 });
  }

  const inserted = await sql/*sql*/`
    insert into public.load_offers (rr_number, user_id, amount_cents, note)
    values (${rr}, ${userId}, ${Math.round(amount * 100)}, ${note})
    returning id, rr_number, user_id, amount_cents, note, created_at
  `;
  return NextResponse.json(inserted[0], { status: 201 });
}
