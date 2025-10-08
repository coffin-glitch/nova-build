import { NextResponse } from "next/server";
import sql from "@/lib/db.server";

// Utility to build ILIKE patterns safely
function ilike(s?: string|null) {
  if (!s) return null;
  const v = s.trim();
  if (!v) return null;
  return `%${v.replace(/[%_]/g, '')}%`;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const {
    q,
    origin,
    destination,
    equipment,
    pickupFrom, // ISO yyyy-mm-dd
    pickupTo,   // ISO yyyy-mm-dd
    milesMin,
    milesMax,
    limit = 60,
    offset = 0,
  } = body || {};

  const oLike = ilike(origin);
  const dLike = ilike(destination);
  const qLike = ilike(q);
  const eLike = ilike(equipment);

  // Build dynamic WHERE
  // Always published=true
  const clauses: string[] = ['published = true'];
  const params: any[] = [];

  if (oLike) { params.push(oLike); clauses.push(`(concat_ws(', ', origin_city, origin_state) ILIKE $${params.length})`); }
  if (dLike) { params.push(dLike); clauses.push(`(concat_ws(', ', destination_city, destination_state) ILIKE $${params.length})`); }
  if (eLike) { params.push(eLike); clauses.push(`(equipment ILIKE $${params.length})`); }
  if (qLike) {
    params.push(qLike, qLike, qLike, qLike);
    clauses.push(`(
      rr_number::text ILIKE $${params.length-3}
      OR coalesce(origin_city,'') ILIKE $${params.length-2}
      OR coalesce(destination_city,'') ILIKE $${params.length-1}
      OR coalesce(equipment,'') ILIKE $${params.length}
    )`);
  }
  if (pickupFrom) { params.push(pickupFrom); clauses.push(`(pickup_date >= $${params.length})`); }
  if (pickupTo)   { params.push(pickupTo);   clauses.push(`(pickup_date <= $${params.length})`); }
  if (milesMin != null && milesMin !== '') { params.push(Number(milesMin)); clauses.push(`(coalesce(total_miles,0) >= $${params.length})`); }
  if (milesMax != null && milesMax !== '') { params.push(Number(milesMax)); clauses.push(`(coalesce(total_miles,0) <= $${params.length})`); }

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const where = clauses.length ? `where ${clauses.join(' AND ')}` : '';
  const rows = await sql/*sql*/`
    select rr_number, equipment, total_miles, revenue, purchase, margin,
           origin_city, origin_state, destination_city, destination_state,
           pickup_date, delivery_date, updated_at
    from public.loads
    ${sql.unsafe(where.replace(/\$(\d+)/g, (_:any,n:string)=>`$${Number(n)}`))}
    order by pickup_date nulls last, updated_at desc
    limit ${sql.unsafe(`$${limitIdx}`)} offset ${sql.unsafe(`$${offsetIdx}`)}
  `(...params);

  return NextResponse.json({ rows });
}
