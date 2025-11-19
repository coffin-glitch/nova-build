# Mapbox Standard Implementation

## Overview

This implementation uses **Mapbox Standard Style**, the modern, continuously improving map style from Mapbox. According to the [official documentation](https://docs.mapbox.com/map-styles/standard/guides/), Mapbox Standard is:

- ✅ **Highly performant** - Optimized rendering
- ✅ **Less configuration** - Many elements are preset
- ✅ **Automatically evolving** - Style updates improve quality without manual intervention
- ✅ **Default for all Mapbox SDKs** - Recommended best practice

## Implementation Details

### Style URL

We use the Mapbox Standard style URL:
```javascript
style: 'mapbox://styles/mapbox/standard'
```

**Reference**: [Mapbox Standard Guides](https://docs.mapbox.com/map-styles/standard/guides/)

### Configuration

We configure Mapbox Standard for cost optimization:

```javascript
config: {
  basemap: {
    // Use appropriate light preset based on theme
    lightPreset: theme === "dark" ? "night" : "day",
    // Disable expensive 3D features for cost savings
    show3dObjects: false,
    // Disable pedestrian roads to reduce complexity
    showPedestrianRoads: false,
  }
}
```

**Available Light Presets** (from [Mapbox Standard API](https://docs.mapbox.com/map-styles/standard/api/)):
- `day` - Default daytime lighting
- `dusk` - Evening lighting
- `dawn` - Morning lighting
- `night` - Nighttime lighting

### Cost Optimization

We disable expensive features:
- **3D Objects**: `show3dObjects: false` - Saves rendering costs
- **Pedestrian Roads**: `showPedestrianRoads: false` - Reduces map complexity

### Components Using Mapbox Standard

1. **MapboxMap** (`components/ui/MapboxMap.tsx`)
   - Route visualization in bid details
   - Uses Standard style with theme-based lighting

2. **LiveMapView** (`components/bid-board/LiveMapView.tsx`)
   - Live map console showing all active bids
   - Uses Standard style with theme-based lighting

## Benefits Over Old Styles

### Old Implementation (deprecated)
```javascript
// ❌ Old way - using v11 styles
style: theme === "dark" 
  ? "mapbox://styles/mapbox/dark-v11" 
  : "mapbox://styles/mapbox/light-v11"
```

### New Implementation (Mapbox Standard)
```javascript
// ✅ New way - using Standard style
style: 'mapbox://styles/mapbox/standard',
config: {
  basemap: {
    lightPreset: theme === "dark" ? "night" : "day",
    show3dObjects: false,
    showPedestrianRoads: false,
  }
}
```

**Advantages**:
1. **Better Performance** - Standard is optimized for rendering
2. **Automatic Updates** - Mapbox improves the style automatically
3. **Less Configuration** - Many settings are preset
4. **Future-Proof** - Standard is the default going forward
5. **Cost Effective** - Can disable expensive features via config

## Static Images

For static map previews, we also use Standard style:
```
https://api.mapbox.com/styles/v1/mapbox/standard/static/...
```

## Limitations

According to the [Mapbox Standard documentation](https://docs.mapbox.com/map-styles/standard/guides/#limitations):

- ❌ **No `queryRenderedFeatures` support** - Cannot dynamically query rendered features
- ❌ **Limited user interaction** - Only what's explicitly allowed by the style
- ❌ **Cannot filter certain layers** (e.g., POIs)

These limitations are acceptable for our use case as we:
- Don't need to query rendered features
- Only need basic marker interactions
- Don't need to filter POIs

## References

- [Mapbox Standard Style Guides](https://docs.mapbox.com/map-styles/standard/guides/)
- [Mapbox Standard API Reference](https://docs.mapbox.com/map-styles/standard/api/)
- [Mapbox Standard Playground](https://docs.mapbox.com/playground/standard-style/)
- [Mapbox GL JS Guides](https://docs.mapbox.com/mapbox-gl-js/guides/)

## Migration Notes

If you were using old v11 styles, the migration is complete. The new Standard style:
- Automatically adapts to your theme (via lightPreset)
- Provides better performance
- Requires less maintenance
- Is the recommended approach going forward

## Testing

To verify the implementation:
1. Check browser console for any Mapbox errors
2. Verify maps load with correct theme (dark/light)
3. Confirm markers appear correctly
4. Test map interactions (zoom, pan, marker clicks)
5. Monitor Mapbox dashboard for usage

All maps now use Mapbox Standard style! 🎉

