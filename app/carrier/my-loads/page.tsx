import PageHeader from "@/components/layout/PageHeader";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CarrierLoadsConsole } from "./CarrierLoadsConsole";

export default async function CarrierMyLoadsPage() {
  const { userId } = await auth();
  
  if (!userId) {
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
