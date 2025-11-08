"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Palette } from "lucide-react";
import { useUserPreferences } from "@/components/providers/UserPreferencesProvider";
import { AdvancedColorPicker } from "./AdvancedColorPicker";

interface ColorPaletteProps {
  currentColor: string;
  onColorChange: (color: string) => void;
}

export function ColorPalette({ currentColor, onColorChange }: ColorPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { preferences, updateGlowingBackground } = useUserPreferences();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-muted/50"
        >
          <Palette className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Advanced Color Picker
          </DialogTitle>
        </DialogHeader>
        
        <AdvancedColorPicker
          currentColor={currentColor}
          onColorChange={(color) => {
            onColorChange(color);
          }}
          onGlowingBackgroundChange={updateGlowingBackground}
          glowingBackgroundEnabled={preferences.glowingBackgroundEnabled}
        />
      </DialogContent>
    </Dialog>
  );
}
