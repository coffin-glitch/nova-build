import PageHeader from "@/components/layout/PageHeader";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import CarrierFavoritesClient from "./CarrierFavoritesClient";

export default async function CarrierFavoritesPage() {
  const { userId } = await auth();
  
  if (!userId) {
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
