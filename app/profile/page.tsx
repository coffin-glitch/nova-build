import { requireSignedIn } from "@/lib/auth";
import { getSupabaseUserInfo } from "@/lib/auth-unified";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

async function getRole(userId: string) {
  const rows = await sql/*sql*/`select role from public.user_roles_cache where supabase_user_id = ${userId} limit 1`;
  return rows?.[0]?.role ?? "—";
}

async function getStats(userId: string, role: string) {
  // Only fetch stats for carriers (admins don't have these stats)
  if (role === 'admin') {
    return { offers: 0, assignments: 0 };
  }
  
  // For carriers, use correct column names
  // load_offers has supabase_carrier_user_id (not supabase_user_id)
  // assignments has supabase_user_id
  try {
    const offers = await sql/*sql*/`
      SELECT count(*)::int as c 
      FROM public.load_offers 
      WHERE COALESCE(supabase_carrier_user_id, carrier_user_id) = ${userId}
    `;
    const assigns = await sql/*sql*/`
      SELECT count(*)::int as c 
      FROM public.assignments 
      WHERE supabase_user_id = ${userId}
    `;
    return { offers: offers?.[0]?.c ?? 0, assignments: assigns?.[0]?.c ?? 0 };
  } catch (error: any) {
    // If columns don't exist, return zeros
    console.error('Error fetching stats:', error);
    return { offers: 0, assignments: 0 };
  }
}

async function getCarrierProfile(userId: string) {
  try {
    const profile = await sql/*sql*/`
      SELECT 
        legal_name,
        mc_number,
        dot_number,
        phone,
        contact_name,
        email,
        company_name,
        address_line1,
        address_line2,
        city,
        state,
        zip_code,
        created_at
      FROM carrier_profiles 
      WHERE supabase_user_id = ${userId}
      LIMIT 1
    `;
    return profile[0] || null;
  } catch (error) {
    console.error('Error fetching carrier profile:', error);
    return null;
  }
}

export default async function ProfilePage() {
  const userId = await requireSignedIn();
  const role = await getRole(userId);
  const stats = await getStats(userId, role);
  const userInfo = await getSupabaseUserInfo(userId);
  const carrierProfile = role === 'carrier' ? await getCarrierProfile(userId) : null;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8" data-aos="fade-up">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">My Profile</h1>
        <p className="text-gray-600">
          {role === 'admin' ? 'Manage your admin profile and settings' : 'Manage your carrier profile and preferences'}
        </p>
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
                <p className="text-gray-900">
                  {userInfo.fullName || `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Not set'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <p className="text-gray-900">
                  {userInfo.emailAddresses[0]?.emailAddress || 'Not set'}
                </p>
              </div>
              {role === 'carrier' && carrierProfile && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                    <p className="text-gray-900">{carrierProfile.phone || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">MC Number</label>
                    <p className="text-gray-900">{carrierProfile.mc_number || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">USDOT Number</label>
                    <p className="text-gray-900">{carrierProfile.dot_number || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Member Since</label>
                    <p className="text-gray-900">
                      {carrierProfile.created_at 
                        ? new Date(carrierProfile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                        : 'Not set'}
                    </p>
                  </div>
                </>
              )}
              {role === 'admin' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                    <p className="text-gray-900 capitalize">{role}</p>
                  </div>
                </>
              )}
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
            
            {role === 'carrier' && carrierProfile ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                  <p className="text-gray-900">{carrierProfile.company_name || carrierProfile.legal_name || 'Not set'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <p className="text-gray-900">
                    {carrierProfile.address_line1 || 'Not set'}
                    {carrierProfile.address_line2 && <><br/>{carrierProfile.address_line2}</>}
                    {carrierProfile.city && carrierProfile.state && (
                      <><br/>{carrierProfile.city}, {carrierProfile.state} {carrierProfile.zip_code || ''}</>
                    )}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Name</label>
                  <p className="text-gray-900">{carrierProfile.contact_name || 'Not set'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <p className="text-gray-900">{carrierProfile.email || userInfo.emailAddresses[0]?.emailAddress || 'Not set'}</p>
                </div>
              </div>
            ) : role === 'admin' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Admin Account</label>
                  <p className="text-gray-900">Administrator</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Access Level</label>
                  <p className="text-gray-900">Full System Access</p>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-sm">No profile information available</div>
            )}
          </div>

          {role === 'carrier' && (
            <div className="bg-white rounded-xl p-6 profile-card shadow-sm border border-gray-100" data-aos="fade-up">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Preferences</h2>
                <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                  <i data-feather="edit" className="w-4 h-4 inline mr-1"></i> Edit
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notification Preferences</label>
                  <p className="text-gray-900">Email notifications enabled</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Status</label>
                  <p className="text-gray-900">Active</p>
                </div>
              </div>
            </div>
          )}
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