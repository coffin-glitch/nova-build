import { UserPreferencesProvider } from "@/components/providers/UserPreferencesProvider";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";
import { ClerkCookieCleanup } from "@/components/ClerkCookieCleanup";
import { LayoutContent } from "@/components/layout/LayoutContent";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Inter } from "next/font/google";
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
