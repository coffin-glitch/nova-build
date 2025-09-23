import { Glass } from "./glass";

export function BidBoardSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <Glass key={i} className="p-6 space-y-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-6 bg-muted rounded w-20"></div>
            <div className="h-8 bg-muted rounded-full w-24"></div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-1/4"></div>
          </div>
          <div className="pt-4 border-t border-border/40">
            <div className="flex justify-between items-center">
              <div className="h-4 bg-muted rounded w-24"></div>
              <div className="flex gap-2">
                <div className="h-8 bg-muted rounded w-20"></div>
                <div className="h-8 bg-muted rounded w-16"></div>
              </div>
            </div>
          </div>
        </Glass>
      ))}
    </div>
  );
}

export function FindLoadsSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-card rounded-lg p-6 animate-pulse">
          <div className="flex justify-between items-start mb-4">
            <div className="h-6 bg-muted rounded w-1/3"></div>
            <div className="h-8 bg-muted rounded w-20"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-4 bg-muted rounded w-1/3"></div>
          </div>
          <div className="h-3 bg-muted rounded w-2/3 mb-4"></div>
          <div className="flex justify-between items-center">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-8 bg-muted rounded w-24"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminAuctionListSkeleton() {
  return (
    <div className="space-y-4">
      <Glass className="p-6">
        <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="h-6 bg-muted rounded w-16"></div>
                <div className="h-4 bg-muted rounded w-24"></div>
                <div className="h-4 bg-muted rounded w-32"></div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="h-4 bg-muted rounded w-16"></div>
                <div className="h-4 bg-muted rounded w-20"></div>
                <div className="h-8 bg-muted rounded w-20"></div>
              </div>
            </div>
          ))}
        </div>
      </Glass>
    </div>
  );
}