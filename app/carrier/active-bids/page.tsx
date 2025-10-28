import PageHeader from "@/components/layout/PageHeader";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import CarrierActiveBidsClient from "./CarrierActiveBidsClient";

export default async function CarrierActiveBidsPage() {
  const { userId } = await auth();
  
  if (!userId) {
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
