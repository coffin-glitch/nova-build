"use client";

import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useTheme } from "next-themes";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  className?: string;
}

function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  const { accentColor } = useAccentColor();
  const { theme } = useTheme();
  
  // Smart color handling for white accent color
  const getTextColor = () => {
    if (accentColor === 'hsl(0, 0%, 100%)') {
      return theme === 'dark' ? '#ffffff' : '#000000';
    }
    return accentColor;
  };
  
  const getShadowColor = () => {
    if (accentColor === 'hsl(0, 0%, 100%)') {
      return theme === 'dark' ? '#ffffff' : '#000000';
    }
    return accentColor;
  };
  
  const getShadowStyle = () => {
    if (accentColor === 'hsl(0, 0%, 100%)') {
      return theme === 'dark' 
        ? `0 1px 2px ${getShadowColor()}20, 0 0 4px ${getShadowColor()}10`
        : `0 1px 2px ${getShadowColor()}20, 0 0 4px ${getShadowColor()}10`;
    }
    return `0 1px 2px ${accentColor}30, 0 0 4px ${accentColor}15`;
  };
  
  return (
    <div className={cn("mb-8", className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-4 flex items-center space-x-1 text-sm text-muted-foreground">
          {breadcrumbs.map((item, index) => (
            <div key={index} className="flex items-center space-x-1">
              {index > 0 && <ChevronRight className="h-4 w-4" />}
              {item.href ? (
                <Link
                  href={item.href}
                  className="hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-foreground">{item.label}</span>
              )}
            </div>
          ))}
        </nav>
      )}

      {/* Header content */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h1 
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ 
              color: getTextColor(),
              textShadow: getShadowStyle()
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-lg text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="ml-4 flex items-center space-x-2">{actions}</div>
        )}
      </div>
    </div>
  );
}

export default PageHeader;
