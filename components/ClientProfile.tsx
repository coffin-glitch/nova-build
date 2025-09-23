"use client";
import { UserProfile } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export default function ClientProfile() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-4 bg-background">
      <UserProfile routing="hash" />
    </div>
  );
}
