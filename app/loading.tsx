import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="p-8 text-center max-w-md">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
          <h2 className="text-xl font-semibold color: hsl(var(--foreground))">Loading...</h2>
          <p className="text-muted-foreground">
            Please wait while we load the page.
          </p>
        </div>
      </Card>
    </div>
  );
}
