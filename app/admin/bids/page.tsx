import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminBidsPage() {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Admin Bidding Console</h1>
        <p className="text-lg text-muted-foreground">
          This is a test version of the admin bidding console.
        </p>
        <div className="mt-6 p-4 bg-green-100 border border-green-300 rounded-lg">
          <p className="text-green-800">
            ✅ Admin access confirmed - the page is working!
          </p>
        </div>
      </div>
    </div>
  );
}