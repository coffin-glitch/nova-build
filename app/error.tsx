"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="p-8 text-center max-w-md">
        <div className="space-y-4">
          <div className="text-6xl">⚠️</div>
          <h1 className="text-2xl font-bold color: hsl(var(--foreground))">Something went wrong!</h1>
          <p className="text-muted-foreground">
            An unexpected error occurred. Please try again or contact support if the problem persists.
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={reset}>
              Try again
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Go Home</Link>
            </Button>
          </div>
          {process.env.NODE_ENV === "development" && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                🔍 Debug Information (Development)
              </summary>
              <div className="mt-2 text-xs bg-muted p-4 rounded overflow-auto space-y-2">
                <div>
                  <strong>Error Message:</strong>
                  <pre className="mt-1 p-2 bg-red-100 text-red-800 rounded">{error.message}</pre>
                </div>
                <div>
                  <strong>Error Digest:</strong>
                  <pre className="mt-1 p-2 bg-yellow-100 text-yellow-800 rounded">{error.digest || 'No digest'}</pre>
                </div>
                <div>
                  <strong>Error Name:</strong>
                  <pre className="mt-1 p-2 bg-blue-100 text-blue-800 rounded">{error.name || 'Unknown'}</pre>
                </div>
                <div>
                  <strong>Current URL:</strong>
                  <pre className="mt-1 p-2 bg-green-100 text-green-800 rounded">{typeof window !== 'undefined' ? window.location.href : 'Server-side'}</pre>
                </div>
                <div>
                  <strong>User Agent:</strong>
                  <pre className="mt-1 p-2 bg-purple-100 text-purple-800 rounded">{typeof window !== 'undefined' ? window.navigator.userAgent : 'Server-side'}</pre>
                </div>
                {error.stack && (
                  <div>
                    <strong>Stack Trace:</strong>
                    <pre className="mt-1 p-2 bg-gray-100 text-gray-800 rounded max-h-40 overflow-auto">{error.stack}</pre>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      </Card>
    </div>
  );
}
