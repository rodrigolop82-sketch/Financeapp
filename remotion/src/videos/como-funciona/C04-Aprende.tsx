// C04 · Aprende.
// Módulos, lecciones y textos de /aprende (contenido real de la app).
import React from "react";
import { useCurrentFrame } from "remotion";
import { Sparkles } from "lucide-react";
import { colors, fonts } from "../../brand/theme";
import { tween } from "../../components";
import { Appear, CardIn, PopIn, SerieProps, SerieVideo, Tap, v, VideoDef, videoLength } from "./serie";
import tiempos from "./tiempos/c04.json";
import { Bar, Card, CardLabel, EmojiTile, Pill, z } from "./ui";

/* 01 — Lecciones cortas */
const Inicio: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <CardIn at={4}>
      <Card>
        <div style={{ fontFamily: fonts.serif, fontSize: 60, color: z.navy }}>Aprende</div>
        <div style={{ fontSize: 25, color: z.secondary, marginBottom: 22 }}>Lecciones de 3 a 5 minutos sobre tu dinero.</div>
        <div style={{ background: z.navy, borderRadius: 24, padding: "26px 28px", color: colors.white }}>
          <div style={{ fontSize: 21, letterSpacing: "0.12em", fontWeight: 700, color: z.heroMuted }}>SIGUE DONDE IBAS</div>
          <div style={{ fontFamily: fonts.serif, fontSize: 40, lineHeight: 1.15, margin: "10px 0 18px" }}>
            Ahorro automático: el truco que realmente funciona
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <Bar pct={tween(frame, [v(0.5), v(2)], [0, 60])} color={z.electricPale} track={z.heroTrack} height={12} />
            </div>
            <span style={{ fontSize: 22, color: z.heroFaint }}>3 de 5</span>
          </div>
        </div>
        <PopIn at={v(2.2)} style={{ marginTop: 20 }}>
          <Pill kind="info" size={26}>
            ⏱ 4 min de lectura
          </Pill>
        </PopIn>
      </Card>
    </CardIn>
  );
};

/* 02 — Los temas */
const MODULES = [
  { at: v(0), e: "💳", n: "Tarjetas de crédito", d: "7 lecciones", premium: false },
  { at: v(1.45), e: "🏦", n: "Deudas y préstamos", d: "7 lecciones", premium: false },
  { at: v(2.28), e: "🐷", n: "Presupuesto y ahorro", d: "5 lecciones", premium: false },
  { at: v(3.28), e: "📈", n: "Inversiones", d: "7 lecciones", premium: true },
  { at: v(4.14), e: "👪", n: "Finanzas familiares", d: "4 lecciones", premium: true },
];

const Temas: React.FC = () => (
  <CardIn at={2} rotate={1.2}>
    <Card pad={32}>
      <CardLabel>Todos los temas</CardLabel>
      {MODULES.map((m, i) => (
        <Appear key={m.n} at={m.at + 2}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "11px 0", borderBottom: i < MODULES.length - 1 ? `2px solid ${z.divider}` : undefined }}>
            <EmojiTile emoji={m.e} size={62} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 28, fontWeight: 600, color: z.ink }}>{m.n}</div>
              <div style={{ fontSize: 21, color: z.secondary }}>{m.d}</div>
            </div>
            {m.premium && <Pill kind="neutral" size={18}>Premium</Pill>}
          </div>
        </Appear>
      ))}
      <PopIn at={v(5.6)} style={{ marginTop: 16 }}>
        <Pill kind="navy" size={24}>
          🇬🇹 Con ejemplos de Guatemala
        </Pill>
      </PopIn>
    </Card>
  </CardIn>
);

/* 03 — Lo más importante */
const Leccion: React.FC = () => {
  const frame = useCurrentFrame();
  const hi = tween(frame, [v(1.2), v(1.6)], [0, 1]);
  return (
    <CardIn at={2} rotate={-1}>
      <Card>
        <CardLabel>Tarjetas de crédito · Lección</CardLabel>
        <div style={{ fontFamily: fonts.serif, fontSize: 50, lineHeight: 1.1, color: z.navy }}>El costo real de pagar solo el mínimo</div>
        <div style={{ fontSize: 25, lineHeight: 1.45, color: z.secondary, margin: "14px 0 18px" }}>
          Con Q 14,000 al 28% anual, pagar solo el mínimo te puede tomar años y miles en intereses.
        </div>
        <div
          style={{
            padding: "20px 24px",
            borderRadius: 20,
            background: z.ghost,
            borderLeft: `8px solid ${z.electric}`,
            fontSize: 26,
            lineHeight: 1.4,
            color: z.navy,
            transform: `scale(${1 + hi * 0.03})`,
            boxShadow: hi > 0 ? `0 0 0 ${hi * 6}px rgba(37,99,235,0.18)` : undefined,
          }}
        >
          <b>Lo más importante:</b> paga siempre más que el mínimo, aunque sean Q 100.
        </div>
        <PopIn at={v(2.6)} style={{ marginTop: 20 }}>
          <Pill kind="ok" size={26}>
            ✓ Lección completada
          </Pill>
        </PopIn>
      </Card>
    </CardIn>
  );
};

/* 04 — Pregúntale a Zafi */
export const Pregunta: React.FC = () => {
  const frame = useCurrentFrame();
  const q = "Leí sobre el pago mínimo, ¿cómo aplica a mi situación?";
  const a = "Con tu Visa de Q 6,400, si pagas Q 300 extra al mes sales 2 años antes.";
  const nq = Math.max(0, Math.min(q.length, Math.floor((frame - v(1.3)) * 1.6)));
  const na = Math.max(0, Math.min(a.length, Math.floor((frame - v(3.7)) * 1.7)));
  return (
    <div style={{ position: "relative" }}>
      <CardIn at={2}>
        <Card>
          <CardLabel>
            <Sparkles size={18} color={z.electric} /> Pregúntale a Zafi
          </CardLabel>
          <div style={{ fontSize: 22, color: z.secondary, marginBottom: 18 }}>Responde con tus números reales, no con consejos genéricos.</div>
          {nq > 0 && (
            <div
              style={{
                marginLeft: "auto",
                width: "fit-content",
                maxWidth: "86%",
                padding: "16px 22px",
                borderRadius: 24,
                borderBottomRightRadius: 6,
                background: z.electric,
                color: colors.white,
                fontSize: 27,
                lineHeight: 1.35,
              }}
            >
              {q.slice(0, nq)}
            </div>
          )}
          {frame >= v(3.5) && (
            <div
              style={{
                marginTop: 16,
                maxWidth: "90%",
                display: "flex",
                gap: 12,
                padding: "16px 22px",
                borderRadius: 24,
                borderBottomLeftRadius: 6,
                background: z.cardAlt,
                border: `2px solid ${z.divider}`,
                fontSize: 27,
                lineHeight: 1.35,
                color: z.ink,
              }}
            >
              <Sparkles size={26} color={z.electric} style={{ flexShrink: 0, marginTop: 4 }} />
              <span>{na > 0 ? a.slice(0, na) : "…"}</span>
            </div>
          )}
        </Card>
      </CardIn>
      <Tap at={v(1.15)} x={300} y={60} />
    </div>
  );
};

export const C04_DEF: VideoDef = {
  id: "c04",
  tiempos,
  chapters: [
    {
      tone: "light",
      eyebrow: { n: "01", label: "Aprende" },
      headline: ["Lecciones de ", { t: "3 a 5 minutos.", s: "mark" }],
      Body: Inicio,
      audio: "01",
      sfx: [
        { at: 4, name: "pop", volume: 0.3 },
        { at: v(2.2), name: "pop", volume: 0.35 },
      ],
    },
    {
      tone: "navy",
      eyebrow: { n: "02", label: "Los temas" },
      headline: ["Pensado ", { t: "para Guatemala.", s: "accent" }],
      Body: Temas,
      audio: "02",
      sfx: [...MODULES.map((m) => ({ at: m.at + 2, name: "pop" as const, volume: 0.25 })), { at: v(5.6), name: "pop" as const, volume: 0.35 }],
    },
    {
      tone: "electric",
      eyebrow: { n: "03", label: "Lo más importante" },
      headline: ["Léelo en 4 minutos. ", { t: "Aplícalo hoy.", s: "accentBox" }],
      headlineSize: 108,
      Body: Leccion,
      audio: "03",
      sfx: [
        { at: v(1.2), name: "pop", volume: 0.3 },
        { at: v(2.6), name: "campanita", volume: 0.3 },
      ],
    },
    {
      tone: "light",
      eyebrow: { n: "04", label: "Aplícalo" },
      headline: ["Y ahora, ", { t: "¿en mi caso?", s: "accent" }],
      Body: Pregunta,
      audio: "04",
      sfx: [
        { at: v(1.15), name: "tic", volume: 0.35 },
        { at: v(3.5), name: "pop", volume: 0.35 },
      ],
    },
  ],
  outro: {
    headline: ["Aprende poco a poco.", { br: true }, { t: "Decide mejor.", s: "accent" }],
    audio: "05",
  },
};

export const C04_DURATION = videoLength(C04_DEF);

export const C04Aprende: React.FC<SerieProps> = ({ mostrarZonasSeguras }) => (
  <SerieVideo def={C04_DEF} mostrarZonasSeguras={mostrarZonasSeguras} />
);
