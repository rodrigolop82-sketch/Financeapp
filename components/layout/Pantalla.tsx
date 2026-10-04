// Piezas comunes de las pantallas estándar (Fase 14): encabezado móvil,
// etiqueta de grupo, tarjeta de lista, fila con tile y pills. Colores de
// tailwind.config.ts y variables --zafi-* para el modo oscuro.

import Link from 'next/link';
import { DIVIDER, SHEET_TITLE, TEXT_FAINT, TEXT_MUTED, TEXT_STRONG, TILE_BG } from '@/components/movimientos/ui';
import { CARD, GROUP_LABEL } from '@/components/resumen/ctf-ui';

/** Texto de enlace/acción azul (#1D4ED8; #93C5FD en oscuro). */
export const LINK_TEXT = 'text-electric-dark dark:text-electric-soft';
/** Pill de acción secundaria de 36px: azul suave. */
export const PILL_ACTION =
  'flex h-9 flex-none items-center justify-center rounded-full bg-electric-ghost px-3.5 text-[13.5px] font-bold text-electric-dark transition duration-150 active:scale-[0.96] group-active:scale-[0.96] dark:bg-[#1B2B4D] dark:text-electric-soft';
/** Pill de 36px con área táctil de 44px. */
export function PillButton({ children, className = PILL_ACTION, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} className="group flex h-11 flex-none items-center disabled:cursor-default">
      <span className={`${className} group-disabled:opacity-60`}>{children}</span>
    </button>
  );
}

/** Pill con borde de 36px (Restaurar). */
export const PILL_OUTLINE =
  `flex h-9 flex-none items-center justify-center rounded-full border border-[var(--zafi-border)] bg-[var(--zafi-card)] px-3.5 text-[13.5px] font-semibold ${TEXT_STRONG} transition duration-150 group-active:scale-[0.96]`;
/** Pill de estado (etiqueta pequeña). */
export const BADGE = 'flex-none rounded-full px-2 py-0.5 text-[11.5px] font-bold';
export const BADGE_OK = `${BADGE} bg-success-light text-[#15803D] dark:bg-[var(--zafi-success-bg)] dark:text-[var(--zafi-success-text)]`;
export const BADGE_WARN = `${BADGE} bg-warning-light text-warning-text dark:bg-warning/15 dark:text-warning`;
export const BADGE_INFO = `${BADGE} bg-electric-ghost text-electric-dark dark:bg-[#1B2B4D] dark:text-electric-soft`;
export const BADGE_NEUTRAL = `${BADGE} ${TILE_BG} ${TEXT_MUTED}`;
/** Hero navy sólido (radio 20, sin degradado). */
export const HERO = 'rounded-[20px] text-white';
export const HERO_STYLE = { background: 'var(--zafi-hero)' } as const;
/** Texto secundario sobre el hero. */
export const HERO_MUTED = 'text-[#CBD8E8]';

/** Encabezado móvil: "‹ {padre}", título DM Serif 30 y subtítulo opcional. */
export function PageHeader({ back, title, subtitle, right }: {
  back: { href: string; label: string };
  title: string;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="-mx-4 flex flex-col items-start gap-0.5 px-5 pt-[env(safe-area-inset-top)] lg:hidden">
      <Link href={back.href} className={`flex h-11 items-center text-[15px] font-semibold ${LINK_TEXT}`}>‹ {back.label}</Link>
      <div className="flex w-full items-center justify-between gap-2">
        <h1 className={`font-serif text-[30px] leading-[1.15] ${TEXT_STRONG}`}>{title}</h1>
        {right}
      </div>
      {subtitle && <p className={`text-sm leading-[1.4] [text-wrap:pretty] ${TEXT_MUTED}`}>{subtitle}</p>}
    </div>
  );
}

/** Etiqueta de grupo en mayúsculas sobre una lista. */
export function GroupTitle({ children, className = 'mb-1.5 mt-[22px]' }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`px-1 ${GROUP_LABEL} ${TEXT_MUTED} ${className}`}>{children}</h2>;
}

/** Tarjeta que agrupa filas. */
export function ListCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-3.5 ${CARD} ${className}`}>{children}</div>;
}

/** Tile de 40×40 con emoji. */
export function Tile({ children, className = TILE_BG }: { children: React.ReactNode; className?: string }) {
  return (
    <span aria-hidden className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl text-xl ${className}`}>
      {children}
    </span>
  );
}

/** Divisor entre filas (la última no lleva). */
export const ROW_DIVIDER = `border-b ${DIVIDER} last:border-b-0`;

/** Contenido de fila: tile, nombre 15/600 y ayuda 13px. */
export function RowBody({ tile, name, help, badge }: {
  tile: React.ReactNode;
  name: React.ReactNode;
  help?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <>
      {tile}
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={`truncate text-[15px] font-semibold ${TEXT_STRONG}`}>{name}</span>
          {badge}
        </span>
        {help && <span className={`text-[13px] leading-[1.35] ${TEXT_MUTED}`}>{help}</span>}
      </span>
    </>
  );
}

/** "›" al final de una fila tocable. */
export function Chevron() {
  return <span aria-hidden className={`flex-none font-bold ${TEXT_FAINT}`}>›</span>;
}

/** Selector segmentado (igual al de Apariencia en Mi cuenta). */
export function Segmented<T extends string>({ label, options, value, onChange }: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid rounded-xl bg-[var(--zafi-tab-bg)] p-[3px]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`flex h-[38px] items-center justify-center rounded-[9px] text-[13.5px] font-semibold transition-colors ${
              active ? `bg-[var(--zafi-tab-active)] shadow-[var(--zafi-tab-shadow)] ${TEXT_STRONG}` : TEXT_MUTED
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Etiqueta de campo dentro de una hoja. */
export function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className={`${GROUP_LABEL} ${TEXT_MUTED}`}>{children}</label>;
}

/** Campo de texto de 48px para hojas. */
export const INPUT_48 =
  `h-12 w-full rounded-[14px] border border-[var(--zafi-border)] bg-[var(--zafi-bg)] px-3.5 text-[15px] outline-none placeholder:text-[var(--zafi-text-secondary)] focus:border-electric ${TEXT_STRONG}`;

/** Caja de error (radio 12). */
export function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-xl bg-danger-light px-3.5 py-3 text-[13.5px] leading-[1.45] text-danger-text dark:bg-[var(--zafi-error-bg)] dark:text-[var(--zafi-error-text)]">
      {children}
    </div>
  );
}

/** Encabezado de hoja: tile de 44px, título DM Serif 24 y subtítulo. */
export function SheetHeader({ emoji, title, subtitle }: { emoji: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl text-[22px] ${TILE_BG}`}>{emoji}</span>
      <div className="flex min-w-0 flex-col">
        <h2 tabIndex={-1} className={`${SHEET_TITLE} leading-[1.15]`}>{title}</h2>
        {subtitle && <span className={`text-[13.5px] ${TEXT_MUTED}`}>{subtitle}</span>}
      </div>
    </div>
  );
}

/** Botón de texto rojo (acciones que quitan algo). */
export const DANGER_TEXT_BUTTON = 'h-11 text-[15px] font-semibold text-danger-text dark:text-[var(--zafi-error-text)]';
