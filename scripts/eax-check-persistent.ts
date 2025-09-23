import 'dotenv/config';
import { chromium } from 'playwright';

(async () => {
  const base = process.env.EAX_BASE_URL || 'https://eax.shiprrexp.com';
  const context = await chromium.launchPersistentContext('storage/eax-profile', {
    headless: true,
  });
  const page = context.pages()[0] || await context.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded' });

  const hasPwd = await page.locator('input[type="password"]').count();
  console.log(JSON.stringify({ url: page.url(), loggedIn: hasPwd === 0 }, null, 2));

  await context.close();
})();
