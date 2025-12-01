"use client";

import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { Button } from "@/components/ui/button";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useUnifiedRole } from "@/hooks/useUnifiedRole";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { getButtonTextColor as getTextColor } from "@/lib/utils";
import {
  ArrowRight,
  CheckCircle,
  Clock,
  DollarSign,
  MapPin,
  Shield,
  Truck,
  Zap
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { accentColor } = useAccentColor();
  const { user, isLoaded } = useUnifiedUser();
  const { role, isLoading: roleLoading } = useUnifiedRole();
  const router = useRouter();

  // Redirect admins to admin dashboard
  useEffect(() => {
    if (!roleLoading && role === "admin") {
      router.replace("/admin");
    }
  }, [role, roleLoading, router]);
  
  // Smart color handling for button text based on background color
  // Note: theme not available here, but light mode is default
  const getButtonTextColor = () => {
    return getTextColor(accentColor, 'light');
  };

  // 🐛 DEBUG: Log auth state (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('🐛 [HOME PAGE DEBUG] Auth state:');
    console.log('🐛 - isLoaded:', isLoaded);
    console.log('🐛 - Has user:', !!user);
    console.log('🐛 - User email:', user?.emailAddresses?.[0]?.emailAddress || user?.email || 'None');
    console.log('🐛 - User ID:', user?.id || 'None');
  }

  // Show landing page for unauthenticated users
  if (!isLoaded || !user) {
    if (process.env.NODE_ENV === 'development') {
      console.log('🐛 [HOME PAGE DEBUG] Showing landing page (not authenticated)');
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-4xl mx-auto text-center px-4">
          <div className="mb-8">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-6 shadow-lg">
              <Truck className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Welcome to{" "}
              <span className="bg-gradient-to-r from-blue-500 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                NOVA
              </span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              The modern logistics platform connecting carriers with premium freight opportunities. 
              Real-time bidding, smart matching, and dedicated lanes for the freight industry.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="flex items-center justify-center space-x-3 p-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/50 dark:to-purple-950/50">
              <Zap className="h-6 w-6 text-blue-600" />
              <span className="font-medium">Smart Load Matching</span>
            </div>
            <div className="flex items-center justify-center space-x-3 p-4 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/50 dark:to-indigo-950/50">
              <Clock className="h-6 w-6 text-purple-600" />
              <span className="font-medium">Real-time Bidding</span>
            </div>
            <div className="flex items-center justify-center space-x-3 p-4 rounded-lg bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/50 dark:to-blue-950/50">
              <Shield className="h-6 w-6 text-indigo-600" />
              <span className="font-medium">Secure & Reliable</span>
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-4">
            <Button asChild size="lg" className="w-full max-w-md bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg">
              <Link href="/sign-in" className="flex items-center justify-center space-x-2">
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              Join thousands of carriers already using NOVA
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  // Show full homepage for authenticated users
  if (process.env.NODE_ENV === 'development') {
    console.log('🐛 [HOME PAGE DEBUG] Showing authenticated homepage');
  }
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            Connect with{" "}
            <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
              Quality Loads
            </span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            The modern logistics platform connecting carriers with premium freight opportunities. 
            Real-time bidding, smart matching, and dedicated lanes for the freight industry.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              asChild 
              size="lg" 
              className="text-lg px-8 py-6 group"
              style={{ backgroundColor: accentColor, color: getButtonTextColor() }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${accentColor}dd`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = accentColor;
              }}
            >
              <Link href="/carrier">
                <MapPin className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                Dashboard
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6 group">
              <Link href="/bid-board">
                <DollarSign className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                Live Auctions
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
          
          {/* Feature strip */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>10,000+ Active Carriers</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>$2.5M+ Monthly Load Value</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>99.8% On-time Delivery</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <PageHeader 
          title="Why Choose NOVA?" 
          subtitle="Built for carriers who demand efficiency and reliability"
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Smart Matching */}
          <SectionCard className="group hover:shadow-card transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Smart Matching</h3>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              AI-powered load matching based on your equipment, location, and preferences for maximum efficiency.
            </p>
          </SectionCard>

          {/* Real-time Bidding */}
          <SectionCard className="group hover:shadow-card transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Real-time Bidding</h3>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              25-minute live auctions with instant bid updates and transparent pricing for fair competition.
            </p>
          </SectionCard>

          {/* Dedicated Lanes */}
          <SectionCard className="group hover:shadow-card transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                <Truck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Dedicated Lanes</h3>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Secure recurring routes and dedicated partnerships with shippers for consistent revenue streams.
            </p>
          </SectionCard>

          {/* Secure & Reliable */}
          <SectionCard className="group hover:shadow-card transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Secure & Reliable</h3>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Enterprise-grade security, verified shippers, and guaranteed payments for peace of mind.
            </p>
          </SectionCard>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <SectionCard className="text-center bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of carriers already using NOVA Build to find better loads and grow their business.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8 py-6 group">
              <Link href="/find-loads">
                Start Finding Loads
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6 group">
              <Link href="/contact">
                Contact Sales
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </SectionCard>
      </section>
    </div>
  );
}