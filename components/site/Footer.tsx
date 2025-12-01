import { Mail, Phone } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-background border-t border-border text-foreground mt-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h4 className="text-lg font-semibold mb-3 text-foreground">NOVA</h4>
            <p className="text-muted-foreground text-sm">Modern load marketplace for carriers and admins.</p>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-3 text-foreground">Quick Links</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/carrier/my-bids" className="hover:text-foreground transition-colors">My Bids</a></li>
              <li><a href="/my-loads" className="hover:text-foreground transition-colors">My Loads</a></li>
              {/* Removed unused page: /payments */}
              <li><a href="/profile" className="hover:text-foreground transition-colors">Account</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-3 text-foreground">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/help" className="hover:text-foreground transition-colors">Help Center</a></li>
              <li><a href="/contact" className="hover:text-foreground transition-colors">Contact Us</a></li>
              {/* Removed unused page: /faq */}
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-3 text-foreground">Contact</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center"><Phone className="h-4 w-4 mr-2" /> 832-529-5871</li>
              <li className="flex items-center"><Mail className="h-4 w-4 mr-2" /> support@novafreight.io</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border mt-8 pt-8 text-sm text-muted-foreground">
          © {new Date().getFullYear()} NOVA. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
