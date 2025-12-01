import { Github, Linkedin, Mail, MapPin, Phone, Truck, Twitter } from "lucide-react";
import Link from "next/link";

const currentYear = new Date().getFullYear();

const footerLinks = {
  product: [
    { name: "Live Auctions", href: "/bid-board" },
    { name: "My Bids", href: "/carrier/my-bids" },
  ],
  company: [
    // Removed unused pages: /about, /press, /blog
  ],
  legal: [
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Terms of Service", href: "/terms" },
    { name: "Cookie Policy", href: "/cookies" },
    { name: "GDPR", href: "/gdpr" },
  ],
  support: [
    { name: "Help Center", href: "/help" },
    { name: "Contact Us", href: "/contact" },
    // Removed unused pages: /docs, /status
  ],
};

const socialLinks = [
  { name: "Twitter", href: "#", icon: Twitter },
  { name: "LinkedIn", href: "#", icon: Linkedin },
  { name: "GitHub", href: "#", icon: Github },
];

export default function SiteFooter() {
  return (
    <footer className="relative border-t border-border bg-background/95 backdrop-blur-sm">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/50 to-transparent pointer-events-none"></div>
      
      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Truck className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">NOVA</span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              The modern logistics platform connecting carriers with quality loads through our premium freight marketplace.
            </p>
            <div className="mt-6 flex space-x-4">
              {socialLinks.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground transition-colors hover:scale-110 transform duration-200"
                >
                  <span className="sr-only">{item.name}</span>
                  <item.icon className="h-5 w-5" />
                </Link>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Product</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.product.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors hover:underline underline-offset-4"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company - Removed empty section */}

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Legal</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.legal.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors hover:underline underline-offset-4"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Support</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.support.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors hover:underline underline-offset-4"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6 space-y-2">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>support@novafreight.io</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>832-529-5871</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>San Francisco, CA</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom section */}
        <div className="mt-12 border-t border-border pt-8">
          <div className="flex flex-col items-center justify-between space-y-4 md:flex-row md:space-y-0">
            <p className="text-sm text-muted-foreground">
              © {currentYear} NOVA. All rights reserved.
            </p>
            <div className="flex items-center space-x-6 text-sm text-muted-foreground">
              <span>Made with ❤️ for the logistics industry</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
