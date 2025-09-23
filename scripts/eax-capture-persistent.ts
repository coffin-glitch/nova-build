import 'dotenv/config';
import { chromium } from 'playwright';

function waitForEnter(prompt = 'When fully logged in and on the EAX SEARCH page, press Enter here to SAVE & CLOSE...') {
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

  // Launch a PERSISTENT context (full browser profile stored on disk)
  const context = await chromium.launchPersistentContext('storage/eax-profile', {
    headless: false,
    slowMo: 60,
  });

  const page = context.pages()[0] || await context.newPage();
  console.log('Opening:', base);
  await page.goto(base, { waitUntil: 'domcontentloaded' });

  console.log(`
STEP A: In THIS window, log in with your username/password and complete the code if prompted.
STEP B: Navigate to the EAX SEARCH screen (date filters visible).
STEP C: Return to this terminal and press Enter to save the profile and close.
  `);

  await waitForEnter();

  // Optional: screenshot for your records
  try {
    await page.screenshot({ path: 'debug/capture_after_login_persistent.png', fullPage: true });
    console.log('Saved debug/capture_after_login_persistent.png');
  } catch {}

  await context.close();
  console.log('✅ Persistent profile saved at storage/eax-profile');
})();
