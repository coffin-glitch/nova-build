import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

/**
 * NOVA Email Confirmation Template
 * Matches the sleek, modern UI design with gradients and premium styling
 */

interface EmailConfirmationProps {
  confirmationUrl: string;
  userEmail?: string;
}

export const EmailConfirmationTemplate = ({
  confirmationUrl,
  userEmail = 'there',
}: EmailConfirmationProps) => (
  <Html>
    <Head />
    <Preview>Confirm your email to get started with NOVA</Preview>
    <Body style={main}>
      {/* Gradient Background Container */}
      <Container style={gradientContainer}>
        {/* Main Content Container */}
        <Container style={container}>
          {/* Logo/Brand Header */}
          <Section style={logoSection}>
            <div style={logoWrapper}>
              <div style={logoIcon}>
                🚛
              </div>
            </div>
            <Heading style={brandHeading}>
              <span style={brandGradient}>NOVA</span>
            </Heading>
            <Text style={tagline}>Premium Freight Marketplace</Text>
          </Section>

          {/* Main Content Card */}
          <Section style={contentCard}>
            <Heading style={h1}>Welcome to NOVA!</Heading>
            
            <Text style={greeting}>
              Hi {userEmail?.split('@')[0] || 'there'},
            </Text>
            
            <Text style={text}>
              Thank you for joining NOVA, the premium freight marketplace 
              connecting carriers with quality loads.
            </Text>

            <Text style={text}>
              To complete your registration and start bidding on loads, please confirm 
              your email address by clicking the button below:
            </Text>

            {/* CTA Button with Gradient */}
            <Section style={buttonContainer}>
              <Button style={button} href={confirmationUrl}>
                <span style={buttonText}>
                  Confirm Email Address →
                </span>
              </Button>
            </Section>

            {/* Alternative Link */}
            <Section style={linkSection}>
              <Text style={linkLabel}>
                Or copy and paste this link into your browser:
              </Text>
              <Text style={linkText}>
                {confirmationUrl}
              </Text>
            </Section>

            {/* Expiry Notice */}
            <Section style={noticeSection}>
              <Text style={smallText}>
                      ⏰ This link will expire in 24 hours. If you didn't create an account with NOVA,
                you can safely ignore this email.
              </Text>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} NOVA. All rights reserved.
            </Text>
            <Text style={footerTagline}>
              Connecting Carriers with Quality Loads
            </Text>
            <Text style={footerLinks}>
              <Link href="https://novafreight.io/privacy" style={footerLink}>
                Privacy Policy
              </Link>
              {' • '}
              <Link href="https://novafreight.io/terms" style={footerLink}>
                Terms of Service
              </Link>
            </Text>
          </Section>
        </Container>
      </Container>
    </Body>
  </Html>
);

// Styles - Matching NOVA Design System
const main = {
  backgroundColor: '#fafbfc', // surface-50 equivalent
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, Inter, sans-serif',
  margin: 0,
  padding: 0,
  width: '100%',
};

// Gradient background container (email-safe)
const gradientContainer = {
  width: '100%',
  backgroundColor: '#fafbfc',
  backgroundImage: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(147, 51, 234, 0.05) 50%, rgba(99, 102, 241, 0.05) 100%)',
  padding: '40px 20px',
};

const container = {
  backgroundColor: '#ffffff',
  borderRadius: '12px', // 0.75rem equivalent
  margin: '0 auto',
  maxWidth: '600px',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  position: 'relative' as const,
  zIndex: 1,
  overflow: 'hidden' as const,
};

const logoSection = {
  padding: '48px 32px 32px',
  textAlign: 'center' as const,
  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(249, 250, 251, 0.9) 100%)',
  borderBottom: '1px solid rgba(226, 232, 240, 0.5)',
};

const logoWrapper = {
  display: 'inline-block',
  marginBottom: '16px',
};

const logoIcon = {
  width: '64px',
  height: '64px',
  borderRadius: '12px',
  backgroundColor: 'hsl(221.2, 83.2%, 53.3%)', // Primary color
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '32px',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  margin: '0 auto',
};

const brandHeading = {
  margin: '16px 0 8px',
  fontSize: '28px',
  fontWeight: '700',
  lineHeight: '1.2',
};

const brandGradient = {
  background: 'linear-gradient(135deg, #3b82f6 0%, #9333ea 50%, #6366f1 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  display: 'inline-block',
};

const tagline = {
  color: '#6b7280', // muted-foreground
  fontSize: '14px',
  fontWeight: '500',
  margin: '0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
};

const contentCard = {
  padding: '48px 40px',
  backgroundColor: '#ffffff',
};

const h1 = {
  color: '#162f4e', // surface-900
  fontSize: '28px',
  fontWeight: '700',
  margin: '0 0 24px',
  lineHeight: '1.3',
  textAlign: 'center' as const,
};

const greeting = {
  color: '#162f4e',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 20px',
  lineHeight: '1.5',
};

const text = {
  color: '#374151', // foreground
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 20px',
};

const buttonContainer = {
  padding: '32px 0',
  textAlign: 'center' as const,
};

const button = {
  backgroundColor: 'hsl(221.2, 83.2%, 53.3%)', // Primary blue
  borderRadius: '12px', // Matching UI radius
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 40px',
  lineHeight: '1.5',
  boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3), 0 4px 6px -2px rgba(59, 130, 246, 0.2)',
  transition: 'all 0.2s ease',
  border: 'none',
  cursor: 'pointer',
};

const buttonText = {
  color: '#ffffff',
};

const linkSection = {
  marginTop: '32px',
  padding: '20px',
  backgroundColor: '#f9fafb', // surface-100
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
};

const linkLabel = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '0 0 12px',
  fontWeight: '500',
};

const linkText = {
  color: 'hsl(221.2, 83.2%, 53.3%)',
  fontSize: '13px',
  wordBreak: 'break-all' as const,
  margin: '0',
  padding: '12px',
  backgroundColor: '#ffffff',
  borderRadius: '6px',
  fontFamily: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
  border: '1px solid #e5e7eb',
};

const noticeSection = {
  marginTop: '32px',
  paddingTop: '24px',
  borderTop: '1px solid #e5e7eb',
};

const smallText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0',
  textAlign: 'center' as const,
};

const footer = {
  borderTop: '1px solid #e5e7eb',
  marginTop: '0',
  padding: '32px 40px',
  textAlign: 'center' as const,
  backgroundColor: '#fafbfc',
};

const footerText = {
  color: '#6b7280',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0 0 8px',
};

const footerTagline = {
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '20px',
  margin: '0 0 16px',
  fontStyle: 'italic' as const,
};

const footerLinks = {
  color: '#6b7280',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0',
};

const footerLink = {
  color: 'hsl(221.2, 83.2%, 53.3%)',
  textDecoration: 'underline',
  fontWeight: '500',
};

// Export for use in Resend
export default EmailConfirmationTemplate;

