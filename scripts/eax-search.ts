import 'dotenv/config';
import { chromium, Page, Frame } from 'playwright';
import { load as loadHtml } from 'cheerio';
// @ts-ignore - luxon types not available
import { DateTime } from 'luxon';

// ====== CONFIG (from .env) ======
const BASE = process.env.EAX_BASE_URL || 'https://eax.shiprrexp.com';
const USER = process.env.EAX_USERNAME || '';
const PASS = process.env.EAX_PASSWORD || '';

const DEFAULT_PICKUP_FROM = DateTime.now().toFormat('MM/dd/yy');
const DEFAULT_PICKUP_TO   = DateTime.now().plus({ days: 2 }).toFormat('MM/dd/yy');

// ====== small helpers ======
function money(s?: string|null) {
  if (!s) return null;
  const n = parseFloat(s.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function int(s?: string|null) {
  if (!s) return null;
  const n = parseInt(s.replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}
function cityState(s?: string|null) {
  if (!s) return { city: null, state: null };
  const t = s.trim().toUpperCase();
  const m = t.match(/^(.+),\s*([A-Z]{2})$/);
  return m ? { city: m[1].trim(), state: m[2] } : { city: t || null, state: null };
}
function mdYtoISO(s?: string|null) {
  if (!s) return null;
  if (s === '00/00/00') return null;
  const parts = s.split('/');
  if (parts.length === 3 && parts[2].length === 2) {
    const yy = parseInt(parts[2], 10);
    const yyyy = yy >= 70 ? 1900 + yy : 2000 + yy;
    s = `${parts[0]}/${parts[1]}/${yyyy}`;
  }
  const dt = DateTime.fromFormat(s, 'MM/dd/yyyy');
  return dt.isValid ? dt.toISODate() : null;
}

async function getMainContext(page: Page): Promise<Page|Frame> {
  const frames = page.frames();
  if (frames.length <= 1) return page;
  for (const f of frames) {
    const url = f.url().toLowerCase();
    if (url.includes('rrblod02r.pgm') || url.includes('rrbl-cgi')) return f;
  }
  return page;
}

// ---------- Robust login & nav ----------
async function login(page: Page, user: string, pass: string) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  const userSelectors = [
    'input[name="userid"]',
    'input[name="username"]',
    'input#userid',
    'input#username',
    'input[name="USERID"]',
    'input[name="USER"]',
    'input[type="text"]'
  ];
  const passSelectors = [
    'input[name="password"]',
    'input#password',
    'input[name="PASSWD"]',
    'input[type="password"]'
  ];
  const submitSelectors = [
    'input[type="submit"]',
    'button[type="submit"]',
    'button:has-text("Login")',
    'button:has-text("Sign In")',
    'input[value="Login"]',
    'input[value="Sign In"]',
  ];

  let ok = false;
  for (const u of userSelectors) {
    const uEl = page.locator(u);
    if (await uEl.count()) {
      await uEl.first().fill(user);
      for (const p of passSelectors) {
        const pEl = page.locator(p);
        if (await pEl.count()) {
          await pEl.first().fill(pass);
          for (const s of submitSelectors) {
            const sEl = page.locator(s);
            if (await sEl.count()) {
              await sEl.first().click();
              await page.waitForLoadState('networkidle').catch(()=>{});
              ok = true;
              break;
            }
          }
          if (ok) break;
        }
      }
      if (ok) break;
    }
  }
  if (!ok) throw new Error('Login selectors not found. Use codegen to lock them in.');
}

async function openSearch(page: Page) {
  const texts = ['EAX SEARCH', 'Search', 'LOAD SEARCH', 'RRB LOAD SEARCH'];
  for (const t of texts) {
    const link = page.locator(`a:has-text("${t}")`);
    if (await link.count()) { await link.first().click(); await page.waitForLoadState('networkidle').catch(()=>{}); return; }
    const btn = page.locator(`button:has-text("${t}")`);
    if (await btn.count()) { await btn.first().click(); await page.waitForLoadState('networkidle').catch(()=>{}); return; }
  }
  // If already on search, continue.
}

// ---- smarter select by text: exact, then loose (contains / (CODE)) ----
async function selectByText(ctx: Page|Frame, selector: string, visibleText: string) {
  const handle = await ctx.$(selector);
  if (!handle) throw new Error(`Select not found: ${selector}`);
  const options = await handle.$$('option');

  const want = (visibleText || '').trim().toUpperCase();

  // 1) exact match
  for (const opt of options) {
    const txt = ((await opt.textContent()) || '').trim();
    if (txt.toUpperCase() === want) {
      const val = await opt.getAttribute('value');
      if (val !== null) { await handle.selectOption({ value: val }); return; }
    }
  }

  // 2) loose match
  for (const opt of options) {
    const raw = ((await opt.textContent()) || '').trim();
    const upper = raw.toUpperCase();
    if (upper.includes(want) || upper.endsWith(`(${want})`) || upper.includes(`(${want})`)) {
      const val = await opt.getAttribute('value');
      if (val !== null) { await handle.selectOption({ value: val }); return; }
    }
  }

  // helpful error
  const all = await Promise.all(options.map(async o => (await o.textContent() || '').trim()));
  throw new Error(`Option "${visibleText}" not found for ${selector}. Available: ${all.join(' | ')}`);
}

async function fillSearchForm(ctx: Page|Frame, opts?: {
  pickupFrom?: string;
  pickupTo?: string;
  status?: string;
  equipment?: string;
}) {
  const pickupFrom = opts?.pickupFrom || DEFAULT_PICKUP_FROM;
  const pickupTo   = opts?.pickupTo   || DEFAULT_PICKUP_TO;

  // Prefer known param names from your URL captures:
  const fromField = await ctx.$('input[name="ssFFPDT170"]'); // Pickup From
  const toField   = await ctx.$('input[name="ssTTPDT170"]'); // Pickup To

  if (fromField && toField) {
    await fromField.fill(pickupFrom);
    await toField.fill(pickupTo);
  } else {
    const from = ctx.locator('label:has-text("Pickup Date")').locator('xpath=following::input[1]');
    const to   = ctx.locator('label:has-text("Pickup Date")').locator('xpath=following::input[2]');
    await from.fill(pickupFrom);
    await to.fill(pickupTo);
  }

  // --- Call Log Status uses ssOST150 (NOT ssDSTRAD) ---
  if (opts?.status) {
    const statusSel = await ctx.$('select[name="ssOST150"]');
    if (statusSel) {
      const sel = await statusSel.evaluate((e: Element) => {
        const id = e.getAttribute('id'); const name = e.getAttribute('name');
        return id ? `#${id}` : name ? `[name="${name}"]` : 'select';
      });
      await selectByText(ctx, sel, opts.status);
    } else {
      console.warn('Call Log Status select (ssOST150) not found; continuing without status filter.');
    }
  }

  if (opts?.equipment) {
    const eq = await ctx.$('select[name="ssEQP170"]');
    if (eq) {
      const sel = await eq.evaluate((e: Element) => {
        const id = e.getAttribute('id'); const name = e.getAttribute('name');
        return id ? `#${id}` : name ? `[name="${name}"]` : 'select';
      });
      await selectByText(ctx, sel, opts.equipment);
    }
  }
}

async function clickSearch(ctx: Page|Frame) {
  const candidates = [
    'button:has-text("Search")',
    'button:has-text("SEARCH")',
    'input[type="submit"][value="Search"]',
    'input[type="submit"][value="SEARCH"]',
    'input[type="submit"]'
  ];
  for (const c of candidates) {
    const el = ctx.locator(c);
    if (await el.count()) { await el.first().click(); return; }
  }
  throw new Error('Could not find Search/Submit button');
}

async function parseResultsFromCurrentPage(ctx: Page|Frame) {
  await ctx.waitForSelector('table'); // replace with exact table selector once known

  const content = (await (ctx as any).content?.()) || (await (ctx as Page).content());
  const $ = loadHtml(content);

  let table: any = null;
  $('table').each((_, t) => {
    const hasRR = $(t).find('th,td').filter((_, el)=>/^\s*RR#\s*$/i.test($(el).text().trim())).length > 0;
    const hasLoad = $(t).find('th,td').filter((_, el)=>/^\s*Load#\s*$/i.test($(el).text().trim())).length > 0;
    if (hasRR && hasLoad) table = $(t);
  });
  if (!table) table = $('table').first();

  const rows: any[] = [];
  const trs = table!.find('tr');

  trs.each((i: number, tr: any) => {
    const tds = $(tr).children('td');
    if (tds.length < 20) return;

    const rr         = $(tds[0]).text().trim();        // RR#
    const tm         = $(tds[1]).text().trim();        // Load#/Tm#
    const statusCode = $(tds[3]).text().trim();        // Sts
    const pDate      = $(tds[4]).text().trim();        // Pickup Date
    const pWin       = $(tds[5]).text().trim();        // Pickup Time window
    const dDate      = $(tds[6]).text().trim();        // Delivery Date
    const dWin       = $(tds[7]).text().trim();        // Delivery Time window

    const rev        = $(tds[12]).text().trim();       // Rev$
    const purch      = $(tds[13]).text().trim();       // Purch Tr$
    const net        = $(tds[16]).text().trim();       // Net
    const mrg        = $(tds[17]).text().trim();       // Mrg$

    const eqp        = $(tds[22]).text().trim();       // Eqp
    const cust       = $(tds[23]).text().trim();       // Cust Nm
    const cref       = $(tds[24]).text().trim();       // Cust Ref#
    const driver     = $(tds[26]).text().trim();       // Driver Nm
    const miles      = $(tds[28]).text().trim();       // Tot Miles
    const origin     = $(tds[30]).text().trim();       // Origin
    const dest       = $(tds[31]).text().trim();       // Destination
    const vendor     = $(tds[32]).text().trim();       // Vendor
    const disp       = $(tds[33]).text().trim();       // Dispatcher

    const { city: oCity, state: oState } = cityState(origin);
    const { city: dCity, state: dState } = cityState(dest);

    if (!rr) return;

    rows.push({
      rr_number: rr || null,
      tm_number: tm || null,
      status_code: statusCode || null,
      pickup_date: mdYtoISO(pDate),
      pickup_window: pWin || null,
      delivery_date: mdYtoISO(dDate),
      delivery_window: dWin || null,
      revenue: money(rev),
      purchase: money(purch),
      net: money(net),
      margin: money(mrg),
      equipment: eqp || null,
      customer_name: cust || null,
      customer_ref: cref || null,
      driver_name: driver || null,
      total_miles: int(miles),
      origin_city: oCity,
      origin_state: oState,
      destination_city: dCity,
      destination_state: dState,
      vendor_name: vendor || null,
      dispatcher_name: disp || null
    });
  });

  return rows;
}

async function goNextPageIfExists(ctx: Page|Frame) {
  const next = ctx.locator('a:has-text("Next page")');
  if (await next.count()) {
    await next.first().click();
    await (ctx as Page).waitForLoadState?.('networkidle').catch(()=>{});
    return true;
  }
  return false;
}

export async function runEaxSearch(options?: {
  pickupFrom?: string;
  pickupTo?: string;
  status?: string;
  equipment?: string;
  pages?: number;
}) {
  if (!USER || !PASS) throw new Error('Missing EAX_USERNAME / EAX_PASSWORD in env');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await login(page, USER, PASS);
  await openSearch(page);
  const ctx = await getMainContext(page);

  await fillSearchForm(ctx, {
    pickupFrom: options?.pickupFrom,
    pickupTo: options?.pickupTo,
    status: options?.status,
    equipment: options?.equipment
  });
  await clickSearch(ctx);

  let allRows = await parseResultsFromCurrentPage(ctx);

  const pages = Math.max(1, options?.pages ?? 1);
  for (let i = 2; i <= pages; i++) {
    const advanced = await goNextPageIfExists(ctx);
    if (!advanced) break;
    const rows = await parseResultsFromCurrentPage(ctx);
    allRows = allRows.concat(rows);
  }

  await browser.close();
  return allRows;
}

// For quick test: `npx tsx scripts/eax-search.ts`
if (require.main === module) {
  // run WITHOUT status first to verify end-to-end
  runEaxSearch({ pages: 1 /*, status: 'OPEN FOR DISPATCH (OPEN)' */ })
    .then(rows => {
      console.log(JSON.stringify({ count: rows.length, sample: rows.slice(0, 3) }, null, 2));
    })
    .catch(e => { console.error(e); process.exit(1); });
}
