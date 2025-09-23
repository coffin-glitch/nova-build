import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import FindLoadsClient from "./FindLoadsClient";

export default function FindLoadsPage() {
  return (
    <div className="py-8">
      <PageHeader 
        title="Find Loads" 
        subtitle="Discover available loads and start bidding on premium freight opportunities"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Find Loads" }
        ]}
      />
      
      <Suspense fallback={
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <SectionCard key={i} className="animate-pulse">
              <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
              <div className="h-6 bg-muted rounded w-1/2 mb-4"></div>
              <div className="h-3 bg-muted rounded w-1/3"></div>
            </SectionCard>
          ))}
        </div>
      }>
        <FindLoadsClient />
      </Suspense>
    </div>
  );
}
