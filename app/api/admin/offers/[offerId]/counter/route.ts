import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const CounterSchema = z.object({
  counter_price: z.coerce.number().positive(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  await requireApiAdmin(request);
  const { offerId } = await params;
  const id = Number(offerId);
  const body = await request.json().catch(() => ({}));
  const parse = CounterSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ ok:false, errors: parse.error.flatten() }, { status: 400 });

  await sql/*sql*/`
    update public.load_offers
       set status='counter', notes = coalesce(notes,'') || E'\n[Counter] ' || ${parse.data.counter_price}, updated_at=now()
     where id = ${id}
  `;
  return NextResponse.json({ ok:true });
}
