import 'dotenv/config';
import { runEaxSearch } from './eax-search';
import { dbQuery } from '@/lib/db';

async function main() {
  // Pull 1 page of OPEN loads; change pages or filters if needed
  const rows = await runEaxSearch({ pages: 1, status: 'OPEN' });

  for (const r of rows) {
    if (!r.rr_number) continue;

    await dbQuery(`
      insert into public.loads (
        source, rr_number, tm_number, status, status_code,
        pickup_date, pickup_window,
        delivery_date, delivery_window,
        equipment, miles, rate,
        revenue, purchase, net, margin,
        customer_name, customer_ref, driver_name,
        total_miles, origin_city, origin_state, destination_city, destination_state,
        vendor_name, dispatcher_name, updated_at, created_at
      )
      values (
        'EAX', $1, $2, coalesce($3,'OPEN'), $3,
        $4::date, $5,
        $6::date, $7,
        $8, $9, null,
        $10, $11, $12, $13,
        $14, $15, $16,
        $17, $18, $19, $20, $21,
        $22, $23, now(), now()
      )
      on conflict (rr_number) do update set
        status = excluded.status,
        status_code = excluded.status_code,
        pickup_date = excluded.pickup_date,
        pickup_window = excluded.pickup_window,
        delivery_date = excluded.delivery_date,
        delivery_window = excluded.delivery_window,
        equipment = excluded.equipment,
        miles = excluded.miles,
        revenue = excluded.revenue,
        purchase = excluded.purchase,
        net = excluded.net,
        margin = excluded.margin,
        customer_name = excluded.customer_name,
        customer_ref = excluded.customer_ref,
        driver_name = excluded.driver_name,
        total_miles = excluded.total_miles,
        origin_city = excluded.origin_city,
        origin_state = excluded.origin_state,
        destination_city = excluded.destination_city,
        destination_state = excluded.destination_state,
        vendor_name = excluded.vendor_name,
        dispatcher_name = excluded.dispatcher_name,
        updated_at = now()
    `, [
      r.rr_number, r.tm_number, r.status_code,
      r.pickup_date, r.pickup_window,
      r.delivery_date, r.delivery_window,
      r.equipment, r.total_miles,
      r.revenue, r.purchase, r.net, r.margin,
      r.customer_name, r.customer_ref, r.driver_name,
      r.total_miles, r.origin_city, r.origin_state, r.destination_city, r.destination_state,
      r.vendor_name, r.dispatcher_name
    ]);
  }

  console.log(`EAX ingest complete: ${rows.length} rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
