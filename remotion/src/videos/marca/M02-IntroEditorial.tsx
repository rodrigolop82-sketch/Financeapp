// M02 · Intro editorial de Zafi.
// Estilo: serif editorial con acentos en itálica (DM Serif Display, la misma de
// los títulos de la app), pantallas que replican el look de Zafi (fondo #F3F5F9,
// tarjetas blancas, filas con emoji, hero navy) y paneles que alternan navy y
// claro. Movimiento suave, sin rebotes: fade + desplazamiento corto + desenfoque.
import React from "react";
import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Bell, Check, Sparkles } from "lucide-react";
import { BRAND, colors, fonts } from "../../brand/theme";
import { easeInOut, SafeZoneGuide, tween } from "../../components";
import { SAFE } from "../../config/formats";

export type IntroEditorialProps = { mostrarZonasSeguras: boolean };

/* ───────────── Paleta editorial ───────────── */

// Colores y estilos del tema claro de la app (app/globals.css,
// tailwind.config.ts y components/movimientos/ui.ts)
const ed = {
  cream: "#F3F5F9", // --zafi-bg (fondo de pantalla y de los tiles de emoji)
  paper: "#FFFFFF", // --zafi-card
  line: "#E2E8F0", // --zafi-border
  divider: "#EEF1F6", // --zafi-border-light
  cardBorder: "rgba(30,58,95,0.08)", // border-navy/[0.08]
  ink: colors.navy, // --zafi-text (títulos)
  strong: colors.ink900, // texto fuerte de filas
  secondary: "#475569", // --zafi-text-secondary
  muted: "#8B9AAE", // --zafi-text-faint
  rust: colors.danger, // acento del problema
  accent: colors.electric, // acento de la solución
  dark: colors.navy, // --zafi-hero: píldoras, burbujas y paneles oscuros
  heroMuted: "#CBD8E8",
  heroFaint: "#9FB3CB",
  heroTrack: "#2A4A6E",
  tint: "#F8F9FC", // --zafi-card-alt
};

/** Insignias de la app (BADGE_OK / BADGE_WARN / BADGE_INFO). */
const badge = {
  ok: { background: colors.successLight, color: "#15803D" },
  warn: { background: colors.warningLight, color: "#92400E" },
  info: { background: colors.electricGhost, color: colors.electricDark },
  neutral: { background: "#F3F5F9", color: "#475569" },
};

const Badge: React.FC<{ kind: keyof typeof badge; size?: number; children: React.ReactNode }> = ({
  kind,
  size = 22,
  children,
}) => (
  <span
    style={{
      ...badge[kind],
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: `${size * 0.2}px ${size * 0.6}px`,
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

/** Tile de emoji como en las filas de Movimientos (fondo #F3F5F9, radio 12). */
const EmojiTile: React.FC<{ emoji: string; size?: number }> = ({ emoji, size = 72 }) => (
  <span
    style={{
      width: size,
      height: size,
      minWidth: size,
      borderRadius: size * 0.3,
      background: ed.cream,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.5,
    }}
  >
    {emoji}
  </span>
);

const money: React.CSSProperties = { fontFamily: fonts.display, fontWeight: 700, color: colors.ink900 };

/* ───────────── Línea de tiempo ───────────── */

const T = {
  finDeMes: { from: 0, dur: 92 },
  notas: { from: 90, dur: 142 },
  noSabes: { from: 230, dur: 57 },
  otraVez: { from: 285, dur: 62 },
  ySi: { from: 345, dur: 77 },
  entiende: { from: 420, dur: 102 },
  paneles: { from: 520, dur: 212 },
  control: { from: 730, dur: 82 },
  tranquilo: { from: 810, dur: 52 },
  logo: { from: 860, dur: 95 },
};
export const M02_DURATION = T.logo.from + T.logo.dur;

/* ───────────── Piezas base ───────────── */

/** Escena con entrada y salida suaves (fundido corto). */
const Scene: React.FC<{
  from: number;
  dur: number;
  bg?: string;
  fadeOut?: boolean;
  children: React.ReactNode;
}> = ({ from, dur, bg, fadeOut = true, children }) => (
  <Sequence from={from} durationInFrames={dur}>
    <SceneFade dur={dur} bg={bg} fadeOut={fadeOut}>
      {children}
    </SceneFade>
  </Sequence>
);

const SceneFade: React.FC<{ dur: number; bg?: string; fadeOut: boolean; children: React.ReactNode }> = ({
  dur,
  bg,
  fadeOut,
  children,
}) => {
  const frame = useCurrentFrame();
  const opacity = tween(frame, [0, 6], [0, 1]) * (fadeOut ? tween(frame, [dur - 6, dur], [1, 0]) : 1);
  return <AbsoluteFill style={{ background: bg, opacity }}>{children}</AbsoluteFill>;
};

/** Entrada elegante: fade + subida corta + desenfoque que se aclara. */
const Rise: React.FC<{
  delay?: number;
  distance?: number;
  duration?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ delay = 0, distance = 28, duration = 16, style, children }) => {
  const frame = useCurrentFrame();
  const p = tween(frame, [delay, delay + duration], [0, 1]);
  return (
    <div
      style={{
        opacity: p,
        transform: `translateY(${(1 - p) * distance}px)`,
        filter: `blur(${(1 - p) * 8}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const serif = (size: number, color: string = ed.ink): React.CSSProperties => ({
  fontFamily: fonts.serif,
  fontWeight: 400,
  fontSize: size,
  lineHeight: 1.02,
  letterSpacing: "-0.02em",
  color,
});

const Em: React.FC<{ color?: string; children: React.ReactNode }> = ({ color = ed.accent, children }) => (
  <span style={{ fontStyle: "italic", color }}>{children}</span>
);

/** Tarjeta/pantalla con el look de la app: blanca, radio 28, borde navy 8%. */
const AppWindow: React.FC<{
  title?: string;
  tabs?: boolean;
  zafiTab?: boolean;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ title, tabs = false, zafiTab = false, width = 848, height = 760, style, children }) => (
  <div
    style={{
      width,
      height,
      borderRadius: 32,
      background: ed.paper,
      border: `2px solid ${ed.cardBorder}`,
      boxShadow: "0 30px 80px rgba(30,58,95,0.10), 0 4px 14px rgba(30,58,95,0.05)",
      overflow: "hidden",
      fontFamily: fonts.body,
      color: ed.strong,
      ...style,
    }}
  >
    <div style={{ padding: "38px 44px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        {title && <div style={{ ...serif(56), lineHeight: 1.15 }}>{title}</div>}
        {tabs && (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              borderRadius: 99,
              fontSize: 24,
              fontWeight: 700,
              background: zafiTab ? colors.electric : colors.electricGhost,
              color: zafiTab ? colors.white : colors.electricDark,
            }}
          >
            <Sparkles size={22} color={zafiTab ? colors.white : colors.electricDark} /> Zafi
          </span>
        )}
      </div>
      {children}
    </div>
  </div>
);

/** Escribe varias líneas una tras otra, como si alguien tomara notas. */
const typed = (lines: string[], frame: number, cps = 1.4) => {
  let budget = Math.max(0, Math.floor(frame * cps));
  return lines.map((l) => {
    const shown = l.slice(0, budget);
    budget = Math.max(0, budget - l.length - 4); // pequeña pausa entre líneas
    return shown;
  });
};

const MESSY = ["súper 640??", "tarjeta — ¿cuánto debo?", "luz… ¿ya la pagué?", "ahorro: nada. otra vez"];

const NotesBody: React.FC<{ frame: number }> = ({ frame }) => {
  const lines = typed(MESSY, frame);
  const active = lines.findIndex((l, i) => l.length < MESSY[i].length);
  return (
    <div style={{ fontSize: 36, lineHeight: 1.55, color: ed.secondary }}>
      {lines.map((l, i) => (
        <div key={i} style={{ minHeight: 56 }}>
          {l}
          {i === active && l.length > 0 && <span style={{ color: colors.electric }}>|</span>}
        </div>
      ))}
    </div>
  );
};

/* ───────────── Columna de gastos (equivale al calendario del estilo) ───────────── */

const EXPENSES = [
  { e: "🛒", n: "Súper", c: "Supermercado", a: "Q 640" },
  { e: "🎬", n: "Netflix", c: "Suscripciones", a: "Q 75" },
  { e: "⛽", n: "Gasolina", c: "Transporte", a: "Q 300" },
  { e: "💳", n: "Tarjeta de crédito", c: "Deudas", a: "Q 1,200" },
  { e: "🍔", n: "Delivery", c: "Comida", a: "Q 180" },
  { e: "💡", n: "Luz", c: "Servicios", a: "Q 280" },
  { e: "💊", n: "Farmacia", c: "Salud", a: "Q 95" },
  { e: "🍿", n: "Cine", c: "Entretenimiento", a: "Q 120" },
  { e: "🏋️", n: "Gimnasio", c: "Salud", a: "Q 250" },
  { e: "☕", n: "Café", c: "Comida", a: "Q 35" },
];
const DAYS = ["Hoy", "Ayer", "Lunes 27", "Domingo 26", "Sábado 25", "Viernes 24", "Jueves 23", "Miércoles 22"];

/** Lista de movimientos que se desplaza (igual a la pantalla Movimientos). */
const ExpenseColumn: React.FC<{
  speed?: number;
  offset?: number;
  checked?: boolean;
  top: number;
  height: number;
}> = ({ speed = 2.4, offset = 0, checked = false, top, height }) => {
  const frame = useCurrentFrame();
  const y = -(offset + frame * speed);
  // Grupos de 2-3 movimientos por día, como en la app
  const items = [...EXPENSES, ...EXPENSES, ...EXPENSES];
  const groups: { day: string; rows: typeof EXPENSES }[] = [];
  for (let i = 0, d = 0; i < items.length; d++) {
    const n = d % 2 === 0 ? 3 : 2;
    groups.push({ day: DAYS[d % DAYS.length], rows: items.slice(i, i + n) });
    i += n;
  }
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: SAFE.left,
        width: 848,
        height,
        overflow: "hidden",
        WebkitMaskImage: "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
        maskImage: "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
      }}
    >
      <div style={{ transform: `translateY(${y}px)`, fontFamily: fonts.body }}>
        {groups.map((g, gi) => (
          <div key={gi} style={{ marginBottom: 26 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "0 8px 10px",
                fontSize: 24,
                fontWeight: 600,
                color: ed.secondary,
              }}
            >
              <span>{g.day}</span>
              <span>{checked ? "en presupuesto" : `-Q ${(gi * 137) % 900 + 120}`}</span>
            </div>
            {g.rows.map((r, ri) => (
              <div
                key={ri}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 22,
                  height: 116,
                  padding: "0 26px",
                  marginBottom: 10,
                  borderRadius: 26,
                  background: ed.paper,
                  border: `2px solid ${ed.cardBorder}`,
                }}
              >
                <EmojiTile emoji={r.e} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 30, fontWeight: 600, color: ed.strong }}>{r.n}</div>
                  <div style={{ fontSize: 24, color: ed.secondary }}>{r.c}</div>
                </div>
                {checked && (
                  <Badge kind="ok" size={20}>
                    <Check size={18} strokeWidth={3} color="#15803D" /> Pagado
                  </Badge>
                )}
                <div style={{ ...money, fontSize: 32 }}>{r.a}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ───────────── Escenas ───────────── */

const TEXT_TOP = SAFE.top + 30;

const FinDeMes: React.FC = () => (
  <AbsoluteFill>
    <div style={{ position: "absolute", top: TEXT_TOP, left: SAFE.left + 8, ...serif(124) }}>
      <Rise>Fin de mes.</Rise>
      <Rise delay={14} style={{ marginLeft: 70 }}>
        <Em color={ed.rust}>otra vez.</Em>
      </Rise>
      <Rise delay={26} style={{ marginLeft: 140 }}>
        <Em color={ed.rust}>otra vez.</Em>
      </Rise>
    </div>
    <Rise delay={4} distance={60}>
      <ExpenseColumn top={720} height={800} />
    </Rise>
  </AbsoluteFill>
);

const Notification: React.FC<{ title: string; body: string; delay: number; out?: number }> = ({
  title,
  body,
  delay,
  out,
}) => {
  const frame = useCurrentFrame();
  const p = tween(frame, [delay, delay + 14], [0, 1]);
  const o = out === undefined ? 0 : tween(frame, [out, out + 10], [0, 1], easeInOut);
  return (
    <div
      style={{
        position: "absolute",
        top: SAFE.top + 10,
        left: SAFE.left + 40,
        right: SAFE.right - 40,
        display: "flex",
        gap: 20,
        alignItems: "center",
        padding: "22px 26px",
        borderRadius: 28,
        background: "rgba(255,255,255,0.92)",
        border: `1.5px solid ${ed.line}`,
        boxShadow: "0 24px 60px rgba(27,27,26,0.12)",
        fontFamily: fonts.body,
        opacity: p * (1 - o),
        transform: `translateY(${(1 - p) * -60 + o * -40}px) scale(${1 - o * 0.05})`,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: ed.ink,
          color: colors.white,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 30,
        }}
      >
        B
      </div>
      <div>
        <div style={{ fontSize: 22, color: ed.muted }}>{title}</div>
        <div style={{ fontSize: 28, fontWeight: 500, color: ed.ink }}>{body}</div>
      </div>
    </div>
  );
};

const Notas: React.FC = () => {
  const frame = useCurrentFrame();
  const pill = tween(frame, [104, 118], [0, 1]);
  return (
    <AbsoluteFill>
      <Notification title="Banco · ahora" body="Consumo de Q 385 en restaurante" delay={14} out={66} />
      <Notification title="Banco · ahora" body="Saldo disponible: Q 212" delay={72} />
      <Rise distance={50} style={{ position: "absolute", top: 470, left: SAFE.left + 40 }}>
        <AppWindow title="Notas" width={768} height={640}>
          <NotesBody frame={frame - 12} />
        </AppWindow>
      </Rise>
      <div
        style={{
          position: "absolute",
          top: 1150,
          left: 0,
          right: SAFE.right - SAFE.left,
          display: "flex",
          justifyContent: "center",
          opacity: pill,
          transform: `translateY(${(1 - pill) * 20}px)`,
        }}
      >
        <div
          style={{
            padding: "20px 38px",
            borderRadius: 99,
            background: ed.dark,
            color: colors.white,
            ...serif(44, colors.white),
            fontStyle: "italic",
          }}
        >
          …y faltan 12 días para la quincena.
        </div>
      </div>
    </AbsoluteFill>
  );
};

const NoSabes: React.FC = () => {
  const frame = useCurrentFrame();
  const lift = tween(frame, [0, 18], [0, 1], easeInOut);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 470 - lift * 170,
          left: SAFE.left + 40,
          transform: `scale(${1 - lift * 0.18})`,
          transformOrigin: "top center",
          opacity: 1 - lift * 0.35,
        }}
      >
        <AppWindow title="Notas" width={768} height={640}>
          <NotesBody frame={999} />
        </AppWindow>
      </div>
      <div style={{ position: "absolute", top: 1050, left: 0, right: SAFE.right - SAFE.left, textAlign: "center", ...serif(104) }}>
        <Rise delay={10}>No sabes a dónde</Rise>
        <Rise delay={16}>
          <Em color={ed.rust}>se fue.</Em>
        </Rise>
      </div>
    </AbsoluteFill>
  );
};

const OtraVez: React.FC = () => (
  <AbsoluteFill>
    <div style={{ position: "absolute", top: TEXT_TOP + 60, left: SAFE.left + 8, ...serif(150) }}>
      <Rise>
        <Em color={ed.ink}>Otra vez.</Em>
      </Rise>
      <Rise delay={14} style={{ ...serif(84, ed.muted), marginTop: 10 }}>
        <Em color={ed.muted}>y otra vez.</Em>
      </Rise>
    </div>
    <ExpenseColumn top={760} height={760} speed={6} offset={900} />
  </AbsoluteFill>
);

const VoiceBars: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", height: 34 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            borderRadius: 9,
            background: colors.white,
            height: 10 + Math.abs(Math.sin(frame / 4 + i * 1.3)) * 24,
          }}
        />
      ))}
    </div>
  );
};

const YSi: React.FC = () => {
  const frame = useCurrentFrame();
  const pill = tween(frame, [50, 64], [0, 1]);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingRight: SAFE.right - SAFE.left }}>
      <div style={{ textAlign: "center", ...serif(112) }}>
        <Rise>¿Y si alguien</Rise>
        <Rise delay={12}>te dijera</Rise>
        <Rise delay={26} style={{ ...serif(150), marginTop: 10 }}>
          <Em>qué hacer?</Em>
        </Rise>
      </div>
      <div
        style={{
          marginTop: 70,
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "16px 30px",
          borderRadius: 99,
          background: ed.dark,
          opacity: pill,
          transform: `scale(${0.85 + pill * 0.15})`,
        }}
      >
        <Sparkles size={30} color={colors.electricPale} />
        <VoiceBars />
      </div>
    </AbsoluteFill>
  );
};

const Chip: React.FC<{ kind: keyof typeof badge; children: React.ReactNode }> = ({ kind, children }) => (
  <Badge kind={kind} size={24}>
    {children}
  </Badge>
);

const Bullet: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: "flex", gap: 14, fontSize: 27, lineHeight: 1.4, color: ed.secondary, margin: "10px 0 0 6px" }}>
    <span>•</span>
    <span>{children}</span>
  </div>
);

const Entiende: React.FC = () => {
  const frame = useCurrentFrame();
  const swap = tween(frame, [46, 58], [0, 1], easeInOut);
  const analyzing = tween(frame, [26, 34], [0, 1]) * (1 - tween(frame, [56, 62], [0, 1]));
  const groups = [
    { kind: "warn" as const, chip: "Comida y delivery", lines: ["Q 1,820 este mes, 18% más que septiembre", "El delivery ya es el 40% de tu comida"] },
    { kind: "info" as const, chip: "Tarjeta de crédito", lines: ["Debes Q 4,300: págala primero (36% anual)"] },
    { kind: "ok" as const, chip: "Luz", lines: ["Vence el día 5 · ya está en tus recordatorios"] },
  ];
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: TEXT_TOP, left: SAFE.left + 8, ...serif(92) }}>
        <Rise>Lo dices o lo subes,</Rise>
        <Rise delay={10}>
          <Em>Zafi lo entiende.</Em>
        </Rise>
      </div>
      <Rise delay={4} distance={50} style={{ position: "absolute", top: 560, left: SAFE.left }}>
        <AppWindow title="Octubre" tabs zafiTab={swap > 0.5} width={848} height={760}>
          <div style={{ position: "relative" }}>
            <div style={{ opacity: 1 - swap, position: "absolute", inset: 0 }}>
              <NotesBody frame={999} />
            </div>
            <div style={{ opacity: swap }}>
              {groups.map((g, gi) => (
                <Rise key={g.chip} delay={52 + gi * 8} distance={18} style={{ marginBottom: 26 }}>
                  <Chip kind={g.kind}>{g.chip}</Chip>
                  {g.lines.map((l) => (
                    <Bullet key={l}>{l}</Bullet>
                  ))}
                </Rise>
              ))}
            </div>
          </div>
        </AppWindow>
      </Rise>
      <div
        style={{
          position: "absolute",
          top: 1220,
          left: SAFE.left,
          width: 848,
          display: "flex",
          justifyContent: "center",
          opacity: analyzing,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 26px",
            borderRadius: 99,
            background: ed.paper,
            border: `1.5px solid ${ed.line}`,
            boxShadow: "0 10px 30px rgba(27,27,26,0.08)",
            fontFamily: fonts.body,
            fontSize: 24,
            color: colors.ink700,
          }}
        >
          <Sparkles size={22} color={colors.electric} style={{ transform: `rotate(${frame * 6}deg)` }} />
          Zafi está analizando tu mes…
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ───────────── Paneles de funciones ───────────── */

const PANEL = 42;

const DiagnosticoBody: React.FC<{ f: number }> = ({ f }) => {
  const score = Math.round(tween(f, [4, 30], [0, 72]));
  const spent = tween(f, [4, 30], [0, 6240]);
  const pct = tween(f, [4, 30], [0, 78]);
  return (
    <div>
      {/* Igual al StatusHero del dashboard */}
      <div style={{ background: ed.dark, borderRadius: 28, padding: "30px 32px", color: colors.white }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 24, color: ed.heroMuted }}>
            <span style={{ width: 12, height: 12, borderRadius: 99, background: colors.warning }} />
            Cuidado, vas un poco rápido
          </div>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 99,
              border: `5px solid ${colors.warning}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: fonts.display,
              fontWeight: 700,
              fontSize: 28,
            }}
          >
            {score}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 18 }}>
          <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 70 }}>
            Q {Math.round(spent).toLocaleString("es-GT")}
          </span>
          <span style={{ fontSize: 24, color: ed.heroFaint }}>de Q 8,000</span>
        </div>
        <div style={{ height: 14, borderRadius: 9, background: ed.heroTrack, marginTop: 16, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 9, background: colors.warning }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 22, color: ed.heroFaint }}>
          <span>
            Te quedan <b style={{ color: colors.white, fontFamily: fonts.display }}>Q 1,760</b>
          </span>
          <span>12 días restantes</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 26 }}>
        {[
          { k: "ok" as const, t: "Deudas controladas" },
          { k: "warn" as const, t: "Ahorro bajo" },
          { k: "info" as const, t: "Comida: +18%" },
        ].map((b, i) => (
          <Rise key={b.t} delay={14 + i * 4} distance={10}>
            <Badge kind={b.k}>{b.t}</Badge>
          </Rise>
        ))}
      </div>
    </div>
  );
};

const PlanBody: React.FC<{ f: number }> = ({ f }) => {
  const items = ["Arma tu fondo de emergencia", "Paga primero la tarjeta más cara", "Aparta 10% de cada ingreso"];
  return (
    <div>
      {items.map((t, i) => {
        const done = f > 14 + i * 7;
        return (
          <Rise key={t} delay={2 + i * 4} distance={14}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "16px 0", fontSize: 29 }}>
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: `2px solid ${done ? colors.success : ed.line}`,
                  background: done ? colors.success : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {done && <Check size={26} color={colors.white} strokeWidth={3} />}
              </span>
              <span style={{ color: done ? ed.muted : ed.ink, textDecoration: done ? "line-through" : "none" }}>{t}</span>
            </div>
          </Rise>
        );
      })}
    </div>
  );
};

const RecordatoriosBody: React.FC<{ f: number }> = ({ f }) => {
  const rows = [
    { e: "💡", n: "Luz", a: "Q 280", d: "en 2 días", k: "warn" as const },
    { e: "🌐", n: "Internet", a: "Q 299", d: "en 5 días", k: "neutral" as const },
    { e: "💳", n: "Tarjeta", a: "Q 1,200", d: "en 9 días", k: "neutral" as const },
  ];
  const sent = tween(f, [20, 30], [0, 1]);
  return (
    <div>
      {rows.map((r, i) => (
        <Rise key={r.n} delay={2 + i * 4} distance={14}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              padding: "16px 0",
              borderBottom: `2px solid ${ed.divider}`,
            }}
          >
            <EmojiTile emoji={r.e} size={66} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 29, fontWeight: 600 }}>{r.n}</div>
              <Badge kind={r.k} size={19}>
                Vence {r.d}
              </Badge>
            </div>
            <span style={{ ...money, fontSize: 30 }}>{r.a}</span>
          </div>
        </Rise>
      ))}
      <div
        style={{
          marginTop: 26,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "18px 22px",
          borderRadius: 20,
          background: ed.tint,
          border: `2px solid ${ed.divider}`,
          fontSize: 24,
          color: ed.secondary,
          opacity: sent,
          transform: `translateY(${(1 - sent) * 12}px)`,
        }}
      >
        <Bell size={26} color={colors.electric} /> Te avisamos antes de que venza
      </div>
    </div>
  );
};

const MemoriaBody: React.FC<{ f: number }> = ({ f }) => {
  const reply = "Llevas Q 3,600 de Q 6,000. Vas dos semanas adelantado.";
  const shown = reply.slice(0, Math.max(0, Math.floor((f - 12) * 2.6)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontSize: 28, lineHeight: 1.4 }}>
      <Rise delay={2} distance={14} style={{ alignSelf: "flex-end", maxWidth: "80%" }}>
        <div style={{ padding: "16px 22px", borderRadius: 22, borderBottomRightRadius: 6, background: colors.electric, color: colors.white }}>
          ¿Cuánto llevo para el viaje?
        </div>
      </Rise>
      {f > 10 && (
        <div
          style={{
            alignSelf: "flex-start",
            maxWidth: "88%",
            display: "flex",
            gap: 14,
            padding: "16px 22px",
            borderRadius: 22,
            borderBottomLeftRadius: 6,
            background: ed.tint,
            border: `2px solid ${ed.divider}`,
          }}
        >
          <Sparkles size={28} color={colors.electric} style={{ marginTop: 4, flexShrink: 0 }} />
          <div style={{ color: ed.secondary }}>{shown || "…"}</div>
        </div>
      )}
    </div>
  );
};

const FamiliaBody: React.FC<{ f: number }> = ({ f }) => {
  const pct = tween(f, [6, 30], [0, 60]);
  const avatar = (l: string, c: string) => (
    <span
      style={{
        width: 64,
        height: 64,
        borderRadius: 99,
        background: c,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 28,
        color: ed.ink,
        border: `3px solid ${ed.paper}`,
      }}
    >
      {l}
    </span>
  );
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 26 }}>
        <div style={{ display: "flex" }}>
          {avatar("Tú", colors.electricGhost)}
          <span style={{ marginLeft: -16 }}>{avatar("A", "#E7EBF2")}</span>
        </div>
        <span style={{ fontSize: 26, color: ed.muted }}>Hogar compartido</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 500, marginBottom: 14 }}>Meta: viaje a Antigua</div>
      <div style={{ height: 22, borderRadius: 99, background: ed.cream, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: colors.electric }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: ed.muted, marginTop: 14 }}>
        <span>Tú · Q 2,100</span>
        <span>Ana · Q 1,500</span>
        <span style={{ color: colors.electric, fontWeight: 700 }}>{Math.round(pct)}%</span>
      </div>
    </div>
  );
};

const PANELS: {
  dark: boolean;
  title: React.ReactNode;
  window: string;
  Body: React.FC<{ f: number }>;
}[] = [
  { dark: true, title: <>Tu diagnóstico,<br /><Em color={colors.electricPale}>al instante.</Em></>, window: "Inicio", Body: DiagnosticoBody },
  { dark: false, title: <>Un plan.</>, window: "Tu plan", Body: PlanBody },
  { dark: true, title: <>Recordatorios.</>, window: "Pagos del mes", Body: RecordatoriosBody },
  { dark: false, title: <>Memoria.</>, window: "Pregúntale a Zafi", Body: MemoriaBody },
  { dark: true, title: <>En familia,<br /><Em color={colors.electricPale}>también.</Em></>, window: "Hogar", Body: FamiliaBody },
];

const Paneles: React.FC = () => {
  const frame = useCurrentFrame();
  const idx = Math.min(PANELS.length - 1, Math.floor(frame / PANEL));
  const windowIn = tween(frame, [0, 16], [0, 1]);
  return (
    <AbsoluteFill style={{ background: ed.cream }}>
      {/* Cada color barre desde la izquierda sobre el anterior */}
      {PANELS.map((p, i) => {
        const start = i * PANEL - 6;
        const wipe = tween(frame, [start, start + 12], [100, 0], easeInOut);
        if (frame < start) return null;
        return (
          <AbsoluteFill key={i} style={{ background: p.dark ? ed.dark : ed.cream, clipPath: `inset(0 ${wipe}% 0 0)` }} />
        );
      })}
      {PANELS.map((p, i) => {
        const local = frame - i * PANEL;
        const last = i === PANELS.length - 1;
        if (local < 0 || (!last && local >= PANEL)) return null;
        const exit = last ? 0 : tween(local, [PANEL - 7, PANEL - 1], [0, 1], easeInOut);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: TEXT_TOP,
              left: SAFE.left + 8,
              ...serif(120, p.dark ? colors.white : ed.ink),
              opacity: 1 - exit,
              transform: `translateY(${-exit * 24}px)`,
              filter: `blur(${exit * 6}px)`,
            }}
          >
            <Rise delay={2} distance={22} duration={12}>
              {p.title}
            </Rise>
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          top: 760,
          left: SAFE.left,
          opacity: windowIn,
          transform: `translateY(${(1 - windowIn) * 80}px)`,
        }}
      >
        <AppWindow title={PANELS[idx].window} width={848} height={640}>
          {(() => {
            const P = PANELS[idx];
            return <P.Body f={frame - idx * PANEL} />;
          })()}
        </AppWindow>
      </div>
    </AbsoluteFill>
  );
};

/* ───────────── Cierre ───────────── */

const Control: React.FC = () => {
  const frame = useCurrentFrame();
  const card = tween(frame, [30, 46], [0, 1]);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: TEXT_TOP, left: SAFE.left + 8, ...serif(124) }}>
        <Rise>Fin de mes.</Rise>
        <Rise delay={12}>
          <Em>Bajo control.</Em>
        </Rise>
      </div>
      <ExpenseColumn top={680} height={840} checked speed={1.6} />
      <div
        style={{
          position: "absolute",
          top: 1000,
          left: SAFE.left + 180,
          width: 600,
          padding: "30px 34px",
          borderRadius: 28,
          background: ed.paper,
          border: `1.5px solid ${ed.line}`,
          boxShadow: "0 30px 80px rgba(27,27,26,0.16)",
          fontFamily: fonts.body,
          opacity: card,
          transform: `translateY(${(1 - card) * 30}px) scale(${0.96 + card * 0.04})`,
        }}
      >
        <div style={{ fontSize: 22, color: colors.success, fontWeight: 700 }}>Tu resumen de octubre</div>
        <div style={{ ...serif(56), marginTop: 10 }}>
          Te sobraron <Em>Q 850</Em>
        </div>
        <div style={{ fontSize: 24, color: ed.muted, marginTop: 8 }}>y ya van directo a tu meta.</div>
      </div>
    </AbsoluteFill>
  );
};

const Tranquilo: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingRight: SAFE.right - SAFE.left }}>
    <Rise style={serif(140, colors.white)}>Vive tranquilo.</Rise>
    <Rise delay={12} style={{ fontFamily: fonts.body, fontSize: 34, color: ed.heroMuted, marginTop: 30 }}>
      Tu dinero en orden, sin estrés.
    </Rise>
  </AbsoluteFill>
);

const Logo: React.FC = () => {
  const frame = useCurrentFrame();
  const btn = tween(frame, [26, 40], [0, 1]);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingRight: SAFE.right - SAFE.left }}>
      <Rise style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <Img src={staticFile("brand/zafi-icon.png")} style={{ width: 96, height: 96, borderRadius: 24 }} />
        <span
          style={{
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 104,
            letterSpacing: "-0.04em",
            color: ed.ink,
          }}
        >
          zaf<span style={{ color: colors.electric }}>i</span>
        </span>
      </Rise>
      <Rise delay={10} style={{ ...serif(84), textAlign: "center", marginTop: 50 }}>
        Tu asesor financiero
        <br />
        <Em>personal.</Em>
      </Rise>
      <div
        style={{
          marginTop: 60,
          padding: "28px 72px",
          borderRadius: 28,
          background: colors.electric,
          boxShadow: `0 20px 50px ${colors.electric}40`,
          color: colors.white,
          fontFamily: fonts.body,
          fontWeight: 700,
          fontSize: 38,
          opacity: btn,
          transform: `translateY(${(1 - btn) * 16}px)`,
        }}
      >
        Pruébalo gratis
      </div>
      <Rise delay={34} style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 32, color: colors.electricDark, marginTop: 40 }}>
        {BRAND.url}
      </Rise>
    </AbsoluteFill>
  );
};

/* ───────────── Composición ───────────── */

export const IntroEditorial: React.FC<IntroEditorialProps> = ({ mostrarZonasSeguras }) => (
  <AbsoluteFill style={{ background: ed.cream }}>
    <Scene {...T.finDeMes}>
      <FinDeMes />
    </Scene>
    <Scene {...T.notas}>
      <Notas />
    </Scene>
    <Scene {...T.noSabes}>
      <NoSabes />
    </Scene>
    <Scene {...T.otraVez}>
      <OtraVez />
    </Scene>
    <Scene {...T.ySi}>
      <YSi />
    </Scene>
    <Scene {...T.entiende}>
      <Entiende />
    </Scene>
    <Scene {...T.paneles}>
      <Paneles />
    </Scene>
    <Scene {...T.control} bg={ed.cream}>
      <Control />
    </Scene>
    <Scene {...T.tranquilo} bg={ed.dark}>
      <Tranquilo />
    </Scene>
    <Scene {...T.logo} bg={ed.cream} fadeOut={false}>
      <Logo />
    </Scene>
    {mostrarZonasSeguras && <SafeZoneGuide />}
  </AbsoluteFill>
);
