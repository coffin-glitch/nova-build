import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const AcceptSchema = z.object({
  accepted_price: z.coerce.number().positive().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  await requireApiAdmin(request);
  const { offerId } = await params;
  const id = Number(offerId);
  const body = await request.json().catch(() => ({}));
  const parse = AcceptSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ ok:false, errors: parse.error.flatten() }, { status: 400 });

  const offerRows = await sql`select load_rr_number, supabase_user_id from load_offers where id = ${id} limit 1`;
  if (!offerRows.length) return NextResponse.json({ ok:false, error:"Offer not found" }, { status:404 });

  const { load_rr_number, supabase_user_id } = offerRows[0] as any;
  const accepted_price = parse.data.accepted_price ?? null;

  await sql.begin(async (trx) => {
    await trx`update load_offers set status='accepted', updated_at=now() where id = ${id}`;
    await trx`
      insert into assignments (load_rr_number, supabase_user_id, accepted_price)
      values (${load_rr_number}, ${supabase_user_id}, ${accepted_price})
    `;
  });

  return NextResponse.json({ ok:true });
}
