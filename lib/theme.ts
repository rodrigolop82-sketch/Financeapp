export interface ThemeColors {
  navy: string
  electric: string
  bg: string
  card: string
  text: string
  textSecondary: string
  textMuted: string
  border: string
  hero: string
  heroTextSecondary: string
}

const LIGHT: ThemeColors = {
  navy: '#1E3A5F',
  electric: '#2563EB',
  bg: '#F3F5F9',
  card: '#FFFFFF',
  text: '#1E3A5F',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  hero: '#1E3A5F',
  heroTextSecondary: '#9FB3CB',
}

const DARK: ThemeColors = {
  navy: '#E2E8F0',
  electric: '#3B82F6',
  bg: '#0B1120',
  card: '#141D2E',
  text: '#E2E8F0',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  border: '#1E293B',
  hero: '#141D2E',
  heroTextSecondary: '#64748B',
}

export function getThemeColors(resolvedTheme: string | undefined): ThemeColors {
  return resolvedTheme === 'dark' ? DARK : LIGHT
}
