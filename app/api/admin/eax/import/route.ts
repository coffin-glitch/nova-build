import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import sql from "@/lib/db";
import * as XLSX from "xlsx";

const RowSchema = z.object({
  rr_number: z.string().min(1),
  tm_number: z.string().optional().nullable(),
  status_code: z.string().optional().nullable(),
  pickup_date: z.string().optional().nullable(),
  pickup_window: z.string().optional().nullable(),
  delivery_date: z.string().optional().nullable(),
  delivery_window: z.string().optional().nullable(),
  equipment: z.string().optional().nullable(),
  total_miles: z.coerce.number().optional().nullable(),
  revenue: z.coerce.number().optional().nullable(),
  purchase: z.coerce.number().optional().nullable(),
  net: z.coerce.number().optional().nullable(),
  margin: z.coerce.number().optional().nullable(),
  customer_name: z.string().optional().nullable(),
  customer_ref: z.string().optional().nullable(),
  driver_name: z.string().optional().nullable(),
  origin_city: z.string().optional().nullable(),
  origin_state: z.string().optional().nullable(),
  destination_city: z.string().optional().nullable(),
  destination_state: z.string().optional().nullable(),
  vendor_name: z.string().optional().nullable(),
  dispatcher_name: z.string().optional().nullable(),
});

function normalizeMoney(v: any) {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function normalizeMiles(v: any) {
  if (v == null) return null;
  const n = parseInt(String(v).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}
function normalizeDate(v: any) {
  if (!v) return null;
  // Accept variants like MM/DD/YY, MM/DD/YYYY
  const s = String(v).trim();
  if (s === "00/00/00") return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let [_, mm, dd, yy] = m;
  let yyyy = parseInt(yy, 10);
  if (yy.length === 2) yyyy = yyyy >= 70 ? 1900 + yyyy : 2000 + yyyy;
  const pad = (n:number)=>String(n).padStart(2,"0");
  return `${yyyy}-${pad(parseInt(mm))}-${pad(parseInt(dd))}`;
}
function cityStateSplit(s: any) {
  if (!s) return { city: null, state: null };
  const t = String(s).trim().toUpperCase();
  const m = t.match(/^(.+?),\s*([A-Z]{2})$/);
  if (!m) return { city: t || null, state: null };
  return { city: m[1].trim(), state: m[2] };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      logSecurityEvent('eax_import_no_file', userId);
      const response = NextResponse.json(
        { ok: false, error: "Missing file" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      logSecurityEvent('eax_import_size_exceeded', userId, { 
        fileSize: file.size,
        fileName: file.name
      });
      const response = NextResponse.json(
        { ok: false, error: "File size exceeds 50MB limit" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      logSecurityEvent('eax_import_invalid_type', userId, { 
        fileName: file.name,
        fileType: file.type
      });
      const response = NextResponse.json(
        { ok: false, error: "Only Excel files (.xlsx, .xls) are supported" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });

  // Use the first sheet
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const rowsRaw: any[] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });

  // Attempt to map columns by name (case-insensitive)
  const mapKey = (o: any, keys: string[]) => {
    for (const k of Object.keys(o)) {
      if (keys.includes(k.trim().toLowerCase())) return o[k];
    }
    return null;
  };

  const normalized = rowsRaw.map((r) => {
    const lower: Record<string, any> = {};
    for (const k of Object.keys(r)) lower[k.trim().toLowerCase()] = r[k];

    const origin = cityStateSplit(mapKey(lower, ["origin", "origin_city", "origin city"]));
    const dest = cityStateSplit(mapKey(lower, ["destination", "destination_city", "destination city"]));

    const obj = {
      rr_number: String(mapKey(lower, ["rr#", "rr_number", "rr number", "rr"] ) || "").trim(),
      tm_number: mapKey(lower, ["tm#", "tm_number", "load#", "load number", "tm"]),
      status_code: mapKey(lower, ["sts", "status", "status_code"]),
      pickup_date: normalizeDate(mapKey(lower, ["pickup date", "pickup_date"])),
      pickup_window: mapKey(lower, ["pickup time", "pickup window", "pickup_window"]),
      delivery_date: normalizeDate(mapKey(lower, ["delivery date", "delivery_date"])),
      delivery_window: mapKey(lower, ["delivery time", "delivery window", "delivery_window"]),
      equipment: mapKey(lower, ["eqp", "equipment"]),
      total_miles: normalizeMiles(mapKey(lower, ["tot miles", "total miles", "miles"])),
      revenue: normalizeMoney(mapKey(lower, ["rev$", "revenue"])),
      purchase: normalizeMoney(mapKey(lower, ["purch tr$", "purchase"])),
      net: normalizeMoney(mapKey(lower, ["net"])),
      margin: normalizeMoney(mapKey(lower, ["mrg$", "margin"])),
      customer_name: mapKey(lower, ["cust nm", "customer", "customer_name"]),
      customer_ref: mapKey(lower, ["cust ref#", "customer ref#", "customer_ref"]),
      driver_name: mapKey(lower, ["driver nm", "driver", "driver_name"]),
      origin_city: origin.city, origin_state: origin.state,
      destination_city: dest.city, destination_state: dest.state,
      vendor_name: mapKey(lower, ["vendor", "vendor_name"]),
      dispatcher_name: mapKey(lower, ["dispatcher", "dispatcher_name"]),
    };

    // zod: coerce numeric fields safely
    const safe = RowSchema.safeParse(obj);
    if (!safe.success) {
      return { __invalid: true, errors: safe.error.flatten(), raw: r };
    }
    return safe.data;
  });

  const validRows = normalized.filter((r: any) => !r.__invalid && r.rr_number) as Array<z.infer<typeof RowSchema>>;
  const invalid = normalized.filter((r: any) => r.__invalid);

    if (!validRows.length) {
      logSecurityEvent('eax_import_no_valid_rows', userId, { 
        totalRows: rowsRaw.length,
        invalidCount: invalid.length
      });
      const response = NextResponse.json(
        { ok: false, inserted: 0, updated: 0, skipped: rowsRaw.length, invalid },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

  let inserted = 0;
  let updated = 0;

  // Transactional upsert into eax_loads_raw and loads mirrored
  await sql.begin(async (trx) => {
    for (const r of validRows) {
      // 1) raw
      await trx/*sql*/`
        insert into public.eax_loads_raw
          (rr_number, tm_number, status_code, pickup_date, pickup_window, delivery_date, delivery_window,
           equipment, total_miles, revenue, purchase, net, margin, customer_name, customer_ref, driver_name,
           origin_city, origin_state, destination_city, destination_state, vendor_name, dispatcher_name, updated_at)
        values
          (${r.rr_number}, ${r.tm_number ?? null}, ${r.status_code ?? null}, ${r.pickup_date ?? null}, ${r.pickup_window ?? null}, ${r.delivery_date ?? null}, ${r.delivery_window ?? null},
           ${r.equipment ?? null}, ${r.total_miles ?? null}, ${r.revenue ?? null}, ${r.purchase ?? null}, ${r.net ?? null}, ${r.margin ?? null}, ${r.customer_name ?? null}, ${r.customer_ref ?? null}, ${r.driver_name ?? null},
           ${r.origin_city ?? null}, ${r.origin_state ?? null}, ${r.destination_city ?? null}, ${r.destination_state ?? null}, ${r.vendor_name ?? null}, ${r.dispatcher_name ?? null}, now())
        on conflict (rr_number) do update set
           tm_number = excluded.tm_number,
           status_code = excluded.status_code,
           pickup_date = excluded.pickup_date,
           pickup_window = excluded.pickup_window,
           delivery_date = excluded.delivery_date,
           delivery_window = excluded.delivery_window,
           equipment = excluded.equipment,
           total_miles = excluded.total_miles,
           revenue = excluded.revenue,
           purchase = excluded.purchase,
           net = excluded.net,
           margin = excluded.margin,
           customer_name = excluded.customer_name,
           customer_ref = excluded.customer_ref,
           driver_name = excluded.driver_name,
           origin_city = excluded.origin_city,
           origin_state = excluded.origin_state,
           destination_city = excluded.destination_city,
           destination_state = excluded.destination_state,
           vendor_name = excluded.vendor_name,
           dispatcher_name = excluded.dispatcher_name,
           updated_at = now()
      `;
      // 2) mirror to loads (leave published as-is)
      const res = await trx/*sql*/`
        insert into public.loads
          (rr_number, tm_number, status_code, pickup_date, pickup_window, delivery_date, delivery_window,
           equipment, total_miles, revenue, purchase, net, margin, customer_name, customer_ref, driver_name,
           origin_city, origin_state, destination_city, destination_state, vendor_name, dispatcher_name, published, created_at, updated_at)
        values
          (${r.rr_number}, ${r.tm_number ?? null}, ${r.status_code ?? null}, ${r.pickup_date ?? null}, ${r.pickup_window ?? null}, ${r.delivery_date ?? null}, ${r.delivery_window ?? null},
           ${r.equipment ?? null}, ${r.total_miles ?? null}, ${r.revenue ?? null}, ${r.purchase ?? null}, ${r.net ?? null}, ${r.margin ?? null}, ${r.customer_name ?? null}, ${r.customer_ref ?? null}, ${r.driver_name ?? null},
           ${r.origin_city ?? null}, ${r.origin_state ?? null}, ${r.destination_city ?? null}, ${r.destination_state ?? null}, ${r.vendor_name ?? null}, ${r.dispatcher_name ?? null}, false, now(), now())
        on conflict (rr_number) do update set
           tm_number = excluded.tm_number,
           status_code = excluded.status_code,
           pickup_date = excluded.pickup_date,
           pickup_window = excluded.pickup_window,
           delivery_date = excluded.delivery_date,
           delivery_window = excluded.delivery_window,
           equipment = excluded.equipment,
           total_miles = excluded.total_miles,
           revenue = excluded.revenue,
           purchase = excluded.purchase,
           net = excluded.net,
           margin = excluded.margin,
           customer_name = excluded.customer_name,
           customer_ref = excluded.customer_ref,
           driver_name = excluded.driver_name,
           origin_city = excluded.origin_city,
           origin_state = excluded.origin_state,
           destination_city = excluded.destination_city,
           destination_state = excluded.destination_state,
           vendor_name = excluded.vendor_name,
           dispatcher_name = excluded.dispatcher_name,
           updated_at = now()
        returning xmax = 0 as inserted
      `;
      if (res?.[0]?.inserted) inserted++; else updated++;
    }
  });

    logSecurityEvent('eax_import_success', userId, { 
      fileName: file.name,
      fileSize: file.size,
      inserted,
      updated,
      skipped: invalid.length,
      invalidCount: invalid.length
    });
    
    const response = NextResponse.json({ 
      ok: true, 
      inserted, 
      updated, 
      skipped: invalid.length, 
      invalidCount: invalid.length 
    });
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("EAX import error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('eax_import_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        ok: false,
        error: "Failed to import EAX file",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}