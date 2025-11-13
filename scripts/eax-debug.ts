import 'dotenv/config';
import { chromium } from 'playwright';
import { promises as fs } from 'fs';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 1) Go to base and try login heuristics
  await page.goto(process.env.EAX_BASE_URL || 'https://eax.shiprrexp.com', { waitUntil: 'domcontentloaded' });
  const user = process.env.EAX_USERNAME || '';
  const pass = process.env.EAX_PASSWORD || '';

  const u = ['input[name="userid"]','input[name="username"]','input#userid','input#username','input[name="USERID"]','input[name="USER"]','input[type="text"]'];
  const p = ['input[name="password"]','input#password','input[name="PASSWD"]','input[type="password"]'];
  const s = ['input[type="submit"]','button[type="submit"]','button:has-text("Login")','button:has-text("Sign In")','input[value="Login"]','input[value="Sign In"]'];

  let ok=false;
  for (const us of u){ if(await page.locator(us).count()){
    await page.fill(us, user);
    for(const ps of p){ if(await page.locator(ps).count()){
      await page.fill(ps, pass);
      for(const ss of s){ if(await page.locator(ss).count()){
        await page.click(ss);
        await page.waitForLoadState('networkidle').catch(()=>{});
        ok=true; break; } }
      if(ok) break;
    } }
    if(ok) break;
  } }

  // 2) Try to open the search screen (menu/button heuristics)
  const texts=['EAX SEARCH','Search','LOAD SEARCH','RRB LOAD SEARCH'];
  for(const t of texts){
    const link=page.locator(`a:has-text("${t}")`);
    if(await link.count()){ await link.first().click(); await page.waitForLoadState('networkidle').catch(()=>{}); break; }
    const btn=page.locator(`button:has-text("${t}")`);
    if(await btn.count()){ await btn.first().click(); await page.waitForLoadState('networkidle').catch(()=>{}); break; }
  }

  // 3) Fill date range (using the names you captured from network params)
  const from=await page.$('input[name="ssFFPDT170"]');
  const to  =await page.$('input[name="ssTTPDT170"]');
  if(from && to){ await from.fill('09/01/25'); await to.fill('10/10/25'); }

  // 4) Click a likely Search button
  const candidates=['button:has-text("Search")','button:has-text("SEARCH")','input[type="submit"][value="Search"]','input[type="submit"][value="SEARCH"]','input[type="submit"]'];
  for(const c of candidates){ const el=page.locator(c); if(await el.count()){ await el.first().click(); break; } }

  // 5) Wait and dump HTML of outer doc + all frames
  await page.waitForTimeout(2000);

  const outer = await page.content();
  await fs.writeFile('/tmp/eax_outer.html', outer, 'utf8');

  const frames = page.frames();
  let idx=0;
  for(const f of frames){
    try{
      const h = await f.content();
      await fs.writeFile(`/tmp/eax_frame_${idx}.html`, h, 'utf8');
    }catch{}
    idx++;
  }

  console.log(`Saved /tmp/eax_outer.html and ${frames.length} frame files (/tmp/eax_frame_*.html)`);
  await browser.close();
})();
