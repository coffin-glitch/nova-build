"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Palette, Droplet, Grid3x3, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdvancedColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
  onGlowingBackgroundChange?: (enabled: boolean) => void;
  glowingBackgroundEnabled?: boolean;
}

// Helper functions for color conversion
const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
};

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
};

const parseHsl = (hsl: string): [number, number, number] => {
  const match = hsl.match(/hsl\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)%,\s*(\d+(?:\.\d+)?)%\)/);
  if (match) {
    return [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])];
  }
  return [221, 83, 53]; // Default blue
};

const hslToString = (h: number, s: number, l: number): string => {
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
};

// Expanded color palette with many more colors
const EXPANDED_COLORS = [
  // Neutrals
  { name: "Black", value: "hsl(0, 0%, 0%)", category: "Neutrals" },
  { name: "White", value: "hsl(0, 0%, 100%)", category: "Neutrals" },
  { name: "Charcoal", value: "hsl(0, 0%, 20%)", category: "Neutrals" },
  { name: "Slate", value: "hsl(215, 13%, 34%)", category: "Neutrals" },
  { name: "Steel", value: "hsl(210, 20%, 50%)", category: "Neutrals" },
  { name: "Silver", value: "hsl(0, 0%, 70%)", category: "Neutrals" },
  { name: "Pearl", value: "hsl(0, 0%, 90%)", category: "Neutrals" },
  
  // Blues
  { name: "Navy", value: "hsl(220, 100%, 25%)", category: "Blues" },
  { name: "Midnight", value: "hsl(220, 100%, 15%)", category: "Blues" },
  { name: "Royal", value: "hsl(225, 100%, 35%)", category: "Blues" },
  { name: "Ocean", value: "hsl(200, 100%, 40%)", category: "Blues" },
  { name: "Azure", value: "hsl(210, 100%, 50%)", category: "Blues" },
  { name: "Cobalt", value: "hsl(220, 100%, 60%)", category: "Blues" },
  { name: "Sapphire", value: "hsl(215, 100%, 45%)", category: "Blues" },
  { name: "Sky", value: "hsl(199, 89%, 48%)", category: "Blues" },
  { name: "Cornflower", value: "hsl(219, 79%, 66%)", category: "Blues" },
  { name: "Powder", value: "hsl(210, 100%, 85%)", category: "Blues" },
  { name: "Ice", value: "hsl(200, 100%, 92%)", category: "Blues" },
  
  // Cyans & Teals
  { name: "Cyan", value: "hsl(188, 94%, 43%)", category: "Cyans" },
  { name: "Turquoise", value: "hsl(180, 100%, 45%)", category: "Cyans" },
  { name: "Aqua", value: "hsl(180, 100%, 60%)", category: "Cyans" },
  { name: "Teal", value: "hsl(173, 80%, 40%)", category: "Cyans" },
  { name: "Seafoam", value: "hsl(170, 100%, 60%)", category: "Cyans" },
  { name: "Mint", value: "hsl(150, 100%, 60%)", category: "Cyans" },
  
  // Purples & Violets
  { name: "Purple", value: "hsl(262, 83%, 58%)", category: "Purples" },
  { name: "Violet", value: "hsl(270, 100%, 50%)", category: "Purples" },
  { name: "Lavender", value: "hsl(270, 100%, 75%)", category: "Purples" },
  { name: "Plum", value: "hsl(300, 100%, 30%)", category: "Purples" },
  { name: "Orchid", value: "hsl(280, 100%, 65%)", category: "Purples" },
  { name: "Amethyst", value: "hsl(270, 50%, 60%)", category: "Purples" },
  { name: "Lilac", value: "hsl(270, 60%, 80%)", category: "Purples" },
  
  // Magentas & Pinks
  { name: "Magenta", value: "hsl(300, 100%, 50%)", category: "Pinks" },
  { name: "Fuchsia", value: "hsl(300, 100%, 60%)", category: "Pinks" },
  { name: "Pink", value: "hsl(330, 81%, 60%)", category: "Pinks" },
  { name: "Rose", value: "hsl(346, 87%, 43%)", category: "Pinks" },
  { name: "Coral", value: "hsl(350, 100%, 60%)", category: "Pinks" },
  { name: "Hot Pink", value: "hsl(320, 100%, 50%)", category: "Pinks" },
  { name: "Salmon", value: "hsl(6, 93%, 71%)", category: "Pinks" },
  { name: "Blush", value: "hsl(340, 100%, 75%)", category: "Pinks" },
  
  // Reds
  { name: "Red", value: "hsl(0, 84%, 60%)", category: "Reds" },
  { name: "Crimson", value: "hsl(0, 100%, 40%)", category: "Reds" },
  { name: "Scarlet", value: "hsl(0, 100%, 50%)", category: "Reds" },
  { name: "Burgundy", value: "hsl(340, 100%, 25%)", category: "Reds" },
  { name: "Maroon", value: "hsl(0, 100%, 20%)", category: "Reds" },
  { name: "Cherry", value: "hsl(0, 100%, 45%)", category: "Reds" },
  { name: "Ruby", value: "hsl(345, 100%, 40%)", category: "Reds" },
  
  // Oranges
  { name: "Orange", value: "hsl(25, 95%, 53%)", category: "Oranges" },
  { name: "Tangerine", value: "hsl(20, 100%, 60%)", category: "Oranges" },
  { name: "Peach", value: "hsl(30, 100%, 70%)", category: "Oranges" },
  { name: "Amber", value: "hsl(45, 93%, 47%)", category: "Oranges" },
  { name: "Copper", value: "hsl(20, 100%, 40%)", category: "Oranges" },
  { name: "Rust", value: "hsl(15, 100%, 35%)", category: "Oranges" },
  { name: "Apricot", value: "hsl(25, 100%, 75%)", category: "Oranges" },
  
  // Yellows
  { name: "Yellow", value: "hsl(54, 96%, 53%)", category: "Yellows" },
  { name: "Gold", value: "hsl(45, 100%, 50%)", category: "Yellows" },
  { name: "Lemon", value: "hsl(60, 100%, 60%)", category: "Yellows" },
  { name: "Canary", value: "hsl(50, 100%, 70%)", category: "Yellows" },
  { name: "Sunshine", value: "hsl(55, 100%, 65%)", category: "Yellows" },
  { name: "Butter", value: "hsl(50, 100%, 80%)", category: "Yellows" },
  
  // Greens
  { name: "Green", value: "hsl(142, 76%, 36%)", category: "Greens" },
  { name: "Forest", value: "hsl(120, 100%, 25%)", category: "Greens" },
  { name: "Emerald", value: "hsl(158, 64%, 52%)", category: "Greens" },
  { name: "Jade", value: "hsl(160, 100%, 40%)", category: "Greens" },
  { name: "Lime", value: "hsl(84, 81%, 44%)", category: "Greens" },
  { name: "Chartreuse", value: "hsl(90, 100%, 50%)", category: "Greens" },
  { name: "Olive", value: "hsl(60, 30%, 40%)", category: "Greens" },
  { name: "Sage", value: "hsl(90, 30%, 50%)", category: "Greens" },
  { name: "Moss", value: "hsl(100, 40%, 45%)", category: "Greens" },
  { name: "Fern", value: "hsl(120, 50%, 55%)", category: "Greens" },
  
  // Special & Metallic
  { name: "Bronze", value: "hsl(30, 50%, 40%)", category: "Special" },
  { name: "Copper", value: "hsl(20, 60%, 50%)", category: "Special" },
  { name: "Mauve", value: "hsl(270, 30%, 60%)", category: "Special" },
  { name: "Cream", value: "hsl(45, 20%, 85%)", category: "Special" },
  { name: "Ivory", value: "hsl(50, 10%, 95%)", category: "Special" },
  { name: "Beige", value: "hsl(40, 15%, 80%)", category: "Special" },
  
  // Flat UI Colors from flatuicolorpicker.com (pages 2-12, scraped)
  { name: "Menthol", value: "hsl(88, 77%, 78%)", category: "Greens" },
  { name: "Sol Spray", value: "hsl(166, 84%, 68%)", category: "Cyans" },
  { name: "Bizarre", value: "hsl(347, 33%, 89%)", category: "Special" },
  { name: "Primrose", value: "hsl(57, 69%, 77%)", category: "Yellows" },
  { name: "Cerise", value: "hsl(329, 75%, 56%)", category: "Special" },
  { name: "Daily Bush", value: "hsl(272, 61%, 34%)", category: "Pinks" },
  { name: "Burly Wood", value: "hsl(31, 60%, 73%)", category: "Oranges" },
  { name: "Green Pea", value: "hsl(171, 52%, 18%)", category: "Cyans" },
  { name: "Sulu", value: "hsl(76, 76%, 72%)", category: "Greens" },
  { name: "Teak", value: "hsl(43, 29%, 51%)", category: "Oranges" },
  { name: "Sunny", value: "hsl(59, 100%, 75%)", category: "Yellows" },
  { name: "Pearl Bush", value: "hsl(30, 25%, 91%)", category: "Neutrals" },
  { name: "Cruise", value: "hsl(181, 45%, 81%)", category: "Cyans" },
  { name: "Laser Canary", value: "hsl(84, 100%, 70%)", category: "Greens" },
  { name: "Stark White", value: "hsl(47, 38%, 78%)", category: "Yellows" },
  { name: "Light Wood", value: "hsl(3, 17%, 44%)", category: "Neutrals" },
  { name: "Persian Indigo", value: "hsl(261, 78%, 38%)", category: "Purples" },
  { name: "Santa Grey", value: "hsl(260, 5%, 65%)", category: "Neutrals" },
  { name: "Athens Gray", value: "hsl(240, 3%, 94%)", category: "Neutrals" },
  { name: "Teal Blue", value: "hsl(203, 92%, 19%)", category: "Blues" },
  { name: "Fuego", value: "hsl(74, 73%, 51%)", category: "Yellows" },
  { name: "Deep Cerise", value: "hsl(334, 63%, 50%)", category: "Special" },
  { name: "Catskill White", value: "hsl(195, 33%, 95%)", category: "Neutrals" },
  { name: "Endeavour", value: "hsl(223, 54%, 34%)", category: "Blues" },
  { name: "Cotton Cloth", value: "hsl(51, 80%, 90%)", category: "Yellows" },
  { name: "Lynx White", value: "hsl(120, 14%, 97%)", category: "Neutrals" },
  { name: "Melon Melody", value: "hsl(26, 93%, 78%)", category: "Oranges" },
  { name: "Lacquer Mauve", value: "hsl(322, 50%, 87%)", category: "Special" },
  { name: "Inchworm", value: "hsl(84, 92%, 71%)", category: "Greens" },
  { name: "Plain And Simple", value: "hsl(78, 51%, 90%)", category: "Greens" },
  { name: "Seaside Villa", value: "hsl(23, 39%, 85%)", category: "Oranges" },
  { name: "Lime Splash", value: "hsl(68, 51%, 71%)", category: "Yellows" },
  { name: "Alabaster", value: "hsl(34, 42%, 93%)", category: "Neutrals" },
  { name: "Sweetly", value: "hsl(336, 71%, 95%)", category: "Neutrals" },
  { name: "Interdimensional Blue", value: "hsl(248, 74%, 47%)", category: "Purples" },
  { name: "Atomic Tangerine", value: "hsl(15, 100%, 72%)", category: "Oranges" },
  { name: "Sauvignon", value: "hsl(28, 42%, 94%)", category: "Neutrals" },
  { name: "Thistle", value: "hsl(304, 15%, 79%)", category: "Neutrals" },
  { name: "Lavender Grey", value: "hsl(230, 30%, 85%)", category: "Blues" },
  { name: "Tasma", value: "hsl(89, 14%, 72%)", category: "Neutrals" },
  { name: "Linen", value: "hsl(25, 75%, 97%)", category: "Neutrals" },
  { name: "Ultramarine", value: "hsl(241, 91%, 45%)", category: "Purples" },
  { name: "Clear Day", value: "hsl(174, 100%, 96%)", category: "Neutrals" },
  { name: "Blue Marguerite", value: "hsl(242, 42%, 51%)", category: "Purples" },
  { name: "Chartreuse Yellow", value: "hsl(68, 96%, 51%)", category: "Yellows" },
  { name: "Blue Martine", value: "hsl(178, 82%, 44%)", category: "Cyans" },
  { name: "White Ice", value: "hsl(150, 70%, 96%)", category: "Neutrals" },
  { name: "Jagged Ice", value: "hsl(168, 46%, 85%)", category: "Cyans" },
  { name: "Buddha Gold", value: "hsl(48, 77%, 42%)", category: "Yellows" },
  { name: "Electrik Violet", value: "hsl(261, 92%, 51%)", category: "Purples" },
  { name: "Yellow Rose", value: "hsl(56, 100%, 50%)", category: "Yellows" },
  { name: "Blue Chalk", value: "hsl(263, 36%, 96%)", category: "Neutrals" },
  { name: "Pale Green", value: "hsl(130, 91%, 78%)", category: "Greens" },
  { name: "Pampa", value: "hsl(45, 22%, 93%)", category: "Neutrals" },
  { name: "Canary", value: "hsl(60, 100%, 81%)", category: "Yellows" },
  { name: "Jacarta", value: "hsl(246, 43%, 31%)", category: "Purples" },
  { name: "Satin Linen", value: "hsl(49, 22%, 90%)", category: "Yellows" },
  { name: "Navy", value: "hsl(240, 98%, 24%)", category: "Purples" },
  { name: "Red Orange", value: "hsl(8, 100%, 59%)", category: "Reds" },
  { name: "Paua", value: "hsl(235, 41%, 25%)", category: "Blues" },
  { name: "Laser Lemon", value: "hsl(70, 100%, 72%)", category: "Yellows" },
  { name: "Neon Blue", value: "hsl(229, 100%, 59%)", category: "Blues" },
  { name: "Minsk", value: "hsl(240, 41%, 33%)", category: "Purples" },
  { name: "Hippie Pink", value: "hsl(350, 46%, 47%)", category: "Special" },
  { name: "Snuff", value: "hsl(282, 21%, 88%)", category: "Pinks" },
  { name: "Whisper", value: "hsl(257, 23%, 94%)", category: "Neutrals" },
  { name: "Eggplant", value: "hsl(313, 19%, 37%)", category: "Neutrals" },
  { name: "Mountbatten Pink", value: "hsl(306, 13%, 57%)", category: "Neutrals" },
  { name: "Bittersweet", value: "hsl(7, 99%, 70%)", category: "Reds" },
  { name: "Ziggurat", value: "hsl(191, 40%, 82%)", category: "Cyans" },
  { name: "Blue Chill", value: "hsl(197, 88%, 36%)", category: "Blues" },
  { name: "Finn", value: "hsl(334, 39%, 31%)", category: "Special" },
  { name: "Pharlap", value: "hsl(351, 17%, 56%)", category: "Neutrals" },
  { name: "Pale Slate", value: "hsl(333, 10%, 79%)", category: "Neutrals" },
  { name: "Boston Blue", value: "hsl(193, 44%, 46%)", category: "Cyans" },
  { name: "Azure Radiance", value: "hsl(208, 100%, 51%)", category: "Blues" },
  { name: "Black Pearl", value: "hsl(230, 69%, 10%)", category: "Blues" },
  { name: "Governor Bay", value: "hsl(240, 60%, 42%)", category: "Purples" },
  { name: "Hint Of Red", value: "hsl(0, 19%, 95%)", category: "Neutrals" },
  { name: "Geyser", value: "hsl(175, 21%, 88%)", category: "Cyans" },
  { name: "Bahama Blue", value: "hsl(197, 100%, 29%)", category: "Blues" },
  { name: "Blue Dianne", value: "hsl(187, 47%, 21%)", category: "Cyans" },
  { name: "Golden Sand", value: "hsl(52, 85%, 69%)", category: "Yellows" },
  { name: "New Orleans", value: "hsl(43, 77%, 76%)", category: "Oranges" },
  { name: "Magic Mint", value: "hsl(152, 73%, 84%)", category: "Cyans" },
  { name: "Merino", value: "hsl(28, 48%, 94%)", category: "Neutrals" },
  { name: "Deep Blush", value: "hsl(346, 72%, 67%)", category: "Special" },
  { name: "Cerulean", value: "hsl(182, 87%, 39%)", category: "Cyans" },
  { name: "Fuzzy Wuzzy Brown", value: "hsl(355, 50%, 54%)", category: "Special" },
  { name: "Blumine", value: "hsl(207, 61%, 30%)", category: "Blues" },
  { name: "Aquamarine", value: "hsl(167, 98%, 74%)", category: "Cyans" },
  { name: "Pippin", value: "hsl(0, 100%, 95%)", category: "Neutrals" },
  { name: "Mulberry", value: "hsl(334, 44%, 54%)", category: "Special" },
  { name: "Moody Blue", value: "hsl(234, 44%, 66%)", category: "Blues" },
  { name: "Froly", value: "hsl(354, 80%, 73%)", category: "Special" },
  { name: "Falcon", value: "hsl(331, 12%, 41%)", category: "Neutrals" },
  { name: "Moon Glow", value: "hsl(54, 95%, 91%)", category: "Neutrals" },
  { name: "Light Buckthorn", value: "hsl(40, 94%, 58%)", category: "Oranges" },
  { name: "Medium Red Violet", value: "hsl(301, 47%, 40%)", category: "Special" },
  { name: "Mariner", value: "hsl(207, 64%, 48%)", category: "Blues" },
  { name: "White Smoke", value: "hsl(0, 0%, 93%)", category: "Neutrals" },
  { name: "Lynch", value: "hsl(211, 12%, 48%)", category: "Neutrals" },
  { name: "Pumice", value: "hsl(132, 6%, 83%)", category: "Neutrals" },
  { name: "Silver Sand", value: "hsl(204, 8%, 76%)", category: "Neutrals" },
  { name: "Porcelain", value: "hsl(192, 15%, 94%)", category: "Neutrals" },
  { name: "Cascade", value: "hsl(184, 9%, 62%)", category: "Neutrals" },
  { name: "Iron", value: "hsl(197, 10%, 87%)", category: "Neutrals" },
  { name: "Edward", value: "hsl(180, 8%, 69%)", category: "Neutrals" },
  { name: "Cararra", value: "hsl(40, 10%, 94%)", category: "Neutrals" },
  { name: "Silver", value: "hsl(0, 0%, 75%)", category: "Neutrals" },
  { name: "Solitude", value: "hsl(207, 20%, 91%)", category: "Neutrals" },
  { name: "Pampas", value: "hsl(30, 14%, 95%)", category: "Neutrals" },
  { name: "Mystic", value: "hsl(213, 24%, 93%)", category: "Neutrals" },
  { name: "Mercury", value: "hsl(0, 0%, 91%)", category: "Neutrals" },
  { name: "Outer Space", value: "hsl(180, 3%, 19%)", category: "Neutrals" },
  { name: "Vivid", value: "hsl(16, 88%, 54%)", category: "Oranges" },
  { name: "Vivid Tangerine", value: "hsl(12, 100%, 74%)", category: "Reds" },
  { name: "Burnt Orange", value: "hsl(24, 100%, 41%)", category: "Oranges" },
  { name: "Ecstasy", value: "hsl(23, 95%, 52%)", category: "Oranges" },
  { name: "Jaffa", value: "hsl(22, 88%, 58%)", category: "Oranges" },
  { name: "Sandstorm", value: "hsl(42, 94%, 60%)", category: "Oranges" },
  { name: "Buttercup", value: "hsl(37, 90%, 51%)", category: "Oranges" },
  { name: "Carrot Orange", value: "hsl(28, 80%, 52%)", category: "Oranges" },
  { name: "Iris Blue", value: "hsl(187, 100%, 40%)", category: "Cyans" },
  { name: "Summer Sky", value: "hsl(200, 73%, 44%)", category: "Blues" },
  { name: "Hoki", value: "hsl(213, 23%, 51%)", category: "Blues" },
  { name: "Jordy Blue", value: "hsl(207, 83%, 75%)", category: "Blues" },
  { name: "Shark", value: "hsl(230, 8%, 15%)", category: "Neutrals" },
  { name: "Gin Fizz", value: "hsl(49, 100%, 94%)", category: "Neutrals" },
  { name: "Salomie", value: "hsl(50, 100%, 77%)", category: "Yellows" },
  { name: "Witch Haze", value: "hsl(55, 100%, 78%)", category: "Yellows" },
  { name: "Energy Yellow", value: "hsl(54, 89%, 64%)", category: "Yellows" },
  { name: "Goldenrod", value: "hsl(44, 96%, 71%)", category: "Oranges" },
  { name: "Yellow", value: "hsl(64, 100%, 50%)", category: "Yellows" },
  { name: "Candy Corn", value: "hsl(55, 99%, 69%)", category: "Yellows" },
  { name: "Cream", value: "hsl(60, 100%, 90%)", category: "Yellows" },
  { name: "Dolly", value: "hsl(60, 100%, 75%)", category: "Yellows" },
  { name: "Marigold Yellow", value: "hsl(61, 89%, 72%)", category: "Yellows" },
  { name: "Turbo", value: "hsl(56, 92%, 53%)", category: "Yellows" },
  { name: "Kournikova", value: "hsl(47, 94%, 66%)", category: "Yellows" },
  { name: "Cornflower Blue", value: "hsl(226, 92%, 63%)", category: "Blues" },
  { name: "Han Purple", value: "hsl(259, 96%, 46%)", category: "Purples" },
  { name: "Air Force Blue", value: "hsl(217, 47%, 52%)", category: "Blues" },
  { name: "Ripe Lemon", value: "hsl(48, 93%, 53%)", category: "Yellows" },
  { name: "Alice Blue", value: "hsl(210, 93%, 95%)", category: "Neutrals" },
  { name: "Orchid White", value: "hsl(60, 46%, 89%)", category: "Yellows" },
  { name: "Caribbean Green", value: "hsl(170, 97%, 40%)", category: "Cyans" },
  { name: "Silver Tree", value: "hsl(159, 43%, 59%)", category: "Cyans" },
  { name: "Downy", value: "hsl(173, 46%, 59%)", category: "Cyans" },
  { name: "Light Sea Green", value: "hsl(177, 72%, 37%)", category: "Cyans" },
  { name: "Medium Aquamarine", value: "hsl(150, 50%, 60%)", category: "Cyans" },
  { name: "Turquoise", value: "hsl(168, 67%, 53%)", category: "Cyans" },
  { name: "Madang", value: "hsl(116, 76%, 87%)", category: "Greens" },
  { name: "Riptide", value: "hsl(172, 61%, 71%)", category: "Cyans" },
  { name: "Shamrock", value: "hsl(145, 63%, 49%)", category: "Greens" },
  { name: "Mountain Meadow", value: "hsl(168, 76%, 36%)", category: "Cyans" },
  { name: "Emerald", value: "hsl(150, 52%, 51%)", category: "Cyans" },
  { name: "Gossip", value: "hsl(112, 50%, 66%)", category: "Greens" },
  { name: "Dark Sea Green", value: "hsl(126, 32%, 67%)", category: "Greens" },
  { name: "Jungles Green", value: "hsl(155, 67%, 45%)", category: "Cyans" },
  { name: "Malachite", value: "hsl(137, 100%, 45%)", category: "Greens" },
  { name: "Eucalyptus", value: "hsl(145, 63%, 40%)", category: "Greens" },
  { name: "Green Haze", value: "hsl(166, 99%, 30%)", category: "Cyans" },
  { name: "Free Speech Aquamarine", value: "hsl(163, 96%, 33%)", category: "Cyans" },
  { name: "Jade", value: "hsl(156, 100%, 35%)", category: "Cyans" },
  { name: "Salem", value: "hsl(148, 63%, 31%)", category: "Greens" },
  { name: "Observatory", value: "hsl(166, 95%, 30%)", category: "Cyans" },
  { name: "Summer Green", value: "hsl(129, 19%, 64%)", category: "Neutrals" },
  { name: "Puerto Rico", value: "hsl(176, 56%, 55%)", category: "Cyans" },
  { name: "Aqua Island", value: "hsl(166, 48%, 75%)", category: "Cyans" },
  { name: "Ocean Green", value: "hsl(149, 39%, 49%)", category: "Greens" },
  { name: "Light Green", value: "hsl(148, 78%, 71%)", category: "Greens" },
  { name: "Java", value: "hsl(167, 71%, 47%)", category: "Cyans" },
  { name: "Bright Turquoise", value: "hsl(166, 88%, 55%)", category: "Cyans" },
  { name: "Niagara", value: "hsl(167, 63%, 45%)", category: "Cyans" },
  { name: "Ebony Clay", value: "hsl(209, 30%, 19%)", category: "Blues" },
  { name: "Havelock Blue", value: "hsl(214, 65%, 55%)", category: "Blues" },
  { name: "Blue Jeans", value: "hsl(204, 71%, 62%)", category: "Blues" },
  { name: "Spray", value: "hsl(191, 61%, 69%)", category: "Cyans" },
  { name: "Shakespeare", value: "hsl(197, 64%, 59%)", category: "Blues" },
  { name: "Humming Bird", value: "hsl(190, 76%, 87%)", category: "Cyans" },
  { name: "Dodger Blue", value: "hsl(201, 87%, 54%)", category: "Blues" },
  { name: "Curious Blue", value: "hsl(204, 70%, 53%)", category: "Blues" },
  { name: "Madison", value: "hsl(210, 29%, 24%)", category: "Blues" },
  { name: "Deep Sky Blue", value: "hsl(199, 99%, 55%)", category: "Blues" },
  { name: "Chambray", value: "hsl(225, 46%, 42%)", category: "Blues" },
  { name: "Ming", value: "hsl(191, 41%, 34%)", category: "Cyans" },
  { name: "Jelly Bean", value: "hsl(204, 64%, 40%)", category: "Blues" },
  { name: "Sherpa Blue", value: "hsl(195, 97%, 13%)", category: "Blues" },
  { name: "San Marino", value: "hsl(218, 45%, 48%)", category: "Blues" },
  { name: "Malibu", value: "hsl(205, 82%, 68%)", category: "Blues" },
  { name: "Pickled Bluewood", value: "hsl(210, 29%, 29%)", category: "Blues" },
  { name: "Jacksons Purple", value: "hsl(226, 65%, 35%)", category: "Blues" },
  { name: "Fountain Blue", value: "hsl(204, 44%, 55%)", category: "Blues" },
  { name: "Wistful", value: "hsl(248, 33%, 74%)", category: "Purples" },
  { name: "Light Slate Blue", value: "hsl(265, 98%, 67%)", category: "Purples" },
  { name: "Scampi", value: "hsl(256, 20%, 50%)", category: "Purples" },
  { name: "Electric Purple", value: "hsl(273, 98%, 60%)", category: "Pinks" },
  { name: "Magnolia", value: "hsl(266, 92%, 95%)", category: "Neutrals" },
  { name: "Mauve", value: "hsl(265, 100%, 86%)", category: "Purples" },
  { name: "Electric Indigo", value: "hsl(271, 97%, 53%)", category: "Pinks" },
  { name: "Rebeccapurple", value: "hsl(270, 50%, 40%)", category: "Pinks" },
  { name: "Ce Soir", value: "hsl(296, 28%, 55%)", category: "Pinks" },
  { name: "Persian Blue", value: "hsl(258, 83%, 45%)", category: "Purples" },
  { name: "Lavender Purple", value: "hsl(268, 25%, 59%)", category: "Purples" },
  { name: "Honey Flower", value: "hsl(287, 27%, 35%)", category: "Pinks" },
  { name: "Medium Purple", value: "hsl(282, 80%, 63%)", category: "Pinks" },
  { name: "Grape Glimmer", value: "hsl(291, 30%, 83%)", category: "Pinks" },
  { name: "Studio", value: "hsl(282, 44%, 47%)", category: "Pinks" },
  { name: "Wisteria", value: "hsl(283, 39%, 53%)", category: "Pinks" },
  { name: "Light Wisteria", value: "hsl(281, 44%, 70%)", category: "Pinks" },
  { name: "Plum", value: "hsl(306, 41%, 40%)", category: "Special" },
  { name: "Seance", value: "hsl(291, 82%, 39%)", category: "Pinks" },
  { name: "Soft Red", value: "hsl(9, 81%, 61%)", category: "Reds" },
  { name: "Chestnut Rose", value: "hsl(355, 60%, 56%)", category: "Special" },
  { name: "Scarlet", value: "hsl(5, 90%, 51%)", category: "Reds" },
  { name: "Thunderbird", value: "hsl(2, 80%, 47%)", category: "Reds" },
  { name: "Old Brick", value: "hsl(6, 69%, 35%)", category: "Reds" },
  { name: "Valencia", value: "hsl(2, 65%, 55%)", category: "Reds" },
  { name: "Tall Poppy", value: "hsl(6, 63%, 46%)", category: "Reds" },
  { name: "Monza", value: "hsl(356, 100%, 41%)", category: "Special" },
  { name: "Carmine Pink", value: "hsl(6, 78%, 57%)", category: "Reds" },
  { name: "Razzmatazz", value: "hsl(337, 91%, 45%)", category: "Special" },
  { name: "Sunset Orange", value: "hsl(0, 91%, 62%)", category: "Reds" },
  { name: "Wax Flower", value: "hsl(7, 74%, 79%)", category: "Reds" },
  { name: "Cabaret", value: "hsl(339, 59%, 57%)", category: "Special" },
  { name: "New York Pink", value: "hsl(359, 60%, 69%)", category: "Special" },
  { name: "Radical Red", value: "hsl(345, 92%, 55%)", category: "Special" },
  { name: "Pomegranatte", value: "hsl(0, 86%, 57%)", category: "Reds" },
  { name: "Fire Bush", value: "hsl(32, 82%, 56%)", category: "Oranges" },
  { name: "Crusta", value: "hsl(16, 87%, 62%)", category: "Oranges" },
  { name: "Saffron Mango", value: "hsl(38, 94%, 66%)", category: "Oranges" },
  { name: "Cape Honey", value: "hsl(42, 96%, 82%)", category: "Oranges" },
  { name: "Confetti", value: "hsl(51, 76%, 65%)", category: "Yellows" },
];

const COLOR_CATEGORIES = ["All", "Neutrals", "Blues", "Cyans", "Purples", "Pinks", "Reds", "Oranges", "Yellows", "Greens", "Special"];

export function AdvancedColorPicker({ 
  currentColor, 
  onColorChange,
  onGlowingBackgroundChange,
  glowingBackgroundEnabled = true
}: AdvancedColorPickerProps) {
  const [hsl, setHsl] = useState<[number, number, number]>(() => parseHsl(currentColor));
  const [hex, setHex] = useState("");
  const [activeTab, setActiveTab] = useState("wheel");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const colorAreaRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rafRef = useRef<number | null>(null);
  const [localHsl, setLocalHsl] = useState<[number, number, number]>(() => parseHsl(currentColor));

  // Update HSL when currentColor changes externally
  useEffect(() => {
    const newHsl = parseHsl(currentColor);
    setHsl(newHsl);
    setLocalHsl(newHsl);
    const [r, g, b] = hslToRgb(newHsl[0], newHsl[1], newHsl[2]);
    setHex(`#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`);
  }, [currentColor]);

  // Optimized color update with debouncing for sliders
  const updateColor = useCallback((newHsl: [number, number, number], immediate = false) => {
    setLocalHsl(newHsl);
    setHsl(newHsl);
    
    // Update hex immediately for visual feedback
    const [r, g, b] = hslToRgb(newHsl[0], newHsl[1], newHsl[2]);
    setHex(`#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`);
    
    // Debounce the actual color change for sliders to reduce lag
    if (immediate) {
      const color = hslToString(newHsl[0], newHsl[1], newHsl[2]);
      onColorChange(color);
    } else {
      // Clear existing timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      // Use requestAnimationFrame for smoother updates
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      
      rafRef.current = requestAnimationFrame(() => {
        const color = hslToString(newHsl[0], newHsl[1], newHsl[2]);
        onColorChange(color);
      });
    }
  }, [onColorChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handleColorAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!colorAreaRef.current) return;
    const rect = colorAreaRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = Math.min(100, Math.max(0, (x / rect.width) * 100));
    const l = Math.min(100, Math.max(0, 100 - (y / rect.height) * 100));
    updateColor([localHsl[0], s, l], true);
  };

  const handleColorAreaDrag = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !colorAreaRef.current) return;
    const rect = colorAreaRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = Math.min(100, Math.max(0, (x / rect.width) * 100));
    const l = Math.min(100, Math.max(0, 100 - (y / rect.height) * 100));
    updateColor([localHsl[0], s, l], false);
  }, [localHsl, updateColor]);

  useEffect(() => {
    if (isDraggingRef.current) {
      document.addEventListener('mousemove', handleColorAreaDrag);
      document.addEventListener('mouseup', () => {
        isDraggingRef.current = false;
      });
      return () => {
        document.removeEventListener('mousemove', handleColorAreaDrag);
      };
    }
  }, [handleColorAreaDrag]);

  const handleHexChange = (value: string) => {
    setHex(value);
    if (value.match(/^#[0-9A-Fa-f]{6}$/)) {
      const r = parseInt(value.slice(1, 3), 16);
      const g = parseInt(value.slice(3, 5), 16);
      const b = parseInt(value.slice(5, 7), 16);
      const newHsl = rgbToHsl(r, g, b);
      updateColor(newHsl, true);
    }
  };

  const filteredColors = selectedCategory === "All" 
    ? EXPANDED_COLORS 
    : EXPANDED_COLORS.filter(c => c.category === selectedCategory);

  const isBlackOrWhite = currentColor === "hsl(0, 0%, 0%)" || currentColor === "hsl(0, 0%, 100%)";

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="wheel" className="flex items-center gap-2">
            <Droplet className="h-4 w-4" />
            Color Wheel
          </TabsTrigger>
          <TabsTrigger value="presets" className="flex items-center gap-2">
            <Grid3x3 className="h-4 w-4" />
            Presets
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Advanced
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wheel" className="space-y-4 mt-4">
          {/* Color Area (Hue-Saturation) */}
          <div className="space-y-2">
            <Label>Hue & Saturation</Label>
            <div
              ref={colorAreaRef}
              className="relative w-full h-48 rounded-lg overflow-hidden cursor-crosshair border border-border"
              style={{
                background: `linear-gradient(to right, 
                  hsl(${localHsl[0]}, 0%, ${localHsl[2]}%), 
                  hsl(${localHsl[0]}, 100%, ${localHsl[2]}%))`
              }}
              onClick={handleColorAreaClick}
              onMouseDown={(e) => {
                isDraggingRef.current = true;
                handleColorAreaClick(e);
              }}
            >
              <div
                className="absolute w-4 h-4 rounded-full border-2 border-white shadow-lg pointer-events-none transition-all duration-75"
                style={{
                  left: `${localHsl[1]}%`,
                  top: `${100 - localHsl[2]}%`,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: hslToString(localHsl[0], localHsl[1], localHsl[2])
                }}
              />
            </div>
          </div>

          {/* Lightness Slider */}
          <div className="space-y-2">
            <Label>Lightness</Label>
            <div className="relative">
              <Slider
                value={[localHsl[2]]}
                onValueChange={([value]) => {
                  const newHsl: [number, number, number] = [localHsl[0], localHsl[1], value];
                  updateColor(newHsl, false);
                }}
                min={0}
                max={100}
                step={0.5}
                className="w-full"
              />
              <div 
                className="absolute inset-0 rounded-full pointer-events-none opacity-30"
                style={{
                  background: `linear-gradient(to right, 
                    hsl(${localHsl[0]}, ${localHsl[1]}%, 0%), 
                    hsl(${localHsl[0]}, ${localHsl[1]}%, 50%), 
                    hsl(${localHsl[0]}, ${localHsl[1]}%, 100%))`
                }}
              />
            </div>
            <div className="text-xs text-muted-foreground text-right">
              {Math.round(localHsl[2])}%
            </div>
          </div>

          {/* Hue Slider */}
          <div className="space-y-2">
            <Label>Hue</Label>
            <div className="relative">
              <Slider
                value={[localHsl[0]]}
                onValueChange={([value]) => {
                  const newHsl: [number, number, number] = [value, localHsl[1], localHsl[2]];
                  updateColor(newHsl, false);
                }}
                min={0}
                max={360}
                step={0.5}
                className="w-full"
              />
              <div 
                className="absolute inset-0 rounded-full pointer-events-none opacity-30"
                style={{
                  background: `linear-gradient(to right, 
                    hsl(0, 100%, 50%), 
                    hsl(60, 100%, 50%), 
                    hsl(120, 100%, 50%), 
                    hsl(180, 100%, 50%), 
                    hsl(240, 100%, 50%), 
                    hsl(300, 100%, 50%), 
                    hsl(360, 100%, 50%))`
                }}
              />
            </div>
            <div className="text-xs text-muted-foreground text-right">
              {Math.round(localHsl[0])}°
            </div>
          </div>
        </TabsContent>

        <TabsContent value="presets" className="space-y-4 mt-4">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {COLOR_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-3 py-1 text-xs rounded-full border transition-colors",
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted hover:bg-muted/80 border-border"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Color Grid */}
          <div className="grid grid-cols-8 gap-2 max-h-64 overflow-y-auto">
            {filteredColors.map((color, index) => (
              <button
                key={`${color.name}-${color.value}-${index}`}
                onClick={() => {
                  updateColor(parseHsl(color.value), true);
                  setActiveTab("wheel");
                }}
                className={cn(
                  "relative h-8 w-8 rounded-md border-2 transition-all hover:scale-110",
                  currentColor === color.value
                    ? "border-foreground ring-2 ring-offset-1 ring-primary scale-110"
                    : "border-border hover:border-foreground/50"
                )}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4 mt-4">
          {/* HSL Inputs */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hue">Hue</Label>
              <Input
                id="hue"
                type="number"
                min="0"
                max="360"
                value={Math.round(localHsl[0])}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  const newHsl: [number, number, number] = [Math.max(0, Math.min(360, value)), localHsl[1], localHsl[2]];
                  updateColor(newHsl, true);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="saturation">Saturation</Label>
              <Input
                id="saturation"
                type="number"
                min="0"
                max="100"
                value={Math.round(localHsl[1])}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  const newHsl: [number, number, number] = [localHsl[0], Math.max(0, Math.min(100, value)), localHsl[2]];
                  updateColor(newHsl, true);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lightness">Lightness</Label>
              <Input
                id="lightness"
                type="number"
                min="0"
                max="100"
                value={Math.round(localHsl[2])}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  const newHsl: [number, number, number] = [localHsl[0], localHsl[1], Math.max(0, Math.min(100, value))];
                  updateColor(newHsl, true);
                }}
              />
            </div>
          </div>

          {/* Hex Input */}
          <div className="space-y-2">
            <Label htmlFor="hex">Hex Color</Label>
            <div className="flex gap-2">
              <Input
                id="hex"
                type="text"
                value={hex}
                onChange={(e) => handleHexChange(e.target.value)}
                placeholder="#000000"
                className="font-mono"
              />
              <div
                className="w-12 h-10 rounded border border-border"
                style={{ backgroundColor: hslToString(localHsl[0], localHsl[1], localHsl[2]) }}
              />
            </div>
          </div>

          {/* Current Color Display */}
          <div className="p-4 rounded-lg border border-border bg-muted/50">
            <div className="flex items-center gap-3">
              <div
                className="w-16 h-16 rounded-lg border-2 border-border shadow-sm"
                style={{ backgroundColor: hslToString(localHsl[0], localHsl[1], localHsl[2]) }}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Current Color</p>
                <p className="text-xs text-muted-foreground font-mono">{hslToString(localHsl[0], localHsl[1], localHsl[2])}</p>
                <p className="text-xs text-muted-foreground font-mono">{hex}</p>
                {isBlackOrWhite && (
                  <p className="text-xs text-primary mt-1">
                    ✨ Multi-color stars enabled for this selection
                  </p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Glowing Background Toggle */}
      {onGlowingBackgroundChange && (
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Glowing Background</p>
              <p className="text-xs text-muted-foreground">Animated stars and effects</p>
            </div>
          </div>
          <Switch
            checked={glowingBackgroundEnabled}
            onCheckedChange={onGlowingBackgroundChange}
          />
        </div>
      )}
    </div>
  );
}

