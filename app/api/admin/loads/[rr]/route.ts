import { auth } from "@clerk/nextjs/server";
import sql from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: { rr: string } }
) {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const rr = decodeURIComponent(params.rr);
  const body = await req.json().catch(() => ({}));
  const published = !!body.published;

  const result = await sql/*sql*/`
    update public.loads
       set published = ${published}, updated_at = now()
     where rr_number = ${rr}
     returning rr_number, published
  `;
  if (result.length === 0) return new NextResponse("Not Found", { status: 404 });
  return NextResponse.json(result[0]);
}