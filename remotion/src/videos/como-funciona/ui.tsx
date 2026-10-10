// Sistema visual de la serie "Cómo funciona Zafi".
// Inspirado en el ejemplo de referencia (capítulos, titular con marcador,
// acento en serif itálica, tarjetas con borde y sombra sólida) usando SOLO
// la paleta y tipografías de la app: Outfit (titulares), DM Sans (texto),
// DM Serif Display itálica (acentos) y los colores de tailwind.config.ts.
import React from "react";
import { AbsoluteFill } from "remotion";
import { colors, fonts } from "../../brand/theme";
import { SAFE } from "../../config/formats";

/* ───────────── Paleta ───────────── */

export const z = {
  bg: "#F3F5F9", // --zafi-bg
  card: "#FFFFFF", // --zafi-card
  cardAlt: "#F8F9FC", // --zafi-card-alt
  border: "#E2E8F0", // --zafi-border
  divider: "#EEF1F6", // --zafi-border-light
  navy: colors.navy, // #1E3A5F --zafi-text / hero
  navyDeep: colors.navyDeep, // #0D1F36
  electric: colors.electric, // #2563EB
  electricDark: colors.electricDark, // #1D4ED8
  electricPale: colors.electricPale, // #60A5FA
  electricSoft: colors.electricSoft, // #93C5FD
  ghost: colors.electricGhost, // #DBEAFE
  ink: colors.ink900, // #0F172A
  secondary: "#475569", // --zafi-text-secondary
  muted: "#8B9AAE", // --zafi-text-faint
  heroMuted: "#CBD8E8",
  heroFaint: "#9FB3CB",
  heroTrack: "#2A4A6E",
  success: colors.success, // #22C55E
  successDark: "#16A34A",
  successLight: colors.successLight, // #D1FAE5
  successText: "#15803D",
};

export type Tone = "light" | "navy" | "electric";

/** Colores según el fondo del capítulo. */
export const toneStyle = (tone: Tone) =>
  ({
    light: { bg: z.bg, text: z.navy, accent: z.electric, eyebrow: z.secondary, square: z.electric, pattern: z.navy },
    navy: { bg: z.navy, text: colors.white, accent: z.electricPale, eyebrow: z.heroMuted, square: z.electricPale, pattern: colors.white },
    electric: { bg: z.electric, text: colors.white, accent: colors.white, eyebrow: z.ghost, square: colors.white, pattern: colors.white },
  })[tone];

/* ───────────── Fondo con textura de ondas ───────────── */

export const ChapterBackground: React.FC<{ tone: Tone }> = ({ tone }) => {
  const t = toneStyle(tone);
  const wave = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='90' viewBox='0 0 180 90'><path d='M0 45 C 30 10, 60 10, 90 45 S 150 80, 180 45' fill='none' stroke='${t.pattern}' stroke-width='14' stroke-linecap='round'/></svg>`,
  );
  return (
    <AbsoluteFill style={{ background: t.bg }}>
      <AbsoluteFill
        style={{
          backgroundImage: `url("data:image/svg+xml,${wave}")`,
          backgroundSize: "180px 90px",
          opacity: tone === "light" ? 0.035 : 0.06,
        }}
      />
    </AbsoluteFill>
  );
};

/* ───────────── Tipografía ───────────── */

/** "■ 01 — EMPIEZA" */
export const Eyebrow: React.FC<{ n: string; label: string; tone: Tone }> = ({ n, label, tone }) => {
  const t = toneStyle(tone);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        fontFamily: fonts.display,
        fontWeight: 600,
        fontSize: 30,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: t.eyebrow,
      }}
    >
      <span style={{ width: 20, height: 20, borderRadius: 4, background: t.square }} />
      {n} — {label}
    </div>
  );
};

/** Titular grande en Outfit. */
export const Headline: React.FC<{ tone: Tone; size?: number; children: React.ReactNode }> = ({
  tone,
  size = 118,
  children,
}) => (
  <div
    style={{
      fontFamily: fonts.display,
      fontWeight: 700,
      fontSize: size,
      lineHeight: 1.04,
      letterSpacing: "-0.035em",
      color: toneStyle(tone).text,
    }}
  >
    {children}
  </div>
);

/** Palabra resaltada con recuadro tipo marcador. */
export const Mark: React.FC<{ tone: Tone; variant?: "solid" | "soft"; children: React.ReactNode }> = ({
  tone,
  variant = "solid",
  children,
}) => {
  const solid = tone === "electric" ? { background: colors.white, color: z.electric } : { background: z.electric, color: colors.white };
  const soft = tone === "light" ? { background: z.ghost, color: z.navy } : { background: z.ghost, color: z.navy };
  return (
    <span
      style={{
        ...(variant === "solid" ? solid : soft),
        padding: "0 0.14em 0.04em",
        borderRadius: 10,
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
      }}
    >
      {children}
    </span>
  );
};

/** Acento en DM Serif Display itálica. */
export const Accent: React.FC<{ tone: Tone; boxed?: boolean; children: React.ReactNode }> = ({
  tone,
  boxed = false,
  children,
}) => {
  const t = toneStyle(tone);
  return (
    <span
      style={{
        fontFamily: fonts.serif,
        fontStyle: "italic",
        fontWeight: 400,
        letterSpacing: "-0.01em",
        color: boxed ? (tone === "electric" ? z.electric : z.navy) : t.accent,
        background: boxed ? colors.white : undefined,
        padding: boxed ? "0 0.12em" : undefined,
        borderRadius: boxed ? 10 : undefined,
      }}
    >
      {children}
    </span>
  );
};

/* ───────────── Tarjetas ───────────── */

/** Tarjeta con borde navy y sombra sólida (estilo del ejemplo). */
export const Card: React.FC<{
  width?: number;
  rotate?: number;
  pad?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ width = 820, rotate = 0, pad = 40, style, children }) => (
  <div
    style={{
      width,
      boxSizing: "border-box",
      padding: pad,
      borderRadius: 32,
      background: z.card,
      border: `4px solid ${z.navy}`,
      boxShadow: `12px 12px 0 ${z.navy}`,
      transform: `rotate(${rotate}deg)`,
      fontFamily: fonts.body,
      color: z.ink,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Etiqueta pequeña dentro de las tarjetas ("● TU PLAN · OCTUBRE"). */
export const CardLabel: React.FC<{ children: React.ReactNode; dot?: string }> = ({ children, dot = z.electric }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      fontFamily: fonts.display,
      fontWeight: 600,
      fontSize: 20,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: z.muted,
      marginBottom: 14,
    }}
  >
    <span style={{ width: 12, height: 12, borderRadius: 99, background: dot }} />
    {children}
  </div>
);

/** Insignias de la app. */
export const Pill: React.FC<{ kind?: "ok" | "info" | "neutral" | "navy"; size?: number; children: React.ReactNode }> = ({
  kind = "info",
  size = 22,
  children,
}) => {
  const s = {
    ok: { background: z.successLight, color: z.successText },
    info: { background: z.ghost, color: z.electricDark },
    neutral: { background: "#E7EBF2", color: z.navy },
    navy: { background: z.navy, color: colors.white },
  }[kind];
  return (
    <span
      style={{
        ...s,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: `${size * 0.25}px ${size * 0.7}px`,
        borderRadius: 99,
        fontFamily: fonts.body,
        fontWeight: 700,
        fontSize: size,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
};

/** Tile de emoji como en Movimientos. */
export const EmojiTile: React.FC<{ emoji: string; size?: number }> = ({ emoji, size = 72 }) => (
  <span
    style={{
      width: size,
      height: size,
      minWidth: size,
      borderRadius: size * 0.3,
      background: z.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.5,
    }}
  >
    {emoji}
  </span>
);

/** Fila de movimiento (emoji, nombre, categoría, monto). */
export const TxRow: React.FC<{ emoji: string; name: string; sub: string; amount: string; last?: boolean }> = ({
  emoji,
  name,
  sub,
  amount,
  last,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 20,
      padding: "16px 0",
      borderBottom: last ? undefined : `2px solid ${z.divider}`,
    }}
  >
    <EmojiTile emoji={emoji} size={68} />
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 30, fontWeight: 600, color: z.ink }}>{name}</div>
      <div style={{ fontSize: 23, color: z.secondary }}>{sub}</div>
    </div>
    <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 32, color: z.ink }}>{amount}</div>
  </div>
);

/** Barra de progreso. */
export const Bar: React.FC<{ pct: number; color?: string; track?: string; height?: number }> = ({
  pct,
  color = z.electric,
  track = z.divider,
  height = 16,
}) => (
  <div style={{ height, borderRadius: 99, background: track, overflow: "hidden" }}>
    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: color }} />
  </div>
);

/** Leyenda inferior con chips (como "■ Sonnet ■ Opus" del ejemplo). */
export const Legend: React.FC<{ tone: Tone; items: { color: string; label: string }[] }> = ({ tone, items }) => (
  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
    {items.map((it) => (
      <span
        key={it.label}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 20px",
          borderRadius: 99,
          border: `3px solid ${tone === "light" ? z.navy : colors.white}`,
          background: tone === "light" ? z.card : "transparent",
          fontFamily: fonts.body,
          fontWeight: 600,
          fontSize: 22,
          color: tone === "light" ? z.navy : colors.white,
        }}
      >
        <span style={{ width: 16, height: 16, borderRadius: 4, background: it.color }} />
        {it.label}
      </span>
    ))}
  </div>
);

/** Distribución vertical estándar de un capítulo: texto arriba, tarjetas abajo. */
export const ChapterLayout: React.FC<{
  tone: Tone;
  eyebrow: { n: string; label: string };
  headline: React.ReactNode;
  headlineSize?: number;
  sub?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ tone, eyebrow, headline, headlineSize, sub, children, footer }) => (
  <AbsoluteFill>
    <ChapterBackground tone={tone} />
    <div
      style={{
        position: "absolute",
        top: SAFE.top + 20,
        left: SAFE.left + 10,
        right: SAFE.right - 20,
        display: "flex",
        flexDirection: "column",
        gap: 34,
      }}
    >
      <Eyebrow tone={tone} {...eyebrow} />
      <Headline tone={tone} size={headlineSize}>
        {headline}
      </Headline>
      {sub && (
        <div style={{ fontFamily: fonts.serif, fontSize: 44, color: toneStyle(tone).eyebrow, marginTop: -6 }}>{sub}</div>
      )}
    </div>
    <div style={{ position: "absolute", top: 860, left: SAFE.left, width: 860 }}>{children}</div>
    {footer && <div style={{ position: "absolute", top: 1440, left: SAFE.left + 10 }}>{footer}</div>}
  </AbsoluteFill>
);
