import 'dotenv/config';
import { chromium } from 'playwright';

(async () => {
  const base = process.env.EAX_BASE_URL || 'https://eax.shiprrexp.com';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: 'storage/eax-state.json' });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded' });

  const hasPwd = await page.locator('input[type="password"]').count();
  console.log(JSON.stringify({
    url: page.url(),
    loggedIn: hasPwd === 0
  }, null, 2));

  await browser.close();
})();
