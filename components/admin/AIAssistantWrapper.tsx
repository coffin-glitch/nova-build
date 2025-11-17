"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Use dynamic import with no SSR to prevent hydration issues
// This ensures the latest version is always loaded
const AIAssistantEnhanced = dynamic(
  () => import("./AIAssistantEnhanced"),
  {
    ssr: false,
    loading: () => null,
  }
);

export default function AIAssistantWrapper() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Only render on client side
    setMounted(true);
  }, []);

  // Don't render anything until mounted to prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  return <AIAssistantEnhanced />;
}

