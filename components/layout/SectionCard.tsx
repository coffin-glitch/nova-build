import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg" | "xl";
  variant?: "default" | "outlined" | "elevated";
}

const paddingVariants = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
  xl: "p-10",
};

const cardVariants = {
  default: "bg-card border-border shadow-sm",
  outlined: "bg-card border-2 border-border shadow-none",
  elevated: "bg-card border-border shadow-card",
};

function SectionCard({
  children,
  className,
  padding = "md",
  variant = "default",
}: SectionCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border transition-all duration-200",
        cardVariants[variant],
        paddingVariants[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

export default SectionCard;
