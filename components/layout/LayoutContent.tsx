"use client";

import { CarrierVerificationConsole } from "@/components/admin/CarrierVerificationConsole";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeaderNew";
import FloatingDevAdminButton from "@/components/ui/FloatingDevAdminButton";
import { GlowingBackground } from "@/components/ui/GlowingBackground";
import { useUserPreferences } from "@/components/providers/UserPreferencesProvider";
import { Toaster } from "sonner";
import dynamic from "next/dynamic";
import { useMemo } from "react";

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const { preferences } = useUserPreferences();
  
  // Dynamically import chat components inside component to avoid module-level evaluation
  // This prevents circular dependency issues during initialization
  const FloatingAdminChatButton = useMemo(
    () => dynamic(
      () => import("@/components/ui/FloatingAdminChatButton"),
      { 
        ssr: false,
        loading: () => null,
      }
    ),
    []
  );
  
  const FloatingCarrierChatButtonNew = useMemo(
    () => dynamic(
      () => import("@/components/ui/FloatingCarrierChatButtonNew"),
      { 
        ssr: false,
        loading: () => null,
      }
    ),
    []
  );
  
  return (
    <>
      <div className="relative min-h-screen">
        {/* Premium background with subtle gradient and texture */}
        <div className="fixed inset-0 bg-background z-0" />
        <div className="fixed inset-0 bg-gradient-to-br from-surface-50 via-transparent to-surface-100 dark:from-surface-900 dark:via-transparent dark:to-surface-950 z-0" />
        <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.03),transparent_50%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.05),transparent_50%)] z-0" />
        
        {/* Glowing background effect - appears on all pages */}
        <div className="fixed inset-0 z-[1]">
          <GlowingBackground enabled={preferences.glowingBackgroundEnabled} />
        </div>
        
        {/* Content */}
        <div className="relative z-10">
          <SiteHeader />
          <main className="min-h-screen">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
          <SiteFooter />
        </div>
      </div>
      
      {/* Toast notifications - mounted once */}
      <Toaster 
        richColors 
        position="top-right"
        toastOptions={{
          style: {
            background: 'hsl(var(--card))',
            color: 'hsl(var(--card-foreground))',
            border: '1px solid hsl(var(--border))',
          },
        }}
      />
      
      {/* Floating Carrier Messages Button */}
      <FloatingCarrierChatButtonNew />
      <FloatingAdminChatButton />
      
      {/* Floating Dev Admin Button */}
      <FloatingDevAdminButton />
      
      {/* Carrier Verification Console */}
      <CarrierVerificationConsole />
    </>
  );
}

