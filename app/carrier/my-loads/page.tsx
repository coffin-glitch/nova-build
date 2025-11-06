import PageHeader from "@/components/layout/PageHeader";
import { redirect } from "next/navigation";
import { getUnifiedAuth } from "@/lib/auth-unified";
import { CarrierLoadsConsole } from "./CarrierLoadsConsole";

export default async function CarrierMyLoadsPage() {
  // NOTE: Authentication and profile status are handled by middleware (middleware.ts)
  // This check is redundant but provides defense-in-depth. Middleware redirects unauthenticated
  // users before this component runs, so this primarily serves as a type safety check.
  const auth = await getUnifiedAuth();
  
  if (!auth.userId) {
    redirect('/sign-in');
  }

  return (
    <div className="py-8">
      <PageHeader 
        title="My Loads" 
        subtitle="Manage your offers, booked loads, and track delivery progress"
        breadcrumbs={[
          { label: "Carrier", href: "/carrier" },
          { label: "My Loads" }
        ]}
      />
      
      <CarrierLoadsConsole />
    </div>
  );
}
