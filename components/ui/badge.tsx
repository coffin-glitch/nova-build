import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-gradient-to-r from-brand-500 to-brand-700 text-white shadow-sm hover:shadow-md hover:scale-105",
        secondary:
          "hover:scale-105",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:scale-105",
        success:
          "border-transparent bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 hover:scale-105",
        warning:
          "border-transparent bg-amber-500 text-white shadow-sm hover:bg-amber-600 hover:scale-105",
        outline: "border-white/20 color: hsl(var(--foreground)) hover:bg-white/5 hover:scale-105",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
