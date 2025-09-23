import 'dotenv/config';
import { chromium } from 'playwright';
import { promises as fs } from 'fs';

function waitForEnter(prompt = 'Press Enter here in the terminal to save the session...') {
  return new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdout.write(`\n${prompt}\n`);
    process.stdin.once('data', () => {
      process.stdin.pause();
      resolve();
    });
  });
}

(async () => {
  const base = process.env.EAX_BASE_URL || 'https://eax.shiprrexp.com';

  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Opening:', base);
  await page.goto(base, { waitUntil: 'domcontentloaded' });

  console.log(`
STEP A: In THIS Playwright window, log in with your username/password and complete the MFA code if prompted.
STEP B: After login, navigate to the EAX SEARCH screen (the one with date filters).
STEP C: Return to this terminal and press Enter to save cookies/storage.
  `);

  await waitForEnter('When you are fully logged in and on the search page, press Enter here...');

  await fs.mkdir('storage', { recursive: true }).catch(()=>{});
  await fs.mkdir('debug', { recursive: true }).catch(()=>{});

  await context.storageState({ path: 'storage/eax-state.json' });
  console.log('💾 Saved session to storage/eax-state.json');

  try {
    await page.screenshot({ path: 'debug/capture_after_login.png', fullPage: true });
    console.log('🖼️ Saved debug/capture_after_login.png');
  } catch {}

  await browser.close();
})();
