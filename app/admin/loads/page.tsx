import { auth } from "@clerk/nextjs/server";
import LoadTable from "@/components/LoadTable";

export const metadata = { title: "NOVA Admin • Loads" };

export default async function AdminLoadsPage() {
  const { userId } = auth();
  if (!userId) {
    // Keep it simple; Clerk middleware will usually guard this already.
    return <div className="p-6">You must be signed in.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Admin • Loads</h1>
      <p className="text-gray-600">Search, filter, and publish/unpublish loads for the Bid Board.</p>
      <LoadTable />
    </div>
  );
}
