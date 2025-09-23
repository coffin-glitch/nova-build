import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import sql from "@/lib/db";
import { createOfferSchema } from "@/lib/validators";

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = createOfferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }

  const { rr, amount, notes } = parsed.data;

  // Ensure load exists & is published
  const [load] = await sql/*sql*/`
    select rr_number from public.loads
     where rr_number = ${rr} and published = true
     limit 1
  `;
  if (!load) return new NextResponse("Load not found or not available", { status: 404 });

  // Insert offer
  const rows = await sql/*sql*/`
    insert into public.load_offers (rr_number, user_id, amount, notes, status)
    values (${rr}, ${userId}, ${amount}, ${notes ?? null}, 'PENDING')
    returning id, rr_number, user_id, amount, notes, status, created_at
  `;
  return NextResponse.json(rows[0]);
}