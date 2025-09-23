"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="p-8 text-center max-w-md">
        <div className="space-y-4">
          <div className="text-6xl">🔧</div>
          <h1 className="text-2xl font-bold color: hsl(var(--foreground))">Admin Error</h1>
          <p className="text-muted-foreground">
            Something went wrong in the admin panel. Please try again.
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={reset}>
              Try again
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin">Admin Dashboard</Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
