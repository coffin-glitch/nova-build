"use client";

import React, { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useAccentColor } from "@/hooks/useAccentColor";
import { 
  HelpCircle, 
  MessageSquare, 
  BookOpen, 
  Video, 
  FileText, 
  Search, 
  ChevronDown, 
  ChevronUp,
  Mail,
  Phone,
  Calendar,
  Truck,
  Gavel,
  Package,
  CreditCard,
  Shield,
  Settings,
  Bell,
  MapPin,
  Users,
  AlertCircle,
  CheckCircle,
  XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export default function HelpPage() {
  const { accentColor } = useAccentColor();
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const GlassCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div
      className={cn(
        "rounded-2xl border border-white/10 dark:border-white/5",
        "bg-white/40 dark:bg-surface-900/20 backdrop-blur-xl",
        "shadow-xl hover:shadow-2xl transition-all duration-300",
        "p-6 md:p-8",
        className
      )}
    >
      {children}
    </div>
  );

  const faqCategories = [
    {
      title: "Getting Started",
      icon: BookOpen,
      faqs: [
        {
          q: "How do I create an account?",
          a: "To create an account, click the 'Sign Up' button in the top right corner. You'll need to provide your email address, create a password, and verify your email. For carriers, you'll also need to complete your profile with business information including MC number, DOT number, and company details."
        },
        {
          q: "What information do I need to provide?",
          a: "Carriers need to provide: company name, MC number, DOT number, contact information, dispatch email, phone number, and business address. Shippers need to provide company information and contact details. All users need a verified email address."
        },
        {
          q: "How long does account approval take?",
          a: "Carrier accounts typically require manual approval and can take 1-3 business days. We review your business credentials and verify your information. You'll receive an email notification once your account is approved or if we need additional information."
        }
      ]
    },
    {
      title: "Bidding & Auctions",
      icon: Gavel,
      faqs: [
        {
          q: "How do I place a bid?",
          a: "Browse available loads on the Bid Board, click 'View Details' on a load you're interested in, review all the details including route, stops, and requirements, then enter your bid amount and click 'Place Bid'. Bids are binding once submitted."
        },
        {
          q: "Can I modify or cancel a bid?",
          a: "You can modify your bid before the auction closes, but you cannot cancel it. To modify, go to 'My Bids' and update your bid amount. The most recent bid amount will be used."
        },
        {
          q: "What happens when I win a bid?",
          a: "If you win a bid, you'll receive a notification via email and in-app. The load will be assigned to you, and you'll need to confirm acceptance. You'll then receive all necessary documentation and can coordinate directly with the shipper."
        },
        {
          q: "How long do auctions last?",
          a: "Most auctions have a 25-minute countdown timer from when the load is posted. You can see the remaining time on each bid card. Once the timer expires, the auction closes and the winning bid is selected."
        }
      ]
    },
    {
      title: "Loads & Shipping",
      icon: Package,
      faqs: [
        {
          q: "How do I find loads that match my preferences?",
          a: "Use the 'Find Loads' page to search by origin, destination, equipment type, and other criteria. You can also set up smart alerts in your Favorites Console to receive notifications when loads matching your saved routes become available."
        },
        {
          q: "What information is included in load details?",
          a: "Load details include: pickup and delivery locations (with full addresses), pickup and delivery times, distance, number of stops, equipment requirements, special instructions, and current bid status."
        },
        {
          q: "Can I save loads for later?",
          a: "Yes! You can favorite loads by clicking the heart icon. Favorite loads appear in your Favorites Console where you can set up smart alerts for similar loads."
        },
        {
          q: "How do I track my booked loads?",
          a: "Go to 'My Loads' in your carrier dashboard to see all your active and completed loads. You can view status updates, documentation, and communicate with shippers through the messaging system."
        }
      ]
    },
    {
      title: "Payments & Billing",
      icon: CreditCard,
      faqs: [
        {
          q: "How do I get paid?",
          a: "Payment is processed after load completion and verification. We support various payment methods including ACH transfer and wire transfer. Payment terms are specified in each load agreement."
        },
        {
          q: "When will I receive payment?",
          a: "Standard payment processing takes 2-3 business days after load completion and verification. Quick Pay options may be available for eligible carriers with faster processing times."
        },
        {
          q: "How do I update my payment information?",
          a: "Go to your Profile settings and navigate to the Payment section. You can add, update, or remove payment methods. All payment information is securely encrypted."
        },
        {
          q: "Are there any fees?",
          a: "Platform fees, if applicable, are clearly disclosed before you commit to a transaction. Review the load details and bid terms for specific fee information."
        }
      ]
    },
    {
      title: "Notifications & Alerts",
      icon: Bell,
      faqs: [
        {
          q: "How do I set up smart alerts?",
          a: "Go to your Favorites Console, select a favorited load, and click 'Enable Smart Alerts'. Choose between 'Exact Match' (same origin and destination) or 'State Match' (same state). You'll receive notifications when matching loads become available."
        },
        {
          q: "What types of notifications will I receive?",
          a: "You can receive notifications for: bid status updates (won/lost), new matching loads, favorite loads available, deadline reminders, messages from other users, and system announcements."
        },
        {
          q: "How do I manage my notification preferences?",
          a: "Go to your Profile settings and navigate to Notification Preferences. You can enable/disable email notifications, in-app notifications, and configure preferences for different notification types."
        }
      ]
    },
    {
      title: "Account & Profile",
      icon: Settings,
      faqs: [
        {
          q: "How do I update my profile information?",
          a: "Go to your Profile page and click 'Edit'. You can update your company information, contact details, equipment types, and preferences. Some changes may require re-verification."
        },
        {
          q: "What if I need to change my email address?",
          a: "Contact support to change your email address. You'll need to verify the new email address before it becomes active. This is a security measure to protect your account."
        },
        {
          q: "How do I reset my password?",
          a: "Click 'Forgot Password' on the sign-in page, enter your email address, and follow the instructions in the email you receive. The password reset link expires after 24 hours."
        },
        {
          q: "Can I deactivate my account?",
          a: "Yes, you can deactivate your account through your Profile settings. Deactivation is reversible within 30 days. After that, your account and data will be permanently deleted in accordance with our data retention policy."
        }
      ]
    },
    {
      title: "Safety & Security",
      icon: Shield,
      faqs: [
        {
          q: "How is my data protected?",
          a: "We use industry-standard encryption, secure authentication, and regular security assessments. Your payment information is processed through PCI-compliant payment processors. We never store your full payment card details."
        },
        {
          q: "What should I do if I suspect fraud?",
          a: "Immediately contact our support team and report any suspicious activity. We take fraud seriously and will investigate promptly. Never share your account credentials with anyone."
        },
        {
          q: "How do I verify a load is legitimate?",
          a: "All loads on our platform are verified before posting. However, always review load details carefully, verify shipper information, and use our messaging system to communicate. If something seems suspicious, contact support."
        }
      ]
    }
  ];

  const allFaqs = faqCategories.flatMap(category => 
    category.faqs.map(faq => ({ ...faq, category: category.title }))
  );

  const filteredFaqs = searchQuery
    ? allFaqs.filter(faq => 
        faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.a.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allFaqs;

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="container mx-auto px-4 py-8 md:py-12 max-w-6xl relative z-10">
        <PageHeader
          title="Help Center"
          subtitle="Find answers to common questions and get support for your freight logistics needs."
        />

        <div className="space-y-6 mt-8">
          {/* Search Bar */}
          <GlassCard className="bg-white/30 dark:bg-surface-900/25">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                type="text"
                placeholder="Search for help articles, FAQs, or topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 text-base"
              />
            </div>
          </GlassCard>

          {/* Quick Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <GlassCard className="hover:scale-105 transition-transform cursor-pointer group">
              <Link href="/contact" className="flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center group-hover:bg-primary/20 dark:group-hover:bg-primary/30 transition-colors">
                  <MessageSquare className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Contact Support</h3>
                  <p className="text-sm text-muted-foreground">Get in touch with our team</p>
                </div>
              </Link>
            </GlassCard>

            <GlassCard className="hover:scale-105 transition-transform cursor-pointer group">
              <Link href="/carrier/profile" className="flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center group-hover:bg-primary/20 dark:group-hover:bg-primary/30 transition-colors">
                  <Settings className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Account Settings</h3>
                  <p className="text-sm text-muted-foreground">Manage your profile</p>
                </div>
              </Link>
            </GlassCard>

            <GlassCard className="hover:scale-105 transition-transform cursor-pointer group">
              <Link href="/privacy" className="flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center group-hover:bg-primary/20 dark:group-hover:bg-primary/30 transition-colors">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Privacy Policy</h3>
                  <p className="text-sm text-muted-foreground">Learn about data protection</p>
                </div>
              </Link>
            </GlassCard>

            <GlassCard className="hover:scale-105 transition-transform cursor-pointer group">
              <Link href="/terms" className="flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center group-hover:bg-primary/20 dark:group-hover:bg-primary/30 transition-colors">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Terms of Service</h3>
                  <p className="text-sm text-muted-foreground">Read our terms</p>
                </div>
              </Link>
            </GlassCard>
          </div>

          {/* FAQ Categories */}
          {!searchQuery ? (
            <div className="space-y-6">
              {faqCategories.map((category, categoryIndex) => {
                const Icon = category.icon;
                return (
                  <GlassCard key={categoryIndex}>
                    <div className="space-y-4">
                      <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Icon className="w-6 h-6 text-primary" />
                        {category.title}
                      </h2>
                      <div className="space-y-3">
                        {category.faqs.map((faq, faqIndex) => {
                          const globalIndex = categoryIndex * 100 + faqIndex;
                          const isOpen = openFaq === globalIndex;
                          return (
                            <div
                              key={faqIndex}
                              className="border border-border/50 rounded-lg overflow-hidden bg-background/30"
                            >
                              <button
                                onClick={() => toggleFaq(globalIndex)}
                                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
                              >
                                <span className="font-semibold text-foreground pr-4">{faq.q}</span>
                                {isOpen ? (
                                  <ChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                                )}
                              </button>
                              {isOpen && (
                                <div className="px-4 pb-4 text-muted-foreground leading-relaxed border-t border-border/50 pt-4">
                                  {faq.a}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          ) : (
            <GlassCard>
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <Search className="w-6 h-6 text-primary" />
                  Search Results
                  <span className="text-lg font-normal text-muted-foreground">
                    ({filteredFaqs.length} {filteredFaqs.length === 1 ? 'result' : 'results'})
                  </span>
                </h2>
                {filteredFaqs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No results found for "{searchQuery}"</p>
                    <p className="text-sm mt-2">Try different keywords or browse categories above</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredFaqs.map((faq, index) => {
                      const isOpen = openFaq === index;
                      return (
                        <div
                          key={index}
                          className="border border-border/50 rounded-lg overflow-hidden bg-background/30"
                        >
                          <div className="p-3 bg-muted/20 border-b border-border/50">
                            <span className="text-xs font-medium text-primary">{faq.category}</span>
                          </div>
                          <button
                            onClick={() => toggleFaq(index)}
                            className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
                          >
                            <span className="font-semibold text-foreground pr-4">{faq.q}</span>
                            {isOpen ? (
                              <ChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                            )}
                          </button>
                          {isOpen && (
                            <div className="px-4 pb-4 text-muted-foreground leading-relaxed border-t border-border/50 pt-4">
                              {faq.a}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </GlassCard>
          )}

          {/* Contact Support */}
          <GlassCard className="bg-primary/10 dark:bg-primary/5 border-primary/20 dark:border-primary/10">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-primary" />
                Still Need Help?
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Our support team is here to assist you. Get in touch through any of these methods:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-background/50 dark:bg-background/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Email Support</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <a href="mailto:support@novafreight.io" className="text-primary hover:underline">
                      support@novafreight.io
                    </a>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Response within 24 hours
                  </p>
                </div>
                <div className="bg-background/50 dark:bg-background/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Phone Support</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <a href="tel:+18005551234" className="text-primary hover:underline">
                      (800) 555-1234
                    </a>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Mon-Fri: 6 AM - 10 PM CT
                  </p>
                </div>
                <div className="bg-background/50 dark:bg-background/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Live Chat</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Available during support hours
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Click the chat icon in the bottom right
                  </p>
                </div>
              </div>
              <div className="mt-6">
                <Link href="/contact">
                  <Button className="w-full md:w-auto">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Contact Support
                  </Button>
                </Link>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

