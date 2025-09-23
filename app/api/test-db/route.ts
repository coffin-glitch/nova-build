import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { useLocalDb } from "@/lib/db";

export async function GET() {
  try {
    // Use different queries based on database type
    if (useLocalDb) {
      const rows = await sql`SELECT datetime('now') as now`;
      return NextResponse.json({ ok: true, now: rows[0].now });
    } else {
      const rows = await sql`SELECT now() as now`;
      return NextResponse.json({ ok: true, now: rows[0].now });
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
