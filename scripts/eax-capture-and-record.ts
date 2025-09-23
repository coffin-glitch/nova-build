import 'dotenv/config';
import { chromium } from 'playwright';
import { promises as fs } from 'fs';

function waitForEnter(prompt = 'When you are on the EAX SEARCH page, press Enter here to SAVE & RECORD...') {
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

  const context = await chromium.launchPersistentContext('storage/eax-profile', {
    headless: false,
    slowMo: 60,
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded' });

  console.log(`
STEP A: In THIS window, log in (username/password + code) if prompted.
STEP B: Navigate to the EAX SEARCH screen (where you see the date filters / table area).
STEP C: Return to this terminal and press Enter to save cookies + record the inner search URL.
  `);

  await waitForEnter();

  await fs.mkdir('storage', { recursive: true }).catch(()=>{});
  await fs.mkdir('debug', { recursive: true }).catch(()=>{});

  // Screenshot for sanity
  try { await page.screenshot({ path: 'debug/capture_after_login_persistent.png', fullPage: true }); } catch {}

  // Gather all frame URLs
  const frames = page.frames();
  const urls = frames.map((f, i) => `#${i}  ${f.url() || '(no url)'}\n`).join('');
  await fs.writeFile('debug/frame_urls_after_capture.txt', urls, 'utf8');
  console.log('📝 Wrote debug/frame_urls_after_capture.txt');

  // Heuristic: pick the first frame whose URL contains rrbl-cgi or RRBLOD02R
  const target = frames.find(f => /rrbl-cgi/i.test(f.url()) || /RRBLOD02R\.pgm/i.test(f.url()));
  if (target) {
    const u = target.url();
    await fs.writeFile('storage/eax-search-url.txt', u + '\n', 'utf8');
    console.log('💾 Recorded search URL -> storage/eax-search-url.txt');
    console.log('   ', u);
  } else {
    console.warn('⚠️ Could not find a frame URL containing rrbl-cgi / RRBLOD02R.pgm. The file storage/eax-search-url.txt will not be created.');
    console.warn('   Please open debug/frame_urls_after_capture.txt and tell me which URL looks like the search page.');
  }

  await context.close();
  console.log('✅ Persistent profile saved at storage/eax-profile');
})();
