// C02 · Arma tu plan del mes.
// Pantallas y textos tomados de /plan (PresupuestoView, EditPlanSheet) y del
// flujo "Inicio de mes" (MonthStartSheet) de la app.
import React from "react";
import { useCurrentFrame } from "remotion";
import { colors, fonts } from "../../brand/theme";
import { easeInOut, tween } from "../../components";
import { Appear, CardIn, PopIn, SerieProps, SerieVideo, Tap, v, VideoDef, videoLength } from "./serie";
import tiempos from "./tiempos/c02.json";
import { Bar, Card, CardLabel, EmojiTile, Pill, z } from "./ui";

const money: React.CSSProperties = { fontFamily: fonts.display, fontWeight: 700, color: z.ink };

/* 01 — Tus ingresos */
const Ingresos: React.FC = () => {
  const frame = useCurrentFrame();
  const added = frame >= v(2.3);
  return (
    <div style={{ position: "relative" }}>
      <CardIn at={4}>
        <Card>
          <CardLabel>Plan del mes · octubre</CardLabel>
          <div style={{ fontFamily: fonts.serif, fontSize: 54, color: z.navy, marginBottom: 16 }}>Ingresos</div>
          {added && (
            <Appear at={v(2.3)}>
              <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "16px 0", borderBottom: `2px solid ${z.divider}` }}>
                <EmojiTile emoji="💼" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 30, fontWeight: 600, color: z.ink }}>Salario</div>
                  <div style={{ fontSize: 23, color: z.secondary }}>Fijo · cada mes</div>
                </div>
                <div style={{ ...money, fontSize: 36, color: z.successDark }}>Q 8,500</div>
              </div>
            </Appear>
          )}
          <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                padding: "12px 24px",
                borderRadius: 99,
                background: z.ghost,
                color: z.electricDark,
                fontWeight: 700,
                fontSize: 25,
              }}
            >
              + Agregar ingreso
            </span>
            <PopIn at={v(3.4)}>
              <Pill kind="navy" size={24}>
                📅 Te pagan el 15
              </Pill>
            </PopIn>
          </div>
        </Card>
      </CardIn>
      <Tap at={v(2.05)} x={170} y={added ? 400 : 260} />
    </div>
  );
};

/* 02 — Dale un destino */
const GROUPS = [
  { at: v(1.3), name: "Lo básico", hint: "no puedes dejar de pagarlo", amount: "Q 4,250", pct: 50, color: z.navy },
  { at: v(2.3), name: "Gustos", hint: "podrías recortarlo", amount: "Q 2,550", pct: 30, color: z.electric },
  { at: v(3.24), name: "Para tus metas", hint: "lo apartas cada mes", amount: "Q 1,700", pct: 20, color: z.electricPale },
];

const Destino: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <CardIn at={4} rotate={1.2}>
      <Card>
        <CardLabel>Ingresos del mes · Q 8,500</CardLabel>
        <div style={{ display: "flex", height: 40, borderRadius: 12, overflow: "hidden", background: z.divider, marginBottom: 22 }}>
          {GROUPS.map((g) => (
            <div key={g.name} style={{ width: `${tween(frame, [g.at, g.at + 14], [0, g.pct], easeInOut)}%`, background: g.color }} />
          ))}
        </div>
        {GROUPS.map((g, i) => (
          <Appear key={g.name} at={g.at}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "14px 0", borderBottom: i < 2 ? `2px solid ${z.divider}` : undefined }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: g.color }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 30, fontWeight: 600, color: z.ink }}>{g.name}</div>
                <div style={{ fontSize: 23, color: z.secondary }}>{g.hint}</div>
              </div>
              <div style={{ ...money, fontSize: 32 }}>{g.amount}</div>
            </div>
          </Appear>
        ))}
        <PopIn at={v(5.2)} style={{ marginTop: 20 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 22px",
              borderRadius: 18,
              background: z.successLight,
              color: z.successText,
              fontWeight: 700,
              fontSize: 25,
            }}
          >
            ✓ Todo tiene a dónde ir
          </div>
        </PopIn>
      </Card>
    </CardIn>
  );
};

/* 03 — Ajusta (hoja "Editar plan") */
const Ajusta: React.FC = () => {
  const frame = useCurrentFrame();
  const amount = Math.round(tween(frame, [v(1.0), v(1.9)], [1500, 1800], easeInOut) / 10) * 10;
  const editing = frame >= v(0.9) && frame < v(2.1);
  const fijo = tween(frame, [v(2.95), v(3.15)], [0, 1], easeInOut);
  const split = tween(frame, [v(4.05), v(4.4)], [0, 1], easeInOut);
  return (
    <div style={{ position: "relative" }}>
      <CardIn at={4} rotate={-1}>
        <Card>
          <CardLabel>Editar plan</CardLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 18 }}>
            <EmojiTile emoji="🛒" size={76} />
            <div style={{ fontFamily: fonts.serif, fontSize: 50, color: z.navy }}>Supermercado</div>
          </div>
          <div style={{ fontSize: 23, fontWeight: 600, color: z.secondary, marginBottom: 8 }}>¿Cuánto planeas para esto?</div>
          <div
            style={{
              height: 92,
              borderRadius: 20,
              border: `3px solid ${editing ? z.electric : z.border}`,
              display: "flex",
              alignItems: "center",
              padding: "0 24px",
              ...money,
              fontSize: 52,
              color: z.navy,
            }}
          >
            Q {amount.toLocaleString("en-US")}
          </div>
          {/* Fijo o variable */}
          <div style={{ display: "flex", marginTop: 22, padding: 6, borderRadius: 18, background: "#E7EBF2", position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: 6,
                bottom: 6,
                left: `calc(6px + ${fijo} * (50% - 6px))`,
                width: "calc(50% - 6px)",
                borderRadius: 14,
                background: z.card,
                boxShadow: "0 2px 8px rgba(30,58,95,0.15)",
              }}
            />
            {["Variable", "Fijo"].map((l, i) => (
              <div
                key={l}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "12px 0",
                  fontSize: 25,
                  fontWeight: 700,
                  position: "relative",
                  color: (i === 1 ? fijo > 0.5 : fijo <= 0.5) ? z.navy : z.muted,
                }}
              >
                {l}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 22, color: z.secondary, marginTop: 10, minHeight: 30 }}>
            {fijo > 0.5 ? "Zafi lo aparta antes de calcular lo que puedes gastar al día." : "Aquí es donde puedes ajustar para ahorrar."}
          </div>
          {/* Dividir en partes */}
          <div style={{ marginTop: 14, overflow: "hidden", maxHeight: 40 + split * 150 }}>
            <div style={{ fontSize: 25, fontWeight: 700, color: z.electricDark }}>Dividir en partes {split > 0.5 ? "▾" : "›"}</div>
            {[
              ["Súper", "Q 1,400"],
              ["Mercado", "Q 400"],
            ].map(([n, a]) => (
              <div key={n} style={{ display: "flex", justifyContent: "space-between", fontSize: 26, padding: "12px 0 0 20px", color: z.ink, opacity: split }}>
                <span>· {n}</span>
                <span style={money}>{a}</span>
              </div>
            ))}
          </div>
        </Card>
      </CardIn>
      <Tap at={v(0.6)} x={300} y={300} />
      <Tap at={v(2.85)} x={640} y={445} />
      <Tap at={v(3.95)} x={200} y={545} />
    </div>
  );
};

/* 04 — Empieza el mes → Hoy puedes gastar */
export const EmpiezaMes: React.FC = () => {
  const frame = useCurrentFrame();
  const press = frame >= v(1.8) && frame < v(2.1);
  const amount = Math.round(tween(frame, [v(3.6), v(4.6)], [0, 245]));
  return (
    <div style={{ position: "relative", height: 680 }}>
      <CardIn at={4} rotate={-1.5}>
        <Card>
          <CardLabel>Inicio de mes</CardLabel>
          <div style={{ fontFamily: fonts.serif, fontSize: 52, color: z.navy, marginBottom: 12 }}>Empieza octubre</div>
          {[
            ["🏠", "Renta", "Q 2,500"],
            ["💡", "Luz", "Q 280"],
          ].map(([e, n, a]) => (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 0" }}>
              <EmojiTile emoji={e} size={60} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 27, fontWeight: 600, color: z.ink }}>{n}</div>
                <div style={{ fontSize: 21, color: z.secondary }}>Contado como gastado</div>
              </div>
              <span style={{ ...money, fontSize: 28 }}>{a}</span>
            </div>
          ))}
          <div
            style={{
              marginTop: 14,
              height: 80,
              borderRadius: 18,
              background: z.electric,
              color: colors.white,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: fonts.display,
              fontWeight: 700,
              fontSize: 32,
              transform: `scale(${press ? 0.95 : 1})`,
            }}
          >
            Empezar el mes
          </div>
        </Card>
      </CardIn>
      <div style={{ position: "absolute", top: -40, left: 0, right: 0 }}>
        <PopIn at={v(2.55)} style={{ transformOrigin: "center" }}>
          <div
            style={{
              margin: "0 auto",
              width: "fit-content",
              padding: "16px 26px",
              borderRadius: 18,
              background: z.navy,
              color: colors.white,
              fontWeight: 600,
              fontSize: 25,
              boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
            }}
          >
            ✓ Listo. Apartaste Q 4,200 para tus fijos.
          </div>
        </PopIn>
      </div>
      <div style={{ position: "absolute", top: 330, left: 40, width: 820 }}>
        <CardIn at={v(3.4)} rotate={1.5}>
          <Card width={820} pad={26}>
            <div style={{ background: z.navy, borderRadius: 24, padding: "28px 30px", color: colors.white }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 24, color: z.heroMuted }}>
                <span style={{ width: 12, height: 12, borderRadius: 99, background: z.success }} />
                Vas bien
              </span>
              <div style={{ fontSize: 26, color: z.heroMuted, marginTop: 14 }}>Hoy puedes gastar</div>
              <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 100, lineHeight: 1 }}>Q {amount}</div>
              <div style={{ marginTop: 18 }}>
                <Bar pct={tween(frame, [v(3.6), v(4.6)], [0, 42])} track={z.heroTrack} height={14} />
              </div>
              <div style={{ fontSize: 22, color: z.heroFaint, marginTop: 12 }}>
                Te quedan <b style={{ color: colors.white }}>Q 4,300</b> de Q 8,500
              </div>
            </div>
          </Card>
        </CardIn>
      </div>
      <Tap at={v(1.75)} x={430} y={540} />
    </div>
  );
};

export const C02_DEF: VideoDef = {
  id: "c02",
  tiempos,
  chapters: [
    {
      tone: "light",
      eyebrow: { n: "01", label: "Tus ingresos" },
      headline: ["Primero, ", { t: "lo que entra.", s: "accent" }],
      Body: Ingresos,
      audio: "01",
      sfx: [
        { at: 4, name: "pop", volume: 0.3 },
        { at: v(2.3), name: "pop", volume: 0.35 },
        { at: v(3.4), name: "pop", volume: 0.35 },
      ],
    },
    {
      tone: "navy",
      eyebrow: { n: "02", label: "Dale un destino" },
      headline: ["Cada quetzal ", { t: "con un trabajo.", s: "accent" }],
      Body: Destino,
      audio: "02",
      sfx: [...GROUPS.map((g) => ({ at: g.at, name: "pop" as const, volume: 0.3 })), { at: v(5.2), name: "campanita" as const, volume: 0.25 }],
    },
    {
      tone: "electric",
      eyebrow: { n: "03", label: "Ajusta" },
      headline: ["Toca y ", { t: "ajusta.", s: "accentBox" }],
      Body: Ajusta,
      audio: "03",
      sfx: [
        { at: v(0.6), name: "tic", volume: 0.3 },
        { at: v(2.85), name: "tic", volume: 0.3 },
        { at: v(3.95), name: "pop", volume: 0.3 },
      ],
    },
    {
      tone: "light",
      eyebrow: { n: "04", label: "Empieza el mes" },
      headline: ["Hoy puedes gastar ", { t: "Q 245.", s: "mark" }],
      Body: EmpiezaMes,
      audio: "04",
      sfx: [
        { at: v(1.8), name: "tic", volume: 0.3 },
        { at: v(2.55), name: "pop", volume: 0.35 },
        { at: v(3.4), name: "pop", volume: 0.35 },
      ],
    },
  ],
  outro: {
    headline: ["Planea en minutos.", { br: true }, { t: "Gasta sin culpa.", s: "accent" }],
    audio: "05",
  },
};

export const C02_DURATION = videoLength(C02_DEF);

export const C02PlanDelMes: React.FC<SerieProps> = ({ mostrarZonasSeguras }) => (
  <SerieVideo def={C02_DEF} mostrarZonasSeguras={mostrarZonasSeguras} />
);
