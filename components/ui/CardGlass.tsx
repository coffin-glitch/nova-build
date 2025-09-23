import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardGlassProps {
  children: ReactNode;
  className?: string;
}

export function CardGlass({ children, className }: CardGlassProps) {
  return (
    <div
      className={cn(
        "bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl shadow-xl",
        "hover:bg-white/15 transition-all duration-300",
        className
      )}
    >
      {children}
    </div>
  );
}