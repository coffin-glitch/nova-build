# Margin/Profit Analytics System

## Overview
The margin/profit analytics system tracks the profit margin that admins add when awarding bids. This data is **strictly admin-only** and is never exposed to carriers.

## Security & Privacy

### Carrier Data Protection
- **`margin_cents` is NEVER exposed to carriers** in any API endpoint
- All carrier-facing endpoints explicitly exclude `margin_cents` from SELECT statements
- Margin data is only accessible through admin-only endpoints:
  - `/api/admin/margin-analytics` - Analytics dashboard data
  - `/api/admin/bids/[bidNumber]/award` - Award endpoint (admin only)
  - `/api/admin/bids/[bidNumber]/re-award` - Re-award endpoint (admin only)

### Protected Endpoints
The following carrier endpoints have been verified to exclude margin data:
- `/api/carrier/awarded-bids` - Returns awarded bids (no margin)
- `/api/carrier/bids` - Returns carrier bids (no margin)
- `/api/carrier/bid-lifecycle/[bidNumber]` - Returns lifecycle data (no margin)
- `/api/carrier/bid-stats` - Returns statistics (no margin)

## Database Schema

### Table: `auction_awards`
- **Column**: `margin_cents` (INTEGER, nullable)
- **Purpose**: Stores profit margin in cents added by admin when submitting bid to actual auction
- **Migration**: `089_add_margin_to_auction_awards.sql`
- **Index**: `idx_auction_awards_margin_cents` (on margin_cents WHERE margin_cents IS NOT NULL)

## Admin Features

### 1. Award Dialog (`BidAdjudicationConsole`)
- Location: `/admin/bids` - Adjudication Console
- Features:
  - Margin input field (optional)
  - Real-time calculation: Carrier Bid + Margin = Submitted Amount
  - Only visible when a winner is selected
  - Margin is sent to API when awarding bid

### 2. Re-Award Dialog (`ReAwardDialog`)
- Location: `/admin/bids` - Re-Award functionality
- Features:
  - Same margin input field as award dialog
  - Real-time calculation display
  - Margin is sent to API when re-awarding bid

### 3. Analytics Console (`MarginProfitAnalytics`)
- Location: `/admin/offers-bids` - Analytics tab
- Features:
  - Total Profit Margin
  - Average Margin per bid
  - Margin Rate (% of carrier bid)
  - Margin Coverage (% of bids with margin)
  - Margin Distribution (buckets)
  - Margin by State
  - Daily Margin Trends
  - Top Routes by Margin
  - Margin Efficiency (per mile)
  - Admin Performance tracking
  - Date range and state filters

## API Endpoints

### Admin Endpoints

#### `POST /api/admin/bids/[bidNumber]/award`
- **Purpose**: Award a bid to a carrier
- **Body**: 
  ```json
  {
    "winnerUserId": "string",
    "adminNotes": "string (optional)",
    "marginCents": "number (optional, in cents)"
  }
  ```
- **Response**: Award details (no margin_cents in response to prevent accidental exposure)

#### `POST /api/admin/bids/[bidNumber]/re-award`
- **Purpose**: Re-award a bid to a different carrier
- **Body**: Same as award endpoint
- **Response**: Re-award details

#### `GET /api/admin/margin-analytics`
- **Purpose**: Get comprehensive margin analytics
- **Query Parameters**:
  - `dateFrom` (optional): Start date filter
  - `dateTo` (optional): End date filter
  - `stateTag` (optional): State filter
- **Response**: Complete analytics data including:
  - Overall statistics
  - Margin by state
  - Daily/weekly/monthly trends
  - Margin distribution
  - Top routes
  - Efficiency metrics
  - Admin performance

## Usage

### Adding Margin When Awarding
1. Open the Adjudication Console for a bid
2. Select a winning carrier
3. (Optional) Enter profit margin in USD
4. The system calculates: Carrier Bid + Margin = Submitted Amount
5. Click "Award Bid"
6. Margin is stored in `auction_awards.margin_cents`

### Viewing Analytics
1. Navigate to `/admin/offers-bids`
2. Click on "Analytics" tab
3. View comprehensive margin/profit analytics
4. Use filters to analyze specific date ranges or states

## Important Notes

1. **Margin is optional** - Admins can award bids without entering margin
2. **Margin is admin-only** - Carriers never see this data
3. **Margin is in cents** - Stored as integer (e.g., $10.50 = 1050 cents)
4. **Margin can be updated** - Re-awarding allows updating margin
5. **Analytics are real-time** - Data refreshes every 30 seconds

## Future Enhancements

- Export margin analytics to CSV/Excel
- Margin forecasting and projections
- Margin alerts (low margin thresholds)
- Historical margin comparisons
- Margin by route type analysis

