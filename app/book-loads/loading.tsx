import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function BookLoadsLoading() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search Section Skeleton */}
      <div className="bg-white rounded-xl p-6 shadow-lg mb-8 border border-gray-100">
        <Skeleton className="h-6 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Skeleton className="h-4 w-16 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>

      {/* Results Section Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Load Listings */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-40" />
            <div className="flex space-x-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>

          {/* Load Cards Skeleton */}
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <Skeleton className="h-6 w-16 mr-2" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <Skeleton className="h-6 w-64 mb-2" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-6 w-20 mb-1" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                  <div className="flex items-center">
                    <Skeleton className="h-10 w-10 rounded-full mr-3" />
                    <div>
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Map Section Skeleton */}
        <div className="lg:col-span-1">
          <Card className="p-6">
            <Skeleton className="h-6 w-24 mb-4" />
            <Skeleton className="h-96 w-full rounded-xl mb-4" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-36" />
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
