import { requireSignedIn } from "@/lib/auth";
import { currentUser } from "@clerk/nextjs/server";

export const metadata = { title: "NOVA • Dashboard" };

export default async function DashboardPage() {
  await requireSignedIn();
  const user = await currentUser();
  const name = user?.firstName || user?.username || "Carrier";

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
