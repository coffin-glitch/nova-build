"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { ArrowRight, Shield, Sparkles, Truck, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function FloatingBubbleLanding() {
  const { user, isLoaded } = useUnifiedUser();
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isLoaded && !user) {
      // Show bubble after a short delay for unauthenticated users
      const timer = setTimeout(() => {
        setIsVisible(true);
        setTimeout(() => setIsAnimating(true), 100);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      setIsAnimating(false);
    }
  }, [isLoaded, user]);

  // Don't render if user is authenticated or still loading
  if (!isLoaded || user) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Bubble Container */}
      <div
        className={cn(
          "relative transition-all duration-1000 ease-out",
          isVisible ? "opacity-100 scale-100" : "opacity-0 scale-50"
        )}
      >
        {/* Main Bubble */}
        <Card
          className={cn(
            "relative overflow-hidden border-0 shadow-2xl transition-all duration-1000 ease-out",
            "bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-50",
            "dark:from-blue-950/50 dark:via-purple-950/50 dark:to-indigo-950/50",
            "backdrop-blur-xl border border-white/20 dark:border-white/10",
            isAnimating ? "animate-pulse" : ""
          )}
        >
          <CardContent className="p-8 text-center max-w-md">
            {/* Logo */}
            <div className="mb-6">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
                <Truck className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                NOVA
              </h1>
              <p className="text-muted-foreground mt-2">
                Premium Freight Marketplace
              </p>
            </div>

            {/* Features */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                <Sparkles className="w-4 h-4 text-yellow-500" />
                <span>Smart Load Matching</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                <Zap className="w-4 h-4 text-blue-500" />
                <span>Real-time Bidding</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-green-500" />
                <span>Secure & Reliable</span>
              </div>
            </div>

            {/* Call to Action */}
            <div className="space-y-3">
              <Button asChild size="lg" className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg">
                <Link href="/sign-in" className="flex items-center justify-center space-x-2">
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              
              <p className="text-xs text-muted-foreground">
                Join thousands of carriers already using NOVA
              </p>
            </div>
          </CardContent>

          {/* Floating Particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "absolute w-2 h-2 bg-blue-400/30 rounded-full animate-pulse",
                  "dark:bg-blue-300/20"
                )}
                style={{
                  left: `${20 + i * 15}%`,
                  top: `${30 + (i % 3) * 20}%`,
                  animationDelay: `${i * 0.5}s`,
                  animationDuration: `${2 + i * 0.3}s`,
                }}
              />
            ))}
          </div>
        </Card>

        {/* Background Glow */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-indigo-400/20 rounded-full blur-3xl scale-150 animate-pulse" />
      </div>
    </div>
  );
}
