// M02 · Intro editorial de Zafi.
// Estilo: fondo crema, serif editorial con acentos en itálica, bloques pastel,
// ventanas de app limpias y paneles de color por función. Movimiento suave,
// sin rebotes: todo entra con fade + desplazamiento corto + desenfoque.
import React from "react";
import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Bell, Check, Sparkles } from "lucide-react";
import { BRAND, colors, fonts } from "../../brand/theme";
import { easeInOut, SafeZoneGuide, tween } from "../../components";
import { SAFE } from "../../config/formats";

export type IntroEditorialProps = { mostrarZonasSeguras: boolean };

/* ───────────── Paleta editorial ───────────── */

const ed = {
  cream: "#F6F5EF",
  paper: "#FFFFFF",
  line: "#E7E4DA",
  ink: colors.navyDeep,
  muted: "#8A8778",
  rust: "#B4532A",
  accent: colors.electric,
  dark: "#1B1B1A",
  mint: "#CDEFD9",
  sky: "#CFE0FF",
  pink: "#F8D3EE",
  lavender: "#DCD5FB",
  sand: "#F3E6A6",
  lime: "#E4F5A1",
  highlight: "#FFF1A8",
};

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

/** Ventana estilo app de escritorio. */
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
      borderRadius: 30,
      background: ed.paper,
      border: `1.5px solid ${ed.line}`,
      boxShadow: "0 40px 90px rgba(27,27,26,0.10), 0 6px 18px rgba(27,27,26,0.06)",
      overflow: "hidden",
      fontFamily: fonts.body,
      color: ed.ink,
      ...style,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", padding: "24px 30px 0" }}>
      {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
        <span key={c} style={{ width: 16, height: 16, borderRadius: 99, background: c, marginRight: 10 }} />
      ))}
      <div style={{ flex: 1 }} />
      {tabs && (
        <div style={{ display: "flex", gap: 8, fontSize: 20 }}>
          <span style={{ padding: "6px 14px", borderRadius: 99, color: ed.muted }}>Mis notas</span>
          <span
            style={{
              padding: "6px 14px",
              borderRadius: 99,
              background: zafiTab ? colors.electric : "transparent",
              color: zafiTab ? colors.white : ed.muted,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Sparkles size={16} color={zafiTab ? colors.white : ed.muted} /> Zafi
          </span>
        </div>
      )}
    </div>
    <div style={{ padding: "26px 44px 0" }}>
      {title && <div style={{ ...serif(54), marginBottom: 22 }}>{title}</div>}
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
    <div style={{ fontSize: 36, lineHeight: 1.55, color: colors.ink700 }}>
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
  { n: "Súper", a: "Q 640", c: ed.sand },
  { n: "Netflix", a: "Q 75", c: ed.pink },
  { n: "Gasolina", a: "Q 300", c: ed.sky },
  { n: "Tarjeta de crédito", a: "Q 1,200", c: ed.lime },
  { n: "Delivery", a: "Q 180", c: ed.lavender },
  { n: "Luz", a: "Q 280", c: ed.mint },
  { n: "Farmacia", a: "Q 95", c: ed.pink },
  { n: "Cine", a: "Q 120", c: ed.sky },
  { n: "Gimnasio", a: "Q 250", c: ed.sand },
  { n: "Café", a: "Q 35", c: ed.lavender },
];

const ExpenseColumn: React.FC<{
  speed?: number;
  offset?: number;
  checked?: boolean;
  top: number;
  height: number;
}> = ({ speed = 2.4, offset = 0, checked = false, top, height }) => {
  const frame = useCurrentFrame();
  const ROW = 124;
  const items = [...EXPENSES, ...EXPENSES, ...EXPENSES];
  const y = -(offset + frame * speed);
  const nowLine = height * 0.42;
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: SAFE.left,
        right: SAFE.right - 40,
        height,
        overflow: "hidden",
        WebkitMaskImage: "linear-gradient(to bottom, transparent, black 14%, black 86%, transparent)",
        maskImage: "linear-gradient(to bottom, transparent, black 14%, black 86%, transparent)",
      }}
    >
      <div style={{ transform: `translateY(${y}px)` }}>
        {items.map((e, i) => {
          const rowTop = i * ROW + y;
          const past = rowTop + ROW / 2 < nowLine;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", height: ROW }}>
              <div style={{ width: 120, fontFamily: fonts.body, fontSize: 22, color: ed.muted }}>
                día {(i % 30) + 1}
              </div>
              <div
                style={{
                  flex: 1,
                  height: ROW - 16,
                  borderRadius: 18,
                  background: e.c,
                  padding: "0 28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: fonts.body,
                  opacity: checked || !past ? 1 : 0.55,
                }}
              >
                <div>
                  <div style={{ fontSize: 30, fontWeight: 500, color: ed.ink }}>{e.n}</div>
                  <div style={{ fontSize: 22, color: "rgba(13,31,54,0.55)" }}>{e.a}</div>
                </div>
                {checked && (
                  <span
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 99,
                      background: colors.success,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Check size={28} color={colors.white} strokeWidth={3} />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Línea de "hoy" */}
      <div style={{ position: "absolute", top: nowLine, left: 0, right: 0, display: "flex", alignItems: "center" }}>
        <span
          style={{
            padding: "6px 14px",
            borderRadius: 99,
            background: colors.danger,
            color: colors.white,
            fontFamily: fonts.body,
            fontWeight: 700,
            fontSize: 20,
          }}
        >
          hoy
        </span>
        <div style={{ flex: 1, height: 3, background: colors.danger }} />
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

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      display: "inline-block",
      padding: "4px 12px",
      borderRadius: 8,
      background: ed.highlight,
      fontWeight: 700,
      fontSize: 26,
      color: ed.ink,
    }}
  >
    {children}
  </span>
);

const Bullet: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: "flex", gap: 14, fontSize: 27, lineHeight: 1.4, color: colors.ink700, margin: "8px 0 0 6px" }}>
    <span>•</span>
    <span>{children}</span>
  </div>
);

const Entiende: React.FC = () => {
  const frame = useCurrentFrame();
  const swap = tween(frame, [46, 58], [0, 1], easeInOut);
  const analyzing = tween(frame, [26, 34], [0, 1]) * (1 - tween(frame, [56, 62], [0, 1]));
  const groups = [
    { chip: "Comida y delivery", lines: ["Q 1,820 este mes, 18% más que septiembre", "El delivery ya es el 40% de tu comida"] },
    { chip: "Tarjeta de crédito", lines: ["Debes Q 4,300: págala primero (36% anual)"] },
    { chip: "Luz", lines: ["Vence el día 5 · ya está en tus recordatorios"] },
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
                  <Chip>{g.chip}</Chip>
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
  const rows = [
    { l: "Deudas", v: "controladas", c: colors.success },
    { l: "Ahorro", v: "bajo", c: colors.warning },
    { l: "Gastos", v: "altos en comida", c: colors.danger },
  ];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
        <span style={{ ...serif(150), fontVariantNumeric: "tabular-nums" }}>{score}</span>
        <span style={{ fontSize: 28, color: ed.muted }}>/ 100 · salud financiera</span>
      </div>
      {rows.map((r, i) => (
        <Rise key={r.l} delay={10 + i * 5} distance={14}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "18px 0",
              borderTop: `1.5px solid ${ed.line}`,
              fontSize: 28,
            }}
          >
            <span style={{ width: 16, height: 16, borderRadius: 99, background: r.c }} />
            <span style={{ fontWeight: 500 }}>{r.l}</span>
            <span style={{ color: ed.muted }}>{r.v}</span>
          </div>
        </Rise>
      ))}
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
    { n: "Luz", a: "Q 280", d: "vence en 2 días" },
    { n: "Internet", a: "Q 299", d: "vence en 5 días" },
    { n: "Tarjeta", a: "Q 1,200", d: "vence en 9 días" },
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
              gap: 18,
              padding: "18px 0",
              borderBottom: `1.5px solid ${ed.line}`,
              fontSize: 28,
            }}
          >
            <Bell size={28} color={i === 0 ? colors.electric : ed.muted} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{r.n}</div>
              <div style={{ fontSize: 22, color: i === 0 ? colors.danger : ed.muted }}>{r.d}</div>
            </div>
            <span style={{ fontWeight: 700 }}>{r.a}</span>
          </div>
        </Rise>
      ))}
      <div
        style={{
          marginTop: 26,
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 22px",
          borderRadius: 99,
          background: colors.successLight,
          color: colors.success,
          fontSize: 24,
          fontWeight: 700,
          opacity: sent,
          transform: `translateY(${(1 - sent) * 12}px)`,
        }}
      >
        <Check size={22} color={colors.success} strokeWidth={3} /> Te avisamos a tiempo
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
        <div style={{ padding: "16px 22px", borderRadius: 22, borderBottomRightRadius: 6, background: ed.dark, color: colors.white }}>
          ¿Cuánto llevo para el viaje?
        </div>
      </Rise>
      {f > 10 && (
        <div style={{ alignSelf: "flex-start", maxWidth: "86%", display: "flex", gap: 14 }}>
          <Sparkles size={28} color={colors.electric} style={{ marginTop: 6, flexShrink: 0 }} />
          <div style={{ color: colors.ink700 }}>{shown || "…"}</div>
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
          {avatar("Tú", ed.sky)}
          <span style={{ marginLeft: -16 }}>{avatar("A", ed.pink)}</span>
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
  bg: string;
  title: React.ReactNode;
  window: string;
  Body: React.FC<{ f: number }>;
}[] = [
  { bg: ed.mint, title: <>Tu diagnóstico,<br /><Em color={colors.navy}>al instante.</Em></>, window: "Diagnóstico", Body: DiagnosticoBody },
  { bg: ed.sky, title: <>Un plan.</>, window: "Tu plan", Body: PlanBody },
  { bg: ed.pink, title: <>Recordatorios.</>, window: "Pagos del mes", Body: RecordatoriosBody },
  { bg: ed.lavender, title: <>Memoria.</>, window: "Pregúntale a Zafi", Body: MemoriaBody },
  { bg: ed.sand, title: <>En familia,<br /><Em color={colors.navy}>también.</Em></>, window: "Hogar", Body: FamiliaBody },
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
          <AbsoluteFill key={i} style={{ background: p.bg, clipPath: `inset(0 ${wipe}% 0 0)` }} />
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
              ...serif(120),
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
    <Rise style={serif(140)}>Vive tranquilo.</Rise>
    <Rise delay={12} style={{ fontFamily: fonts.body, fontSize: 34, color: colors.electric, marginTop: 30 }}>
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
          padding: "24px 56px",
          borderRadius: 99,
          background: ed.ink,
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
      <Rise delay={34} style={{ fontFamily: fonts.body, fontSize: 32, color: ed.ink, marginTop: 40 }}>
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
    <Scene {...T.tranquilo} bg="#EEF3FF">
      <Tranquilo />
    </Scene>
    <Scene {...T.logo} bg={ed.paper} fadeOut={false}>
      <Logo />
    </Scene>
    {mostrarZonasSeguras && <SafeZoneGuide />}
  </AbsoluteFill>
);
