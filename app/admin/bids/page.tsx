import { requireAdmin } from "@/lib/auth";
import sql from "@/lib/db";
import NavBar from "@/components/site/NavBar";
import Footer from "@/components/site/Footer";
import BidListClient from "./view.client";

export const dynamic = "force-dynamic";

export default async function AdminBidsPage() {
  await requireAdmin();
  const bids = await sql/*sql*/`
    select bid_number, distance_miles, pickup_timestamp, delivery_timestamp,
           stops, tag, received_at, expires_at
      from public.telegram_bids
     order by received_at desc
     limit 200
  `;
  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-4">Bid Manager</h1>
        <BidListClient initialRows={bids} />
      </main>
      <Footer />
    </>
  );
}