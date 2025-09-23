import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              {title}
            </span>
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
