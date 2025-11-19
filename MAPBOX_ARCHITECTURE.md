# Mapbox Architecture - Best Practices Implementation

## Overview

This document describes the improved Mapbox implementation following Next.js and React best practices, based on modern patterns for Mapbox GL JS integration.

## Architecture

### 1. Map Context (`context/map-context.tsx`)
- Provides shared map instance through React Context
- Allows any component to access the map without prop drilling
- Type-safe with TypeScript

### 2. Map Provider (`lib/mapbox/provider.tsx`)
- Manages map lifecycle (creation, cleanup)
- Handles theme-aware style switching
- Automatic resize handling for dialogs/modals
- Container dimension validation
- Error handling

### 3. Components

#### Current Implementation (`components/ui/MapboxMap.tsx`)
- Works with existing codebase
- Supports lazy loading
- Static map previews
- Route visualization with markers and lines

#### New Pattern (Available for new components)
- Uses MapProvider for cleaner architecture
- Better separation of concerns
- Easier to extend and maintain

## Key Improvements

### ✅ Proper Container Handling
- Waits for container dimensions before initialization
- Critical for dialogs/modals that open dynamically
- Automatic retry if container not ready

### ✅ Map Resize Handling
- ResizeObserver for dynamic container changes
- Manual resize calls after map loads
- Essential for dialogs that animate open

### ✅ Theme Support
- Automatic style switching based on theme
- Supports both dark-v11 and light-v11 styles
- Ready for Mapbox Standard when SDK supports it

### ✅ Error Handling
- Filters out empty/non-critical errors
- Only logs meaningful errors
- Better debugging information

### ✅ Route Visualization
- Color-coded markers (blue=pickup, green=stops, red=delivery)
- Route lines connecting all stops
- Auto-fit bounds to show entire route

## Usage Examples

### Using MapProvider (New Pattern)

```tsx
import MapProvider from "@/lib/mapbox/provider";
import { useMap } from "@/context/map-context";

function MyMapComponent() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  return (
    <div ref={mapContainerRef} className="w-full h-96" />
    <MapProvider
      mapContainerRef={mapContainerRef}
      initialViewState={{
        longitude: -96.9,
        latitude: 37.6,
        zoom: 4
      }}
    >
      <MapContent /> {/* Uses useMap() hook */}
    </MapProvider>
  );
}

function MapContent() {
  const { map } = useMap();
  // Add markers, layers, etc.
}
```

### Using Existing MapboxMap (Current)

```tsx
import { MapboxMap } from "@/components/ui/MapboxMap";

<MapboxMap 
  stops={['Atlanta, GA', 'Dallas, TX']}
  lazy={false}
  minHeight="300px"
/>
```

## Best Practices Applied

1. **Context Pattern**: Shared map state through React Context
2. **Provider Pattern**: Lifecycle management in dedicated component
3. **Container Validation**: Ensures map only initializes when ready
4. **Resize Handling**: Automatic resizing for dynamic containers
5. **Error Filtering**: Only logs meaningful errors
6. **Theme Integration**: Seamless dark/light mode support
7. **Code Splitting**: Dynamic imports for Mapbox GL JS
8. **Lazy Loading**: Static previews before full map loads

## Migration Path

The existing `MapboxMap` component continues to work. For new features or components:

1. Use `MapProvider` for new map instances
2. Use `useMap()` hook to access map in child components
3. Gradually migrate existing components if needed

## Troubleshooting

### Map Not Displaying
- Check container has explicit dimensions (width/height)
- Verify Mapbox token is set in `.env.local`
- Check browser console for CSP errors
- Ensure container is visible before initialization

### Map in Dialog Not Showing
- MapProvider automatically handles resize
- Container dimension validation should catch this
- Check that dialog is fully open before map loads

### Theme Not Switching
- MapProvider automatically updates style on theme change
- Verify `next-themes` is properly configured
- Check theme value in browser DevTools

## Next Steps

1. ✅ Map Context and Provider created
2. ✅ Container dimension handling
3. ✅ Resize handling for dialogs
4. ✅ Route visualization
5. 🔄 Consider migrating LiveMapView to use MapProvider
6. 🔄 Add more map controls (zoom, style switcher)
7. 🔄 Add search/geocoding features

## References

- [Mapbox GL JS Docs](https://docs.mapbox.com/mapbox-gl-js/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [React Context API](https://react.dev/reference/react/useContext)

