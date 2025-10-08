"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import SectionCard from "@/components/layout/SectionCard";
import PageHeader from "@/components/layout/PageHeader";
import { 
  Truck, 
  Zap, 
  Shield, 
  Clock, 
  MapPin, 
  DollarSign,
  Users,
  CheckCircle,
  ArrowRight,
  Star
} from "lucide-react";
import { useAccentColor } from "@/hooks/useAccentColor";

export default function HomePage() {
  const { accentColor } = useAccentColor();
  
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
              style={{ backgroundColor: accentColor }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${accentColor}dd`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = accentColor;
              }}
            >
              <Link href="/find-loads">
                <MapPin className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                Find Loads
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
          title="Why Choose NOVA Build?" 
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