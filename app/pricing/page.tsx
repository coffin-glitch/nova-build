import PageHeader from "@/components/layout/PageHeader";
import PricingCalculator from "@/components/pricing/PricingCalculator";
import { Suspense } from "react";

export default function PricingPage() {
  return (
    <div className="py-8">
      <PageHeader 
        title="Pricing Calculator" 
        subtitle="Calculate accurate shipping costs with real-time fuel prices, toll calculations, and comprehensive rate analysis"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Pricing Calculator" }
        ]}
      />
      
      <Suspense fallback={
        <div className="space-y-6">
          {/* Calculator Skeleton */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="h-6 bg-muted rounded w-32"></div>
                <div className="space-y-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-4 bg-muted rounded w-24"></div>
                      <div className="h-10 bg-muted rounded"></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="h-6 bg-muted rounded w-40"></div>
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-16 bg-muted rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      }>
        <PricingCalculator />
      </Suspense>
    </div>
  );
}
