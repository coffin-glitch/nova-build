import { auth } from "@clerk/nextjs/server";
import sql from "@/lib/db";
import { NextResponse } from "next/server";

// GET /api/admin/loads?search=&published=true|false|all&limit=100&offset=0
export async function GET(req: Request) {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const search = (url.searchParams.get("search") || "").trim();
  const pub = url.searchParams.get("published") || "all";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 500);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);

  // Build WHERE
  const where: string[] = [];
  const params: any[] = [];
  if (pub === "true") where.push("published = true");
  if (pub === "false") where.push("published = false");
  if (search) {
    params.push(`%${search.toUpperCase()}%`);
    where.push(`(
      upper(rr_number) like $${params.length} or
      upper(tm_number) like $${params.length} or
      upper(customer_name) like $${params.length} or
      upper(origin_city) like $${params.length} or
      upper(destination_city) like $${params.length}
    )`);
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const rows = await sql.unsafe(`
    select rr_number, tm_number, status_code, pickup_date, pickup_window,
           delivery_date, delivery_window, revenue, purchase, net, margin,
           equipment, customer_name, driver_name, total_miles,
           origin_city, origin_state, destination_city, destination_state,
           vendor_name, dispatcher_name, updated_at, published
    from public.loads
    ${whereSql}
    order by coalesce(pickup_date, delivery_date) nulls last, rr_number
    limit ${limit} offset ${offset}
  `, params);

  return NextResponse.json({ rows });
}
