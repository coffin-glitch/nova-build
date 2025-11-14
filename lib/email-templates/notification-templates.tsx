/**
 * NOVA Notification Email Templates
 * 
 * Using React Email components with Resend best practices (2024-2025):
 * - Use `react` prop in Resend API (not `html`)
 * - Responsive design for mobile/desktop
 * - Consistent NOVA branding
 * - Clear CTAs with deep links
 */

import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Html,
    Link,
    Preview,
    Section,
    Text
} from '@react-email/components';

// ============================================================================
// ELEGANT NOVA DESIGN SYSTEM STYLES
// Matching the premium UI with refined colors and spacing
// ============================================================================

// Primary brand color: hsl(221.2, 83.2%, 53.3%) - Nova Blue
// Gradient: Blue (#3b82f6) → Purple (#9333ea) → Indigo (#6366f1)
// Surface-50: #fafbfc, Surface-900: #162f4e

const main = {
  backgroundColor: '#fafbfc', // surface-50
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, "Inter", sans-serif',
  margin: 0,
  padding: 0,
  width: '100%',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
};

// Elegant gradient background with subtle NOVA brand colors
const gradientContainer = {
  width: '100%',
  backgroundColor: '#fafbfc',
  backgroundImage: 'linear-gradient(135deg, rgba(59, 130, 246, 0.04) 0%, rgba(147, 51, 234, 0.04) 50%, rgba(99, 102, 241, 0.04) 100%)',
  padding: '48px 20px',
};

// Premium card with refined shadows and rounded corners
const container = {
  backgroundColor: '#ffffff',
  borderRadius: '16px', // Slightly more rounded for elegance
  margin: '0 auto',
  maxWidth: '600px',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.02)',
  position: 'relative' as const,
  zIndex: 1,
  overflow: 'hidden' as const,
};

// Elegant header with glass-morphism feel
const logoSection = {
  padding: '40px 40px 32px',
  textAlign: 'center' as const,
  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)',
  borderBottom: '1px solid rgba(226, 232, 240, 0.6)',
  position: 'relative' as const,
};

// Glass-morphism bell icon with NOVA brand colors
const logoIcon = {
  width: '64px',
  height: '64px',
  borderRadius: '16px',
  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 51, 234, 0.15) 50%, rgba(99, 102, 241, 0.15) 100%)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 8px 32px -4px rgba(59, 130, 246, 0.2), 0 4px 16px -2px rgba(147, 51, 234, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
  margin: '0 auto 16px',
  position: 'relative' as const,
  overflow: 'hidden' as const,
};

// Inner glow effect for glass bell
const logoIconGlow = {
  position: 'absolute' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '48px',
  height: '48px',
  borderRadius: '12px',
  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(147, 51, 234, 0.25) 100%)',
  filter: 'blur(8px)',
  zIndex: 0,
};

const brandHeading = {
  margin: '0 0 6px',
  fontSize: '26px',
  fontWeight: '700',
  lineHeight: '1.2',
  letterSpacing: '-0.02em',
};

// NOVA brand gradient text
const brandGradient = {
  background: 'linear-gradient(135deg, #3b82f6 0%, #9333ea 50%, #6366f1 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  display: 'inline-block',
};

// Premium content area with refined spacing
const contentCard = {
  padding: '48px 40px',
  backgroundColor: '#ffffff',
};

// Elegant heading typography
const h1 = {
  color: '#162f4e', // surface-900
  fontSize: '26px',
  fontWeight: '700',
  margin: '0 0 24px',
  lineHeight: '1.3',
  letterSpacing: '-0.01em',
};

// Refined body text
const text = {
  color: '#374151', // foreground
  fontSize: '16px',
  lineHeight: '28px', // More generous line height for readability
  margin: '0 0 20px',
};

// Elegant button container
const buttonContainer = {
  padding: '32px 0 24px',
  textAlign: 'center' as const,
};

// Premium button with gradient and refined shadows
const button = {
  background: 'linear-gradient(135deg, hsl(221.2, 83.2%, 53.3%) 0%, hsl(221.2, 83.2%, 48%) 100%)',
  borderRadius: '12px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '16px 40px',
  lineHeight: '1.5',
  boxShadow: '0 10px 20px -5px rgba(59, 130, 246, 0.35), 0 4px 8px -2px rgba(59, 130, 246, 0.25)',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  letterSpacing: '0.01em',
};

// Elegant info box with refined colors
const infoBox = {
  backgroundColor: '#f0f9ff', // Light blue tint
  borderLeft: '4px solid hsl(221.2, 83.2%, 53.3%)',
  padding: '20px',
  borderRadius: '10px',
  margin: '24px 0',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
};

const infoText = {
  color: '#1e3a8a', // Darker blue for contrast
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0',
  fontWeight: '500',
};

// Elegant footer with refined styling
const footer = {
  borderTop: '1px solid rgba(226, 232, 240, 0.8)',
  marginTop: '0',
  padding: '32px 40px',
  textAlign: 'center' as const,
  backgroundColor: '#fafbfc',
};

const footerText = {
  color: '#6b7280', // muted-foreground
  fontSize: '13px',
  lineHeight: '22px',
  margin: '0 0 10px',
};

const footerLink = {
  color: 'hsl(221.2, 83.2%, 53.3%)',
  textDecoration: 'none',
  fontSize: '13px',
  fontWeight: '500',
  borderBottom: '1px solid transparent',
};

// Success/positive state colors
const successBox = {
  backgroundColor: '#ecfdf5',
  borderLeft: '4px solid #10b981',
  padding: '20px',
  borderRadius: '10px',
  margin: '24px 0',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
};

const successText = {
  color: '#065f46',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0',
  fontWeight: '500',
};

// Warning/urgent state colors
const warningBox = {
  backgroundColor: '#fef3c7',
  borderLeft: '4px solid #f59e0b',
  padding: '20px',
  borderRadius: '10px',
  margin: '24px 0',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
};

const warningText = {
  color: '#92400e',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0',
  fontWeight: '500',
};

// ============================================================================
// CARRIER NOTIFICATION TEMPLATES
// ============================================================================

/**
 * Exact Match Notification - Perfect match for favorite route
 */
interface ExactMatchNotificationProps {
  bidNumber: string;
  origin: string;
  destination: string;
  miles?: number;
  stops?: number;
  pickupTime?: string;
  deliveryTime?: string;
  viewUrl: string;
  carrierName?: string;
}

export const ExactMatchNotificationTemplate = ({
  bidNumber,
  origin,
  destination,
  miles,
  stops,
  pickupTime,
  deliveryTime,
  viewUrl,
  carrierName,
}: ExactMatchNotificationProps) => (
  <Html>
    <Head />
    <Preview>🎯 Exact match found for your favorite route: {origin} → {destination}</Preview>
    <Body style={main}>
      <Container style={gradientContainer}>
        <Container style={container}>
          <Section style={logoSection}>
            <div style={logoIcon}>
              <div style={logoIconGlow}></div>
              <svg 
                width="32" 
                height="32" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                style={{ position: 'relative', zIndex: 1 }}
              >
                <defs>
                  <linearGradient id="bellGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#9333ea" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                <path 
                  d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" 
                  stroke="url(#bellGradient)" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  fill="none"
                />
                <path 
                  d="M13.73 21a2 2 0 0 1-3.46 0" 
                  stroke="url(#bellGradient)" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>
            <Heading style={brandHeading}>
              <span style={brandGradient}>NOVA</span>
            </Heading>
          </Section>

          <Section style={contentCard}>
            <Heading style={h1}>Perfect Match Found!</Heading>
            
            <Text style={text}>
              {carrierName ? `Hi ${carrierName},` : 'Hi there,'}
            </Text>

            <Text style={text}>
              We found an <strong>exact match</strong> for one of your favorite routes!
            </Text>

            <Section style={infoBox}>
              <Text style={infoText}>
                <strong>Bid Number:</strong> {bidNumber}<br />
                <strong>Route:</strong> {origin} → {destination}<br />
                {pickupTime && <><strong>Pickup:</strong> {pickupTime}<br /></>}
                {deliveryTime && <><strong>Delivery:</strong> {deliveryTime}<br /></>}
                {stops !== undefined && <><strong>Stops:</strong> {stops}<br /></>}
                {miles !== undefined && <><strong>Miles:</strong> {miles.toLocaleString()}<br /></>}
              </Text>
            </Section>

            <Text style={text}>
              This load matches your saved preferences perfectly. Don't miss out - act fast!
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={viewUrl}>
                View Load Details →
              </Button>
            </Section>

            <Text style={{ ...text, fontSize: '14px', color: '#6b7280', marginTop: '24px' }}>
              ⏰ This is a time-sensitive opportunity. Bids close soon!
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} NOVA. All rights reserved.
            </Text>
            <Text style={footerText}>
              <Link href="https://novafreight.io/preferences" style={footerLink}>
                Manage notification preferences
              </Link>
            </Text>
          </Section>
        </Container>
      </Container>
    </Body>
  </Html>
);

/**
 * State Pref Bid Notification - Load matching state preferences
 */
interface SimilarLoadNotificationProps {
  bidNumber: string;
  origin: string;
  destination: string;
  matchScore: number;
  reasons: string[];
  miles?: number;
  stops?: number;
  pickupTime?: string;
  deliveryTime?: string;
  viewUrl: string;
  carrierName?: string;
}

export const SimilarLoadNotificationTemplate = ({
  bidNumber,
  origin,
  destination,
  matchScore,
  reasons,
  miles,
  stops,
  pickupTime,
  deliveryTime,
  viewUrl,
  carrierName,
}: SimilarLoadNotificationProps) => (
  <Html>
    <Head />
    <Preview>🚚 State preference bid found: {origin} → {destination} ({String(matchScore)}% match)</Preview>
    <Body style={main}>
      <Container style={gradientContainer}>
        <Container style={container}>
          <Section style={logoSection}>
            <div style={logoIcon}>
              <div style={logoIconGlow}></div>
              <svg 
                width="32" 
                height="32" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                style={{ position: 'relative', zIndex: 1 }}
              >
                <defs>
                  <linearGradient id="bellGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#9333ea" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                <path 
                  d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" 
                  stroke="url(#bellGradient2)" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  fill="none"
                />
                <path 
                  d="M13.73 21a2 2 0 0 1-3.46 0" 
                  stroke="url(#bellGradient2)" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>
            <Heading style={brandHeading}>
              <span style={brandGradient}>NOVA</span>
            </Heading>
          </Section>

          <Section style={contentCard}>
            <Heading style={h1}>State Preference Bid Found!</Heading>
            
            <Text style={text}>
              {carrierName ? `Hi ${carrierName},` : 'Hi there,'}
            </Text>

            <Text style={text}>
              We found a load that matches your <strong>state preferences</strong> with a <strong>{matchScore}% match score</strong>!
            </Text>

            <Section style={infoBox}>
              <Text style={infoText}>
                <strong>Bid Number:</strong> {bidNumber}<br />
                <strong>Route:</strong> {origin} → {destination}<br />
                {pickupTime && <><strong>Pickup:</strong> {pickupTime}<br /></>}
                {deliveryTime && <><strong>Delivery:</strong> {deliveryTime}<br /></>}
                {stops !== undefined && <><strong>Stops:</strong> {stops}<br /></>}
                {miles !== undefined && <><strong>Miles:</strong> {miles.toLocaleString()}<br /></>}
                <strong>Match Score:</strong> {matchScore}%
              </Text>
            </Section>

            {reasons.length > 0 && (
              <>
                <Text style={{ ...text, fontWeight: '600', marginTop: '20px' }}>
                  Why this matches:
                </Text>
                <ul style={{ color: '#374151', fontSize: '15px', lineHeight: '24px', paddingLeft: '20px', margin: '0 0 20px' }}>
                  {reasons.slice(0, 3).map((reason, i) => (
                    <li key={i} style={{ marginBottom: '8px' }}>{reason}</li>
                  ))}
                </ul>
              </>
            )}

            <Section style={buttonContainer}>
              <Button style={button} href={viewUrl}>
                View Load Details →
              </Button>
            </Section>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} NOVA. All rights reserved.
            </Text>
            <Text style={footerText}>
              <Link href="https://novafreight.io/preferences" style={footerLink}>
                Manage notification preferences
              </Link>
            </Text>
          </Section>
        </Container>
      </Container>
    </Body>
  </Html>
);

/**
 * Favorite Available Notification - Favorite load is now available
 */
interface FavoriteAvailableNotificationProps {
  bidNumber: string;
  origin: string;
  destination: string;
  miles?: number;
  stops?: number;
  pickupTime?: string;
  deliveryTime?: string;
  viewUrl: string;
  carrierName?: string;
}

export const FavoriteAvailableNotificationTemplate = ({
  bidNumber,
  origin,
  destination,
  miles,
  stops,
  pickupTime,
  deliveryTime,
  viewUrl,
  carrierName,
}: FavoriteAvailableNotificationProps) => (
  <Html>
    <Head />
    <Preview>⭐ Your favorite load is available: {bidNumber}</Preview>
    <Body style={main}>
      <Container style={gradientContainer}>
        <Container style={container}>
          <Section style={logoSection}>
            <div style={logoIcon}>
              <div style={logoIconGlow}></div>
              <svg 
                width="32" 
                height="32" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                style={{ position: 'relative', zIndex: 1 }}
              >
                <defs>
                  <linearGradient id="bellGradient3" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#9333ea" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                <path 
                  d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" 
                  stroke="url(#bellGradient3)" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  fill="none"
                />
                <path 
                  d="M13.73 21a2 2 0 0 1-3.46 0" 
                  stroke="url(#bellGradient3)" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>
            <Heading style={brandHeading}>
              <span style={brandGradient}>NOVA</span>
            </Heading>
          </Section>

          <Section style={contentCard}>
            <Heading style={h1}>Your Favorite Load is Available!</Heading>
            
            <Text style={text}>
              {carrierName ? `Hi ${carrierName},` : 'Hi there,'}
            </Text>

            <Text style={text}>
              A load you saved as a favorite is now available for bidding!
            </Text>

            <Section style={infoBox}>
              <Text style={infoText}>
                <strong>Bid Number:</strong> {bidNumber}<br />
                <strong>Route:</strong> {origin} → {destination}<br />
                {pickupTime && <><strong>Pickup:</strong> {pickupTime}<br /></>}
                {deliveryTime && <><strong>Delivery:</strong> {deliveryTime}<br /></>}
                {stops !== undefined && <><strong>Stops:</strong> {stops}<br /></>}
                {miles !== undefined && <><strong>Miles:</strong> {miles.toLocaleString()}<br /></>}
              </Text>
            </Section>

            <Text style={text}>
              This is one of your saved favorites. Don't miss this opportunity!
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={viewUrl}>
                View & Place Bid →
              </Button>
            </Section>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} NOVA. All rights reserved.
            </Text>
            <Text style={footerText}>
              <Link href="https://novafreight.io/preferences" style={footerLink}>
                Manage notification preferences
              </Link>
            </Text>
          </Section>
        </Container>
      </Container>
    </Body>
  </Html>
);

// ============================================================================
// BID NOTIFICATION TEMPLATES
// ============================================================================

/**
 * Bid Won Notification - Carrier won the auction
 */
interface BidWonNotificationProps {
  bidNumber: string;
  amount: number;
  origin: string;
  destination: string;
  miles?: number;
  stops?: number;
  pickupTime?: string;
  deliveryTime?: string;
  viewUrl: string;
  carrierName?: string;
}

export const BidWonNotificationTemplate = ({
  bidNumber,
  amount,
  origin,
  destination,
  miles,
  stops,
  pickupTime,
  deliveryTime,
  viewUrl,
  carrierName,
}: BidWonNotificationProps) => (
  <Html>
    <Head />
    <Preview>🎉 Congratulations! You won Bid #{bidNumber}</Preview>
    <Body style={main}>
      <Container style={gradientContainer}>
        <Container style={container}>
          <Section style={logoSection}>
            <div style={logoIcon}>
              <div style={logoIconGlow}></div>
              <svg 
                width="32" 
                height="32" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                style={{ position: 'relative', zIndex: 1 }}
              >
                <defs>
                  <linearGradient id="bellGradient4" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#9333ea" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                <path 
                  d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" 
                  stroke="url(#bellGradient4)" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  fill="none"
                />
                <path 
                  d="M13.73 21a2 2 0 0 1-3.46 0" 
                  stroke="url(#bellGradient4)" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>
            <Heading style={brandHeading}>
              <span style={brandGradient}>NOVA</span>
            </Heading>
          </Section>

          <Section style={contentCard}>
            <Heading style={h1}>Congratulations! You Won!</Heading>
            
            <Text style={text}>
              {carrierName ? `Hi ${carrierName},` : 'Hi there,'}
            </Text>

            <Text style={text}>
              Great news! Your bid was selected as the winning bid for this load.
            </Text>

            <Section style={successBox}>
              <Text style={successText}>
                <strong>Bid Number:</strong> {bidNumber}<br />
                <strong>Route:</strong> {origin} → {destination}<br />
                {pickupTime && <><strong>Pickup Time:</strong> {pickupTime}<br /></>}
                {deliveryTime && <><strong>Delivery Time:</strong> {deliveryTime}<br /></>}
                {stops !== undefined && <><strong>Stops:</strong> {stops}<br /></>}
                {miles !== undefined && <><strong>Miles:</strong> {miles.toLocaleString()}<br /></>}
                <strong>Winning Amount:</strong> ${(amount / 100).toLocaleString()}
              </Text>
            </Section>

            <Text style={text}>
              Next steps will be communicated shortly. Please review the load details and prepare for dispatch.
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={viewUrl}>
                View Load Details →
              </Button>
            </Section>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} NOVA. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Container>
    </Body>
  </Html>
);

/**
 * Bid Lost Notification - Another carrier won
 */
interface BidLostNotificationProps {
  bidNumber: string;
  origin: string;
  destination: string;
  winningAmount?: number;
  yourBid?: number;
  miles?: number;
  stops?: number;
  pickupTime?: string;
  deliveryTime?: string;
  viewUrl: string;
  carrierName?: string;
}

export const BidLostNotificationTemplate = ({
  bidNumber,
  origin,
  destination,
  winningAmount,
  yourBid,
  miles,
  stops,
  pickupTime,
  deliveryTime,
  viewUrl,
  carrierName,
}: BidLostNotificationProps) => (
  <Html>
    <Head />
    <Preview>Bid #{bidNumber} was awarded to another carrier</Preview>
    <Body style={main}>
      <Container style={gradientContainer}>
        <Container style={container}>
          <Section style={logoSection}>
            <div style={logoIcon}>
              <div style={logoIconGlow}></div>
              <svg 
                width="32" 
                height="32" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                style={{ position: 'relative', zIndex: 1 }}
              >
                <defs>
                  <linearGradient id="bellGradient5" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#9333ea" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                <path 
                  d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" 
                  stroke="url(#bellGradient5)" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  fill="none"
                />
                <path 
                  d="M13.73 21a2 2 0 0 1-3.46 0" 
                  stroke="url(#bellGradient5)" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>
            <Heading style={brandHeading}>
              <span style={brandGradient}>NOVA</span>
            </Heading>
          </Section>

          <Section style={contentCard}>
            <Heading style={h1}>Bid Awarded to Another Carrier</Heading>
            
            <Text style={text}>
              {carrierName ? `Hi ${carrierName},` : 'Hi there,'}
            </Text>

            <Text style={text}>
              Unfortunately, Bid #{bidNumber} was awarded to another carrier.
            </Text>

            <Section style={infoBox}>
              <Text style={infoText}>
                <strong>Bid Number:</strong> {bidNumber}<br />
                <strong>Route:</strong> {origin} → {destination}<br />
                {pickupTime && <><strong>Pickup Time:</strong> {pickupTime}<br /></>}
                {deliveryTime && <><strong>Delivery Time:</strong> {deliveryTime}<br /></>}
                {stops !== undefined && <><strong>Stops:</strong> {stops}<br /></>}
                {miles !== undefined && <><strong>Miles:</strong> {miles.toLocaleString()}<br /></>}
                {winningAmount && <><strong>Winning Bid:</strong> ${(winningAmount / 100).toLocaleString()}<br /></>}
                {yourBid && <><strong>Your Bid:</strong> ${(yourBid / 100).toLocaleString()}<br /></>}
              </Text>
            </Section>

            <Text style={text}>
              Don't worry - there are always more opportunities! Keep an eye out for new loads that match your preferences.
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={viewUrl}>
                View Other Loads →
              </Button>
            </Section>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} NOVA. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Container>
    </Body>
  </Html>
);

/**
 * Deadline Approaching Notification - Bid closing soon
 */
interface DeadlineApproachingNotificationProps {
  bidNumber: string;
  origin: string;
  destination: string;
  minutesRemaining: number;
  miles?: number;
  stops?: number;
  pickupTime?: string;
  deliveryTime?: string;
  viewUrl: string;
  carrierName?: string;
}

export const DeadlineApproachingNotificationTemplate = ({
  bidNumber,
  origin,
  destination,
  minutesRemaining,
  miles,
  stops,
  pickupTime,
  deliveryTime,
  viewUrl,
  carrierName,
}: DeadlineApproachingNotificationProps) => (
  <Html>
    <Head />
    <Preview>⏰ Bid #{bidNumber} closing in {String(minutesRemaining)} minutes</Preview>
    <Body style={main}>
      <Container style={gradientContainer}>
        <Container style={container}>
          <Section style={logoSection}>
            <div style={logoIcon}>
              <div style={logoIconGlow}></div>
              <svg 
                width="32" 
                height="32" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                style={{ position: 'relative', zIndex: 1 }}
              >
                <defs>
                  <linearGradient id="bellGradient6" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#9333ea" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                <path 
                  d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" 
                  stroke="url(#bellGradient6)" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  fill="none"
                />
                <path 
                  d="M13.73 21a2 2 0 0 1-3.46 0" 
                  stroke="url(#bellGradient6)" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>
            <Heading style={brandHeading}>
              <span style={brandGradient}>NOVA</span>
            </Heading>
          </Section>

          <Section style={contentCard}>
            <Heading style={h1}>Deadline Approaching!</Heading>
            
            <Text style={text}>
              {carrierName ? `Hi ${carrierName},` : 'Hi there,'}
            </Text>

            <Text style={text}>
              A bid you're watching is closing soon!
            </Text>

            <Section style={warningBox}>
              <Text style={warningText}>
                <strong>Bid Number:</strong> {bidNumber}<br />
                <strong>Route:</strong> {origin} → {destination}<br />
                {pickupTime && <><strong>Pickup Time:</strong> {pickupTime}<br /></>}
                {deliveryTime && <><strong>Delivery Time:</strong> {deliveryTime}<br /></>}
                {stops !== undefined && <><strong>Stops:</strong> {stops}<br /></>}
                {miles !== undefined && <><strong>Miles:</strong> {miles.toLocaleString()}<br /></>}
                <strong>Time Remaining:</strong> {minutesRemaining} minutes
              </Text>
            </Section>

            <Text style={text}>
              If you haven't placed a bid yet, now's your chance! This opportunity won't last long.
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={viewUrl}>
                Place Bid Now →
              </Button>
            </Section>

            <Text style={{ ...text, fontSize: '15px', color: '#dc2626', marginTop: '28px', fontWeight: '600', textAlign: 'center' as const }}>
              ⚠️ This is your last chance to bid on this load!
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} NOVA. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Container>
    </Body>
  </Html>
);

