import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Format distance
export function formatDistance(miles: number): string {
  if (miles < 1) {
    return `${Math.round(miles * 5280)} ft`;
  }
  return `${miles.toLocaleString()} mi`;
}

// Format date
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

// Format time
export function formatTime(timeString: string): string {
  if (!timeString) return '';
  
  // Handle different time formats
  if (timeString.includes(':')) {
    return timeString;
  }
  
  // Handle HHMM format
  if (timeString.length === 4 && /^\d{4}$/.test(timeString)) {
    const hours = timeString.substring(0, 2);
    const minutes = timeString.substring(2, 4);
    return `${hours}:${minutes}`;
  }
  
  return timeString;
}

// Get appropriate text color (black or white) based on HSL background color
// Returns black for light colors and white for dark colors
// theme: optional 'dark' | 'light' to adjust thresholds for dark mode
export function getButtonTextColor(hslColor: string, theme?: 'dark' | 'light' | string | null): string {
  if (!hslColor) return '#ffffff';
  
  // Parse HSL color: "hsl(0, 0%, 100%)" or "hsl(0,0%,100%)"
  const match = hslColor.match(/hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/i);
  if (!match) {
    // Fallback: if it's not HSL format, default to white text
    return '#ffffff';
  }
  
  const lightness = parseFloat(match[3]);
  const isDarkMode = theme === 'dark';
  
  // White (100% lightness) should have black text
  if (lightness >= 100) {
    return '#000000';
  }
  
  // In dark mode, be more aggressive about using white text
  // because even medium colors need better contrast against dark backgrounds
  if (isDarkMode) {
    // In dark mode: use white text for anything below 70% lightness
    if (lightness < 70) {
      return '#ffffff';
    }
    // Very light colors (>= 90% lightness) can use black text even in dark mode
    if (lightness >= 90) {
      return '#000000';
    }
    // For 70-90% range in dark mode, use relative luminance
  } else {
    // Light mode: use original thresholds
    // Very light colors (>= 85% lightness) should have black text for better contrast
    if (lightness >= 85) {
      return '#000000';
    }
    
    // Dark colors (< 50% lightness) should have white text
    if (lightness < 50) {
      return '#ffffff';
    }
  }
  
  // Medium colors: use relative luminance for better contrast
  // Convert HSL to RGB to calculate relative luminance
  const h = parseInt(match[1]) / 360;
  const s = parseFloat(match[2]) / 100;
  const l = lightness / 100;
  
  // HSL to RGB conversion
  let r, g, b;
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  // Calculate relative luminance
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  
  // In dark mode, use a lower threshold for white text (more aggressive)
  // In light mode, use standard threshold
  const threshold = isDarkMode ? 0.6 : 0.5;
  
  // Use white text for darker colors, black for lighter colors
  return luminance < threshold ? '#ffffff' : '#000000';
}
