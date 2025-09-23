"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Glass({ 
  className = "", 
  children 
}: React.PropsWithChildren<{className?: string}>) {
  return (
    <div className={cn(
      "rounded-2xl border border-white/10 bg-white/70 dark:bg-surface-900/30 backdrop-blur-md shadow-glass",
      className
    )}>
      {children}
    </div>
  );
}
