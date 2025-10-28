# Carrier Favorites & Notification System

## Overview
This document outlines the implementation of a comprehensive favorites and notification system for carriers to manage their bid preferences and receive alerts about similar loads.

## System Architecture

### 1. Database Schema
- **carrier_favorites**: Stores favorited bids per carrier
- **carrier_notification_preferences**: Stores notification settings per carrier
- **carrier_notifications**: Stores sent notifications (extends existing table)

### 2. Load Matching Algorithm
The system uses multiple criteria to determine if a new load matches a carrier's favorited bids:

#### Similarity Criteria:
1. **Geographic Similarity**: 
   - Same origin/destination states
   - Within distance threshold (default: 50 miles)
   - Same route corridor

2. **Load Characteristics**:
   - Similar distance range (±20%)
   - Same equipment type
   - Similar pickup/delivery timing

3. **Route Pattern Matching**:
   - Same major cities/metropolitan areas
   - Similar stop patterns
   - Same interstate corridors

#### Matching Algorithm Implementation:
```sql
-- Example similarity query
WITH favorite_patterns AS (
  SELECT 
    cf.carrier_user_id,
    tb.stops,
    tb.distance_miles,
    tb.tag,
    tb.pickup_timestamp,
    tb.delivery_timestamp
  FROM carrier_favorites cf
  JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
  WHERE cf.carrier_user_id = $1
),
new_load AS (
  SELECT * FROM telegram_bids WHERE bid_number = $2
)
SELECT 
  fp.carrier_user_id,
  CASE 
    WHEN fp.tag = nl.tag THEN 0.3
    WHEN ST_DWithin(
      ST_GeogFromText('POINT(' || fp.origin_lng || ' ' || fp.origin_lat || ')'),
      ST_GeogFromText('POINT(' || nl.origin_lng || ' ' || nl.origin_lat || ')'),
      50000
    ) THEN 0.4
    WHEN ABS(fp.distance_miles - nl.distance_miles) / fp.distance_miles < 0.2 THEN 0.3
    ELSE 0
  END as similarity_score
FROM favorite_patterns fp
CROSS JOIN new_load nl
WHERE similarity_score > 0.5;
```

### 3. Notification System

#### Email Service Integration
- **Primary**: Resend (recommended for Next.js)
- **Fallback**: SendGrid
- **Features**: 
  - HTML email templates
  - Unsubscribe management
  - Delivery tracking

#### Notification Types:
1. **Similar Load Alert**: New load matches favorited criteria
2. **Bid Status Update**: Bid won/lost/expired
3. **System Notifications**: Maintenance, updates

#### Notification Preferences:
- Email frequency (immediate, daily digest, weekly)
- Distance threshold for matching
- Preferred states/equipment types
- Minimum/maximum distance filters

### 4. Implementation Plan

#### Phase 1: Core Favorites System ✅
- [x] Database schema
- [x] API endpoints
- [x] UI components
- [x] Navigation integration

#### Phase 2: Load Matching Algorithm
- [ ] Similarity scoring function
- [ ] Background job for new load processing
- [ ] Matching criteria configuration

#### Phase 3: Email Notification System
- [ ] Email service integration
- [ ] HTML email templates
- [ ] Notification preferences UI
- [ ] Unsubscribe management

#### Phase 4: Advanced Features
- [ ] Real-time notifications
- [ ] Mobile push notifications
- [ ] Analytics and reporting
- [ ] A/B testing for notification content

## Technical Implementation

### Email Service Setup (Resend)
```bash
npm install resend
```

```typescript
// lib/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendSimilarLoadNotification({
  carrierEmail,
  carrierName,
  similarLoad,
  favoriteLoad
}: {
  carrierEmail: string;
  carrierName: string;
  similarLoad: TelegramBid;
  favoriteLoad: TelegramBid;
}) {
  return await resend.emails.send({
    from: 'notifications@nova-build.com',
    to: carrierEmail,
    subject: `Similar Load Alert: ${similarLoad.bid_number}`,
    html: `
      <h2>New Load Matching Your Favorites!</h2>
      <p>Hi ${carrierName},</p>
      <p>A new load has been posted that matches your favorited load ${favoriteLoad.bid_number}.</p>
      
      <div style="border: 1px solid #ccc; padding: 20px; margin: 20px 0;">
        <h3>New Load: ${similarLoad.bid_number}</h3>
        <p><strong>Route:</strong> ${formatStops(similarLoad.stops)}</p>
        <p><strong>Distance:</strong> ${formatDistance(similarLoad.distance_miles)}</p>
        <p><strong>Pickup:</strong> ${formatPickupDateTime(similarLoad.pickup_timestamp)}</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/bid-board" 
           style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          View on Bid Board
        </a>
      </div>
      
      <p><small>You can manage your notification preferences in your profile settings.</small></p>
    `
  });
}
```

### Background Job for Load Matching
```typescript
// lib/load-matching.ts
export async function processNewLoadForMatching(bidNumber: string) {
  const newLoad = await getTelegramBid(bidNumber);
  if (!newLoad) return;

  // Get all carriers with notification preferences
  const carriers = await sql`
    SELECT DISTINCT cf.carrier_user_id, cnp.*
    FROM carrier_favorites cf
    JOIN carrier_notification_preferences cnp ON cf.carrier_user_id = cnp.carrier_user_id
    WHERE cnp.similar_load_notifications = true
  `;

  for (const carrier of carriers) {
    const similarityScore = await calculateSimilarityScore(carrier.carrier_user_id, bidNumber);
    
    if (similarityScore > 0.5) {
      await sendSimilarLoadNotification({
        carrierEmail: carrier.email,
        carrierName: carrier.name,
        similarLoad: newLoad,
        favoriteLoad: await getFavoriteLoad(carrier.carrier_user_id, bidNumber)
      });
      
      // Record notification
      await sql`
        INSERT INTO carrier_notifications (
          carrier_user_id, type, title, message, bid_number
        ) VALUES (
          ${carrier.carrier_user_id}, 
          'similar_load', 
          'Similar Load Alert: ${newLoad.bid_number}',
          'A new load matching your favorites has been posted.',
          ${bidNumber}
        )
      `;
    }
  }
}
```

## Future Enhancements

### 1. Machine Learning Integration
- Train models on carrier bidding patterns
- Improve matching accuracy over time
- Personalized recommendation engine

### 2. Real-time Notifications
- WebSocket integration for instant alerts
- Browser push notifications
- Mobile app notifications

### 3. Advanced Analytics
- Notification effectiveness metrics
- Carrier engagement tracking
- Load matching success rates

### 4. Integration Opportunities
- Calendar integration for pickup/delivery times
- GPS tracking for route optimization
- Third-party load board integration

## Security Considerations

1. **Data Privacy**: Ensure carrier preferences are encrypted
2. **Rate Limiting**: Prevent notification spam
3. **Authentication**: Verify carrier identity for all operations
4. **GDPR Compliance**: Provide data export/deletion options

## Performance Optimization

1. **Database Indexing**: Optimize queries for large datasets
2. **Caching**: Cache frequently accessed data
3. **Background Processing**: Use job queues for heavy operations
4. **CDN**: Serve static assets efficiently

This system provides a solid foundation for carrier engagement and can be extended with additional features as the platform grows.
