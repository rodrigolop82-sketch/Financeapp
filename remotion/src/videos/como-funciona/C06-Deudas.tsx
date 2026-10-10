// C06 · Deudas.
// Pantallas y textos de Deudas en la app (DeudasView y el simulador
// "Cómo salir más rápido" con Bola de nieve y Avalancha).
import React from "react";
import { useCurrentFrame } from "remotion";
import { colors, fonts } from "../../brand/theme";
import { easeInOut, tween } from "../../components";
import { Appear, CardIn, PopIn, SerieProps, SerieVideo, v, VideoDef, videoLength } from "./serie";
import tiempos from "./tiempos/c06.json";
import { Bar, Card, CardLabel, EmojiTile, Pill, z } from "./ui";

const money: React.CSSProperties = { fontFamily: fonts.display, fontWeight: 700, color: z.ink };

/* 01 — Todo en un lugar */
const DEBTS = [
  { at: v(0.3), e: "💳", n: "Tarjeta Visa", t: "Tarjeta · 28% anual", a: "Q 6,400" },
  { at: v(0.9), e: "🏦", n: "Préstamo personal", t: "Préstamo · 18% anual", a: "Q 9,500" },
  { at: v(1.4), e: "🤝", n: "Préstamo del tío", t: "Informal · sin interés", a: "Q 2,500" },
];

const Total: React.FC = () => {
  const frame = useCurrentFrame();
  const total = Math.round(tween(frame, [v(3.2), v(4.2)], [0, 18400], easeInOut) / 100) * 100;
  return (
    <CardIn at={2}>
      <Card pad={30}>
        <div style={{ background: z.navy, borderRadius: 24, padding: "26px 30px", color: colors.white, marginBottom: 14 }}>
          <div style={{ fontSize: 25, color: z.heroMuted }}>Debes en total</div>
          <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 92, lineHeight: 1.05 }}>Q {total.toLocaleString("en-US")}</div>
          <PopIn at={v(4.0)} style={{ marginTop: 8 }}>
            <span style={{ fontSize: 23, color: z.heroFaint }}>3 deudas · libre en 4 años pagando solo mínimos</span>
          </PopIn>
        </div>
        {DEBTS.map((d, i) => (
          <Appear key={d.n} at={d.at}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "12px 4px", borderBottom: i < DEBTS.length - 1 ? `2px solid ${z.divider}` : undefined }}>
              <EmojiTile emoji={d.e} size={64} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: z.ink }}>{d.n}</div>
                <div style={{ fontSize: 21, color: z.secondary }}>{d.t}</div>
              </div>
              <span style={{ ...money, fontSize: 30 }}>{d.a}</span>
            </div>
          </Appear>
        ))}
      </Card>
    </CardIn>
  );
};

/* 02 — La trampa del mínimo */
const Trampa: React.FC = () => {
  const frame = useCurrentFrame();
  const warn = tween(frame, [v(2.0), v(2.4)], [0, 1]);
  return (
    <CardIn at={2} rotate={1.2}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 20 }}>
          <EmojiTile emoji="💳" size={76} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: z.ink }}>Tarjeta Visa</div>
            <div style={{ fontSize: 23, color: z.secondary }}>Saldo Q 6,400 · 28% anual</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {[
            { l: "Pago mínimo", a: "Q 120", sub: "al mes" },
            { l: "Interés al mes", a: "Q 149", sub: "lo que crece" },
          ].map((b, i) => (
            <div key={b.l} style={{ flex: 1, padding: "18px 20px", borderRadius: 20, background: z.cardAlt, border: `2px solid ${i === 1 && warn > 0.5 ? z.navy : z.divider}` }}>
              <div style={{ fontSize: 22, color: z.secondary }}>{b.l}</div>
              <div style={{ ...money, fontSize: 48, color: z.navy }}>{b.a}</div>
              <div style={{ fontSize: 20, color: z.muted }}>{b.sub}</div>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 22,
            padding: "20px 24px",
            borderRadius: 20,
            background: z.navy,
            color: colors.white,
            fontSize: 26,
            lineHeight: 1.4,
            opacity: warn,
            transform: `translateY(${(1 - warn) * 20}px)`,
          }}
        >
          ⚠️ El pago mínimo no cubre los intereses del mes. Esta deuda va a crecer si no pagas más.
        </div>
      </Card>
    </CardIn>
  );
};

/* 03 — Bola de nieve VS Avalancha */
const Strategy: React.FC<{ at: number; title: string; line: string; rule: string; color: string; rotate: number }> = ({
  at,
  title,
  line,
  rule,
  color,
  rotate,
}) => (
  <CardIn at={at} rotate={rotate}>
    <Card width={390} pad={30}>
      <CardLabel dot={color}>Estrategia</CardLabel>
      <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 46, lineHeight: 1.05, color: z.navy }}>{title}</div>
      <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: 30, color: z.secondary, margin: "12px 0 20px", lineHeight: 1.15 }}>{line}</div>
      <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "0.1em", color: z.muted }}>PAGAS PRIMERO</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: z.ink, margin: "6px 0 18px" }}>{rule}</div>
      <Bar pct={title === "Avalancha" ? 85 : 60} color={color} />
    </Card>
  </CardIn>
);

const Estrategia: React.FC = () => (
  <div style={{ position: "relative", display: "flex", gap: 40, alignItems: "flex-start" }}>
    <Strategy at={v(1.55)} title="Bola de nieve" line="Ganas rápido y te motiva" rule="La deuda más pequeña" color={z.electricPale} rotate={-2.5} />
    <div style={{ marginTop: 50 }}>
      <Strategy at={v(4.1)} title="Avalancha" line="Pagas menos en total" rule="La de más interés" color={z.navy} rotate={2} />
    </div>
    <div style={{ position: "absolute", left: 390 - 28, top: 190 }}>
      <PopIn at={v(3.9)} style={{ transformOrigin: "center" }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 99,
            background: colors.white,
            border: `4px solid ${z.navy}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 34,
            color: z.navy,
          }}
        >
          VS
        </div>
      </PopIn>
    </div>
  </div>
);

/* 04 — Libre antes */
const Libre: React.FC = () => {
  const frame = useCurrentFrame();
  const rows = [
    { l: "Solo mínimos", m: 48, color: z.muted },
    { l: "Con Q 500 extra", m: 26, color: z.electric },
  ];
  return (
    <CardIn at={2} rotate={-1}>
      <Card>
        <CardLabel>Cómo salir más rápido</CardLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <span style={{ fontSize: 25, fontWeight: 600, color: z.secondary }}>Pago extra al mes</span>
          <span style={{ ...money, fontSize: 40, color: z.navy, padding: "8px 20px", borderRadius: 16, border: `3px solid ${frame < v(1.6) ? z.electric : z.border}` }}>
            Q {Math.round(tween(frame, [v(0.6), v(1.3)], [0, 500]) / 50) * 50}
          </span>
        </div>
        {rows.map((r, i) => (
          <div key={r.l} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, fontWeight: 600, color: z.ink, marginBottom: 8 }}>
              <span>{r.l}</span>
              <span style={money}>{Math.round(tween(frame, [v(1.8) + i * 6, v(2.8) + i * 6], [0, r.m]))} meses</span>
            </div>
            <Bar pct={tween(frame, [v(1.8) + i * 6, v(2.8) + i * 6], [0, (r.m / 48) * 100], easeInOut)} color={r.color} height={20} />
          </div>
        ))}
        <PopIn at={v(3.75)} style={{ marginTop: 10 }}>
          <Pill kind="ok" size={28}>
            Ahorras Q 6,300 en intereses
          </Pill>
        </PopIn>
      </Card>
    </CardIn>
  );
};

export const C06_DEF: VideoDef = {
  id: "c06",
  tiempos,
  chapters: [
    {
      tone: "light",
      eyebrow: { n: "01", label: "Todo en un lugar" },
      headline: ["Cuánto debes, ", { t: "de verdad.", s: "accent" }],
      Body: Total,
      audio: "01",
      sfx: [...DEBTS.map((d) => ({ at: d.at, name: "pop" as const, volume: 0.25 })), { at: v(4.0), name: "pop" as const, volume: 0.35 }],
    },
    {
      tone: "navy",
      eyebrow: { n: "02", label: "La trampa" },
      headline: ["El mínimo ", { t: "no alcanza.", s: "mark" }],
      Body: Trampa,
      audio: "02",
      sfx: [
        { at: 2, name: "pop", volume: 0.3 },
        { at: v(2.0), name: "pop", volume: 0.4 },
      ],
    },
    {
      tone: "electric",
      eyebrow: { n: "03", label: "Tu estrategia" },
      headline: [{ t: "Bola de nieve", s: "mark" }, { br: true }, "o ", { t: "avalancha?", s: "accentBox" }],
      headlineSize: 112,
      Body: Estrategia,
      audio: "03",
      sfx: [
        { at: v(1.55), name: "pop", volume: 0.35 },
        { at: v(3.9), name: "pop", volume: 0.4 },
        { at: v(4.1), name: "pop", volume: 0.35 },
      ],
    },
    {
      tone: "light",
      eyebrow: { n: "04", label: "Libre" },
      headline: ["Libre ", { t: "22 meses antes.", s: "accent" }],
      Body: Libre,
      audio: "04",
      sfx: [
        { at: 2, name: "pop", volume: 0.3 },
        { at: v(3.75), name: "campanita", volume: 0.3 },
      ],
    },
  ],
  outro: {
    headline: ["Sal de deudas", { br: true }, { t: "con un plan.", s: "accent" }],
    audio: "05",
  },
};

export const C06_DURATION = videoLength(C06_DEF);

export const C06Deudas: React.FC<SerieProps> = ({ mostrarZonasSeguras }) => <SerieVideo def={C06_DEF} mostrarZonasSeguras={mostrarZonasSeguras} />;
