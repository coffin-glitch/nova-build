import { requireApiAdmin } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import sql from "@/lib/db";

const CounterSchema = z.object({
  counter_price: z.coerce.number().positive(),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  await requireApiAdmin(request);
  const id = Number(params.id);
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
