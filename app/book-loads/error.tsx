"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function BookLoadsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Book Loads Error:", error);
  }, [error]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="p-8 text-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Unable to Load Loads
            </h2>
            <p className="text-gray-600 mb-4">
              There was an error loading the available loads. Please try again.
            </p>
            {process.env.NODE_ENV === "development" && (
              <p className="text-sm text-gray-500 mb-4">
                Error: {error.message}
              </p>
            )}
          </div>
          
          <Button onClick={reset} className="flex items-center">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </Card>
    </main>
  );
}
