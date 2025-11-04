import PageHeader from "@/components/layout/PageHeader";
import { Suspense } from "react";
import { CarrierProfileClient } from "./CarrierProfileClient";

export const dynamic = "force-dynamic";

export default async function CarrierProfilePage() {
  // NOTE: Authentication is handled by middleware (middleware.ts)
  // which checks profile status and redirects unauthenticated users.
  // The client-side CarrierProfileClient component handles UI state.
  // This is safe because:
  // 1. Middleware enforces authentication and profile status checks
  // 2. The API route /api/carrier/profile requires authentication (enforced server-side)
  // 3. If user somehow bypasses these, they'll just see empty data (no security risk)

  return (
    <div className="py-8">
      <PageHeader 
        title="Carrier Profile" 
        subtitle="Manage your company information and carrier credentials"
        breadcrumbs={[
          { label: "Carrier", href: "/carrier" },
          { label: "Profile" }
        ]}
      />
      
      <Suspense fallback={
        <div className="py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      }>
        <CarrierProfileClient />
      </Suspense>
    </div>
  );
}
