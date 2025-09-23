import 'dotenv/config';
import postgres from 'postgres';
import { chromium, Page, Frame, BrowserContext } from 'playwright';

// ---------- DB ----------
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

// ---------- helpers ----------
function money(s?: string|null){ if(!s) return null; const n=parseFloat((s||'').replace(/[^0-9.-]/g,'')); return Number.isFinite(n)?n:null; }
function int(s?: string|null){ if(!s) return null; const n=parseInt((s||'').replace(/[^0-9-]/g,''),10); return Number.isFinite(n)?n:null; }
function cityState(s?: string|null){ if(!s) return {city:null,state:null}; const t=(s||'').trim().toUpperCase(); const m=t.match(/^(.+),\s*([A-Z]{2})$/); return m?{city:m[1].trim(),state:m[2]}:{city:t||null,state:null}; }
function mdYtoISO(s?: string|null){ if(!s) return null; if(s==='00/00/00') return null; const p=s.split('/'); if(p.length!==3) return null; const [mm,dd,yy]=p; const yyyy = yy.length===2 ? (+yy>=70?1900+ +yy:2000+ +yy) : +yy; const d=new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`); return isNaN(d.getTime())?null:d.toISOString().slice(0,10); }

type Row = {
  rr_number: string;
  tm_number: string|null;
  status_code: string|null;
  pickup_date: string|null;
  pickup_window: string|null;
  delivery_date: string|null;
  delivery_window: string|null;
  revenue: number|null;
  purchase: number|null;
  net: number|null;
  margin: number|null;
  equipment: string|null;
  customer_name: string|null;
  customer_ref: string|null;
  driver_name: string|null;
  total_miles: number|null;
  origin_city: string|null;
  origin_state: string|null;
  destination_city: string|null;
  destination_state: string|null;
  vendor_name: string|null;
  dispatcher_name: string|null;
};

// Evaluate ONE page/frame and try to extract a results table using header text
async function extractFromContext(ctx: Page|Frame): Promise<{rows: Row[], headerSample?: string[], firstRow?: string[]}> {
  const data = await ctx.evaluate(() => {
    const tables = [...document.querySelectorAll('table')].map((t, idx) => {
      const rows = [...t.querySelectorAll('tr')];
      const headerTr = rows.find(r => r.querySelectorAll('th').length >= 4) || rows[0];
      const headers = headerTr ? [...headerTr.children].map(el => (el.textContent || '').replace(/\s+/g,' ').trim()) : [];
      const bodyRows = rows.slice(headerTr ? 1 : 0).map(r => [...r.children].map(td => (td as HTMLElement).innerText.replace(/\s+/g,' ').trim()));
      const cellCount = t.querySelectorAll('td').length;
      const hasRR   = headers.some(h => /RR#/.test(h));
      const hasLoad = headers.some(h => /Load#|Tm#/.test(h));
      const looksLikeResults = hasRR && hasLoad && cellCount > 40;
      const score = cellCount + (hasRR?1000:0) + (hasLoad?900:0);
      return { idx, headers, bodyRows, looksLikeResults, score };
    }).sort((a,b)=>b.score-a.score);

    const chosen = tables[0];
    return { chosen, tables: tables.slice(0,5) };
  });

  if (!data || !data.chosen || !data.chosen.bodyRows || data.chosen.bodyRows.length === 0) {
    return { rows: [] };
  }

  const H: string[] = (data.chosen.headers || []).map((h: string) => h.toUpperCase());
  const findIdx = (re: RegExp) => H.findIndex(h => re.test(h));

  const idx = {
    rr:           findIdx(/RR#/),
    loadOrTm:     findIdx(/LOAD#|TM#/),
    sts:          findIdx(/\bSTS\b/i),
    pDate:        findIdx(/PICKUP\s*DATE/i),
    pTime:        findIdx(/PICKUP\s*TIME/i),
    dDate:        findIdx(/DELIVERY\s*DATE/i),
    dTime:        findIdx(/DELIVERY\s*TIME/i),
    revenue:      findIdx(/REV\$/i),
    purchase:     findIdx(/PURCH/i),
    net:          findIdx(/\bNET\b/i),
    margin:       findIdx(/MRG\$/i),
    equipment:    findIdx(/^EQP$|EQUIP/i),
    custName:     findIdx(/CUST\s*NM|CUSTOMER/i),
    custRef:      findIdx(/CUST\s*REF|REF#/i),
    driver:       findIdx(/DRIVER/i),
    miles:        findIdx(/TOT\s*MILES|MILES/i),
    origin:       findIdx(/^ORIGIN$/i),
    destination:  findIdx(/^DESTINATION$/i),
    vendor:       findIdx(/^VENDOR$/i),
    dispatcher:   findIdx(/^DISPATCHER$/i),
  };

  const rows: Row[] = [];
  for (const r of data.chosen.bodyRows as string[][]) {
    const rr = idx.rr >= 0 ? (r[idx.rr] || '').trim() : '';
    if (!rr || !/^\d{5,}$/.test(rr)) continue;

    const originText = idx.origin >= 0 ? r[idx.origin] : '';
    const destText   = idx.destination >= 0 ? r[idx.destination] : '';
    const oc = cityState(originText);
    const dc = cityState(destText);

    rows.push({
      rr_number: rr,
      tm_number: idx.loadOrTm >= 0 ? (r[idx.loadOrTm] || '').trim() : null,
      status_code: idx.sts >= 0 ? (r[idx.sts] || '').trim() : null,
      pickup_date: mdYtoISO(idx.pDate >= 0 ? r[idx.pDate] : null),
      pickup_window: idx.pTime >= 0 ? (r[idx.pTime] || '').trim() : null,
      delivery_date: mdYtoISO(idx.dDate >= 0 ? r[idx.dDate] : null),
      delivery_window: idx.dTime >= 0 ? (r[idx.dTime] || '').trim() : null,
      revenue: money(idx.revenue >= 0 ? r[idx.revenue] : null),
      purchase: money(idx.purchase >= 0 ? r[idx.purchase] : null),
      net: money(idx.net >= 0 ? r[idx.net] : null),
      margin: money(idx.margin >= 0 ? r[idx.margin] : null),
      equipment: idx.equipment >= 0 ? (r[idx.equipment] || '').trim() : null,
      customer_name: idx.custName >= 0 ? (r[idx.custName] || '').trim() : null,
      customer_ref: idx.custRef >= 0 ? (r[idx.custRef] || '').trim() : null,
      driver_name: idx.driver >= 0 ? (r[idx.driver] || '').trim() : null,
      total_miles: int(idx.miles >= 0 ? r[idx.miles] : null),
      origin_city: oc.city, origin_state: oc.state,
      destination_city: dc.city, destination_state: dc.state,
      vendor_name: idx.vendor >= 0 ? (r[idx.vendor] || '').trim() : null,
      dispatcher_name: idx.dispatcher >= 0 ? (r[idx.dispatcher] || '').trim() : null
    });
  }

  return { rows, headerSample: data.chosen.headers, firstRow: (data.chosen.bodyRows || [])[0] };
}

async function extractEverywhere(context: BrowserContext) {
  let total: Row[] = [];
  const pages = context.pages();
  // Check the existing pages first
  for (const p of pages) {
    // Outer page
    const one = await extractFromContext(p);
    if (one.rows.length) total = total.concat(one.rows);
    // All frames
    for (const f of p.frames()) {
      const sub = await extractFromContext(f);
      if (sub.rows.length) total = total.concat(sub.rows);
    }
  }
  return total;
}

(async () => {
  // 1) Launch headful with the saved profile (so you’re logged in)
  const context = await chromium.launchPersistentContext('storage/eax-profile', {
    headless: false,
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36'
  });

  // Always keep track of new popups that appear after you click Search
  context.on('page', (p) => {
    console.log('>> New tab opened:', p.url());
  });

  // 2) Open home; you manually click to EAX SEARCH and run your search
  const base = process.env.EAX_BASE_URL || 'https://eax.shiprrexp.com';
  const page = context.pages()[0] || await context.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  console.log('\n=== NOVA EAX INGEST (interactive) ===');
  console.log('A Chromium window is open using your saved profile.');
  console.log('Do this NOW in the window:');
  console.log('  1) If asked, log in + MFA.');
  console.log('  2) Navigate to EAX SEARCH.');
  console.log('  3) Set your filters (e.g., Pickup Date range).');
  console.log('  4) Click the Search button and WAIT until the results table is fully visible.');
  console.log('When you SEE the results table with RR#/Load# columns, return to this terminal and press ENTER...');

  // Pause for Enter
  await new Promise<void>((resolve) => {
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', () => resolve());
  });

  // 3) Parse all open pages/frames
  const rows = await extractEverywhere(context);
  console.log(`Parsed rows: ${rows.length}`);

  // 4) Upsert
  if (rows.length) {
    await sql.begin(async t => {
      for (const r of rows) {
        await t`insert into public.eax_loads_raw (
          rr_number, tm_number, status_code, pickup_date, pickup_window,
          delivery_date, delivery_window, revenue, purchase, net, margin,
          equipment, customer_name, customer_ref, driver_name, total_miles,
          origin_city, origin_state, destination_city, destination_state, vendor_name, dispatcher_name
        ) values (
          ${r.rr_number}, ${r.tm_number}, ${r.status_code}, ${r.pickup_date}, ${r.pickup_window},
          ${r.delivery_date}, ${r.delivery_window}, ${r.revenue}, ${r.purchase}, ${r.net}, ${r.margin},
          ${r.equipment}, ${r.customer_name}, ${r.customer_ref}, ${r.driver_name}, ${r.total_miles},
          ${r.origin_city}, ${r.origin_state}, ${r.destination_city}, ${r.destination_state}, ${r.vendor_name}, ${r.dispatcher_name}
        )`;
        await t`insert into public.loads as l (
          rr_number, tm_number, status_code, pickup_date, pickup_window,
          delivery_date, delivery_window, revenue, purchase, net, margin,
          equipment, customer_name, customer_ref, driver_name, total_miles,
          origin_city, origin_state, destination_city, destination_state, vendor_name, dispatcher_name, updated_at
        ) values (
          ${r.rr_number}, ${r.tm_number}, ${r.status_code}, ${r.pickup_date}, ${r.pickup_window},
          ${r.delivery_date}, ${r.delivery_window}, ${r.revenue}, ${r.purchase}, ${r.net}, ${r.margin},
          ${r.equipment}, ${r.customer_name}, ${r.customer_ref}, ${r.driver_name}, ${r.total_miles},
          ${r.origin_city}, ${r.origin_state}, ${r.destination_city}, ${r.destination_state}, ${r.vendor_name}, ${r.dispatcher_name}, now()
        )
        on conflict (rr_number) do update set
          tm_number = excluded.tm_number,
          status_code = excluded.status_code,
          pickup_date = excluded.pickup_date,
          pickup_window = excluded.pickup_window,
          delivery_date = excluded.delivery_date,
          delivery_window = excluded.delivery_window,
          revenue = excluded.revenue,
          purchase = excluded.purchase,
          net = excluded.net,
          margin = excluded.margin,
          equipment = excluded.equipment,
          customer_name = excluded.customer_name,
          customer_ref = excluded.customer_ref,
          driver_name = excluded.driver_name,
          total_miles = excluded.total_miles,
          origin_city = excluded.origin_city,
          origin_state = excluded.origin_state,
          destination_city = excluded.destination_city,
          destination_state = excluded.destination_state,
          vendor_name = excluded.vendor_name,
          dispatcher_name = excluded.dispatcher_name,
          updated_at = now()`;
      }
    });
  }

  await sql.end({ timeout: 0 });
  console.log('Ingest complete. You can close the Chromium window.');
  await context.close();
})();
