import PageHeader from "@/components/layout/PageHeader";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { getSupabaseServer, createCookieAdapter } from "@/lib/supabase";
import { Suspense } from "react";
import CarrierActiveBidsClient from "./CarrierActiveBidsClient";

export default async function CarrierActiveBidsPage() {
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
        title="My Active Bids" 
        subtitle="Manage your current bids and track their status"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Carrier", href: "/carrier" },
          { label: "Active Bids" }
        ]}
      />

      <Suspense fallback={
        <div className="space-y-6">
          <div className="grid gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-muted/20 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      }>
        <CarrierActiveBidsClient />
      </Suspense>
    </div>
  );
}
