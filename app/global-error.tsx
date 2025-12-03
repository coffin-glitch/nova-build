"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Enhanced error logging with module information
    const errorInfo = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      digest: error.digest,
      // Try to extract module/file information from stack trace
      module: error.stack?.match(/at\s+.*?\(([^:]+):\d+:\d+\)/)?.[1] || 'unknown',
      // Check if it's a temporal dead zone error
      isTDZError: error.message.includes("Cannot access") && error.message.includes("before initialization"),
    };
    
    console.error("🚨 [GlobalError] Critical error occurred:", errorInfo);
    
    // Log additional context for TDZ errors
    if (errorInfo.isTDZError) {
      console.error("🚨 [GlobalError] This appears to be a temporal dead zone (TDZ) error.");
      console.error("🚨 [GlobalError] This usually indicates a circular dependency or use-before-declaration.");
      console.error("🚨 [GlobalError] Check the stack trace above for the problematic module.");
    }
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4 p-8">
            <div className="text-6xl">💥</div>
            <h1 className="text-2xl font-bold">Something went wrong!</h1>
            <p className="text-muted-foreground">
              A critical error occurred. Please refresh the page.
            </p>
            <button
              onClick={reset}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
