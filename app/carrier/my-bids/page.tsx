import PageHeader from "@/components/layout/PageHeader";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CarrierBidsConsole } from "./CarrierBidsConsole";

export default async function CarrierMyBidsPage() {
  const { userId } = await auth();
  
  if (!userId) {
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
