import { Phone, Mail } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white mt-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h4 className="text-lg font-semibold mb-3">NOVA</h4>
            <p className="text-gray-400 text-sm">Modern load marketplace for carriers and admins.</p>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="/book-loads" className="hover:text-white">Find Loads</a></li>
              <li><a href="/my-loads" className="hover:text-white">My Loads</a></li>
              <li><a href="/payments" className="hover:text-white">Payments</a></li>
              <li><a href="/profile" className="hover:text-white">Account</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-3">Support</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="/help" className="hover:text-white">Help Center</a></li>
              <li><a href="/contact" className="hover:text-white">Contact Us</a></li>
              <li><a href="/faq" className="hover:text-white">FAQs</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-3">Contact</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-center"><Phone className="h-4 w-4 mr-2" /> (800) 555-1234</li>
              <li className="flex items-center"><Mail className="h-4 w-4 mr-2" /> support@novaloads.com</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 mt-8 pt-8 text-sm text-gray-400">
          © {new Date().getFullYear()} NOVA. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
