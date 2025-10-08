"use client";

import { useUserPreferences } from "@/components/providers/UserPreferencesProvider";

export function useAccentColor() {
  const { preferences } = useUserPreferences();
  
  return {
    accentColor: preferences.accentColor,
    accentColorStyle: { color: preferences.accentColor },
    accentBgStyle: { backgroundColor: preferences.accentColor },
    accentBorderStyle: { borderColor: preferences.accentColor },
  };
}
