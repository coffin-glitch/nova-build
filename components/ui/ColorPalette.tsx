"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Palette, Check } from "lucide-react";

interface ColorPaletteProps {
  currentColor: string;
  onColorChange: (color: string) => void;
}

const ACCENT_COLORS = [
  { name: "Default", value: "hsl(221, 83%, 53%)", class: "bg-blue-500" },
  { name: "White", value: "hsl(0, 0%, 100%)", class: "bg-white" },
  
  // Blues & Cyans
  { name: "Navy", value: "hsl(220, 100%, 25%)", class: "bg-blue-900" },
  { name: "Ocean", value: "hsl(200, 100%, 40%)", class: "bg-blue-600" },
  { name: "Azure", value: "hsl(210, 100%, 50%)", class: "bg-blue-500" },
  { name: "Cobalt", value: "hsl(220, 100%, 60%)", class: "bg-blue-400" },
  { name: "Indigo", value: "hsl(238, 100%, 67%)", class: "bg-indigo-500" },
  { name: "Periwinkle", value: "hsl(240, 100%, 75%)", class: "bg-indigo-300" },
  { name: "Cyan", value: "hsl(188, 94%, 43%)", class: "bg-cyan-500" },
  { name: "Turquoise", value: "hsl(180, 100%, 45%)", class: "bg-teal-400" },
  { name: "Sky", value: "hsl(199, 89%, 48%)", class: "bg-sky-500" },
  { name: "Aqua", value: "hsl(180, 100%, 60%)", class: "bg-cyan-300" },
  
  // Purples & Magentas
  { name: "Purple", value: "hsl(262, 83%, 58%)", class: "bg-purple-500" },
  { name: "Violet", value: "hsl(270, 100%, 50%)", class: "bg-purple-600" },
  { name: "Lavender", value: "hsl(270, 100%, 75%)", class: "bg-purple-200" },
  { name: "Plum", value: "hsl(300, 100%, 30%)", class: "bg-purple-800" },
  { name: "Magenta", value: "hsl(300, 100%, 50%)", class: "bg-fuchsia-500" },
  { name: "Fuchsia", value: "hsl(300, 100%, 60%)", class: "bg-fuchsia-400" },
  { name: "Pink", value: "hsl(330, 81%, 60%)", class: "bg-pink-500" },
  { name: "Rose", value: "hsl(346, 87%, 43%)", class: "bg-rose-500" },
  { name: "Coral", value: "hsl(350, 100%, 60%)", class: "bg-rose-400" },
  { name: "Hot Pink", value: "hsl(320, 100%, 50%)", class: "bg-pink-600" },
  
  // Reds & Oranges
  { name: "Red", value: "hsl(0, 84%, 60%)", class: "bg-red-500" },
  { name: "Crimson", value: "hsl(0, 100%, 40%)", class: "bg-red-700" },
  { name: "Scarlet", value: "hsl(0, 100%, 50%)", class: "bg-red-600" },
  { name: "Burgundy", value: "hsl(340, 100%, 25%)", class: "bg-red-900" },
  { name: "Orange", value: "hsl(25, 95%, 53%)", class: "bg-orange-500" },
  { name: "Tangerine", value: "hsl(20, 100%, 60%)", class: "bg-orange-400" },
  { name: "Peach", value: "hsl(30, 100%, 70%)", class: "bg-orange-300" },
  { name: "Amber", value: "hsl(45, 93%, 47%)", class: "bg-amber-500" },
  { name: "Gold", value: "hsl(45, 100%, 50%)", class: "bg-yellow-500" },
  { name: "Copper", value: "hsl(20, 100%, 40%)", class: "bg-orange-700" },
  
  // Yellows & Greens
  { name: "Yellow", value: "hsl(54, 96%, 53%)", class: "bg-yellow-500" },
  { name: "Lemon", value: "hsl(60, 100%, 60%)", class: "bg-yellow-300" },
  { name: "Canary", value: "hsl(50, 100%, 70%)", class: "bg-yellow-200" },
  { name: "Lime", value: "hsl(84, 81%, 44%)", class: "bg-lime-500" },
  { name: "Chartreuse", value: "hsl(90, 100%, 50%)", class: "bg-lime-400" },
  { name: "Green", value: "hsl(142, 76%, 36%)", class: "bg-green-500" },
  { name: "Forest", value: "hsl(120, 100%, 25%)", class: "bg-green-800" },
  { name: "Mint", value: "hsl(150, 100%, 60%)", class: "bg-green-300" },
  { name: "Emerald", value: "hsl(158, 64%, 52%)", class: "bg-emerald-500" },
  { name: "Jade", value: "hsl(160, 100%, 40%)", class: "bg-emerald-600" },
  { name: "Teal", value: "hsl(173, 80%, 40%)", class: "bg-teal-500" },
  { name: "Seafoam", value: "hsl(170, 100%, 60%)", class: "bg-teal-300" },
  
  // Grays & Neutrals
  { name: "Black", value: "hsl(0, 0%, 0%)", class: "bg-black" },
  { name: "Charcoal", value: "hsl(0, 0%, 20%)", class: "bg-gray-800" },
  { name: "Slate", value: "hsl(215, 13%, 34%)", class: "bg-slate-500" },
  { name: "Steel", value: "hsl(210, 20%, 50%)", class: "bg-gray-500" },
  { name: "Silver", value: "hsl(0, 0%, 70%)", class: "bg-gray-300" },
  { name: "Pearl", value: "hsl(0, 0%, 90%)", class: "bg-gray-100" },
  
  // Special Colors
  { name: "Bronze", value: "hsl(30, 50%, 40%)", class: "bg-amber-700" },
  { name: "Copper", value: "hsl(20, 60%, 50%)", class: "bg-orange-600" },
  { name: "Olive", value: "hsl(60, 30%, 40%)", class: "bg-yellow-700" },
  { name: "Sage", value: "hsl(90, 30%, 50%)", class: "bg-green-600" },
  { name: "Mauve", value: "hsl(270, 30%, 60%)", class: "bg-purple-300" },
  { name: "Cream", value: "hsl(45, 20%, 85%)", class: "bg-yellow-100" },
];

export function ColorPalette({ currentColor, onColorChange }: ColorPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Choose Accent Color
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Customize your accent color for buttons, badges, and highlights
          </p>
          
          <div className="grid grid-cols-6 gap-2">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => {
                  onColorChange(color.value);
                  setIsOpen(false);
                }}
                className={`relative h-10 w-10 rounded-lg ${color.class} hover:scale-105 transition-transform border-2 ${
                  currentColor === color.value 
                    ? 'border-foreground ring-2 ring-offset-2 ring-primary' 
                    : 'border-border hover:border-foreground/50'
                }`}
                style={{ backgroundColor: color.value }}
              >
                {currentColor === color.value && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check className="h-4 w-4 text-white drop-shadow-sm" />
                  </div>
                )}
              </button>
            ))}
          </div>
          
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div 
                className="w-4 h-4 rounded-full border border-border"
                style={{ backgroundColor: currentColor }}
              />
              <span>Current: {ACCENT_COLORS.find(c => c.value === currentColor)?.name || 'Custom'}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
