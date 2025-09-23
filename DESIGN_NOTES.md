# NOVA Build Design System

## Overview
NOVA Build implements a premium, production-quality UI/UX using Tailwind CSS + shadcn/ui components. The design system emphasizes modern logistics aesthetics with soft gradients, glass morphism effects, and crisp typography.

## Design Tokens

### Colors
- **Primary**: `hsl(221.2 83.2% 53.3%)` - Nova Blue
- **Surface Scale**: 50-950 range with proper contrast ratios
- **Semantic Colors**: background, foreground, card, border, input, ring, muted, accent
- **Dark Mode**: Full support with proper contrast ratios

### Typography
- **Font Family**: Inter (Google Fonts) with system fallbacks
- **Scale**: h1 `text-4xl md:text-5xl`, h2 `text-3xl`, h3 `text-2xl`
- **Body**: `text-muted-foreground` for secondary content

### Spacing & Layout
- **Container**: Centered with `max-w-7xl` and responsive padding
- **Sections**: `py-8 md:py-12` for consistent vertical rhythm
- **Grid**: Responsive with `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`

## Components

### Glass Morphism
- **Glass Component**: `bg-white/70 dark:bg-surface-900/30 backdrop-blur-md`
- **Borders**: `border-white/10` for subtle depth
- **Shadows**: Custom `shadow-glass` for premium feel

### Cards & Surfaces
- **Standard Cards**: shadcn/ui Card component
- **Glass Cards**: Custom Glass wrapper for premium sections
- **Hover Effects**: `hover:shadow-card transition-all duration-300 hover:-translate-y-1`

### Interactive Elements
- **Buttons**: shadcn/ui Button with hover scale effects
- **Focus States**: `ring-2 ring-primary/30` for accessibility
- **Transitions**: Smooth `transition-all duration-300` throughout

## Page Layouts

### Home Page
- **Hero Section**: Large gradient background with CTAs
- **Feature Grid**: 4-column responsive grid with glass cards
- **Stats Section**: Key metrics display
- **CTA Section**: Conversion-focused bottom section

### Find Loads
- **Search Panel**: Glass-wrapped filter controls
- **Results Grid**: 2-column layout with sticky map sidebar
- **Load Cards**: Detailed information with hover effects
- **Map Integration**: Placeholder for future Mapbox integration

### Bid Board
- **Live Auctions**: Real-time countdown timers
- **Auction Cards**: Glass cards with bidding information
- **Filters**: Search by bid number and state tag
- **Stats Dashboard**: Active/expired auction counts

### Admin Console
- **Auction Management**: Table view with bid details
- **Award Workflow**: Dialog-based bid awarding
- **Real-time Updates**: SWR polling for live data

## Accessibility

### Focus Management
- **Keyboard Navigation**: Full keyboard support
- **Focus Rings**: Visible focus indicators
- **ARIA Labels**: Proper labeling for screen readers

### Color Contrast
- **WCAG AA**: All text meets contrast requirements
- **Dark Mode**: Proper contrast in both themes
- **Status Indicators**: Clear visual feedback

## Performance

### Database
- **Connection Pooling**: 10 max connections with 30s idle timeout
- **Response Times**: < 120ms for subsequent requests
- **Health Checks**: `/api/health/db` endpoint

### Frontend
- **SWR Caching**: 10s polling for real-time data
- **Skeleton Loading**: Smooth loading states
- **Image Optimization**: Next.js Image component ready

## Technical Stack

### Core
- **Next.js 15**: App Router with server components
- **TypeScript**: Full type safety
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: Component library

### State Management
- **SWR**: Data fetching and caching
- **React Hooks**: Local state management
- **Clerk**: Authentication and user management

### Database
- **PostgreSQL**: Via Supabase pooler
- **Connection Pooling**: Optimized for performance
- **Real-time**: WebSocket-ready architecture

## Future Enhancements

### Theme System
- **Multiple Accents**: Nova Blue, Emerald variants
- **Theme Toggle**: System/light/dark modes
- **Brand Customization**: Easy color token updates

### Map Integration
- **Mapbox**: Route visualization
- **Interactive Maps**: Load location display
- **Geocoding**: Address validation

### Advanced Features
- **Real-time Notifications**: WebSocket integration
- **Advanced Filtering**: Multi-criteria search
- **Export Functionality**: Data export capabilities

## Development Guidelines

### Component Creation
1. Use shadcn/ui primitives as base
2. Apply glass morphism for premium sections
3. Include proper TypeScript types
4. Add accessibility attributes
5. Test in both light and dark modes

### Styling Patterns
1. Use semantic color tokens
2. Apply consistent spacing scale
3. Include hover/focus states
4. Ensure responsive design
5. Test contrast ratios

### Performance
1. Use server components for data fetching
2. Implement proper loading states
3. Optimize images and assets
4. Monitor bundle size
5. Test on various devices

This design system provides a solid foundation for building premium logistics applications with modern aesthetics and excellent user experience.
