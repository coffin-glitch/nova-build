import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import Script from "next/script";

const inter = Inter({ 
  subsets: ["latin"], 
  variable: "--font-inter" 
});

export const metadata: Metadata = {
  title: "NOVA Build",
  description: "Carrier portal & Bid Board",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans min-h-screen bg-gradient-to-b from-surface-50 to-surface-100 dark:from-surface-900 dark:to-surface-950`}>
        <ClerkProvider
          appearance={{
            layout: {
              socialButtonsVariant: "iconButton",
            },
            elements: {
              formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground",
              card: "shadow-sm",
              headerTitle: "color: hsl(var(--foreground))",
              headerSubtitle: "text-muted-foreground",
              socialButtonsBlockButton: "hover:bg-accent",
              formFieldInput: "",
              formFieldLabel: "color: hsl(var(--foreground))",
            }
          }}
        >
          {children}
          
          {/* Toast notifications */}
          <Toaster richColors />
        </ClerkProvider>
      </body>
    </html>
  );
}