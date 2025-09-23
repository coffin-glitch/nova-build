import { requireSignedIn } from "@/lib/auth";
import sql from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Award, FileText, CheckCircle, Edit, Lock, Bell, CreditCard, Mail, HelpCircle, MessageSquare } from "lucide-react";
import ClientProfile from "@/components/ClientProfile";

export const dynamic = "force-dynamic";

async function getRole(userId: string) {
  const rows = await sql/*sql*/`select role from public.user_roles where clerk_user_id = ${userId} limit 1`;
  return rows?.[0]?.role ?? "—";
}

async function getStats(userId: string) {
  const offers = await sql/*sql*/`select count(*)::int as c from public.load_offers where clerk_user_id = ${userId}`;
  const assigns = await sql/*sql*/`select count(*)::int as c from public.assignments where clerk_user_id = ${userId}`;
  return { offers: offers?.[0]?.c ?? 0, assignments: assigns?.[0]?.c ?? 0 };
}

export default async function ProfilePage() {
  const userId = await requireSignedIn();
  const role = await getRole(userId);
  const stats = await getStats(userId);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8" data-aos="fade-up">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">My Profile</h1>
        <p className="text-gray-600">Manage your carrier profile and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Profile Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information Card */}
          <div className="bg-white rounded-xl p-6 profile-card shadow-sm border border-gray-100" data-aos="fade-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Personal Information</h2>
              <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                <i data-feather="edit" className="w-4 h-4 inline mr-1"></i> Edit
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <p className="text-gray-900">John Carrier</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <p className="text-gray-900">john.carrier@example.com</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                <p className="text-gray-900">(555) 123-4567</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">MC Number</label>
                <p className="text-gray-900">MC-1234567</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">USDOT Number</label>
                <p className="text-gray-900">123456789</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Carrier Since</label>
                <p className="text-gray-900">January 2018</p>
              </div>
            </div>
          </div>

          {/* Company Information Card */}
          <div className="bg-white rounded-xl p-6 profile-card shadow-sm border border-gray-100" data-aos="fade-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Company Information</h2>
              <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                <i data-feather="edit" className="w-4 h-4 inline mr-1"></i> Edit
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                <p className="text-gray-900">Carrier Express LLC</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <p className="text-gray-900">123 Trucker Lane<br/>Dallas, TX 75201</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Type</label>
                <p className="text-gray-900">Owner Operator</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fleet Size</label>
                <p className="text-gray-900">2 Trucks</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Primary Equipment</label>
                <p className="text-gray-900">Dry Van (53')</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Operating Radius</label>
                <p className="text-gray-900">National</p>
              </div>
            </div>
          </div>

          {/* Preferences Card */}
          <div className="bg-white rounded-xl p-6 profile-card shadow-sm border border-gray-100" data-aos="fade-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Preferences</h2>
              <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                <i data-feather="edit" className="w-4 h-4 inline mr-1"></i> Edit
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Lanes</label>
                <p className="text-gray-900">Midwest, Southeast</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Rate</label>
                <p className="text-gray-900">$2.00/mile</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notification Preferences</label>
                <p className="text-gray-900">Email & SMS</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                <p className="text-gray-900">English</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Stats & Actions */}
        <div className="space-y-6">
          {/* Stats Card */}
          <div className="stats-card rounded-xl p-6 text-white" data-aos="fade-up">
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                <i data-feather="truck" className="w-10 h-10"></i>
              </div>
              <h3 className="text-xl font-semibold">Performance Stats</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Load Completion Rate</span>
                <span className="font-semibold">98.7%</span>
              </div>
              <div className="flex justify-between items-center">
                <span>On-Time Delivery</span>
                <span className="font-semibold">96.2%</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Average Rating</span>
                <span className="font-semibold">4.8 ★</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Total Loads</span>
                <span className="font-semibold">{stats.offers + stats.assignments}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100" data-aos="fade-up">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
            
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                <span className="text-gray-700">Update Documents</span>
                <i data-feather="file-text" className="w-5 h-5 text-gray-400"></i>
              </button>
              <button className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                <span className="text-gray-700">Change Password</span>
                <i data-feather="lock" className="w-5 h-5 text-gray-400"></i>
              </button>
              <button className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                <span className="text-gray-700">Notification Settings</span>
                <i data-feather="bell" className="w-5 h-5 text-gray-400"></i>
              </button>
              <button className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                <span className="text-gray-700">Payment Methods</span>
                <i data-feather="credit-card" className="w-5 h-5 text-gray-400"></i>
              </button>
            </div>
          </div>

          {/* Support Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100" data-aos="fade-up">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Need Help?</h3>
            
            <div className="space-y-3">
              <a href="/contact" className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                <span className="text-gray-700">Contact Support</span>
                <i data-feather="mail" className="w-5 h-5 text-gray-400"></i>
              </a>
              <button className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                <span className="text-gray-700">FAQs</span>
                <i data-feather="help-circle" className="w-5 h-5 text-gray-400"></i>
              </button>
              <button className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                <span className="text-gray-700">Give Feedback</span>
                <i data-feather="message-square" className="w-5 h-5 text-gray-400"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}