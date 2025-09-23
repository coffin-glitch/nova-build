"use client";
import { SignUp } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export default function ClientSignUp() {
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
      <SignUp routing="hash" />
    </div>
  );
}
