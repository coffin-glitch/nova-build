import { requireCarrier } from "@/lib/auth";
import sql from "@/lib/db";
import NavBar from "@/components/site/NavBar";
import Footer from "@/components/site/Footer";
import BookSheet from "@/components/book/BookSheet";
import { fmtUSD, fmtMiles, fmtDate } from "@/lib/format";
import MapCard from "@/components/book/MapCard";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoadDetailPage({ params }: { params: { rr: string } }) {
  await requireCarrier();
  const rr = decodeURIComponent(params.rr);

  const [load] = await sql/*sql*/`
    select rr_number, equipment, total_miles, revenue, customer_name,
           pickup_date, pickup_window, delivery_date, delivery_window,
           origin_city, origin_state, destination_city, destination_state
    from public.loads
    where rr_number = ${rr} and published = true
    limit 1
  `;
  if (!load) notFound();

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {load.origin_city}, {load.origin_state} → {load.destination_city}, {load.destination_state}
            </h1>
            <p className="text-sm text-gray-500 mt-1">RR #{load.rr_number} · {load.equipment || "—"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/book-loads" className="text-sm text-gray-600 hover:text-gray-900 underline">Back to results</Link>
            <BookSheet rr={load.rr_number} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border p-6 bg-white">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500">Pickup</div>
                  <div className="text-sm text-gray-800">
                    {fmtDate(load.pickup_date)}{load.pickup_window ? ` · ${load.pickup_window}` : ""}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Delivery</div>
                  <div className="text-sm text-gray-800">
                    {fmtDate(load.delivery_date)}{load.delivery_window ? ` · ${load.delivery_window}` : ""}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Miles</div>
                  <div className="text-sm text-gray-800">{fmtMiles(load.total_miles)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Revenue</div>
                  <div className="text-sm text-gray-800">{fmtUSD(load.revenue)}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-gray-500">Customer</div>
                  <div className="text-sm text-gray-800">{load.customer_name || "—"}</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border p-6 bg-white">
              <div className="text-sm text-gray-700">
                Equipment: {load.equipment || "—"}
              </div>
              <div className="text-sm text-gray-700 mt-2">
                Origin: {load.origin_city}, {load.origin_state}
              </div>
              <div className="text-sm text-gray-700">
                Destination: {load.destination_city}, {load.destination_state}
              </div>
            </div>
          </div>

          <div>
            <MapCard />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}