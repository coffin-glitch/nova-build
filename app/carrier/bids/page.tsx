import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { CarrierBidsClient } from "./CarrierBidsClient";

export default async function CarrierBidsPage() {
  const { userId } = await auth();
  
  if (!userId) {
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
