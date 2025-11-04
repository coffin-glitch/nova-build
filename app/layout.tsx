import { CarrierVerificationConsole } from "@/components/admin/CarrierVerificationConsole";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeaderNew";
import { UserPreferencesProvider } from "@/components/providers/UserPreferencesProvider";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";
import { ClerkCookieCleanup } from "@/components/ClerkCookieCleanup";
import FloatingAdminChatButton from "@/components/ui/FloatingAdminChatButton";
import FloatingCarrierChatButtonNew from "@/components/ui/FloatingCarrierChatButtonNew";
import FloatingDevAdminButton from "@/components/ui/FloatingDevAdminButton";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"], 
  variable: "--font-inter" 
});

export const metadata: Metadata = {
  title: "NOVA - Premium Freight Marketplace",
  description: "Connect with quality loads and bid on premium freight opportunities. The modern logistics platform for carriers and shippers.",
  keywords: "freight, logistics, carrier, shipping, loads, bidding, marketplace",
};

// Shared layout content
const LayoutContent = ({ children }: { children: React.ReactNode }) => (
  <>
    <div className="relative min-h-screen">
      {/* Premium background with subtle gradient and texture */}
      <div className="fixed inset-0 bg-background" />
      <div className="fixed inset-0 bg-gradient-to-br from-surface-50 via-transparent to-surface-100 dark:from-surface-900 dark:via-transparent dark:to-surface-950" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.03),transparent_50%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.05),transparent_50%)]" />
      
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans min-h-screen bg-background`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <UserPreferencesProvider>
            <SupabaseProvider>
              <ClerkCookieCleanup />
              <LayoutContent>{children}</LayoutContent>
            </SupabaseProvider>
          </UserPreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
