import 'dotenv/config';
import postgres from 'postgres';
import { chromium, Page, Frame } from 'playwright';

// ---------- DB ----------
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

// ---------- small helpers ----------
function money(s?: string|null){ if(!s) return null; const n=parseFloat((s||'').replace(/[^0-9.-]/g,'')); return Number.isFinite(n)?n:null; }
function int(s?: string|null){ if(!s) return null; const n=parseInt((s||'').replace(/[^0-9-]/g,''),10); return Number.isFinite(n)?n:null; }
function cityState(s?: string|null){ if(!s) return {city:null,state:null}; const t=(s||'').trim().toUpperCase(); const m=t.match(/^(.+),\s*([A-Z]{2})$/); return m?{city:m[1].trim(),state:m[2]}:{city:t||null,state:null}; }
function mdYtoISO(s?: string|null){ if(!s) return null; if(s==='00/00/00') return null; const parts=s.split('/'); if(parts.length!==3) return null; const [mm,dd,yy]=parts; const yyyy = yy.length===2 ? (parseInt(yy,10)>=70?1900+parseInt(yy,10):2000+parseInt(yy,10)) : parseInt(yy,10); const d=new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`); return isNaN(d.getTime())?null:d.toISOString().slice(0,10); }

// ----- Find the page or frame that actually shows results (contains "Records:" or "Pages:") -----
async function findResultsContext(page: Page): Promise<Page|Frame> {
  for (const f of page.frames()) {
    try {
      const ok = await f.evaluate(() => {
        const txt = document.body?.innerText || '';
        return /Records:\s*\d+/.test(txt) || /Pages:\s*\d+/.test(txt);
      });
      if (ok) return f;
    } catch {}
  }
  const outerOk = await page.evaluate(() => {
    const txt = document.body?.innerText || '';
    return /Records:\s*\d+/.test(txt) || /Pages:\s*\d+/.test(txt);
  });
  if (outerOk) return page;
  return page;
}

// ---- Try to submit the search ----
async function submitSearch(ctx: Page|Frame) {
  const tryClick = async (sel: string) => {
    const loc = (ctx as any).locator?.(sel);
    if (loc && await loc.count()) { await loc.first().click(); return true; }
    return false;
  };
  const candidates = [
    'button:has-text("Search")', 'button:has-text("SEARCH")',
    'input[type="submit"][value="Search"]', 'input[type="submit"][value="SEARCH"]',
    'input[type="submit"]'
  ];
  for (const sel of candidates) if (await tryClick(sel)) return;

  const from = (ctx as any).locator?.('input[name="ssFFPDT170"]');
  if (from && await from.count()) { await from.first().press('Enter'); return; }

  try {
    await (ctx as any).evaluate(() => { const f=document.querySelector('form') as HTMLFormElement|null; if (f) f.submit(); });
  } catch {}
}

// ---- FRAME-AWARE + HEADER-AWARE extraction (no named functions inside evaluate) ----
async function extractRowsFromContext(ctx: Page|Frame) {
  type Row = Record<string, any>;

  const data = await ctx.evaluate(() => {
    // collect candidate tables with headers/body
    const tables = [...document.querySelectorAll('table')].map((t, idx) => {
      const rows = [...t.querySelectorAll('tr')];
      const headerTr = rows.find(r => r.querySelectorAll('th').length >= 4) || rows[0];
      const headers = headerTr ? [...headerTr.children].map(el => (el.textContent || '').replace(/\s+/g,' ').trim()) : [];
      const bodyRows = rows.slice(headerTr ? 1 : 0).map(r => [...r.children].map(td => (td as HTMLElement).innerText.replace(/\s+/g,' ').trim()));
      const cellCount = t.querySelectorAll('td').length;
      const hasRR   = headers.some(h => /RR#/.test(h));
      const hasLoad = headers.some(h => /Load#/.test(h));
      const score = cellCount + (hasRR?1000:0) + (hasLoad?1000:0);
      return { idx, headers, bodyRows, cellCount, hasRR, hasLoad, score };
    }).sort((a,b)=>b.score-a.score);

    const chosen = tables[0];
    return { chosen, tables: tables.slice(0,5) };
  });

  if (!data || !data.chosen || !data.chosen.bodyRows || data.chosen.bodyRows.length === 0) {
    return { rows: [] as Row[], debug: data };
  }

  // Build a flexible header map (substring matching)
  const H: string[] = (data.chosen.headers || []).map((h: string) => h.toUpperCase());
  const findIdx = (re: RegExp) => H.findIndex(h => re.test(h));

  const idxMap = {
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
    custName:     findIdx(/CUST\s*NM/i),
    custRef:      findIdx(/CUST\s*REF/i),
    driver:       findIdx(/DRIVER/i),
    miles:        findIdx(/TOT\s*MILES/i),
    origin:       findIdx(/^ORIGIN$/i),
    destination:  findIdx(/^DESTINATION$/i),
    vendor:       findIdx(/^VENDOR$/i),
    dispatcher:   findIdx(/^DISPATCHER$/i),
  };

  const rows: Row[] = [];
  for (const r of data.chosen.bodyRows as string[][]) {
    const rr = idxMap.rr >= 0 ? (r[idxMap.rr] || '').trim() : '';
    if (!rr || !/^\d{6,}$/.test(rr)) continue;

    const originText = idxMap.origin >= 0 ? r[idxMap.origin] : '';
    const destText   = idxMap.destination >= 0 ? r[idxMap.destination] : '';
    const oc = ((): {city:string|null,state:string|null} => {
      const t = (originText || '').trim().toUpperCase();
      const m = t.match(/^(.+),\s*([A-Z]{2})$/);
      return m ? { city: m[1].trim(), state: m[2] } : { city: t || null, state: null };
    })();
    const dc = ((): {city:string|null,state:string|null} => {
      const t = (destText || '').trim().toUpperCase();
      const m = t.match(/^(.+),\s*([A-Z]{2})$/);
      return m ? { city: m[1].trim(), state: m[2] } : { city: t || null, state: null };
    })();

    rows.push({
      rr_number: rr,
      tm_number: idxMap.loadOrTm >= 0 ? (r[idxMap.loadOrTm] || '').trim() : null,
      status_code: idxMap.sts >= 0 ? (r[idxMap.sts] || '').trim() : null,
      pickup_date: ((): string|null => {
        const val = idxMap.pDate >= 0 ? r[idxMap.pDate] : null;
        if (!val || val === '00/00/00') return null;
        const [mm,dd,yy] = (val || '').split('/');
        if (!yy) return null;
        const yyyy = yy.length===2 ? (+yy>=70?1900+ +yy:2000+ +yy) : +yy;
        const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
        return isNaN(d.getTime()) ? null : d.toISOString().slice(0,10);
      })(),
      pickup_window: idxMap.pTime >= 0 ? (r[idxMap.pTime] || '').trim() : null,
      delivery_date: ((): string|null => {
        const val = idxMap.dDate >= 0 ? r[idxMap.dDate] : null;
        if (!val || val === '00/00/00') return null;
        const [mm,dd,yy] = (val || '').split('/');
        if (!yy) return null;
        const yyyy = yy.length===2 ? (+yy>=70?1900+ +yy:2000+ +yy) : +yy;
        const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
        return isNaN(d.getTime()) ? null : d.toISOString().slice(0,10);
      })(),
      delivery_window: idxMap.dTime >= 0 ? (r[idxMap.dTime] || '').trim() : null,
      revenue: ((): number|null => {
        const s = idxMap.revenue >= 0 ? r[idxMap.revenue] : null;
        if (!s) return null; const n = parseFloat((s||'').replace(/[^0-9.-]/g,'')); return Number.isFinite(n)?n:null;
      })(),
      purchase: ((): number|null => {
        const s = idxMap.purchase >= 0 ? r[idxMap.purchase] : null;
        if (!s) return null; const n = parseFloat((s||'').replace(/[^0-9.-]/g,'')); return Number.isFinite(n)?n:null;
      })(),
      net: ((): number|null => {
        const s = idxMap.net >= 0 ? r[idxMap.net] : null;
        if (!s) return null; const n = parseFloat((s||'').replace(/[^0-9.-]/g,'')); return Number.isFinite(n)?n:null;
      })(),
      margin: ((): number|null => {
        const s = idxMap.margin >= 0 ? r[idxMap.margin] : null;
        if (!s) return null; const n = parseFloat((s||'').replace(/[^0-9.-]/g,'')); return Number.isFinite(n)?n:null;
      })(),
      equipment: idxMap.equipment >= 0 ? (r[idxMap.equipment] || '').trim() : null,
      customer_name: idxMap.custName >= 0 ? (r[idxMap.custName] || '').trim() : null,
      customer_ref: idxMap.custRef >= 0 ? (r[idxMap.custRef] || '').trim() : null,
      driver_name: idxMap.driver >= 0 ? (r[idxMap.driver] || '').trim() : null,
      total_miles: ((): number|null => {
        const s = idxMap.miles >= 0 ? r[idxMap.miles] : null;
        if (!s) return null; const n = parseInt((s||'').replace(/[^0-9-]/g,''),10); return Number.isFinite(n)?n:null;
      })(),
      origin_city: oc.city, origin_state: oc.state,
      destination_city: dc.city, destination_state: dc.state,
      vendor_name: idxMap.vendor >= 0 ? (r[idxMap.vendor] || '').trim() : null,
      dispatcher_name: idxMap.dispatcher >= 0 ? (r[idxMap.dispatcher] || '').trim() : null
    });
  }

  return { rows, debug: data };
}

(async () => {
  // 0) Need the saved search URL (from earlier capture step)
  const fs = await import('fs/promises');
  const searchUrl = (await fs.readFile('storage/eax-search-url.txt', 'utf8')).trim();

  // 1) Launch with your saved profile (so we’re logged in)
  const context = await chromium.launchPersistentContext('storage/eax-profile', { headless: true });
  const page = context.pages()[0] || await context.newPage();
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

  // 2) If date inputs exist, widen the range to guarantee data
  const dateCtx: Page|Frame = (await (async () => {
    if (await page.locator('input[name="ssFFPDT170"]').count() && await page.locator('input[name="ssTTPDT170"]').count()) return page;
    for (const f of page.frames()) {
      if (await f.locator('input[name="ssFFPDT170"]').count() && await f.locator('input[name="ssTTPDT170"]').count()) return f;
    }
    return page;
  })());

  const from = (dateCtx as any).locator?.('input[name="ssFFPDT170"]');
  const to   = (dateCtx as any).locator?.('input[name="ssTTPDT170"]');
  if (from && to && await from.count() && await to.count()) {
    await from.first().fill('09/01/24');
    await to.first().fill('12/31/25');
  }

  // 3) Submit the search
  await submitSearch(dateCtx);

  // 4) Wait for results markers or time out
  try {
    await page.waitForFunction(() => {
      const txt = document.body?.innerText || '';
      return /Records:\s*\d+/.test(txt) || /Pages:\s*\d+/.test(txt);
    }, { timeout: 20000 });
  } catch {}

  // 5) Pick the correct context (frame or page) that has the results
  const resultsCtx = await findResultsContext(page);

  // 6) Extract rows from that specific context
  const { rows, debug } = await extractRowsFromContext(resultsCtx);

  // Debug summary in console
  const tableInfo = debug?.chosen ? {
    chosenIdx: debug.chosen.idx,
    headers: debug.chosen.headers?.slice?.(0, 30),
    sampleRow: debug.chosen.bodyRows?.[0]?.slice?.(0, 30)
  } : null;
  console.log(JSON.stringify({ parsed: rows.length, tableInfo }, null, 2));

  // 7) Write to DB
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
  await context.close();
  console.log('Ingest complete.');
})();
