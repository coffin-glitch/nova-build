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
          
          {/* Debug Information */}
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm text-muted-foreground font-semibold">
              🔍 Debug Information - Step 3 Issue
            </summary>
            <div className="mt-4 text-xs bg-slate-100 p-4 rounded overflow-auto space-y-3">
              <div>
                <strong className="text-red-600">Error Message:</strong>
                <pre className="mt-1 p-2 bg-red-50 text-red-800 rounded border">{error.message}</pre>
              </div>
              <div>
                <strong className="text-yellow-600">Error Digest:</strong>
                <pre className="mt-1 p-2 bg-yellow-50 text-yellow-800 rounded border">{error.digest || 'No digest'}</pre>
              </div>
              <div>
                <strong className="text-blue-600">Error Name:</strong>
                <pre className="mt-1 p-2 bg-blue-50 text-blue-800 rounded border">{error.name || 'Unknown'}</pre>
              </div>
              <div>
                <strong className="text-green-600">Current URL:</strong>
                <pre className="mt-1 p-2 bg-green-50 text-green-800 rounded border">{typeof window !== 'undefined' ? window.location.href : 'Server-side'}</pre>
              </div>
              <div>
                <strong className="text-purple-600">Timestamp:</strong>
                <pre className="mt-1 p-2 bg-purple-50 text-purple-800 rounded border">{new Date().toISOString()}</pre>
              </div>
              <div>
                <strong className="text-gray-600">Step 3 Status:</strong>
                <pre className="mt-1 p-2 bg-gray-50 text-gray-800 rounded border">Client Component with event handler issue</pre>
              </div>
              {error.stack && (
                <div>
                  <strong className="text-gray-600">Stack Trace:</strong>
                  <pre className="mt-1 p-2 bg-gray-50 text-gray-800 rounded border max-h-40 overflow-auto">{error.stack}</pre>
                </div>
              )}
            </div>
          </details>
        </div>
      </Card>
    </div>
  );
}
