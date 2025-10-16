import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { CarrierProfileClient } from "./CarrierProfileClient";

export default async function CarrierProfilePage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }

  return (
    <div className="py-8">
      <PageHeader 
        title="Carrier Profile" 
        subtitle="Manage your company information and carrier credentials"
        breadcrumbs={[
          { label: "Carrier", href: "/carrier" },
          { label: "Profile" }
        ]}
      />
      
      <CarrierProfileClient />
    </div>
  );
}
