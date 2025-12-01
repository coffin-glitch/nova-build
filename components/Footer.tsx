import Link from "next/link";
import { 
  Truck, 
  Mail, 
  Phone, 
  MapPin, 
  Twitter, 
  Linkedin, 
  Github,
  Sparkles,
  ArrowRight
} from "lucide-react";

const footerLinks = {
  quickLinks: [
    { name: "My Bids", href: "/carrier/my-bids" },
    { name: "My Loads", href: "/my-loads" },
    { name: "My Offers", href: "/current-offers" },
    { name: "Profile", href: "/profile" },
  ],
  support: [
    { name: "Help Center", href: "/help" },
    { name: "Contact Us", href: "/contact" },
    { name: "FAQs", href: "/faq" },
  ],
};

const socialLinks = [
  { name: "Twitter", href: "#", icon: Twitter },
  { name: "LinkedIn", href: "#", icon: Linkedin },
  { name: "GitHub", href: "#", icon: Github },
];

export default function Footer() {
  return (
    <footer className="bg-background border-t border-border text-foreground py-8 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h4 className="text-lg font-semibold mb-4 text-foreground">NOVA</h4>
            <p className="text-muted-foreground text-sm">Connecting carriers with quality loads since 2024.</p>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-4 text-foreground">Quick Links</h4>
            <ul className="space-y-2">
              {footerLinks.quickLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-4 text-foreground">Support</h4>
            <ul className="space-y-2">
              {footerLinks.support.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-4 text-foreground">Contact</h4>
            <ul className="space-y-2">
              <li className="flex items-center text-muted-foreground text-sm">
                <Phone className="w-4 h-4 mr-2" /> 832-529-5871
              </li>
              <li className="flex items-center text-muted-foreground text-sm">
                <Mail className="w-4 h-4 mr-2" /> support@novafreight.io
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border mt-8 pt-8 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} NOVA. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
