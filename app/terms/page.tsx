"use client";

import React from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useAccentColor } from "@/hooks/useAccentColor";
import { FileText, Scale, AlertTriangle, Gavel, Users, CreditCard, Shield, Mail, Calendar, Ban, TrendingUp, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TermsOfServicePage() {
  const { accentColor, accentColorStyle } = useAccentColor();

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="container mx-auto px-4 py-8 md:py-12 max-w-4xl relative z-10">
        <PageHeader
          title="Terms of Service"
          subtitle="Please read these terms carefully before using our freight logistics platform."
        />

        <div className="space-y-6 mt-8">
          {/* Last Updated */}
          <GlassCard className="bg-white/30 dark:bg-surface-900/25">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </GlassCard>

          {/* Introduction */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <FileText className="w-6 h-6" style={accentColorStyle} />
                1. Agreement to Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using NOVA Build ("we," "our," or "us"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these Terms, you may not access or use our freight logistics platform (the "Service").
              </p>
              <p className="text-muted-foreground leading-relaxed">
                These Terms apply to all users of the Service, including carriers, shippers, and any other visitors or users of our platform.
              </p>
            </div>
          </GlassCard>

          {/* Account Registration */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Users className="w-6 h-6" style={accentColorStyle} />
                2. Account Registration and Eligibility
              </h2>
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">2.1 Eligibility</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    To use our Service, you must:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                    <li>Be at least 18 years of age</li>
                    <li>Have the legal capacity to enter into binding agreements</li>
                    <li>Provide accurate, current, and complete information during registration</li>
                    <li>Maintain and promptly update your account information</li>
                    <li>Be authorized to represent the business entity you register (if applicable)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">2.2 Account Security</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    You are responsible for:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                    <li>Maintaining the confidentiality of your account credentials</li>
                    <li>All activities that occur under your account</li>
                    <li>Notifying us immediately of any unauthorized use of your account</li>
                    <li>Ensuring that your account information remains accurate and up-to-date</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">2.3 Account Suspension or Termination</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    We reserve the right to suspend or terminate your account if you violate these Terms, engage in fraudulent activity, or for any other reason we deem necessary to protect the integrity of our platform.
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Use of Service */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <CheckCircle className="w-6 h-6" style={accentColorStyle} />
                3. Use of Service
              </h2>
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">3.1 Permitted Use</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    You may use our Service to:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                    <li>Post and browse available loads or carrier services</li>
                    <li>Submit bids, offers, and proposals</li>
                    <li>Communicate with other users through our messaging system</li>
                    <li>Manage your profile, preferences, and transaction history</li>
                    <li>Access analytics and reporting features (where available)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">3.2 Prohibited Activities</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    You agree NOT to:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                    <li>Use the Service for any illegal or unauthorized purpose</li>
                    <li>Violate any applicable laws or regulations</li>
                    <li>Infringe upon the rights of others, including intellectual property rights</li>
                    <li>Transmit any viruses, malware, or harmful code</li>
                    <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
                    <li>Interfere with or disrupt the Service or servers</li>
                    <li>Use automated systems (bots, scrapers) to access the Service without permission</li>
                    <li>Impersonate any person or entity or misrepresent your affiliation</li>
                    <li>Engage in fraudulent, deceptive, or manipulative practices</li>
                    <li>Harass, abuse, or harm other users</li>
                    <li>Collect or store personal data about other users without authorization</li>
                  </ul>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Transactions and Payments */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <CreditCard className="w-6 h-6" style={accentColorStyle} />
                4. Transactions, Payments, and Fees
              </h2>
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">4.1 Bids and Offers</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    When you submit a bid or offer through our platform:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                    <li>You represent that you have the authority and capacity to fulfill the commitment</li>
                    <li>Bids and offers are binding once accepted by the other party</li>
                    <li>You are responsible for all terms and conditions of your bids/offers</li>
                    <li>We are not a party to transactions between users</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">4.2 Payment Processing</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Payment processing is handled by third-party payment processors. You agree to comply with their terms and conditions. We are not responsible for payment processing errors or disputes.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">4.3 Fees</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    We may charge fees for certain services, features, or transactions. All fees will be clearly disclosed before you commit to a transaction. Fees are non-refundable unless otherwise stated or required by law.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">4.4 Disputes Between Users</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    We are not responsible for disputes between users. Users are responsible for resolving their own disputes. We may, at our discretion, provide dispute resolution assistance, but we are not obligated to do so.
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Intellectual Property */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Scale className="w-6 h-6" style={accentColorStyle} />
                5. Intellectual Property
              </h2>
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">5.1 Our Content</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    All content on our Service, including text, graphics, logos, software, and design, is owned by NOVA Build or our licensors and is protected by copyright, trademark, and other intellectual property laws.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">5.2 Your Content</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    You retain ownership of content you post on our Service. By posting content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and display your content for the purpose of operating and promoting our Service.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">5.3 Trademarks</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    "NOVA Build" and related marks are trademarks of NOVA Build. You may not use our trademarks without our prior written permission.
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Disclaimers and Limitations */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-6 h-6" style={accentColorStyle} />
                6. Disclaimers and Limitations of Liability
              </h2>
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">6.1 Service "As Is"</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Our Service is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">6.2 No Guarantees</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    We do not guarantee:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                    <li>That the Service will be uninterrupted, secure, or error-free</li>
                    <li>The accuracy, completeness, or reliability of any information on the Service</li>
                    <li>That users will complete transactions or fulfill their obligations</li>
                    <li>The quality, safety, or legality of loads, services, or transactions</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">6.3 Limitation of Liability</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    To the maximum extent permitted by law, NOVA Build shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from your use of the Service.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">6.4 User Responsibility</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    You are solely responsible for:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                    <li>Verifying the accuracy of information provided by other users</li>
                    <li>Conducting due diligence before entering into transactions</li>
                    <li>Complying with all applicable laws and regulations</li>
                    <li>Obtaining appropriate insurance and licenses</li>
                  </ul>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Indemnification */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Shield className="w-6 h-6" style={accentColorStyle} />
                7. Indemnification
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree to indemnify, defend, and hold harmless NOVA Build, its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or in any way connected with:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Your use of the Service</li>
                <li>Your violation of these Terms</li>
                <li>Your violation of any rights of another party</li>
                <li>Your content or transactions conducted through the Service</li>
              </ul>
            </div>
          </GlassCard>

          {/* Termination */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Ban className="w-6 h-6" style={accentColorStyle} />
                8. Termination
              </h2>
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">8.1 Termination by You</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    You may terminate your account at any time by contacting us or using the account deletion feature in your settings.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">8.2 Termination by Us</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    We may suspend or terminate your access to the Service immediately, without prior notice, if you violate these Terms or for any other reason we deem necessary.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">8.3 Effect of Termination</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Upon termination, your right to use the Service will immediately cease. We may delete your account and data, subject to our data retention policies and legal obligations.
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Governing Law */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Gavel className="w-6 h-6" style={accentColorStyle} />
                9. Governing Law and Dispute Resolution
              </h2>
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">9.1 Governing Law</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which NOVA Build operates, without regard to its conflict of law provisions.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">9.2 Dispute Resolution</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Any disputes arising out of or relating to these Terms or the Service shall be resolved through binding arbitration in accordance with applicable arbitration rules, except where prohibited by law.
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Changes to Terms */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="w-6 h-6" style={accentColorStyle} />
                10. Changes to Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these Terms at any time. We will notify you of material changes by:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Posting the updated Terms on this page</li>
                <li>Updating the "Last Updated" date</li>
                <li>Sending you an email notification (for significant changes)</li>
                <li>Displaying a notice on our Service</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Your continued use of the Service after any changes constitutes acceptance of the updated Terms. If you do not agree to the changes, you must stop using the Service.
              </p>
            </div>
          </GlassCard>

          {/* Contact Us */}
          <GlassCard className="bg-primary/10 dark:bg-primary/5 border-primary/20 dark:border-primary/10">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Mail className="w-6 h-6" style={accentColorStyle} />
                11. Contact Us
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms of Service, please contact us:
              </p>
              <div className="bg-background/50 dark:bg-background/30 rounded-lg p-4 space-y-2">
                <p className="text-foreground font-medium">NOVA Build</p>
                <p className="text-muted-foreground">
                  Email: <a href="mailto:legal@novafreight.io" className="hover:underline" style={accentColorStyle}>legal@novafreight.io</a>
                </p>
                <p className="text-muted-foreground">
                  Website: <a href="https://novafreight.io" className="hover:underline" style={accentColorStyle} target="_blank" rel="noopener noreferrer">novafreight.io</a>
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

