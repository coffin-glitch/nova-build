import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import Nav from "@/components/Nav"; // client component (uses "use client")

export const metadata: Metadata = {
  title: "NOVA Build",
  description: "Carrier portal & Bid Board",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ClerkProvider>
          <Nav />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
