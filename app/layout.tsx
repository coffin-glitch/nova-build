import { UserPreferencesProvider } from "@/components/providers/UserPreferencesProvider";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";
import { ClerkCookieCleanup } from "@/components/ClerkCookieCleanup";
import { LayoutContent } from "@/components/layout/LayoutContent";
import { ErrorHandler } from "@/components/ErrorHandler";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Inter } from "next/font/google";
import "./globals.css";

// Client-side error handler for unhandled errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    // Enhanced error logging for unhandled errors
    const errorInfo = {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
      // Check if it's a temporal dead zone error
      isTDZError: event.message.includes("Cannot access") && event.message.includes("before initialization"),
    };
    
    console.error("🚨 [WindowError] Unhandled error:", errorInfo);
    
    if (errorInfo.isTDZError) {
      console.error("🚨 [WindowError] TDZ error detected. This indicates a circular dependency or initialization order issue.");
      console.error("🚨 [WindowError] File:", event.filename, "Line:", event.lineno);
    }
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    console.error("🚨 [WindowError] Unhandled promise rejection:", event.reason);
  });
}

const inter = Inter({ 
  subsets: ["latin"], 
  variable: "--font-inter" 
});

export const metadata: Metadata = {
  title: "NOVA - Premium Freight Marketplace",
  description: "Connect with quality loads and bid on premium freight opportunities. The modern logistics platform for carriers and shippers.",
  keywords: "freight, logistics, carrier, shipping, loads, bidding, marketplace",
};


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
          <ErrorHandler />
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
