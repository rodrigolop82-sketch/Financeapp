// C01 · Empieza: registro y diagnóstico.
// Pantallas y textos tomados de /registro y /onboarding de la app.
import React from "react";
import { useCurrentFrame } from "remotion";
import { colors, fonts } from "../../brand/theme";
import { tween } from "../../components";
import { Appear, CardIn, PopIn, SerieProps, SerieVideo, v, VideoDef, videoLength } from "./serie";
import tiempos from "./tiempos/c01.json";
import { Bar, Card, CardLabel, EmojiTile, Pill, ScoreRing, z } from "./ui";

/* 01 — Crea tu cuenta */
const Field: React.FC<{ label: string; value: string; start: number; active?: boolean }> = ({ label, value, start }) => {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.min(value.length, Math.floor((frame - start) * 1.4)));
  const typing = n > 0 && n < value.length;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 22, fontWeight: 600, color: z.secondary, marginBottom: 8 }}>{label}</div>
      <div
        style={{
          height: 74,
          borderRadius: 18,
          border: `3px solid ${typing ? z.electric : z.border}`,
          padding: "0 22px",
          display: "flex",
          alignItems: "center",
          fontSize: 30,
          color: z.ink,
        }}
      >
        {value.slice(0, n)}
        {typing && <span style={{ color: z.electric }}>|</span>}
      </div>
    </div>
  );
};

const Registro: React.FC = () => {
  const frame = useCurrentFrame();
  const press = tween(frame, [v(3.5), v(3.5) + 4], [0, 1]) * (1 - tween(frame, [v(3.5) + 4, v(3.5) + 10], [0, 1]));
  const done = frame > v(3.5) + 6;
  return (
    <CardIn at={6}>
      <Card>
        <CardLabel>Registro · gratis</CardLabel>
        <div style={{ fontFamily: fonts.serif, fontSize: 60, color: z.navy, lineHeight: 1.1 }}>Crea tu cuenta</div>
        <div style={{ fontSize: 25, color: z.secondary, margin: "6px 0 24px" }}>Gratis. Tu dinero en orden en 5 minutos.</div>
        <Field label="Tu nombre" value="Andrea" start={v(1.7)} />
        <Field label="Correo" value="andrea@correo.com" start={v(2.3)} />
        <div
          style={{
            marginTop: 8,
            height: 84,
            borderRadius: 18,
            background: done ? z.success : z.electric,
            color: colors.white,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 34,
            transform: `scale(${1 - press * 0.05})`,
          }}
        >
          {done ? "✓ Cuenta creada" : "Crear cuenta"}
        </div>
      </Card>
    </CardIn>
  );
};

/* 02 — Cuéntale a Zafi: preguntas que se apilan */
const QUESTIONS: { at: number; paso: number; node: React.ReactNode }[] = [
  {
    at: v(2.9),
    paso: 2,
    node: (
      <>
        <div style={{ fontFamily: fonts.serif, fontSize: 44, color: z.navy, marginBottom: 18 }}>¿Cómo administras tus finanzas?</div>
        <div style={{ display: "flex", gap: 12 }}>
          {[
            ["🙋", "Individual", false],
            ["💑", "En pareja", true],
            ["👪", "Familia", false],
          ].map(([e, l, sel]) => (
            <div
              key={l as string}
              style={{
                flex: 1,
                padding: "18px 10px",
                borderRadius: 18,
                textAlign: "center",
                border: `3px solid ${sel ? z.electric : z.border}`,
                background: sel ? z.ghost : z.card,
                fontSize: 24,
                fontWeight: 600,
                color: z.navy,
              }}
            >
              <div style={{ fontSize: 40 }}>{e}</div>
              {l}
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    at: v(5.7),
    paso: 3,
    node: (
      <>
        <div style={{ fontFamily: fonts.serif, fontSize: 44, color: z.navy }}>¿Cuál es tu ingreso mensual?</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 10 }}>
          <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 96, color: z.navy }}>Q 8,500</span>
          <Pill kind="info">Fijo</Pill>
        </div>
      </>
    ),
  },
  {
    at: v(6.95),
    paso: 4,
    node: (
      <>
        <div style={{ fontFamily: fonts.serif, fontSize: 44, color: z.navy, marginBottom: 8 }}>Tus gastos fijos</div>
        {[
          ["🏠", "Vivienda", "Q 2,500"],
          ["🛒", "Alimentación", "Q 1,800"],
        ].map(([e, n, a]) => (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 0", fontSize: 28, color: z.ink }}>
            <EmojiTile emoji={e} size={56} />
            <span style={{ flex: 1, fontWeight: 600 }}>{n}</span>
            <span style={{ fontFamily: fonts.display, fontWeight: 700 }}>{a}</span>
          </div>
        ))}
      </>
    ),
  },
  {
    at: v(8.4),
    paso: 5,
    node: (
      <>
        <div style={{ fontFamily: fonts.serif, fontSize: 44, color: z.navy, marginBottom: 8 }}>¿Tienes deudas?</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, color: z.ink }}>
          <EmojiTile emoji="💳" size={56} />
          <span style={{ flex: 1, fontWeight: 600 }}>Tarjeta Visa</span>
          <span style={{ fontFamily: fonts.display, fontWeight: 700 }}>Q 6,400</span>
        </div>
      </>
    ),
  },
  {
    at: v(9.25),
    paso: 6,
    node: (
      <>
        <div style={{ fontFamily: fonts.serif, fontSize: 44, color: z.navy, marginBottom: 8 }}>¿Tienes ahorros?</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, color: z.ink }}>
          <EmojiTile emoji="🐷" size={56} />
          <span style={{ flex: 1, fontWeight: 600 }}>Disponible ya</span>
          <span style={{ fontFamily: fonts.display, fontWeight: 700 }}>Q 3,000</span>
        </div>
      </>
    ),
  },
];

const Preguntas: React.FC = () => {
  const frame = useCurrentFrame();
  const current = QUESTIONS.filter((q) => frame >= q.at).length;
  const paso = current === 0 ? 1 : QUESTIONS[current - 1].paso;
  const pct = tween(frame, [0, QUESTIONS[QUESTIONS.length - 1].at + 10], [10, 66]);
  return (
    <div>
      <Appear at={4}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 40 }}>
          <span style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 26, color: z.heroMuted, whiteSpace: "nowrap" }}>
            Paso {paso} de 9
          </span>
          <div style={{ flex: 1 }}>
            <Bar pct={pct} color={z.electricPale} track={z.heroTrack} height={14} />
          </div>
        </div>
      </Appear>
      <div style={{ position: "relative", height: 520, marginTop: 80 }}>
        {QUESTIONS.map((q, i) => {
          if (frame < q.at - 2) return null;
          const depth = current - 1 - i; // 0 = la de arriba
          if (depth > 2) return null;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                transform: `translateY(${-depth * 30}px) scale(${1 - depth * 0.05})`,
                transformOrigin: "top center",
                zIndex: 10 + i,
              }}
            >
              <CardIn at={q.at} rotate={i % 2 === 0 ? -1.5 : 1.5}>
                {/* Las tarjetas de atrás quedan como un mazo limpio, sin texto */}
                <Card style={{ minHeight: 330, background: depth > 0 ? (depth === 1 ? "#E7EBF2" : "#CBD8E8") : z.card }}>
                  <div style={{ opacity: depth > 0 ? 0 : 1 }}>{q.node}</div>
                </Card>
              </CardIn>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* 03 — Tu diagnóstico */
const PARTS: [string, number][] = [
  ["💰 Ahorro", 11],
  ["💳 Deuda", 16],
  ["🛡️ Fondo de emergencia", 8],
  ["📊 Gasto del mes", 15],
  ["📈 Estabilidad", 18],
];

export const Diagnostico: React.FC = () => {
  const frame = useCurrentFrame();
  const score = tween(frame, [v(2.3), v(3.3)], [0, 68]);
  return (
    <CardIn at={4} rotate={-1.5}>
      <Card>
        <CardLabel dot={z.success}>Tu salud financiera</CardLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <ScoreRing value={score} size={210} />
          <div>
            <PopIn at={v(3.35)}>
              <Pill kind="ok" size={30}>
                💪 Saludable
              </Pill>
            </PopIn>
            <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: 30, color: z.secondary, marginTop: 14 }}>
              Se actualiza sola con lo que registras.
            </div>
          </div>
        </div>
        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          {PARTS.map(([label, pts], i) => {
            const fill = tween(frame, [v(3.6) + i * 4, v(3.6) + i * 4 + 14], [0, (pts / 20) * 100]);
            const best = label.includes("Deuda") || label.includes("Estabilidad");
            const worst = label.includes("Fondo");
            const hi = best ? tween(frame, [v(3.9), v(4.2)], [0, 1]) : worst ? tween(frame, [v(5.15), v(5.45)], [0, 1]) : 0;
            const color = best ? z.success : worst ? z.electricPale : z.electric;
            return (
              <div key={label} style={{ padding: "4px 10px", margin: "0 -10px", borderRadius: 12, background: `rgba(${best ? "34,197,94" : "96,165,250"},${hi * 0.14})` }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, fontWeight: 600, color: z.ink, marginBottom: 6 }}>
                  <span>{label}</span>
                  <span style={{ fontFamily: fonts.display }}>
                    {hi > 0.5 && (best ? "↑ " : "↓ ")}
                    {pts}/20
                  </span>
                </div>
                <Bar pct={fill} color={color} height={12} />
              </div>
            );
          })}
        </div>
      </Card>
    </CardIn>
  );
};

/* 04 — Tu plan */
const STEPS: [string, "alta" | "media"][] = [
  ["Registra todos tus gastos esta semana", "alta"],
  ["Empieza tu fondo de emergencia", "alta"],
  ["Paga al menos el mínimo de tus deudas", "media"],
];

const Plan: React.FC = () => (
  <div style={{ position: "relative", height: 660 }}>
    <CardIn at={2} rotate={-1}>
      <Card>
        <CardLabel>Tu plan de acción · octubre</CardLabel>
        {STEPS.map(([t, p], i) => (
          <Appear key={t} at={v(0.3) + i * 8}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "14px 0", borderBottom: i < 2 ? `2px solid ${z.divider}` : undefined }}>
              <span
                style={{
                  width: 50,
                  height: 50,
                  minWidth: 50,
                  borderRadius: 99,
                  background: z.navy,
                  color: colors.white,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: fonts.display,
                  fontWeight: 700,
                  fontSize: 26,
                }}
              >
                {i + 1}
              </span>
              <span style={{ flex: 1, fontSize: 27, fontWeight: 600, color: z.ink, lineHeight: 1.25 }}>{t}</span>
              <Pill kind={p === "alta" ? "info" : "neutral"} size={19}>
                Prioridad {p}
              </Pill>
            </div>
          </Appear>
        ))}
      </Card>
    </CardIn>
    <div style={{ position: "absolute", top: 370, left: 120, width: 700 }}>
      <CardIn at={v(1.75)} rotate={2}>
        <Card width={700} pad={32}>
          <CardLabel dot={z.success}>Presupuesto listo</CardLabel>
          <div style={{ display: "flex", height: 34, borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
            <div style={{ width: "50%", background: z.navy }} />
            <div style={{ width: "30%", background: z.electric }} />
            <div style={{ width: "20%", background: z.electricPale }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 23, fontWeight: 600, color: z.secondary }}>
            <span>Lo básico 50%</span>
            <span>Gustos 30%</span>
            <span>Metas 20%</span>
          </div>
        </Card>
      </CardIn>
    </div>
    <div style={{ position: "absolute", top: 620, left: 10 }}>
      <PopIn at={v(3.75)}>
        <Pill kind="navy" size={26}>
          🔒 Encriptación activa · solo tú lo ves
        </Pill>
      </PopIn>
    </div>
  </div>
);

export const C01_DEF: VideoDef = {
  id: "c01",
  tiempos,
  chapters: [
    {
      tone: "light",
      eyebrow: { n: "01", label: "Empieza" },
      headline: ["Crea tu cuenta en ", { t: "1 minuto.", s: "mark" }],
      Body: Registro,
      audio: "01",
      sfx: [
        { at: 6, name: "pop", volume: 0.3 },
        { at: v(3.5), name: "pop", volume: 0.4 },
      ],
    },
    {
      tone: "navy",
      eyebrow: { n: "02", label: "Cuéntale a Zafi" },
      headline: ["5 minutos. ", { br: true }, { t: "Cero juicios.", s: "accent" }],
      Body: Preguntas,
      audio: "02",
      sfx: QUESTIONS.map((q) => ({ at: q.at, name: "pop" as const, volume: 0.3 })),
    },
    {
      tone: "electric",
      eyebrow: { n: "03", label: "Tu diagnóstico" },
      headline: ["Tu salud financiera, ", { t: "en un número.", s: "accentBox" }],
      headlineSize: 112,
      Body: Diagnostico,
      audio: "03",
      sfx: [
        { at: 4, name: "pop", volume: 0.3 },
        { at: v(3.35), name: "pop", volume: 0.4 },
      ],
    },
    {
      tone: "light",
      eyebrow: { n: "04", label: "Tu plan" },
      headline: ["Un plan ", { t: "para este mes.", s: "accent" }],
      Body: Plan,
      audio: "04",
      sfx: [
        { at: 2, name: "pop", volume: 0.3 },
        { at: v(1.75), name: "pop", volume: 0.35 },
        { at: v(3.75), name: "pop", volume: 0.35 },
      ],
    },
  ],
  outro: {
    headline: ["Un minuto para entrar.", { br: true }, { t: "Cinco para entenderte.", s: "accent" }],
    audio: "05",
  },
};

export const C01_DURATION = videoLength(C01_DEF);

export const C01Empieza: React.FC<SerieProps> = ({ mostrarZonasSeguras }) => (
  <SerieVideo def={C01_DEF} mostrarZonasSeguras={mostrarZonasSeguras} />
);
