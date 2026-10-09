// Colores y tipografías de Zafi (tomados de tailwind.config.ts de la app).
import { bodyFamily, fontFamily as outfit } from "./fonts";

export const colors = {
  navyDeep: "#0D1F36",
  navyDarker: "#152B48",
  navy: "#1E3A5F",
  navyMid: "#264878",
  electricDark: "#1D4ED8",
  electric: "#2563EB",
  electricLight: "#3B82F6",
  electricPale: "#60A5FA",
  electricSoft: "#93C5FD",
  electricGhost: "#DBEAFE",
  white: "#FFFFFF",
  surfaceTint: "#F8F9FC",
  success: "#22C55E",
  successLight: "#D1FAE5",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  danger: "#EF4444",
  dangerLight: "#FEE2E2",
  ink900: "#0F172A",
  ink700: "#334155",
  ink500: "#64748B",
  ink400: "#94A3B8",
} as const;

export const fonts = {
  /** Titulares y logotipo */
  display: outfit,
  /** Texto de apoyo */
  body: bodyFamily,
} as const;

export const BRAND = {
  name: "Zafi",
  url: "zafiapp.com",
  tagline: "tu planeador financiero",
  currency: "Q",
} as const;
