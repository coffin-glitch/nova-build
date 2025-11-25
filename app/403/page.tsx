"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAccentColor } from "@/hooks/useAccentColor";

export default function UnauthorizedPage() {
  const { accentColor, accentBgStyle } = useAccentColor();
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="p-8 text-center max-w-md">
        <div className="space-y-4">
          <div className="text-6xl">🚫</div>
          <h1 className="text-2xl font-bold color: hsl(var(--foreground))">Access Denied</h1>
          <p className="text-muted-foreground">
            You don&apos;t have permission to access this page. Please contact an administrator if you believe this is an error.
          </p>
          <div className="flex gap-2 justify-center">
            <Button asChild style={accentBgStyle}>
              <Link href="/">Go Home</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/profile">View Profile</Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
