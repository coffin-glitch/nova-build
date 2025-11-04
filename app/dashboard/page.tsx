import { requireSignedIn } from "@/lib/auth";
import { createCookieAdapter, getSupabaseServer } from "@/lib/supabase";
import { cookies, headers } from "next/headers";

export const metadata = { title: "NOVA • Dashboard" };

export default async function DashboardPage() {
  await requireSignedIn();
  const headersList = await headers();
  const cookieStore = await cookies();
  const cookieAdapter = createCookieAdapter(cookieStore, true);
  const supabase = getSupabaseServer(headersList, cookieAdapter);
  const { data: { user } } = await supabase.auth.getUser();
  const name = user?.user_metadata?.first_name || user?.user_metadata?.name || user?.email?.split('@')[0] || "Carrier";

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Welcome, {name}</h1>
      <p className="text-gray-600">Quick links for today:</p>
      <ul className="list-disc pl-6">
        <li><a className="underline" href="/book-loads">Book Loads</a></li>
        <li><a className="underline" href="/bid-board">Bid Board</a></li>
        <li><a className="underline" href="/current-offers">Current Offers</a></li>
        <li><a className="underline" href="/my-loads">My Loads</a></li>
        <li><a className="underline" href="/dedicated-lanes">Dedicated Lanes</a></li>
      </ul>
    </div>
  );
}
