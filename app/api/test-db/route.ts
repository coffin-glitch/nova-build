import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

export async function GET() {
  try {
    const { rows } = await dbQuery<{ now: string }>("select now()");
    return NextResponse.json({ ok: true, now: rows[0].now });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
