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
