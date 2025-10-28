import { NextResponse } from "next/server";
import { z } from "zod";
import sql from "@/lib/db.server";
import { requireAdmin } from "@/lib/auth";

const CounterSchema = z.object({
  counter_price: z.coerce.number().positive(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const id = Number(params.id);
  const body = await req.json().catch(() => ({}));
  const parse = CounterSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ ok:false, errors: parse.error.flatten() }, { status: 400 });

  await sql/*sql*/`
    update public.load_offers
       set status='counter', notes = coalesce(notes,'') || E'\n[Counter] ' || ${parse.data.counter_price}, updated_at=now()
     where id = ${id}
  `;
  return NextResponse.json({ ok:true });
}
