"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Truck, Compass, Book, DollarSign, Settings, User } from "lucide-react";
import { useEffect } from "react";

const nav = [
  { href: "/book-loads", label: "Find Loads", icon: Compass },
  { href: "/my-loads", label: "My Loads", icon: Book },
  { href: "/payments", label: "Payments", icon: DollarSign },
  { href: "/profile", label: "Account", icon: Settings },
];

export default function NavBar() {
  const pathname = usePathname();
  useEffect(() => { /* hook if we later add scroll shadow */ }, []);

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-black/5 sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Truck className="h-6 w-6 text-blue-600" />
          <span className="text-lg font-bold tracking-tight text-gray-900">NOVA</span>
        </Link>
        <div className="hidden md:flex items-center gap-6">
          {nav.map((n) => {
            const active = pathname?.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`inline-flex items-center gap-2 text-sm font-medium border-b-2 transition-colors
                  ${active ? "text-gray-900 border-blue-500" : "text-gray-500 hover:text-gray-800 border-transparent"}`}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-sm text-gray-700">Hello, Carrier</div>
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="h-4 w-4 text-blue-600" />
          </div>
        </div>
      </div>
    </nav>
  );
}
