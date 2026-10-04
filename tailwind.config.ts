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
          tint:    "#F8F9FC",
          bg:      "#F3F5F9",
        },
        // ── SEMÁNTICOS ───────────────────────────────────
        success: {
          DEFAULT: "#22C55E",
          dark:    "#16A34A",
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
        // ── Fase 9: movimiento ───────────────────
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "none" },
        },
        "fade-quick": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        pop: {
          "0%": { transform: "scale(0.4)", opacity: "0" },
          "60%": { transform: "scale(1.12)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        draw: {
          to: { strokeDashoffset: "0" },
        },
        ring: {
          "0%": { transform: "scale(0.8)", opacity: "0.6" },
          "100%": { transform: "scale(1.9)", opacity: "0" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        "bounce-tab": {
          "0%": { transform: "scale(1)" },
          "35%": { transform: "scale(0.82)" },
          "70%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)" },
        },
        // Fila nueva: entra deslizando hacia abajo y su fondo pasa de #DBEAFE al de la tarjeta.
        "row-in": {
          from: { opacity: "0", transform: "translateY(-16px) scale(0.98)" },
          to: { opacity: "1", transform: "none" },
        },
        "row-flash": {
          "0%, 40%": { backgroundColor: "#DBEAFE" },
          "100%": { backgroundColor: "var(--zafi-card)" },
        },
        confetti: {
          "0%": { transform: "translate(0,0) rotate(0)", opacity: "1" },
          "85%": { opacity: "1" },
          "100%": { transform: "translate(var(--dx), 640px) rotate(var(--r))", opacity: "0" },
        },
        breath: {
          "0%, 100%": { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(96,165,250,0.35)" },
          "50%": { transform: "scale(1.05)", boxShadow: "0 0 0 18px rgba(96,165,250,0)" },
        },
        dot: {
          "0%, 80%, 100%": { opacity: "0.25", transform: "scale(0.8)" },
          "40%": { opacity: "1", transform: "scale(1)" },
        },
        bell: {
          "0%, 100%": { transform: "rotate(0)" },
          "20%": { transform: "rotate(14deg)" },
          "40%": { transform: "rotate(-12deg)" },
          "60%": { transform: "rotate(8deg)" },
          "80%": { transform: "rotate(-4deg)" },
        },
      },
      animation: {
        "score-fill": "score-fill 1.5s ease-out forwards",
        "fade-in": "fade-in 0.5s ease-out forwards",
        "count-up": "count-up 0.3s ease-out forwards",
        "fade-up": "fade-up .45s cubic-bezier(.2,.8,.2,1) both",
        "fade-quick": "fade-quick .15s ease-out both",
        pop: "pop .5s cubic-bezier(.3,1.4,.5,1) both",
        draw: "draw .35s ease-out forwards",
        ring: "ring .9s ease-out both",
        shimmer: "shimmer 1.3s linear infinite",
        "bounce-tab": "bounce-tab .45s cubic-bezier(.3,1.5,.5,1)",
        "row-in": "row-in .64s cubic-bezier(.2,.8,.2,1) .2s both",
        "row-flash": "row-flash 1.6s ease-out",
        confetti: "confetti 2s cubic-bezier(.2,.6,.4,1) both",
        breath: "breath 1.6s ease-in-out .5s infinite",
        dot: "dot 1s ease-in-out infinite",
        bell: "bell 1s ease-in-out .4s both",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(.3,1.5,.5,1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};
export default config;
