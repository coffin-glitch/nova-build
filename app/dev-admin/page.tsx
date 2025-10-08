import { Suspense } from "react";
import DevAdminClient from "./DevAdminClient";

export default function DevAdminPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 text-white relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
        
        {/* Floating Particles */}
        <div className="absolute top-20 left-20 w-2 h-2 bg-white/30 rounded-full animate-ping"></div>
        <div className="absolute top-40 right-32 w-1 h-1 bg-purple-300/50 rounded-full animate-ping delay-700"></div>
        <div className="absolute bottom-32 left-40 w-1.5 h-1.5 bg-blue-300/40 rounded-full animate-ping delay-300"></div>
        <div className="absolute bottom-20 right-20 w-1 h-1 bg-indigo-300/60 rounded-full animate-ping delay-1000"></div>
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8">
          <div className="relative">
            {/* Rounded background container */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800/20 via-purple-900/30 to-indigo-900/20 rounded-3xl blur-sm"></div>
            <div className="relative bg-gradient-to-br from-slate-800/40 via-purple-900/50 to-indigo-900/40 backdrop-blur-md rounded-3xl border border-white/10 shadow-2xl p-8">
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-[400px]">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
                    <div className="absolute inset-0 animate-spin rounded-full h-32 w-32 border-t-2 border-purple-400 opacity-50" style={{ animationDirection: 'reverse' }}></div>
                  </div>
                </div>
              }>
                <DevAdminClient />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
