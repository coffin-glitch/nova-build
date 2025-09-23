# NOVA Build - Live Auction System

## Overview

The NOVA Build application now features a comprehensive live auction system for USPS loads with 25-minute countdown timers, carrier bidding, and admin adjudication.

## Key Features

### 🎯 Live Auction Board (`/bid-board`)
- **25-minute countdown timers** for each Telegram bid
- **Real-time updates** every 10 seconds
- **Premium glassmorphism design** with gradient backgrounds
- **Carrier bidding** with amount validation
- **Search and filtering** by bid number and state tag
- **Responsive design** with mobile support

### 🔨 Admin Auction Console (`/admin/auctions`)
- **Live auction management** with real-time bid tracking
- **Award system** for selecting winning carriers
- **Comprehensive bid details** with carrier information
- **Notification system** for winners and participants
- **Expired auction tracking** for historical data

### 🔔 Notification System
- **In-app notifications** for auction awards
- **Real-time updates** with unread count badges
- **Winner notifications** with next steps
- **Participant notifications** for auction results

## Database Schema

### Core Tables
- `telegram_bids` - USPS load data from Telegram
- `carrier_profiles` - Carrier company information
- `carrier_bids` - Individual carrier bids on loads
- `auction_awards` - Admin-awarded winning bids
- `notifications` - In-app notification system

### Key Constraints
- **25-minute auction window**: `expires_at_25 = received_at + INTERVAL '25 minutes'`
- **Unique bidding**: One active bid per carrier per auction
- **Award validation**: Winner must have existing bid
- **Real-time indexing**: Optimized for live queries

## API Endpoints

### Public Endpoints
- `GET /api/health/db` - Database health check
- `GET /api/telegram-bids` - List active auctions with filters

### Carrier Endpoints
- `POST /api/carrier-bids` - Place/update bid on auction
- `GET /api/carrier-bids` - Get carrier's bid summary
- `GET /api/bids/[bid_number]` - Get detailed bid information

### Admin Endpoints
- `POST /api/admin/bids/[bid_number]/award` - Award auction to winner
- `GET /api/notifications` - Get user notifications
- `PATCH /api/notifications` - Mark notifications as read

## User Roles & Permissions

### Public Users
- View live auction board
- See countdown timers
- Access bid details

### Carriers
- Place bids on active auctions
- View their bid history
- Receive award notifications
- Access "My Loads" for awarded loads

### Admins
- Manage all auctions
- Award winning bids
- View all carrier information
- Access comprehensive analytics

## 25-Minute Auction Rules

### Bidding Window
- **Start**: When Telegram bid is received
- **End**: Exactly 25 minutes after receipt
- **Lock**: No new bids after expiration
- **Display**: Live countdown with visual urgency

### Validation Rules
- **Amount**: Must be > $0 and < $100,000
- **Timing**: Only during active auction window
- **Uniqueness**: One bid per carrier per auction
- **Currency**: All amounts stored as cents (integer)

### Admin Awarding
- **Eligibility**: Winner must have existing bid
- **Uniqueness**: One award per auction
- **Notifications**: Automatic winner/loser notifications
- **Integration**: Creates load assignment for winner

## Testing Checklist

### As Carrier
1. ✅ Visit `/bid-board` - see live auctions with countdowns
2. ✅ Place bid on active auction - form validation works
3. ✅ Update existing bid - upsert functionality
4. ✅ Try to bid on expired auction - rejection with clear message
5. ✅ View bid details - comprehensive information display

### As Admin
1. ✅ Visit `/admin/auctions` - see all active and expired auctions
2. ✅ Click auction - view all carrier bids sorted by price
3. ✅ Award auction - select winner and confirm
4. ✅ Check notifications - winner and participants notified
5. ✅ Verify "My Loads" - winner sees awarded load

### Visual Design
1. ✅ Premium gradient backgrounds
2. ✅ Glassmorphism cards with backdrop blur
3. ✅ Live countdown animations
4. ✅ Responsive mobile design
5. ✅ Consistent typography and spacing

## Technical Implementation

### Frontend
- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** with custom components
- **SWR** for real-time data fetching
- **Lucide React** for consistent icons

### Backend
- **PostgreSQL** with optimized indexes
- **Postgres.js** for database queries
- **Clerk** for authentication
- **Server-side validation** for all operations

### Real-time Features
- **10-second polling** for auction updates
- **Client-side countdown** with server sync
- **Optimistic UI updates** for better UX
- **Error handling** with user feedback

## Migration Instructions

1. **Run migration**: `psql $DATABASE_URL -f db/migrations/006_auctions_and_bidding.sql`
2. **Verify tables**: Check that all tables and indexes are created
3. **Test connection**: Visit `/api/health/db` for database status
4. **Start application**: `npm run dev` and test all features

## Future Enhancements

- **WebSocket support** for real-time updates
- **Email/SMS notifications** for critical events
- **Advanced analytics** for auction performance
- **Mobile app** with push notifications
- **Integration** with external load boards

## Troubleshooting

### Common Issues
- **Database connection**: Check `DATABASE_URL` in `.env.local`
- **Migration errors**: Ensure PostgreSQL is accessible
- **Authentication**: Verify Clerk configuration
- **Real-time updates**: Check SWR refresh intervals

### Debug Steps
1. Check server logs for errors
2. Verify database connectivity
3. Test API endpoints individually
4. Check browser console for client errors
5. Validate environment variables

---

**Status**: ✅ Fully implemented and tested
**Last Updated**: September 22, 2024
**Version**: 1.0.0
