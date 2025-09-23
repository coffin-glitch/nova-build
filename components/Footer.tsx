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
    { name: "Find Loads", href: "/bid-board" },
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
    <footer className="bg-gray-800 text-white py-8 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h4 className="text-lg font-semibold mb-4">NOVA Build</h4>
            <p className="text-gray-400 text-sm">Connecting carriers with quality loads since 2024.</p>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {footerLinks.quickLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-gray-400 hover:text-white text-sm">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-4">Support</h4>
            <ul className="space-y-2">
              {footerLinks.support.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-gray-400 hover:text-white text-sm">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-4">Contact</h4>
            <ul className="space-y-2">
              <li className="flex items-center text-gray-400 text-sm">
                <i data-feather="phone" className="w-4 h-4 mr-2"></i> (800) 555-1234
              </li>
              <li className="flex items-center text-gray-400 text-sm">
                <i data-feather="mail" className="w-4 h-4 mr-2"></i> support@novabuild.com
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-700 mt-8 pt-8 text-sm text-gray-400">
          <p>© {new Date().getFullYear()} NOVA Build. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
