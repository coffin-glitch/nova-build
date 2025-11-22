"use client";

import React from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useAccentColor } from "@/hooks/useAccentColor";
import { Shield, FileText, CheckCircle, Download, Trash2, Ban, ArrowRight, Lock, Eye, Mail, Calendar, AlertCircle, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export default function GDPRPage() {
  const { accentColor } = useAccentColor();

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
          title="GDPR Rights"
          subtitle="Your data protection rights under the General Data Protection Regulation (GDPR)."
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
                <Shield className="w-6 h-6 text-primary" />
                1. Introduction
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                The General Data Protection Regulation (GDPR) is a European Union regulation that gives you control over your personal data. If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, you have specific rights regarding your personal information.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                At NOVA Build, we are committed to protecting your privacy and ensuring compliance with GDPR. This page explains your rights and how to exercise them.
              </p>
            </div>
          </GlassCard>

          {/* Your Rights */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <UserCheck className="w-6 h-6 text-primary" />
                2. Your GDPR Rights
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Under GDPR, you have the following rights regarding your personal data:
              </p>
              
              <div className="space-y-4">
                <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                  <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-primary" />
                    2.1 Right to Access (Article 15)
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-2">
                    You have the right to obtain confirmation as to whether or not we process your personal data and, if so, to access that data. You can request:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                    <li>A copy of your personal data we hold</li>
                    <li>Information about how we use your data</li>
                    <li>Details about who we share your data with</li>
                    <li>How long we retain your data</li>
                  </ul>
                </div>

                <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                  <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    2.2 Right to Rectification (Article 16)
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    You have the right to have inaccurate personal data corrected and incomplete personal data completed. You can update most of your information directly through your account settings, or contact us to request corrections.
                  </p>
                </div>

                <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                  <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Trash2 className="w-5 h-5 text-primary" />
                    2.3 Right to Erasure / "Right to be Forgotten" (Article 17)
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-2">
                    You have the right to request deletion of your personal data in certain circumstances, such as when:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                    <li>The data is no longer necessary for the original purpose</li>
                    <li>You withdraw consent and there is no other legal basis</li>
                    <li>You object to processing and there are no overriding legitimate grounds</li>
                    <li>The data has been unlawfully processed</li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed mt-3 text-sm bg-warning/10 p-2 rounded">
                    <strong>Note:</strong> We may need to retain certain data for legal or legitimate business purposes, such as transaction records or compliance obligations.
                  </p>
                </div>

                <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                  <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Ban className="w-5 h-5 text-primary" />
                    2.4 Right to Restrict Processing (Article 18)
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    You have the right to request that we limit how we use your personal data in certain circumstances, such as when you contest the accuracy of the data or object to processing while we verify your request.
                  </p>
                </div>

                <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                  <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Download className="w-5 h-5 text-primary" />
                    2.5 Right to Data Portability (Article 20)
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    You have the right to receive your personal data in a structured, commonly used, and machine-readable format and to transmit that data to another controller. This applies to data you provided to us based on consent or contract.
                  </p>
                </div>

                <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                  <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-primary" />
                    2.6 Right to Object (Article 21)
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-2">
                    You have the right to object to processing of your personal data based on legitimate interests or for direct marketing purposes. When you object:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                    <li>We will stop processing unless we can demonstrate compelling legitimate grounds</li>
                    <li>For direct marketing, we will stop processing immediately upon your objection</li>
                  </ul>
                </div>

                <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                  <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-primary" />
                    2.7 Right to Withdraw Consent (Article 7)
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Where processing is based on your consent, you have the right to withdraw that consent at any time. Withdrawal of consent does not affect the lawfulness of processing based on consent before its withdrawal.
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* How to Exercise Your Rights */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <ArrowRight className="w-6 h-6 text-primary" />
                3. How to Exercise Your Rights
              </h2>
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">3.1 Making a Request</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    To exercise any of your GDPR rights, you can:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                    <li>Contact us at <a href="mailto:privacy@novafreight.io" className="text-primary hover:underline">privacy@novafreight.io</a></li>
                    <li>Use the privacy controls in your account settings (for certain requests)</li>
                    <li>Submit a request through our support system</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">3.2 Verification</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    To protect your privacy, we may need to verify your identity before processing your request. We may ask you to provide:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                    <li>Your account email address</li>
                    <li>Proof of identity (for sensitive requests)</li>
                    <li>Additional information to confirm you are the account owner</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">3.3 Response Time</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    We will respond to your request within <strong>one month</strong> of receipt. If your request is complex or we receive multiple requests, we may extend this period by up to two additional months, and we will inform you of the extension and the reasons for it.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">3.4 No Fee</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Exercising your GDPR rights is free of charge. However, we may charge a reasonable fee if your request is manifestly unfounded, excessive, or repetitive.
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Legal Basis for Processing */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <FileText className="w-6 h-6 text-primary" />
                4. Legal Basis for Processing
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Under GDPR, we process your personal data based on the following legal bases:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li><strong>Consent:</strong> When you have given clear consent for us to process your data for specific purposes (e.g., marketing communications)</li>
                <li><strong>Contract:</strong> When processing is necessary to perform a contract with you (e.g., processing transactions, managing your account)</li>
                <li><strong>Legal Obligation:</strong> When we need to comply with a legal obligation (e.g., tax records, regulatory requirements)</li>
                <li><strong>Legitimate Interests:</strong> When processing is necessary for our legitimate interests, such as improving our Service, security, or fraud prevention (we balance these against your rights and interests)</li>
                <li><strong>Vital Interests:</strong> When processing is necessary to protect someone's life or physical safety</li>
              </ul>
            </div>
          </GlassCard>

          {/* Data Transfers */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">5. International Data Transfers</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your personal data may be transferred to and processed in countries outside the EEA, UK, or Switzerland. When we transfer your data internationally, we ensure appropriate safeguards are in place, such as:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Standard Contractual Clauses (SCCs) approved by the European Commission</li>
                <li>Adequacy decisions by the European Commission</li>
                <li>Other appropriate safeguards as required by GDPR</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                By using our Service, you consent to the transfer of your information to these countries in accordance with this policy.
              </p>
            </div>
          </GlassCard>

          {/* Data Protection Officer */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">6. Data Protection Officer</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have questions or concerns about how we handle your personal data, or if you wish to exercise your GDPR rights, you can contact our data protection team:
              </p>
              <div className="bg-background/50 dark:bg-background/30 rounded-lg p-4 space-y-2 mt-4">
                <p className="text-foreground font-medium">Data Protection Contact</p>
                <p className="text-muted-foreground">
                  Email: <a href="mailto:privacy@novafreight.io" className="text-primary hover:underline">privacy@novafreight.io</a>
                </p>
                <p className="text-muted-foreground">
                  Subject Line: "GDPR Request - [Your Request Type]"
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Right to Complain */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-primary" />
                7. Right to Lodge a Complaint
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                If you believe that we have not adequately addressed your concerns or that we have violated your data protection rights, you have the right to lodge a complaint with a supervisory authority in your country of residence, place of work, or where the alleged violation occurred.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                For example, if you are in the UK, you can contact the Information Commissioner's Office (ICO). If you are in another EEA country, you can find your local supervisory authority on the <a href="https://edpb.europa.eu/about-edpb/about-edpb/members_en" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">European Data Protection Board website</a>.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                We encourage you to contact us first so we can try to resolve any concerns you may have.
              </p>
            </div>
          </GlassCard>

          {/* Updates */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">8. Updates to This Page</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this GDPR Rights page from time to time to reflect changes in our practices or legal requirements. We will notify you of any material changes by updating the "Last Updated" date and, where appropriate, through other communication channels.
              </p>
            </div>
          </GlassCard>

          {/* Contact Us */}
          <GlassCard className="bg-primary/10 dark:bg-primary/5 border-primary/20 dark:border-primary/10">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Mail className="w-6 h-6 text-primary" />
                9. Contact Us
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about your GDPR rights or wish to exercise them, please contact us:
              </p>
              <div className="bg-background/50 dark:bg-background/30 rounded-lg p-4 space-y-2">
                <p className="text-foreground font-medium">NOVA Build - Data Protection</p>
                <p className="text-muted-foreground">
                  Email: <a href="mailto:privacy@novafreight.io" className="text-primary hover:underline">privacy@novafreight.io</a>
                </p>
                <p className="text-muted-foreground">
                  Website: <a href="https://novafreight.io" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">novafreight.io</a>
                </p>
                <p className="text-muted-foreground text-sm mt-3">
                  <strong>Response Time:</strong> We aim to respond to GDPR requests within 30 days as required by law.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

