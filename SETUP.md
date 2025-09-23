# NOVA Build - Setup Instructions

## Overview

NOVA Build is a premium carrier portal for freight management, bidding, and load optimization. This application features:

- **Premium Design**: Apple-level design language with dark glass surfaces and smooth animations
- **Role-Based Access**: Admin and Carrier roles with appropriate permissions
- **Real-time Bidding**: Live Telegram bid integration with 10-second refresh
- **Load Management**: EAX system integration for load data
- **Modern Tech Stack**: Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Clerk Auth

## Prerequisites

- Node.js 18+ 
- npm or yarn
- PostgreSQL database (Supabase recommended)
- Clerk account for authentication

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Database
DATABASE_URL=your_supabase_database_url

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Optional: Base URL for API calls
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Database Setup

1. **Run Migrations**: Execute the SQL files in `db/migrations/` in order:
   ```sql
   -- Run these in your PostgreSQL database
   -- 001_create_eax_tables.sql
   -- 002_add_published_to_loads.sql  
   -- 004_offers_and_lanes.sql
   -- 005_telegram_bids.sql
   -- 006_user_roles.sql
   -- 007_carrier_profiles.sql
   ```

2. **Create User Roles**: After running migrations, manually set user roles:
   ```sql
   -- Set a user as admin (replace with actual Clerk user ID)
   INSERT INTO user_roles (user_id, role) VALUES ('user_123', 'admin');
   
   -- Set a user as carrier (replace with actual Clerk user ID)  
   INSERT INTO user_roles (user_id, role) VALUES ('user_456', 'carrier');
   ```

## Installation & Running

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```

3. **Open Application**:
   Navigate to `http://localhost:3000`

## Features Implemented

### 🏠 **Home Page**
- Premium hero section with glass morphism effects
- Feature cards showcasing key capabilities
- Call-to-action buttons for Bid Board and Sign In

### 🎯 **Bid Board** (Public)
- Real-time Telegram bids display (refreshes every 10 seconds)
- Search by bid number
- Filter by state/tag
- Premium card-based layout with hover effects

### 👤 **Profile Page** (Carrier)
- Clerk user information display
- Editable carrier details (MC#, DOT#, phone, dispatch email)
- Profile completion status indicators
- Real-time save functionality

### 🛡️ **Admin Dashboard**
- KPI cards showing system statistics
- Quick action buttons for load/bid management
- Recent activity feed
- Real-time data updates

### 📊 **Admin Manage Bids**
- Live table of all Telegram bids
- Detailed drawer view for each bid
- Carrier offers display
- Route and timing information

### 🎨 **Design System**
- Premium dark theme with glass morphism
- Consistent spacing and typography
- Smooth animations and transitions
- Mobile-responsive design
- Custom scrollbars and hover effects

## Role-Based Access Control

The application uses Clerk middleware for authentication and custom role-based access control:

### **Public Routes** (No authentication required)
- `/` - Home page
- `/bid-board` - Bid Board
- `/sign-in` - Sign in page
- `/sign-up` - Sign up page
- `/api/test-db` - Database test endpoint
- `/api/bids/active` - Legacy bid data endpoint

### **Protected Routes** (Authentication required)
All other routes require authentication. Role checking is handled at the page level:

- **Carrier Routes**: `/book-loads`, `/my-loads`, `/current-offers`, `/dedicated-lanes`, `/profile`
- **Admin Routes**: `/admin`, `/admin/bids`, `/admin/loads`, `/admin/eax-upload`

### **Auth Functions** (`lib/auth.ts`)
- `getUserRole(userId)` - Get user role from database (defaults to "carrier")
- `requireAdmin()` - Require admin role, redirect to 403 if not
- `requireCarrier()` - Require carrier role (admin can also pass)
- `isAdmin(userId?)` - Check admin role without redirecting
- `isCarrier(userId?)` - Check carrier role without redirecting

### **Middleware Configuration** (`middleware.ts`)
- Uses Clerk's `clerkMiddleware` for authentication
- Public routes are allow-listed using `createRouteMatcher`
- All other routes require authentication
- Role-based access control is handled at the page level

## Server Actions

The application uses Next.js 15 server actions instead of API routes for better performance and type safety:

### **Profile Management**
- `getCarrierProfile()` - Get current user's carrier profile
- `updateCarrierProfile(formData)` - Update carrier profile information

### **Admin Functions**
- `getAdminStats()` - Get admin dashboard statistics
- `getUserRoleAction()` - Get current user's role

### **Bid Management**
- `getActiveBids()` - Get active Telegram bids
- `getBidOffers(bidId)` - Get offers for specific bid

### **Remaining API Routes**
- `GET /api/bids/active` - Legacy route for bid data (used by existing scripts)
- `GET /api/test-db` - Database connection test

## Database Schema

### **Core Tables**
- `user_roles` - User role assignments (admin/carrier)
- `carrier_profiles` - Additional carrier information
- `loads` - EAX load data with publish status
- `telegram_bids` - Telegram bid data
- `telegram_bid_offers` - Carrier offers on bids
- `load_offers` - Carrier offers on loads
- `assignments` - Load assignments to carriers
- `dedicated_lanes` - Dedicated lane information

## Development Notes

### **Styling**
- Uses Tailwind CSS with custom design tokens
- Glass morphism effects via custom CSS classes
- Dark theme optimized for premium feel
- Responsive design with mobile-first approach

### **State Management**
- React hooks for local state
- Server actions for data fetching and mutations
- Real-time updates via polling with server actions
- Client components for interactive features

### **Type Safety**
- Full TypeScript implementation
- Strict type checking enabled
- Interface definitions for all data structures

## Troubleshooting

### **Common Issues**

1. **Database Connection**: Ensure DATABASE_URL is correct and database is accessible
2. **Clerk Auth**: Verify Clerk keys are properly set in environment variables
3. **Role Access**: Make sure user roles are set in the database
4. **Build Errors**: Check for TypeScript errors and missing dependencies

### **Debug Mode**
- Check browser console for client-side errors
- Monitor network tab for API call failures
- Review server logs for backend issues

## Next Steps

### **Immediate Improvements**
1. Implement remaining carrier pages (book-loads, my-loads, etc.)
2. Add load management functionality for admins
3. Implement EAX integration for data updates
4. Add real-time notifications

### **Future Enhancements**
1. Mobile app development
2. Advanced analytics and reporting
3. Automated load matching
4. Integration with external freight systems

## Support

For technical support or questions:
- Check the codebase documentation
- Review API endpoint responses
- Monitor browser developer tools
- Check database query logs

---

**Built with ❤️ using Next.js, TypeScript, and modern web technologies**
