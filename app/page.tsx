import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Glass } from "@/components/ui/glass";
import { SectionHeader } from "@/components/ui/section";
import { 
  Truck, 
  Zap, 
  Shield, 
  Clock, 
  MapPin, 
  DollarSign,
  Users,
  CheckCircle
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Connect with{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/70">
                Quality Loads
              </span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Streamlined logistics platform connecting carriers with premium freight opportunities. 
              Real-time bidding, smart matching, and dedicated lanes for the modern freight industry.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg px-8 py-6">
                <Link href="/find-loads">
                  <MapPin className="mr-2 h-5 w-5" />
                  Find Loads
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6">
                <Link href="/bid-board">
                  <DollarSign className="mr-2 h-5 w-5" />
                  Live Auctions
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <SectionHeader 
            title="Why Choose NOVA Build?" 
            subtitle="Built for carriers who demand efficiency and reliability"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Smart Matching */}
            <Glass className="p-6 hover:shadow-card transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Smart Matching</h3>
              </div>
              <p className="text-muted-foreground text-sm">
                AI-powered load matching based on your equipment, location, and preferences for maximum efficiency.
              </p>
            </Glass>

            {/* Real-time Bidding */}
            <Glass className="p-6 hover:shadow-card transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Real-time Bidding</h3>
              </div>
              <p className="text-muted-foreground text-sm">
                25-minute live auctions with instant bid updates and transparent pricing for fair competition.
              </p>
            </Glass>

            {/* Dedicated Lanes */}
            <Glass className="p-6 hover:shadow-card transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Truck className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Dedicated Lanes</h3>
              </div>
              <p className="text-muted-foreground text-sm">
                Secure recurring routes and dedicated partnerships with shippers for consistent revenue streams.
              </p>
            </Glass>

            {/* Secure & Reliable */}
            <Glass className="p-6 hover:shadow-card transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Secure & Reliable</h3>
              </div>
              <p className="text-muted-foreground text-sm">
                Enterprise-grade security, verified shippers, and guaranteed payments for peace of mind.
              </p>
            </Glass>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">10,000+</div>
              <div className="text-muted-foreground">Active Carriers</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">$2.5M+</div>
              <div className="text-muted-foreground">Monthly Load Value</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">99.8%</div>
              <div className="text-muted-foreground">On-time Delivery</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary/5">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join thousands of carriers already using NOVA Build to find better loads and grow their business.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg px-8 py-6">
                <Link href="/find-loads">
                  Start Finding Loads
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6">
                <Link href="/contact">
                  Contact Sales
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}