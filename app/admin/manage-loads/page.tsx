import { requireAdmin } from "@/lib/auth";
import sql from "@/lib/db";
import NavBar from "@/components/site/NavBar";
import Footer from "@/components/site/Footer";
import { fmtMiles, fmtDate } from "@/lib/format";
import ManageLoadsClient from "./view.client";

export const dynamic = "force-dynamic";

export default async function ManageLoadsPage() {
  await requireAdmin();

  const loads = await sql/*sql*/`
    select rr_number, published, equipment, total_miles,
           pickup_date, delivery_date,
           origin_city, origin_state, destination_city, destination_state,
           updated_at
      from public.loads
     order by published desc, updated_at desc
     limit 250
  `;

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-4">Manage Loads</h1>
        <ManageLoadsClient initialRows={loads} />
      </main>
      <Footer />
    </>
  );
}
