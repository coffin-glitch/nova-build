"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface UserPreferences {
  accentColor: string;
  glowingBackgroundEnabled: boolean;
}

const defaultPreferences: UserPreferences = {
  accentColor: "hsl(221, 83%, 53%)", // Default blue
  glowingBackgroundEnabled: true, // Default enabled
};

const UserPreferencesContext = createContext<{
  preferences: UserPreferences;
  updateAccentColor: (color: string) => void;
  updateGlowingBackground: (enabled: boolean) => void;
} | null>(null);

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("user-preferences");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setPreferences({ ...defaultPreferences, ...parsed });
        } catch (error) {
          console.error("Failed to parse user preferences:", error);
        }
      }
    }
  }, []);

  // Save preferences to localStorage when they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("user-preferences", JSON.stringify(preferences));
    }
  }, [preferences]);

  const updateAccentColor = (color: string) => {
    setPreferences(prev => ({ ...prev, accentColor: color }));
  };

  const updateGlowingBackground = (enabled: boolean) => {
    setPreferences(prev => ({ ...prev, glowingBackgroundEnabled: enabled }));
  };

  return (
    <UserPreferencesContext.Provider value={{ preferences, updateAccentColor, updateGlowingBackground }}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error("useUserPreferences must be used within a UserPreferencesProvider");
  }
  return context;
}
