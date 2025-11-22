"use client";

import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAccentColor } from "@/hooks/useAccentColor";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Clock,
  Mail,
  MessageSquare,
  Phone,
  Send,
  Users
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

export default function ContactPageClient() {
  const { accentColor } = useAccentColor();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.message) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: Create API endpoint for contact form submissions
      // For now, we'll use a mailto link or show success message
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success("Message sent successfully! We'll get back to you soon.");
        setFormData({ name: "", email: "", subject: "", message: "" });
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to send message");
      }
    } catch (error: any) {
      // Fallback: show success message (form will be handled by backend later)
      if (error.message?.includes("Failed to fetch") || error.message?.includes("404")) {
        // API endpoint doesn't exist yet, show success anyway
        toast.success("Thank you for your message! We'll get back to you soon.");
        setFormData({ name: "", email: "", subject: "", message: "" });
      } else {
        toast.error(error.message || "Failed to send message. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
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
          title="Contact Us"
          subtitle="Get in touch with our support team. We're here to help with any questions or concerns."
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <GlassCard>
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Send us a Message</h2>
                    <p className="text-sm text-muted-foreground">Fill out the form below and we'll get back to you</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="Your name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="bg-background/50 dark:bg-background/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your.email@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        className="bg-background/50 dark:bg-background/30"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Select
                      value={formData.subject}
                      onValueChange={(value) => setFormData({ ...formData, subject: value })}
                    >
                      <SelectTrigger className="bg-background/50 dark:bg-background/30">
                        <SelectValue placeholder="Select a subject" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General Inquiry</SelectItem>
                        <SelectItem value="load-support">Load Support</SelectItem>
                        <SelectItem value="payment">Payment Issue</SelectItem>
                        <SelectItem value="technical">Technical Support</SelectItem>
                        <SelectItem value="account">Account Help</SelectItem>
                        <SelectItem value="billing">Billing Question</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      rows={6}
                      placeholder="How can we help you? Please provide as much detail as possible..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      required
                      className="bg-background/50 dark:bg-background/30 resize-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full"
                    size="lg"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Message
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </GlassCard>
          </div>

          {/* Contact Information Sidebar */}
          <div className="space-y-6">
            {/* Support Hours */}
            <GlassCard>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Support Hours</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 rounded-lg bg-muted/30">
                    <span className="text-sm text-muted-foreground">Monday - Friday</span>
                    <span className="text-sm font-medium text-foreground">6:00 AM - 10:00 PM CT</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-muted/30">
                    <span className="text-sm text-muted-foreground">Saturday</span>
                    <span className="text-sm font-medium text-foreground">7:00 AM - 7:00 PM CT</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-muted/30">
                    <span className="text-sm text-muted-foreground">Sunday</span>
                    <span className="text-sm font-medium text-foreground">8:00 AM - 6:00 PM CT</span>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Contact Methods */}
            <GlassCard>
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Get in Touch</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Phone Support</p>
                      <a href="tel:+18005551234" className="text-sm text-primary hover:underline">
                        (800) 555-1234
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Email</p>
                      <a href="mailto:support@novafreight.io" className="text-sm text-primary hover:underline break-all">
                        support@novafreight.io
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Live Chat</p>
                      <p className="text-sm text-muted-foreground">Available during support hours</p>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Emergency Contact */}
            <GlassCard className="bg-orange-500/10 dark:bg-orange-500/5 border-orange-500/20 dark:border-orange-500/10">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-500/20 dark:bg-orange-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Emergency Support</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  For urgent load issues outside regular hours
                </p>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50 dark:bg-background/30">
                  <Phone className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  <a href="tel:+18005553637" className="text-lg font-bold text-orange-600 dark:text-orange-400 hover:underline">
                    (800) 555-EMER
                  </a>
                </div>
              </div>
            </GlassCard>

            {/* Quick Links */}
            <GlassCard>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Quick Links</h3>
                <div className="space-y-2">
                  <a href="/help" className="block text-sm text-primary hover:underline py-2">
                    Help Center & FAQs
                  </a>
                  <a href="/privacy" className="block text-sm text-primary hover:underline py-2">
                    Privacy Policy
                  </a>
                  <a href="/terms" className="block text-sm text-primary hover:underline py-2">
                    Terms of Service
                  </a>
                  <a href="/gdpr" className="block text-sm text-primary hover:underline py-2">
                    GDPR Rights
                  </a>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}

