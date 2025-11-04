import PageHeader from "@/components/layout/PageHeader";
import { redirect } from "next/navigation";
import { getUnifiedAuth } from "@/lib/auth-unified";
import { CarrierBidsConsole } from "./CarrierBidsConsole";

export default async function CarrierMyBidsPage() {
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
        title="My Bids" 
        subtitle="Manage your awarded bids and track delivery progress"
        breadcrumbs={[
          { label: "Carrier", href: "/carrier" },
          { label: "My Bids" }
        ]}
      />
      
      <CarrierBidsConsole />
    </div>
  );
}
