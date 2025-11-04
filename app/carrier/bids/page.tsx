import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { getSupabaseServer, createCookieAdapter } from "@/lib/supabase";
import PageHeader from "@/components/layout/PageHeader";
import { CarrierBidsClient } from "./CarrierBidsClient";

export default async function CarrierBidsPage() {
  // NOTE: Authentication and profile status are handled by middleware (middleware.ts)
  // This check is redundant but provides defense-in-depth. Middleware redirects unauthenticated
  // users before this component runs, so this primarily serves as a type safety check.
  const headersList = await headers();
  const cookieStore = await cookies();
  const cookieAdapter = createCookieAdapter(cookieStore, true); // readOnly for Server Components
  const supabase = getSupabaseServer(headersList, cookieAdapter);
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/sign-in');
  }

  return (
    <div className="py-8">
      <PageHeader 
        title="My Bids" 
        subtitle="View and manage your current and past bids"
        breadcrumbs={[
          { label: "Carrier", href: "/carrier" },
          { label: "My Bids" }
        ]}
      />
      
      <CarrierBidsClient />
    </div>
  );
}
