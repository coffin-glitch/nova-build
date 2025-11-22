"use client";

import React from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useAccentColor } from "@/hooks/useAccentColor";
import { Cookie, Settings, BarChart3, Target, Shield, Calendar, Mail, Info, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CookiePolicyPage() {
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
          title="Cookie Policy"
          subtitle="Learn how we use cookies and similar technologies to enhance your experience on our platform."
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
                <Cookie className="w-6 h-6 text-primary" />
                1. What Are Cookies?
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Cookies are small text files that are placed on your device (computer, tablet, or mobile) when you visit a website. They are widely used to make websites work more efficiently and provide information to website owners.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Cookies allow a website to recognize your device and store some information about your preferences or past actions. This helps us provide you with a better experience when you return to our platform.
              </p>
            </div>
          </GlassCard>

          {/* Types of Cookies */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Settings className="w-6 h-6 text-primary" />
                2. Types of Cookies We Use
              </h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    2.1 Essential Cookies
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-2">
                    These cookies are necessary for the website to function properly. They enable core functionality such as:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                    <li>User authentication and session management</li>
                    <li>Security features and fraud prevention</li>
                    <li>Load balancing and website performance</li>
                    <li>Remembering your login status and preferences</li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed mt-3 text-sm bg-muted/30 p-3 rounded-lg">
                    <strong>Note:</strong> These cookies cannot be disabled as they are essential for the Service to work.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    2.2 Analytics and Performance Cookies
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-2">
                    These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. They allow us to:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                    <li>Count visits and traffic sources</li>
                    <li>Understand which pages are most popular</li>
                    <li>Identify and fix technical issues</li>
                    <li>Improve website performance and user experience</li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed mt-3">
                    We use services like Google Analytics (with anonymized IP addresses) to collect this information.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    2.3 Functionality Cookies
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-2">
                    These cookies enable enhanced functionality and personalization. They remember choices you make (such as your language preference or region) and provide enhanced, more personalized features:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                    <li>Remembering your preferences and settings</li>
                    <li>Storing your search history and filters</li>
                    <li>Maintaining your theme preference (light/dark mode)</li>
                    <li>Remembering your notification preferences</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    2.4 Advertising and Marketing Cookies
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-2">
                    These cookies may be set through our site by our advertising partners. They may be used to:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                    <li>Build a profile of your interests</li>
                    <li>Show you relevant advertisements on other sites</li>
                    <li>Measure the effectiveness of advertising campaigns</li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed mt-3">
                    Currently, we do not use advertising cookies, but we reserve the right to do so in the future with your consent.
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* How We Use Cookies */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Info className="w-6 h-6 text-primary" />
                3. How We Use Cookies
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We use cookies for the following purposes:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li><strong>Authentication:</strong> To keep you logged in and secure your account</li>
                <li><strong>Preferences:</strong> To remember your settings and preferences</li>
                <li><strong>Performance:</strong> To monitor and improve website performance</li>
                <li><strong>Analytics:</strong> To understand how you use our Service and identify areas for improvement</li>
                <li><strong>Security:</strong> To detect and prevent fraud, abuse, and security threats</li>
                <li><strong>Functionality:</strong> To enable features like saved searches, favorites, and notifications</li>
              </ul>
            </div>
          </GlassCard>

          {/* Third-Party Cookies */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">4. Third-Party Cookies</h2>
              <p className="text-muted-foreground leading-relaxed">
                In addition to our own cookies, we may also use various third-party cookies to report usage statistics of the Service and deliver advertisements on and through the Service. These third parties may include:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li><strong>Google Analytics:</strong> For website analytics and performance monitoring (with anonymized data)</li>
                <li><strong>Authentication Providers:</strong> For secure user authentication (e.g., Google OAuth)</li>
                <li><strong>Payment Processors:</strong> For secure payment processing</li>
                <li><strong>Cloud Services:</strong> For hosting and infrastructure services</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                These third parties may use cookies to collect information about your online activities across different websites. We do not control these third-party cookies, and they are subject to the respective third parties' privacy policies.
              </p>
            </div>
          </GlassCard>

          {/* Cookie Duration */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">5. Cookie Duration</h2>
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">5.1 Session Cookies</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    These cookies are temporary and are deleted when you close your browser. They are used to maintain your session while you navigate our website.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">5.2 Persistent Cookies</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    These cookies remain on your device for a set period or until you delete them. They help us recognize you when you return to our website and remember your preferences. Persistent cookies typically last:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                    <li><strong>Authentication cookies:</strong> Until you log out or the session expires</li>
                    <li><strong>Preference cookies:</strong> Up to 12 months</li>
                    <li><strong>Analytics cookies:</strong> Up to 24 months</li>
                  </ul>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Managing Cookies */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Settings className="w-6 h-6 text-primary" />
                6. Managing Your Cookie Preferences
              </h2>
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">6.1 Browser Settings</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Most web browsers allow you to control cookies through their settings. You can:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                    <li>View and delete cookies stored on your device</li>
                    <li>Block all cookies or only third-party cookies</li>
                    <li>Set your browser to notify you before cookies are placed</li>
                    <li>Delete cookies when you close your browser</li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed mt-3">
                    Please note that blocking or deleting cookies may impact your ability to use certain features of our Service.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">6.2 Cookie Consent Banner</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    When you first visit our website, you may see a cookie consent banner. You can accept all cookies, reject non-essential cookies, or customize your preferences. You can change your preferences at any time through your account settings or by clearing your browser cookies.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">6.3 Opt-Out Links</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    For specific third-party cookies, you can opt out directly:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                    <li><strong>Google Analytics:</strong> <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Analytics Opt-out</a></li>
                    <li>Check your browser's help section for instructions on managing cookies</li>
                  </ul>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Do Not Track */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-primary" />
                7. Do Not Track Signals
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Some browsers include a "Do Not Track" (DNT) feature that signals to websites you visit that you do not want to have your online activity tracked. Currently, there is no standard for how DNT signals should be interpreted. As a result, our Service does not currently respond to DNT browser signals or mechanisms.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                However, you can control cookies through your browser settings as described in Section 6 above.
              </p>
            </div>
          </GlassCard>

          {/* Updates to Cookie Policy */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">8. Updates to This Cookie Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Cookie Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify you of any material changes by:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Posting the updated Cookie Policy on this page</li>
                <li>Updating the "Last Updated" date at the top of this page</li>
                <li>Sending you an email notification (for significant changes)</li>
                <li>Displaying a notice on our Service</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                We encourage you to review this Cookie Policy periodically to stay informed about how we use cookies.
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
                If you have any questions about our use of cookies or this Cookie Policy, please contact us:
              </p>
              <div className="bg-background/50 dark:bg-background/30 rounded-lg p-4 space-y-2">
                <p className="text-foreground font-medium">NOVA Build</p>
                <p className="text-muted-foreground">
                  Email: <a href="mailto:privacy@novafreight.io" className="text-primary hover:underline">privacy@novafreight.io</a>
                </p>
                <p className="text-muted-foreground">
                  Website: <a href="https://novafreight.io" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">novafreight.io</a>
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

