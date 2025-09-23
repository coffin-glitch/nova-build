import 'dotenv/config';
import { chromium, Page, Frame } from 'playwright';
import { promises as fs } from 'fs';

async function findSearchContext(page: Page): Promise<Page|Frame> {
  // Prefer the frame that has the pickup date fields
  for (const f of page.frames()) {
    try {
      const hasFrom = await f.locator('input[name="ssFFPDT170"]').count();
      const hasTo   = await f.locator('input[name="ssTTPDT170"]').count();
      if (hasFrom && hasTo) return f;
    } catch {}
  }
  // Fallback: any rrbl CGI frame
  const guess = page.frames().find(f => /rrbl-cgi/i.test(f.url()) || /RRBLOD02R\.pgm/i.test(f.url()));
  return guess || page;
}

async function submitSearch(ctx: Page|Frame) {
  const selectors = [
    'button:has-text("Search")',
    'button:has-text("SEARCH")',
    'input[type="submit"][value="Search"]',
    'input[type="submit"][value="SEARCH"]',
    'input[type="submit"]',
  ];
  for (const s of selectors) {
    const el = (ctx as any).locator?.(s);
    if (el && await el.count()) { await el.first().click(); return; }
  }
  const from = (ctx as any).locator?.('input[name="ssFFPDT170"]');
  if (from && await from.count()) { await from.first().press('Enter'); return; }
  try {
    await (ctx as any).evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form')) as HTMLFormElement[];
      if (forms[0]) forms[0].submit();
    });
  } catch {}
}

(async () => {
  await fs.mkdir('debug', { recursive: true }).catch(()=>{});

  // Read the recorded inner search URL
  let searchUrl = '';
  try {
    searchUrl = (await fs.readFile('storage/eax-search-url.txt', 'utf8')).trim();
  } catch {
    console.error('❌ storage/eax-search-url.txt not found. Run: npx tsx scripts/eax-capture-and-record.ts');
    process.exit(1);
  }

  const context = await chromium.launchPersistentContext('storage/eax-profile', {
    headless: false, slowMo: 60,
  });

  // Capture popups
  const popups: Page[] = [];
  context.on('page', (p) => {
    if (p.opener()) {
      popups.push(p);
      console.log('>> Popup opened:', p.url());
    }
  });

  const page = context.pages()[0] || await context.newPage();
  console.log('Opening direct search URL:', searchUrl);
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

  const ctx = await findSearchContext(page);

  // Fill a wide date window (adjust as needed)
  const from = (ctx as any).locator?.('input[name="ssFFPDT170"]');
  const to   = (ctx as any).locator?.('input[name="ssTTPDT170"]');
  if (from && to && await from.count() && await to.count()) {
    await from.first().fill('09/01/25');
    await to.first().fill('10/10/25');
  } else {
    console.warn('⚠️ Could not find date inputs; will still dump debug artifacts.');
  }

  await submitSearch(ctx);
  await page.waitForTimeout(2000);

  // Dump outer + frames
  await page.screenshot({ path: 'debug/outer_after_direct_search.png', fullPage: true }).catch(()=>{});
  await fs.writeFile('debug/outer_after_direct_search.html', await page.content(), 'utf8');

  const frames = page.frames();
  let idx = 0;
  for (const f of frames) {
    try {
      const h = await f.content();
      await fs.writeFile(`debug/direct_frame_${idx}.html`, h, 'utf8');
      try {
        const el = await f.frameElement();
        await el.screenshot({ path: `debug/direct_frame_${idx}.png` });
      } catch {}
    } catch {}
    idx++;
  }
  console.log(`Wrote debug/outer_after_direct_search.* and ${frames.length} frame dumps to debug/`);

  // Dump any popups (some apps put the table in the popup)
  let pidx = 0;
  for (const pop of popups) {
    try {
      await pop.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(()=>{});
      await pop.screenshot({ path: `debug/direct_popup_${pidx}.png`, fullPage: true }).catch(()=>{});
      await fs.writeFile(`debug/direct_popup_${pidx}.html`, await pop.content(), 'utf8');
      console.log(`Saved direct_popup_${pidx}.*`);
    } catch {}
    pidx++;
  }

  await context.close();
})();
