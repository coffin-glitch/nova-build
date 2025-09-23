"use client";
import { SignIn } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export default function ClientSignIn() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "70vh", alignItems: "center", justifyContent: "center" }}>
      <SignIn routing="hash" />
    </div>
  );
}
