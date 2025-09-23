/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      container: { 
        center: true, 
        padding: "1rem", 
        screens: { "2xl": "1280px" } 
      },
      fontFamily: { 
        sans: ["var(--font-inter)", "system-ui", "ui-sans-serif", "Arial"] 
      },
      colors: {
        // Semantic tokens (shadcn compatible)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { 
          DEFAULT: "hsl(var(--primary))", 
          foreground: "hsl(var(--primary-foreground))" 
        },
        secondary: { 
          DEFAULT: "hsl(var(--secondary))", 
          foreground: "hsl(var(--secondary-foreground))" 
        },
        muted: { 
          DEFAULT: "hsl(var(--muted))", 
          foreground: "hsl(var(--muted-foreground))" 
        },
        accent: { 
          DEFAULT: "hsl(var(--accent))", 
          foreground: "hsl(var(--accent-foreground))" 
        },
        card: { 
          DEFAULT: "hsl(var(--card))", 
          foreground: "hsl(var(--card-foreground))" 
        },
        // Surface scale used by templates (fixes bg-surface-100 errors)
        surface: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1f2937",
          900: "#0f172a",
          950: "#020617"
        }
      },
      boxShadow: {
        soft: "0 4px 20px rgba(2, 6, 23, 0.06)",
        card: "0 10px 25px rgba(2, 6, 23, 0.08)",
        glass: "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 30px rgba(2,6,23,0.35)",
      },
      backdropBlur: { 
        xs: "2px" 
      },
      animation: { 
        "pulse-slow": "pulse 3s ease-in-out infinite" 
      },
    },
  },
  plugins: [require("@tailwindcss/typography"), require("tailwindcss-animate")],
};