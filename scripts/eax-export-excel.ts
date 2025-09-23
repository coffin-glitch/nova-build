import 'dotenv/config';
import { chromium, Download } from 'playwright';
import postgres from 'postgres';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const BASE = process.env.EAX_BASE_URL || 'https://eax.shiprrexp.com';
const STORAGE = 'storage/eax-profile';
const TMP = 'debug/downloads';
const DATABASE_URL = process.env.DATABASE_URL!;
if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");

type Row = Record<string, any>;

function cityState(s?: string|null) {
  if (!s) return { city: null, state: null };
  const t = s.trim().toUpperCase();
  const m = t.match(/^(.+),\s*([A-Z]{2})$/);
  return m ? { city: m[1].trim(), state: m[2] } : { city: t || null, state: null };
}

function money(s?: any) {
  if (s == null) return null;
  const n = parseFloat(String(s).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function int(s?: any) {
  if (s == null) return null;
  const n = parseInt(String(s).replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

async function parseXlsx(filePath: string): Promise<Row[]> {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Row[] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });

  // Map common column names you showed from EAX into our schema fields
  // You may need to tweak these keys once after inspecting a real export header.
  return rows.map((r) => {
    const origin = cityState(r["Origin"] ?? r["Origin City"]);
    const dest = cityState(r["Destination"] ?? r["Destination City"]);
    return {
      rr_number: r["RR#"] ?? r["RR"] ?? null,
      tm_number: r["Load#"] ?? r["Tm#"] ?? null,
      status_code: r["Sts"] ?? r["Status"] ?? null,
      pickup_date: r["Pickup Date"] ?? null,
      pickup_window: r["Pickup Time"] ?? null,
      delivery_date: r["Delivery Date"] ?? null,
      delivery_window: r["Delivery Time"] ?? null,
      revenue: money(r["Rev$"]),
      purchase: money(r["Purch Tr$"]),
      net: money(r["Net"]),
      margin: money(r["Mrg$"]),
      equipment: r["Eqp"] ?? null,
      customer_name: r["Cust Nm"] ?? r["Customer"] ?? null,
      customer_ref: r["Cust Ref#"] ?? null,
      driver_name: r["Driver Nm"] ?? null,
      total_miles: int(r["Tot Miles"]),
      origin_city: origin.city,
      origin_state: origin.state,
      destination_city: dest.city,
      destination_state: dest.state,
      vendor_name: r["Vendor"] ?? null,
      dispatcher_name: r["Dispatcher"] ?? null,
    };
  }).filter(x => x.rr_number);
}

async function ingest(rows: Row[]) {
  const sql = postgres(DATABASE_URL, { ssl: 'require' });
  await sql/*sql*/`
    create table if not exists public.loads (
      rr_number text primary key,
      tm_number text,
      status_code text,
      pickup_date text,
      pickup_window text,
      delivery_date text,
      delivery_window text,
      equipment text,
      total_miles int,
      revenue numeric,
      purchase numeric,
      net numeric,
      margin numeric,
      customer_name text,
      customer_ref text,
      driver_name text,
      origin_city text,
      origin_state text,
      destination_city text,
      destination_state text,
      vendor_name text,
      dispatcher_name text,
      published boolean default false,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );
  `;

  for (const r of rows) {
    await sql/*sql*/`
      insert into public.loads
        (rr_number, tm_number, status_code, pickup_date, pickup_window, delivery_date, delivery_window,
         equipment, total_miles, revenue, purchase, net, margin, customer_name, customer_ref, driver_name,
         origin_city, origin_state, destination_city, destination_state, vendor_name, dispatcher_name, updated_at)
      values
        (${r.rr_number}, ${r.tm_number}, ${r.status_code}, ${r.pickup_date}, ${r.pickup_window}, ${r.delivery_date}, ${r.delivery_window},
         ${r.equipment}, ${r.total_miles}, ${r.revenue}, ${r.purchase}, ${r.net}, ${r.margin}, ${r.customer_name}, ${r.customer_ref}, ${r.driver_name},
         ${r.origin_city}, ${r.origin_state}, ${r.destination_city}, ${r.destination_state}, ${r.vendor_name}, ${r.dispatcher_name}, now())
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
        updated_at = now();
    `;
  }
  await sql.end();
}

async function run() {
  fs.mkdirSync(TMP, { recursive: true });

  const ctx = await chromium.launchPersistentContext(STORAGE, { headless: false });
  const page = ctx.pages()[0] || await ctx.newPage();

  // Go to EAX home (you should be already logged-in in this profile)
  await page.goto(BASE, { waitUntil: "domcontentloaded" });

  // You may need to navigate to EAX SEARCH page manually if menu requires clicks.
  // PAUSE here so you can set filters & click Search yourself:
  console.log("🔵 A Chromium window is open. 1) Go to EAX SEARCH  2) Set filters  3) Click Search  4) Click the Export/Download button");
  console.log("When the file dialog or download starts, I’ll capture it automatically. Waiting for a download...");

  const download: Download = await page.waitForEvent("download", { timeout: 180000 });
  const suggested = download.suggestedFilename();
  const dest = path.join(TMP, suggested);
  await download.saveAs(dest);
  console.log("✅ Downloaded:", dest);

  const rows = await parseXlsx(dest);
  console.log("Parsed rows:", rows.length);

  await ingest(rows);
  console.log("✅ Ingest complete.");

  await ctx.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
