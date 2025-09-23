import 'dotenv/config';
import { runEaxSearch } from './eax-search';

(async () => {
  try {
    const rows = await runEaxSearch({
      pages: 1,
      pickupFrom: '09/01/25',   // widen range so we actually hit your Oct loads
      pickupTo:   '10/10/25',
      // status: 'OPEN FOR DISPATCH (OPEN)',   // uncomment later once results work
      // equipment: 'Van (V)',                 // example filter (exact visible text)
    });
    console.log(JSON.stringify({ count: rows.length, sample: rows.slice(0, 5) }, null, 2));
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
