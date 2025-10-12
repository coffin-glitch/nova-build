import FindLoadsClient from "@/components/find-loads/FindLoadsClient";
import PageHeader from "@/components/layout/PageHeader";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function FindLoadsPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }
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
        <div className="space-y-6">
          {/* Search Panel Skeleton */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-muted rounded w-16"></div>
                  <div className="h-10 bg-muted rounded"></div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Results Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="h-6 bg-muted rounded w-24 mb-2"></div>
                      <div className="h-5 bg-muted rounded w-48 mb-1"></div>
                      <div className="flex items-center gap-4">
                        <div className="h-4 bg-muted rounded w-32"></div>
                        <div className="h-4 bg-muted rounded w-32"></div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="h-8 bg-muted rounded w-20 mb-1"></div>
                      <div className="h-4 bg-muted rounded w-16"></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-muted rounded-full"></div>
                      <div>
                        <div className="h-4 bg-muted rounded w-24 mb-1"></div>
                        <div className="h-3 bg-muted rounded w-12"></div>
                      </div>
                    </div>
                    <div className="h-8 bg-muted rounded w-20"></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="lg:col-span-1">
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="h-6 bg-muted rounded w-24 mb-4"></div>
                <div className="aspect-square bg-muted/30 rounded-lg mb-4"></div>
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-muted rounded-full"></div>
                        <div className="h-4 bg-muted rounded w-16"></div>
                      </div>
                      <div className="h-5 bg-muted rounded w-8"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      }>
        <FindLoadsClient />
      </Suspense>
    </div>
  );
}
