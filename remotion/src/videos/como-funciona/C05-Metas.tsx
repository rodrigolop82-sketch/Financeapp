// C05 · Metas.
// Pantallas y textos de Metas en la app (GoalForm, AddContributionSheet,
// detalle de meta y metas compartidas del hogar).
import React from "react";
import { useCurrentFrame } from "remotion";
import { colors, fonts } from "../../brand/theme";
import { easeInOut, tween } from "../../components";
import { Appear, CardIn, PopIn, SerieProps, SerieVideo, Tap, v, VideoDef, videoLength } from "./serie";
import tiempos from "./tiempos/c05.json";
import { Bar, Card, CardLabel, EmojiTile, Pill, z } from "./ui";

const money: React.CSSProperties = { fontFamily: fonts.display, fontWeight: 700, color: z.ink };

/* 01 — ¿Para qué quieres ahorrar? */
const TYPES = [
  { e: "🛡️", l: "Fondo de emergencia", at: v(3.0) },
  { e: "✈️", l: "Viaje", at: v(2.0) },
  { e: "🚗", l: "Vehículo", at: v(4.5) },
  { e: "🎓", l: "Educación", at: -1 },
  { e: "📈", l: "Inversión", at: -1 },
  { e: "🎯", l: "Otra meta", at: -1 },
];

const NuevaMeta: React.FC = () => {
  const frame = useCurrentFrame();
  const active = [...TYPES].filter((t) => t.at >= 0 && frame >= t.at).sort((a, b) => b.at - a.at)[0];
  return (
    <CardIn at={4}>
      <Card>
        <CardLabel>Nueva meta</CardLabel>
        <div style={{ fontFamily: fonts.serif, fontSize: 50, color: z.navy, marginBottom: 20 }}>¿Para qué quieres ahorrar?</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {TYPES.map((t) => {
            const sel = active?.l === t.l;
            return (
              <div
                key={t.l}
                style={{
                  padding: "20px 10px",
                  borderRadius: 20,
                  textAlign: "center",
                  border: `3px solid ${sel ? z.electric : z.border}`,
                  background: sel ? z.ghost : z.card,
                  transform: `scale(${sel ? 1.05 : 1})`,
                }}
              >
                <div style={{ fontSize: 48 }}>{t.e}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: z.navy, marginTop: 6, lineHeight: 1.2 }}>{t.l}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </CardIn>
  );
};

/* 02 — Cuándo llegas */
const Cuando: React.FC = () => {
  const frame = useCurrentFrame();
  const meta = Math.round(tween(frame, [v(0.4), v(1.2)], [0, 6000]) / 100) * 100;
  const aporte = Math.round(tween(frame, [v(1.7), v(2.4)], [0, 500]) / 50) * 50;
  const Field: React.FC<{ label: string; value: string; active: boolean }> = ({ label, value, active }) => (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 22, fontWeight: 600, color: z.secondary, marginBottom: 8 }}>{label}</div>
      <div
        style={{
          height: 84,
          borderRadius: 18,
          border: `3px solid ${active ? z.electric : z.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 22px",
          ...money,
          fontSize: 40,
          color: z.navy,
        }}
      >
        {value}
      </div>
    </div>
  );
  return (
    <CardIn at={2} rotate={1.2}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 22 }}>
          <EmojiTile emoji="✈️" size={80} />
          <div>
            <div style={{ fontSize: 22, color: z.secondary }}>Nombre</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: z.ink }}>Viaje a Semuc</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 18 }}>
          <Field label="Meta" value={`Q ${meta.toLocaleString("en-US")}`} active={frame >= v(0.4) && frame < v(1.5)} />
          <Field label="Aporte al mes" value={`Q ${aporte}`} active={frame >= v(1.7) && frame < v(2.8)} />
        </div>
        <PopIn at={v(4.0)} style={{ marginTop: 26 }}>
          <div style={{ padding: "20px 24px", borderRadius: 20, background: z.ghost, fontFamily: fonts.serif, fontSize: 38, color: z.navy, lineHeight: 1.2 }}>
            Con Q 500 al mes, <span style={{ fontStyle: "italic", color: z.electric }}>llegas en 12 meses.</span>
          </div>
        </PopIn>
      </Card>
    </CardIn>
  );
};

/* 03 — Aporta */
const Aporta: React.FC = () => {
  const frame = useCurrentFrame();
  const saved = frame >= v(2.3) ? 3000 : 2500;
  const pct = tween(frame, [v(3.1), v(3.8)], [42, 50], easeInOut);
  return (
    <div style={{ position: "relative" }}>
      <CardIn at={2} rotate={-1.2}>
        <Card>
          <CardLabel>Aportar a Viaje a Semuc</CardLabel>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <span style={{ ...money, fontWeight: 800, fontSize: 84, color: z.navy }}>Q {saved.toLocaleString("en-US")}</span>
            <span style={{ fontSize: 25, color: z.secondary }}>de Q 6,000</span>
          </div>
          <div style={{ margin: "16px 0 24px" }}>
            <Bar pct={pct} height={22} />
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            {["Q 200", "Q 500", "Otro monto"].map((l) => {
              const sel = l === "Q 500" && frame >= v(2.1);
              return (
                <div
                  key={l}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "18px 0",
                    borderRadius: 18,
                    border: `3px solid ${sel ? z.electric : z.border}`,
                    background: sel ? z.electric : z.card,
                    color: sel ? colors.white : z.navy,
                    fontWeight: 700,
                    fontSize: 27,
                  }}
                >
                  {l}
                </div>
              );
            })}
          </div>
        </Card>
      </CardIn>
      <div style={{ position: "absolute", top: -60, left: 0, right: 0 }}>
        <PopIn at={v(2.3)} style={{ transformOrigin: "center" }}>
          <div
            style={{
              margin: "0 auto",
              width: "fit-content",
              padding: "16px 26px",
              borderRadius: 18,
              background: z.navy,
              color: colors.white,
              fontWeight: 600,
              fontSize: 26,
              boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
            }}
          >
            ✓ Aporte guardado · +Q 500
          </div>
        </PopIn>
      </div>
      <Tap at={v(2.0)} x={430} y={400} />
    </div>
  );
};

/* 04 — En familia */
const Familia: React.FC = () => {
  const frame = useCurrentFrame();
  const people = [
    { n: "Tú", amount: "Q 1,800", pct: 60, color: z.electric, at: v(3.15) },
    { n: "Ana", amount: "Q 1,200", pct: 40, color: z.electricPale, at: v(3.6) },
  ];
  return (
    <CardIn at={2}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <CardLabel>Viaje a Semuc</CardLabel>
          <Pill kind="info" size={20}>
            🏠 Es de la casa
          </Pill>
        </div>
        <div style={{ fontSize: 24, color: z.secondary }}>Llevan ahorrado</div>
        <div style={{ ...money, fontWeight: 800, fontSize: 80, color: z.navy, marginBottom: 14 }}>Q 3,000</div>
        <div style={{ display: "flex", height: 26, borderRadius: 99, overflow: "hidden", background: z.divider, marginBottom: 22 }}>
          {people.map((p) => (
            <div key={p.n} style={{ width: `${tween(frame, [p.at, p.at + 12], [0, p.pct / 2], easeInOut)}%`, background: p.color }} />
          ))}
        </div>
        {people.map((p) => (
          <Appear key={p.n} at={p.at}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "10px 0" }}>
              <span
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 99,
                  background: p.color,
                  color: colors.white,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 24,
                }}
              >
                {p.n === "Tú" ? "Tú" : "A"}
              </span>
              <span style={{ flex: 1, fontSize: 29, fontWeight: 600, color: z.ink }}>{p.n}</span>
              <span style={{ ...money, fontSize: 32 }}>{p.amount}</span>
            </div>
          </Appear>
        ))}
        <div style={{ fontSize: 22, color: z.secondary, marginTop: 8 }}>Los dos la ven y aportan, cada aporte con su nombre.</div>
      </Card>
    </CardIn>
  );
};

export const C05_DEF: VideoDef = {
  id: "c05",
  tiempos,
  chapters: [
    {
      tone: "light",
      eyebrow: { n: "01", label: "Tu meta" },
      headline: ["¿Para qué ", { t: "quieres ahorrar?", s: "accent" }],
      Body: NuevaMeta,
      audio: "01",
      sfx: [{ at: 4, name: "pop", volume: 0.3 }, ...TYPES.filter((t) => t.at >= 0).map((t) => ({ at: t.at, name: "tic" as const, volume: 0.35 }))],
    },
    {
      tone: "navy",
      eyebrow: { n: "02", label: "Cuándo llegas" },
      headline: ["Zafi calcula ", { t: "cuándo llegas.", s: "accent" }],
      Body: Cuando,
      audio: "02",
      sfx: [
        { at: 2, name: "pop", volume: 0.3 },
        { at: v(4.0), name: "pop", volume: 0.4 },
      ],
    },
    {
      tone: "electric",
      eyebrow: { n: "03", label: "Aporta" },
      headline: ["Cada aporte ", { t: "cuenta.", s: "accentBox" }],
      Body: Aporta,
      audio: "03",
      sfx: [
        { at: v(2.0), name: "tic", volume: 0.35 },
        { at: v(2.3), name: "campanita", volume: 0.3 },
      ],
    },
    {
      tone: "light",
      eyebrow: { n: "04", label: "En familia" },
      headline: ["Metas ", { t: "compartidas.", s: "mark" }],
      Body: Familia,
      audio: "04",
      sfx: [
        { at: 2, name: "pop", volume: 0.3 },
        { at: v(3.15), name: "pop", volume: 0.3 },
        { at: v(3.6), name: "pop", volume: 0.3 },
      ],
    },
  ],
  outro: {
    headline: ["Una meta clara", { br: true }, { t: "se cumple.", s: "accent" }],
    audio: "05",
  },
};

export const C05_DURATION = videoLength(C05_DEF);

export const C05Metas: React.FC<SerieProps> = ({ mostrarZonasSeguras }) => <SerieVideo def={C05_DEF} mostrarZonasSeguras={mostrarZonasSeguras} />;
