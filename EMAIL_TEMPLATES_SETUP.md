# 📧 NOVA Email Templates - Complete Setup Guide

## ✅ What We've Created

### **Elegant Email Templates** (Using React Email + Resend)
All templates match your NOVA design system with:
- **Premium styling**: Refined colors, spacing, and typography
- **Brand consistency**: Uses exact NOVA colors (`hsl(221.2, 83.2%, 53.3%)`)
- **Elegant gradients**: Blue → Purple → Indigo brand gradient
- **Responsive design**: Works on all email clients
- **Professional polish**: Glass-morphism feel, refined shadows, premium buttons

### **Templates Created:**

#### **Carrier Notifications:**
1. **Exact Match** (`ExactMatchNotificationTemplate`) - Perfect match for favorite routes
2. **Similar Load** (`SimilarLoadNotificationTemplate`) - Loads similar to preferences
3. **Favorite Available** (`FavoriteAvailableNotificationTemplate`) - Saved favorite is available

#### **Bid Notifications:**
4. **Bid Won** (`BidWonNotificationTemplate`) - Congratulations! You won
5. **Bid Lost** (`BidLostNotificationTemplate`) - Another carrier won
6. **Deadline Approaching** (`DeadlineApproachingNotificationTemplate`) - Urgent: Bid closing soon

---

## 🎨 Design System Match

### **Colors Used:**
- **Primary Blue**: `hsl(221.2, 83.2%, 53.3%)` - Exact match to your UI
- **Brand Gradient**: `#3b82f6 → #9333ea → #6366f1` - Same as your app
- **Surface Colors**: `#fafbfc` (background), `#162f4e` (text)
- **Success Green**: `#10b981` (for bid won)
- **Warning Amber**: `#f59e0b` (for urgent deadlines)

### **Typography:**
- **Font**: Inter (same as your app) with system fallbacks
- **Headings**: 26px, bold, refined letter spacing
- **Body**: 16px, 28px line height for readability
- **Refined**: Antialiased, proper font smoothing

### **Spacing & Layout:**
- **Padding**: Generous 48px/40px for premium feel
- **Border Radius**: 16px cards, 12px buttons (elegant curves)
- **Shadows**: Refined multi-layer shadows for depth
- **Gradients**: Subtle background gradients matching your UI

---

## 🚀 How to Use

### **Step 1: Set Up Resend**

1. **Get Resend API Key:**
   - Go to https://resend.com
   - Create account (free tier available)
   - Create API key
   - Copy the key (starts with `re_`)

2. **Add Environment Variables:**
   ```bash
   # In .env.local or Railway/Vercel
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   RESEND_FROM_EMAIL="NOVA Build <noreply@novafreight.io>"
   ENABLE_EMAIL_NOTIFICATIONS=true
   ```

3. **Verify Domain (Optional but Recommended):**
   - Add your domain in Resend dashboard
   - Add DNS records (SPF, DKIM, DMARC)
   - Verify domain
   - Use verified domain in `RESEND_FROM_EMAIL`

### **Step 2: Import Templates**

The templates are in `lib/email-templates/notification-templates.tsx`:

```typescript
import {
  ExactMatchNotificationTemplate,
  SimilarLoadNotificationTemplate,
  FavoriteAvailableNotificationTemplate,
  BidWonNotificationTemplate,
  BidLostNotificationTemplate,
  DeadlineApproachingNotificationTemplate,
} from '@/lib/email-templates/notification-templates';
```

### **Step 3: Send Emails**

Use the `sendEmail` function with React Email templates:

```typescript
import { sendEmail } from '@/lib/email/notify';
import { ExactMatchNotificationTemplate } from '@/lib/email-templates/notification-templates';

// Send exact match notification
await sendEmail({
  to: 'carrier@example.com',
  subject: '🎯 Exact Match Found for Your Favorite Route',
  react: ExactMatchNotificationTemplate({
    bidNumber: 'BID-12345',
    origin: 'Los Angeles, CA',
    destination: 'New York, NY',
    revenue: 5000,
    miles: 2800,
    viewUrl: 'https://novafreight.io/loads/BID-12345',
    carrierName: 'John Doe',
  }),
});
```

### **Step 4: Integrate with Notification Worker**

Update `workers/notification-worker.ts` to send emails:

```typescript
import { sendEmail } from '../lib/email/notify';
import { ExactMatchNotificationTemplate } from '../lib/email-templates/notification-templates';

// In your notification processing function
async function sendNotificationEmail(carrierEmail: string, notificationData: any) {
  // Get carrier email from database
  const carrier = await sql`
    SELECT email FROM users WHERE id = ${carrierUserId}
  `;
  
  if (!carrier[0]?.email) return;
  
  // Send email based on notification type
  switch (notificationType) {
    case 'exact_match':
      await sendEmail({
        to: carrier[0].email,
        subject: '🎯 Exact Match Found for Your Favorite Route',
        react: ExactMatchNotificationTemplate({
          bidNumber: notificationData.bidNumber,
          origin: notificationData.origin,
          destination: notificationData.destination,
          revenue: notificationData.revenue,
          miles: notificationData.miles,
          viewUrl: `https://novafreight.io/loads/${notificationData.bidNumber}`,
          carrierName: carrier[0].name,
        }),
      });
      break;
    // ... other cases
  }
}
```

---

## 📋 Template Props Reference

### **ExactMatchNotificationTemplate**
```typescript
{
  bidNumber: string;
  origin: string;
  destination: string;
  revenue?: number;
  miles?: number;
  viewUrl: string;
  carrierName?: string;
}
```

### **SimilarLoadNotificationTemplate**
```typescript
{
  bidNumber: string;
  origin: string;
  destination: string;
  matchScore: number;
  reasons: string[];
  revenue?: number;
  miles?: number;
  viewUrl: string;
  carrierName?: string;
}
```

### **FavoriteAvailableNotificationTemplate**
```typescript
{
  bidNumber: string;
  origin: string;
  destination: string;
  revenue?: number;
  miles?: number;
  viewUrl: string;
  carrierName?: string;
}
```

### **BidWonNotificationTemplate**
```typescript
{
  bidNumber: string;
  amount: number; // in cents
  origin: string;
  destination: string;
  viewUrl: string;
  carrierName?: string;
}
```

### **BidLostNotificationTemplate**
```typescript
{
  bidNumber: string;
  origin: string;
  destination: string;
  winningAmount?: number; // in cents
  yourBid?: number; // in cents
  viewUrl: string;
  carrierName?: string;
}
```

### **DeadlineApproachingNotificationTemplate**
```typescript
{
  bidNumber: string;
  origin: string;
  destination: string;
  minutesRemaining: number;
  viewUrl: string;
  carrierName?: string;
}
```

---

## 🎯 Best Practices (2024-2025)

### **Resend + React Email:**
✅ **DO:**
- Use `react` prop (not `html`) - Resend renders React Email components
- Keep templates responsive (React Email handles this)
- Use consistent branding across all emails
- Test in multiple email clients

❌ **DON'T:**
- Don't use complex CSS (email clients have limited support)
- Don't use JavaScript in emails
- Don't use external images without fallbacks
- Don't forget to set `RESEND_FROM_EMAIL`

### **Email Design:**
✅ **DO:**
- Keep subject lines clear and action-oriented
- Use emojis sparingly (one per subject line)
- Include clear CTAs (buttons, not just links)
- Make it scannable (headings, bullet points)

❌ **DON'T:**
- Don't make emails too long
- Don't use too many colors
- Don't forget mobile responsiveness
- Don't skip the preview text

---

## 🧪 Testing

### **Local Testing:**
```typescript
// Set EMAIL_PROVIDER=none for development
// Emails will be logged but not sent
EMAIL_PROVIDER=none
```

### **Production Testing:**
1. Use Resend's test mode first
2. Send to your own email
3. Check spam folder
4. Test on mobile devices
5. Verify all links work

### **Resend Dashboard:**
- View sent emails
- Check delivery status
- Monitor bounce rates
- See open/click rates

---

## 📊 Monitoring

### **Check Email Delivery:**
```typescript
const result = await sendEmail({ ... });
if (result.success) {
  console.log('Email sent:', result.messageId);
} else {
  console.error('Email failed:', result.error);
}
```

### **Resend Dashboard:**
- Go to https://resend.com/emails
- See all sent emails
- Check delivery status
- View analytics

---

## 🎨 Customization

### **Update Colors:**
Edit `lib/email-templates/notification-templates.tsx`:
- Change `hsl(221.2, 83.2%, 53.3%)` to your primary color
- Update gradient colors in `brandGradient`
- Adjust surface colors to match your theme

### **Update Branding:**
- Change logo icon emoji
- Update "NOVA" text
- Modify footer links
- Adjust tagline

### **Add New Templates:**
1. Create new template component
2. Use shared styles (main, container, etc.)
3. Export from the file
4. Import and use in your code

---

## ✅ Summary

**You now have:**
- ✅ 6 elegant email templates matching your NOVA design
- ✅ Resend provider implementation
- ✅ React Email best practices (2024-2025)
- ✅ Premium styling with your exact color scheme
- ✅ Responsive, professional emails

**Next Steps:**
1. Set up Resend API key
2. Integrate with notification worker
3. Test email delivery
4. Monitor in Resend dashboard

**The templates are ready to use!** 🚀

