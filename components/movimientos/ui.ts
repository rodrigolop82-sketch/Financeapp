// Clases compartidas de Movimientos. Los colores salen de los tokens de
// tailwind.config.ts y de las variables --zafi-* para respetar el modo oscuro.

/** #0F172A en claro. */
export const TEXT_STRONG = 'text-ink-900 dark:text-ink-100';
/** #334155 en claro. */
export const TEXT_BODY = 'text-ink-700 dark:text-ink-200';
/** #64748B en claro. */
export const TEXT_MUTED = 'text-[var(--zafi-text-secondary)]';
/** #94A3B8 en claro. */
export const TEXT_FAINT = 'text-[var(--zafi-text-muted)]';
/** Borde #E2E8F0. */
export const BORDER = 'border-ink-100 dark:border-white/10';
/** Divisor de lista #EEF1F6. */
export const DIVIDER = 'border-[var(--zafi-border-light)]';
/** Fondo de tarjeta (blanco en claro). */
export const CARD_BG = 'bg-[var(--zafi-card)]';
/** Fondo #F3F5F9 (tiles de emoji). */
export const TILE_BG = 'bg-[var(--zafi-bg)]';
/** Fondo #F8F9FC (cajas suaves). */
export const SOFT_BG = 'bg-[var(--zafi-card-alt)]';
/** Título de hoja: DM Serif Display 24px. */
export const SHEET_TITLE = `font-serif text-[24px] leading-tight outline-none ${TEXT_STRONG}`;
/** Botón primario de hoja (54px, radio 14). */
export const PRIMARY_BUTTON =
  'h-[54px] w-full rounded-[14px] bg-electric text-white font-semibold text-base transition-colors hover:bg-electric-dark disabled:opacity-60';
