// Clases compartidas de "Cómo te fue". Colores de tailwind.config.ts y
// variables --zafi-* para el modo oscuro.

import { CARD_BG } from '@/components/movimientos/ui';

/** Tarjeta blanca con borde suave (radio 16). */
export const CARD = `rounded-2xl border border-navy/[0.08] dark:border-white/[0.06] ${CARD_BG}`;
/** Tarjeta grande (radio 20). */
export const CARD_LG = `rounded-[20px] border border-navy/[0.08] dark:border-white/[0.06] ${CARD_BG}`;
/** Verde de texto (#16A34A; claro en oscuro). */
export const GREEN_TEXT = 'text-success-dark dark:text-[var(--zafi-success-text)]';
/** Ámbar de texto (#92400E; #F59E0B en oscuro). */
export const AMBER_TEXT = 'text-warning-text dark:text-warning';
/** Título de sección: 17px bold. */
export const SECTION_TITLE = 'text-[17px] font-bold text-ink-900 dark:text-ink-100';
/** Etiqueta de grupo en mayúsculas. */
export const GROUP_LABEL = 'text-[13px] font-bold uppercase tracking-[0.04em]';
/** Navy de gráficas (más claro en oscuro para que se distinga del fondo). */
export const NAVY_BG = 'bg-navy dark:bg-navy-light';
