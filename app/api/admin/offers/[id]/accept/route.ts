import { NextResponse } from "next/server";
import { z } from "zod";
import sql from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const AcceptSchema = z.object({
  accepted_price: z.coerce.number().positive().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const id = Number(params.id);
  const body = await req.json().catch(() => ({}));
  const parse = AcceptSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ ok:false, errors: parse.error.flatten() }, { status: 400 });

  const offerRows = await sql/*sql*/`select load_rr, clerk_user_id from public.load_offers where id = ${id} limit 1`;
  if (!offerRows.length) return NextResponse.json({ ok:false, error:"Offer not found" }, { status:404 });

  const { load_rr, clerk_user_id } = offerRows[0] as any;
  const accepted_price = parse.data.accepted_price ?? null;

  await sql.begin(async (trx) => {
    await trx/*sql*/`update public.load_offers set status='accepted', updated_at=now() where id = ${id}`;
    await trx/*sql*/`
      insert into public.assignments (load_rr, clerk_user_id, accepted_price)
      values (${load_rr}, ${clerk_user_id}, ${accepted_price})
    `;
  });

  return NextResponse.json({ ok:true });
}
