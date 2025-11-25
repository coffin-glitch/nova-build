"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Shield } from "lucide-react";
import Link from "next/link";
import { useAccentColor } from "@/hooks/useAccentColor";

export default function ForbiddenPage() {
  const { accentColor, accentColorStyle, accentBgStyle } = useAccentColor();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: `${accentColor}20` }}>
            <Shield className="w-8 h-8" style={accentColorStyle} />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">
            Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            You don't have permission to access this page. Please contact an administrator if you believe this is an error.
          </p>
          <div className="flex flex-col space-y-2">
            <Button asChild className="w-full" style={accentBgStyle}>
              <Link href="/" className="flex items-center justify-center space-x-2">
                <ArrowLeft className="w-4 h-4" />
                <span>Go Home</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/sign-in">Sign In</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}