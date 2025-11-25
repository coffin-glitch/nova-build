"use client";

import PageHeader from "@/components/layout/PageHeader";
import { useAccentColor } from "@/hooks/useAccentColor";
import { cn } from "@/lib/utils";
import { Calendar, Eye, FileText, Lock, Mail, Shield } from "lucide-react";
import React from "react";

export default function PrivacyPolicyPage() {
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
          title="Privacy Policy"
          subtitle="Your privacy is important to us. Learn how we collect, use, and protect your information."
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
                1. Introduction
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Welcome to NOVA Build ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our freight logistics platform (the "Service").
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Please read this Privacy Policy carefully. If you do not agree with the terms of this Privacy Policy, please do not access or use our Service.
              </p>
            </div>
          </GlassCard>

          {/* Information We Collect */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Eye className="w-6 h-6" style={accentColorStyle} />
                2. Information We Collect
              </h2>
              
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">2.1 Personal Information</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    We collect information that you provide directly to us when you:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                    <li>Register for an account on our platform</li>
                    <li>Create a carrier or shipper profile</li>
                    <li>Submit bids, offers, or load requests</li>
                    <li>Communicate with us or other users through our messaging system</li>
                    <li>Subscribe to our newsletter or notifications</li>
                    <li>Contact us for customer support</li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed mt-3">
                    This information may include:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                    <li>Name, email address, phone number, and mailing address</li>
                    <li>Company name, MC number, DOT number, and other business credentials</li>
                    <li>Payment and billing information</li>
                    <li>Profile information and preferences</li>
                    <li>Messages and communications sent through our platform</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">2.2 Automatically Collected Information</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    When you access or use our Service, we automatically collect certain information, including:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                    <li><strong>Device Information:</strong> IP address, browser type, operating system, device identifiers</li>
                    <li><strong>Usage Data:</strong> Pages visited, time spent on pages, features used, search queries</li>
                    <li><strong>Location Data:</strong> General location information based on IP address or GPS (with your permission)</li>
                    <li><strong>Cookies and Tracking:</strong> Information collected through cookies, web beacons, and similar technologies</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">2.3 Third-Party Information</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    We may receive information about you from third parties, such as:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                    <li>Authentication providers (e.g., Google, email verification services)</li>
                    <li>Payment processors</li>
                    <li>Business partners and service providers</li>
                    <li>Public databases and business directories</li>
                  </ul>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* How We Use Your Information */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Lock className="w-6 h-6" style={accentColorStyle} />
                3. How We Use Your Information
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We use the information we collect for the following purposes:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li><strong>To Provide Our Service:</strong> Process transactions, facilitate matches between carriers and shippers, manage bids and offers, and enable communication between users</li>
                <li><strong>To Improve Our Service:</strong> Analyze usage patterns, develop new features, and enhance user experience</li>
                <li><strong>To Communicate:</strong> Send you notifications, updates, announcements, and respond to your inquiries</li>
                <li><strong>To Ensure Security:</strong> Detect, prevent, and address fraud, security issues, and unauthorized access</li>
                <li><strong>To Comply with Legal Obligations:</strong> Meet legal requirements, respond to legal requests, and protect our rights</li>
                <li><strong>For Business Operations:</strong> Conduct analytics, research, and business development activities</li>
                <li><strong>For Marketing:</strong> Send promotional communications (with your consent, where required)</li>
              </ul>
            </div>
          </GlassCard>

          {/* How We Share Your Information */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">4. How We Share Your Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                We do not sell your personal information. We may share your information in the following circumstances:
              </p>
              
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">4.1 With Other Users</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    When you participate in our platform, certain information may be visible to other users, such as:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                    <li>Your company name and business credentials (when relevant to transactions)</li>
                    <li>Public profile information</li>
                    <li>Bids, offers, and load postings (as applicable)</li>
                    <li>Ratings and reviews (if applicable)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">4.2 With Service Providers</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    We may share information with third-party service providers who perform services on our behalf, including:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                    <li>Cloud hosting and data storage providers</li>
                    <li>Payment processors</li>
                    <li>Email and communication services</li>
                    <li>Analytics and monitoring tools</li>
                    <li>Customer support platforms</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">4.3 Legal Requirements</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    We may disclose your information if required by law or in response to valid legal requests, such as:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                    <li>Court orders, subpoenas, or other legal processes</li>
                    <li>Government investigations</li>
                    <li>To protect our rights, property, or safety, or that of our users</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">4.4 Business Transfers</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    In the event of a merger, acquisition, or sale of assets, your information may be transferred to the new entity.
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Data Security */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Shield className="w-6 h-6" style={accentColorStyle} />
                5. Data Security
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement appropriate technical and organizational security measures to protect your personal information, including:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure authentication and access controls</li>
                <li>Regular security assessments and updates</li>
                <li>Limited access to personal information on a need-to-know basis</li>
                <li>Secure data storage and backup systems</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security.
              </p>
            </div>
          </GlassCard>

          {/* Your Rights */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">6. Your Privacy Rights</h2>
              <p className="text-muted-foreground leading-relaxed">
                Depending on your location, you may have certain rights regarding your personal information, including:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li><strong>Right to Access:</strong> Request copies of your personal data</li>
                <li><strong>Right to Rectification:</strong> Request correction of inaccurate or incomplete information</li>
                <li><strong>Right to Erasure:</strong> Request deletion of your personal data under certain circumstances</li>
                <li><strong>Right to Restrict Processing:</strong> Request limitation of how we process your data</li>
                <li><strong>Right to Data Portability:</strong> Request transfer of your data to another service</li>
                <li><strong>Right to Object:</strong> Object to certain types of processing</li>
                <li><strong>Right to Withdraw Consent:</strong> Withdraw consent where processing is based on consent</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                To exercise these rights, please contact us using the information provided in the "Contact Us" section below.
              </p>
            </div>
          </GlassCard>

          {/* Cookies and Tracking */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">7. Cookies and Tracking Technologies</h2>
              <p className="text-muted-foreground leading-relaxed">
                We use cookies and similar tracking technologies to collect and store information about your use of our Service. Cookies are small data files stored on your device that help us:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Remember your preferences and settings</li>
                <li>Authenticate your identity</li>
                <li>Analyze how you use our Service</li>
                <li>Provide personalized content and features</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                You can control cookies through your browser settings. However, disabling cookies may limit your ability to use certain features of our Service.
              </p>
            </div>
          </GlassCard>

          {/* Data Retention */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">8. Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. When we no longer need your information, we will securely delete or anonymize it.
              </p>
            </div>
          </GlassCard>

          {/* Children's Privacy */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">9. Children's Privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
              </p>
            </div>
          </GlassCard>

          {/* Third-Party Links */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">10. Third-Party Links</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our Service may contain links to third-party websites or services. We are not responsible for the privacy practices or content of these third parties. We encourage you to review the privacy policies of any third-party sites you visit.
              </p>
            </div>
          </GlassCard>

          {/* International Data Transfers */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">11. International Data Transfers</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country. By using our Service, you consent to the transfer of your information to these countries.
              </p>
            </div>
          </GlassCard>

          {/* Changes to This Policy */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">12. Changes to This Privacy Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Posting the updated Privacy Policy on this page</li>
                <li>Updating the "Last Updated" date at the top of this page</li>
                <li>Sending you an email notification (for significant changes)</li>
                <li>Displaying a notice on our Service</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Your continued use of our Service after any changes constitutes acceptance of the updated Privacy Policy.
              </p>
            </div>
          </GlassCard>

          {/* Contact Us */}
          <GlassCard className="bg-primary/10 dark:bg-primary/5 border-primary/20 dark:border-primary/10">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Mail className="w-6 h-6" style={accentColorStyle} />
                13. Contact Us
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="bg-background/50 rounded-lg p-4 space-y-2">
                <p className="text-foreground font-medium">NOVA Build</p>
                <p className="text-muted-foreground">
                  Email: <a href="mailto:privacy@novafreight.io" className="hover:underline" style={accentColorStyle}>privacy@novafreight.io</a>
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

