import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── MARCA PRINCIPAL ──────────────────────────────
        navy: {
          deep:    "#0D1F36",
          darker:  "#152B48",
          DEFAULT: "#1E3A5F",
          mid:     "#264878",
          light:   "#315899",
        },
        electric: {
          dark:    "#1D4ED8",
          DEFAULT: "#2563EB",
          light:   "#3B82F6",
          pale:    "#60A5FA",
          soft:    "#93C5FD",
          ghost:   "#DBEAFE",
        },
        // ── SUPERFICIE ───────────────────────────────────
        surface: {
          DEFAULT: "#FFFFFF",
          tint:    "#F8FAFF",
          bg:      "#EEF2FB",
        },
        // ── SEMÁNTICOS ───────────────────────────────────
        success: {
          DEFAULT: "#10B981",
          light:   "#D1FAE5",
          text:    "#065F46",
        },
        warning: {
          DEFAULT: "#F59E0B",
          light:   "#FEF3C7",
          text:    "#92400E",
        },
        danger: {
          DEFAULT: "#EF4444",
          light:   "#FEE2E2",
          text:    "#991B1B",
        },
        // ── NEUTRALES ────────────────────────────────────
        ink: {
          900: "#0F172A",
          700: "#334155",
          500: "#64748B",
          400: "#94A3B8",
          200: "#CBD5E1",
          100: "#E2E8F0",
          50:  "#F8FAFF",
        },
        // ── SHADCN COMPAT ────────────────────────────────
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        outfit: ["Outfit", "sans-serif"],
        serif:  ["DM Serif Display", "Georgia", "serif"],
        sans:   ["DM Sans", "system-ui", "sans-serif"],
      },
      fontSize: {
        "hero":    ["52px", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
        "display": ["38px", { lineHeight: "1.1",  letterSpacing: "-0.02em" }],
        "title":   ["28px", { lineHeight: "1.2",  letterSpacing: "-0.01em" }],
        "heading": ["22px", { lineHeight: "1.3",  letterSpacing: "-0.01em" }],
        "subhead": ["18px", { lineHeight: "1.4" }],
        "body-lg": ["16px", { lineHeight: "1.6" }],
        "body":    ["15px", { lineHeight: "1.65" }],
        "body-sm": ["14px", { lineHeight: "1.6" }],
        "caption": ["12px", { lineHeight: "1.5",  letterSpacing: "0.01em" }],
        "label":   ["11px", { lineHeight: "1.4",  letterSpacing: "0.15em" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "score-fill": {
          "0%": { width: "0%" },
          "100%": { width: "var(--score-width)" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "count-up": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "score-fill": "score-fill 1.5s ease-out forwards",
        "fade-in": "fade-in 0.5s ease-out forwards",
        "count-up": "count-up 0.3s ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};
export default config;
