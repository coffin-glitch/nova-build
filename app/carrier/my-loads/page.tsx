import PageHeader from "@/components/layout/PageHeader";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { getSupabaseServer, createCookieAdapter } from "@/lib/supabase";
import { CarrierLoadsConsole } from "./CarrierLoadsConsole";

export default async function CarrierMyLoadsPage() {
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
