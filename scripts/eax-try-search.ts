import 'dotenv/config';
import { chromium, Page, Frame, BrowserContext } from 'playwright';
import { promises as fs } from 'fs';

async function findSearchContext(page: Page): Promise<Page|Frame> {
  // Prefer the frame that contains the pickup date fields
  for (const f of page.frames()) {
    try {
      const hasFrom = await f.locator('input[name="ssFFPDT170"]').count();
      const hasTo   = await f.locator('input[name="ssTTPDT170"]').count();
      if (hasFrom && hasTo) return f;
    } catch {}
  }
  // Fallback: any frame with rrbl CGI in URL
  const guess = page.frames().find(f => /rrblod02r\.pgm/i.test(f.url()) || /rrbl-cgi/i.test(f.url()));
  if (guess) return guess;
  // Final fallback: outer page
  return page;
}

async function submitSearch(ctx: Page|Frame) {
  // 1) Try obvious buttons/inputs
  const selectors = [
    'button:has-text("Search")',
    'button:has-text("SEARCH")',
    'input[type="submit"][value="Search"]',
    'input[type="submit"][value="SEARCH"]',
    'input[type="submit"]'
  ];
  for (const s of selectors) {
    const el = (ctx as any).locator?.(s);
    if (el && await el.count()) { await el.first().click(); return; }
  }
  // 2) Try pressing Enter inside a field
  const from = await (ctx as any).locator?.('input[name="ssFFPDT170"]');
  if (from && await from.count()) { await from.first().press('Enter'); return; }
  // 3) Try submitting first FORM directly
  try {
    await (ctx as any).evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form')) as HTMLFormElement[];
      if (forms[0]) forms[0].submit();
    });
  } catch {}
}

(async () => {
  await fs.mkdir('debug', { recursive: true }).catch(()=>{});

  const browser = await chromium.launch({ headless: false, slowMo: 50 }); // headed so you can see what happens
  const context = await browser.newContext({ storageState: 'storage/eax-state.json' }).catch(async () => {
    // fallback to new context if storage missing
    return browser.newContext();
  });

  // Log console errors from the app
  context.on('page', (p) => {
    p.on('console', (msg) => {
      if (['error','warning'].includes(msg.type())) {
        console.log('[console]', msg.type(), msg.text());
      }
    });
  });

  // Capture popups (results sometimes open as new window)
  const popups: Page[] = [];
  context.on('page', (p) => {
    if (p.opener()) {
      popups.push(p);
      console.log('>> Popup opened:', p.url());
    }
  });

  const page = await context.newPage();
  await page.goto(process.env.EAX_BASE_URL || 'https://eax.shiprrexp.com', { waitUntil: 'domcontentloaded' });

  // If session expired, bail with a clear message
  if (await page.locator('input[type="password"]').count()) {
    console.error('Not logged in here. Re-run: npx tsx scripts/eax-capture-login.ts');
    await browser.close();
    process.exit(1);
  }

  // Try to navigate to the search screen (menu items that often exist)
  const navTexts = ['EAX SEARCH','Search','LOAD SEARCH','RRB LOAD SEARCH'];
  for (const t of navTexts) {
    const link = page.locator(`a:has-text("${t}")`);
    if (await link.count()) { await link.first().click().catch(()=>{}); await page.waitForLoadState('domcontentloaded').catch(()=>{}); }
    const btn = page.locator(`button:has-text("${t}")`);
    if (await btn.count()) { await btn.first().click().catch(()=>{}); await page.waitForLoadState('domcontentloaded').catch(()=>{}); }
  }

  // Locate the frame that has the date fields
  const ctx = await findSearchContext(page);

  // Fill a wide pickup window (adjust as needed)
  const from = (ctx as any).locator?.('input[name="ssFFPDT170"]');
  const to   = (ctx as any).locator?.('input[name="ssTTPDT170"]');
  if (from && to && await from.count() && await to.count()) {
    await from.first().fill('09/01/25');
    await to.first().fill('10/10/25');
  } else {
    console.warn('Could not find date inputs in this context. We will still dump debug artifacts.');
  }

  // Try to submit the search
  await submitSearch(ctx);

  // Wait a bit for navigation or DOM change; handle popups if any
  await page.waitForTimeout(2000);

  // Dump outer page
  await page.screenshot({ path: 'debug/outer_after_search.png', fullPage: true }).catch(()=>{});
  await fs.writeFile('debug/outer_after_search.html', await page.content(), 'utf8');

  // Dump all frames (before & after)
  const frames = page.frames();
  let idx = 0;
  for (const f of frames) {
    try {
      const h = await f.content();
      await fs.writeFile(`debug/frame_${idx}_after.html`, h, 'utf8');
      // frame screenshot (via its element)
      try {
        const el = await f.frameElement();
        await el.screenshot({ path: `debug/frame_${idx}_after.png` });
      } catch {}
    } catch {}
    idx++;
  }
  console.log(`Saved debug/outer_after_search.* and ${frames.length} frame dumps to debug/`);

  // Dump any popup pages (results may be here)
  let pidx = 0;
  for (const pop of popups) {
    try {
      await pop.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(()=>{});
      await pop.screenshot({ path: `debug/popup_${pidx}.png`, fullPage: true }).catch(()=>{});
      await fs.writeFile(`debug/popup_${pidx}.html`, await pop.content(), 'utf8');
      console.log(`Saved popup_${pidx}.*`);
    } catch {}
    pidx++;
  }

  await browser.close();
})();
