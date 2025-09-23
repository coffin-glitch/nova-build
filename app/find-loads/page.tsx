import { Suspense } from "react";
import { SectionHeader } from "@/components/ui/section";
import FindLoadsClient from "./FindLoadsClient";

export default function FindLoadsPage() {
  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <SectionHeader 
          title="Find Loads" 
          subtitle="Discover available loads and start bidding on premium freight opportunities"
        />
        
        <Suspense fallback={
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card rounded-lg p-6 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
                <div className="h-6 bg-muted rounded w-1/2 mb-4"></div>
                <div className="h-3 bg-muted rounded w-1/3"></div>
              </div>
            ))}
          </div>
        }>
          <FindLoadsClient />
        </Suspense>
      </div>
    </div>
  );
}
