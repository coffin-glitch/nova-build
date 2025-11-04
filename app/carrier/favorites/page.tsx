import PageHeader from "@/components/layout/PageHeader";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { getSupabaseServer, createCookieAdapter } from "@/lib/supabase";
import { Suspense } from "react";
import CarrierFavoritesClient from "./CarrierFavoritesClient";

export default async function CarrierFavoritesPage() {
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
        title="My Favorites" 
        subtitle="Manage your favorited bids and get notified about similar loads"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Carrier", href: "/carrier" },
          { label: "Favorites" }
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
        <CarrierFavoritesClient />
      </Suspense>
    </div>
  );
}
