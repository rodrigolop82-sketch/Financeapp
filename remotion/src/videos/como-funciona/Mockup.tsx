// Mockup estático de la serie: un cuadro clave de cada video + hoja de estilo.
// Cada frame de esta composición es una pantalla distinta (render con `still`).
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Mic } from "lucide-react";
import { Wordmark } from "../../brand/Wordmark";
import { colors, fonts } from "../../brand/theme";
import { Accent, Bar, Card, CardLabel, ChapterBackground, ChapterLayout, EmojiTile, Legend, Mark, Pill, TxRow, z } from "./ui";

export const MOCKUP_FRAMES = 8;

/* C01 · 03 — Tu diagnóstico (fondo azul eléctrico) */
const ScoreRing: React.FC<{ value: number; size?: number }> = ({ value, size = 230 }) => {
  const r = size / 2 - 18;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={z.divider} strokeWidth={22} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={z.success}
        strokeWidth={22}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fontFamily={fonts.display} fontWeight={800} fontSize={76} fill={z.navy}>
        {value}
      </text>
    </svg>
  );
};

const C01: React.FC = () => (
  <ChapterLayout
    tone="electric"
    eyebrow={{ n: "03", label: "Tu diagnóstico" }}
    headline={
      <>
        Tu salud financiera, <Accent tone="electric" boxed>en un número.</Accent>
      </>
    }
  >
    <Card rotate={-1.5}>
      <CardLabel dot={z.success}>Salud financiera</CardLabel>
      <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
        <ScoreRing value={68} />
        <div>
          <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 52, color: z.navy }}>Saludable</div>
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: 32, color: z.secondary, marginTop: 6 }}>
            Se actualiza sola con lo que registras.
          </div>
        </div>
      </div>
      <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 16 }}>
        {[
          ["💰 Ahorro", 55],
          ["💳 Deuda", 80],
          ["🛡️ Fondo de emergencia", 40],
          ["📊 Gasto del mes", 75],
        ].map(([l, v]) => (
          <div key={l as string}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 25, fontWeight: 600, color: z.ink, marginBottom: 8 }}>
              <span>{l}</span>
              <span style={{ fontFamily: fonts.display }}>{Math.round((v as number) / 5)}/20</span>
            </div>
            <Bar pct={v as number} />
          </div>
        ))}
      </div>
    </Card>
  </ChapterLayout>
);

/* C02 · 04 — Empieza el mes (fondo claro) */
const C02: React.FC = () => (
  <ChapterLayout
    tone="light"
    eyebrow={{ n: "04", label: "Empieza el mes" }}
    headline={
      <>
        Hoy puedes gastar <Mark tone="light">Q 245.</Mark>
      </>
    }
    sub="Tus fijos ya están apartados."
  >
    <Card rotate={1.2} pad={30}>
      <div style={{ background: z.navy, borderRadius: 24, padding: "30px 32px", color: colors.white }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 24, color: z.heroMuted }}>
            <span style={{ width: 12, height: 12, borderRadius: 99, background: z.success }} />
            Vas bien
          </span>
          <span style={{ fontSize: 22, color: z.heroFaint }}>12 días restantes</span>
        </div>
        <div style={{ fontSize: 26, color: z.heroMuted, marginTop: 18 }}>Hoy puedes gastar</div>
        <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 92, lineHeight: 1 }}>Q 245</div>
        <div style={{ marginTop: 20 }}>
          <Bar pct={58} track={z.heroTrack} height={14} />
        </div>
        <div style={{ fontSize: 22, color: z.heroFaint, marginTop: 12 }}>
          Te quedan <b style={{ color: colors.white }}>Q 2,940</b> de Q 8,500
        </div>
      </div>
      <div
        style={{
          marginTop: 22,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "18px 22px",
          borderRadius: 20,
          background: z.successLight,
          color: z.successText,
          fontSize: 25,
          fontWeight: 600,
        }}
      >
        ✓ Listo. Apartaste Q 4,200 para tus fijos.
      </div>
    </Card>
  </ChapterLayout>
);

/* C03 · 02 — Díctalo (fondo navy) */
const C03: React.FC = () => (
  <ChapterLayout
    tone="navy"
    eyebrow={{ n: "02", label: "Díctalo" }}
    headline={
      <>
        O solo <Mark tone="navy">dilo.</Mark>
      </>
    }
    sub="Como se lo dirías a alguien."
  >
    <Card rotate={-1.2}>
      <CardLabel>Cuéntame tu gasto</CardLabel>
      <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
        <span
          style={{
            width: 110,
            height: 110,
            borderRadius: 99,
            background: z.electric,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 0 14px ${z.ghost}`,
          }}
        >
          <Mic size={54} color={colors.white} />
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {[30, 60, 90, 50, 75, 40, 85, 55, 30, 65, 45].map((h, i) => (
            <span key={i} style={{ width: 12, height: h, borderRadius: 9, background: z.electricPale }} />
          ))}
        </div>
      </div>
      <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: 40, color: z.navy, margin: "28px 0 10px" }}>
        “gasté 200 en el súper y 38 de uber”
      </div>
      <TxRow emoji="🛒" name="Súper" sub="Supermercado · hoy" amount="Q 200" />
      <TxRow emoji="🚕" name="Uber" sub="Transporte · hoy" amount="Q 38" last />
    </Card>
  </ChapterLayout>
);

/* C04 · 03 — Lo más importante (fondo claro) */
const C04: React.FC = () => (
  <ChapterLayout
    tone="light"
    eyebrow={{ n: "03", label: "Lo más importante" }}
    headline={
      <>
        Léelo en 4 minutos. <Accent tone="light">Aplícalo hoy.</Accent>
      </>
    }
  >
    <Card rotate={1}>
      <CardLabel>Tarjetas de crédito · Lección 2</CardLabel>
      <div style={{ fontFamily: fonts.serif, fontSize: 52, lineHeight: 1.1, color: z.navy }}>El costo real de pagar solo el mínimo</div>
      <div style={{ fontSize: 26, lineHeight: 1.45, color: z.secondary, marginTop: 18 }}>
        Con Q 14,000 al 28% anual, pagando solo el mínimo tardarías años en salir.
      </div>
      <div
        style={{
          marginTop: 24,
          padding: "22px 24px",
          borderRadius: 20,
          background: z.ghost,
          borderLeft: `8px solid ${z.electric}`,
          fontSize: 26,
          lineHeight: 1.4,
          color: z.navy,
        }}
      >
        <b>Lo más importante:</b> paga siempre más que el mínimo, aunque sean Q 100.
      </div>
      <div style={{ marginTop: 24 }}>
        <Pill kind="ok">✓ Lección completada</Pill>
      </div>
    </Card>
  </ChapterLayout>
);

/* C05 · 02 — Cuándo llegas (fondo navy) */
const C05: React.FC = () => (
  <ChapterLayout
    tone="navy"
    eyebrow={{ n: "02", label: "Cuándo llegas" }}
    headline={
      <>
        Zafi calcula <Accent tone="navy">cuándo llegas.</Accent>
      </>
    }
    footer={<Legend tone="navy" items={[{ color: z.electricPale, label: "Ahorrado" }, { color: z.heroTrack, label: "Te falta" }]} />}
  >
    <Card rotate={-1}>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <EmojiTile emoji="✈️" size={84} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: z.ink }}>Viaje a Semuc</div>
          <div style={{ fontSize: 24, color: z.secondary }}>Meta Q 6,000 · Q 500 al mes</div>
        </div>
        <Pill kind="info">En curso</Pill>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 30 }}>
        <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 80, color: z.navy }}>Q 2,500</span>
        <span style={{ fontSize: 26, color: z.secondary }}>llevas ahorrado</span>
      </div>
      <div style={{ marginTop: 16 }}>
        <Bar pct={42} height={22} />
      </div>
      <div style={{ marginTop: 26, fontFamily: fonts.serif, fontStyle: "italic", fontSize: 40, color: z.navy }}>
        Con tu aporte de Q 500 al mes, <span style={{ color: z.electric }}>llegas en 7 meses.</span>
      </div>
    </Card>
  </ChapterLayout>
);

/* C06 · 03 — Tu estrategia (fondo azul eléctrico) con VS */
const StrategyCard: React.FC<{ title: string; line: string; rule: string; color: string; rotate: number }> = ({
  title,
  line,
  rule,
  color,
  rotate,
}) => (
  <Card width={390} rotate={rotate} pad={30}>
    <CardLabel dot={color}>Estrategia</CardLabel>
    <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 46, lineHeight: 1.05, color: z.navy }}>{title}</div>
    <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: 30, color: z.secondary, margin: "12px 0 20px" }}>{line}</div>
    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.1em", color: z.muted }}>PAGAS PRIMERO</div>
    <div style={{ fontSize: 26, fontWeight: 600, color: z.ink, margin: "6px 0 18px" }}>{rule}</div>
    <Bar pct={title === "Avalancha" ? 85 : 60} color={color} />
  </Card>
);

const C06: React.FC = () => (
  <ChapterLayout
    tone="electric"
    eyebrow={{ n: "03", label: "Tu estrategia" }}
    headline={
      <>
        <Mark tone="electric">Bola de nieve</Mark>
        <br />o <Accent tone="electric" boxed>avalancha?</Accent>
      </>
    }
    sub="Mismo objetivo. Distinto camino."
  >
    <div style={{ position: "relative", display: "flex", gap: 40, alignItems: "flex-start" }}>
      <StrategyCard title="Bola de nieve" line="Ganas rápido y te motiva" rule="La deuda más pequeña" color={z.electricPale} rotate={-2.5} />
      <div style={{ marginTop: 40 }}>
        <StrategyCard title="Avalancha" line="Pagas menos en total" rule="La de más interés" color={z.navy} rotate={2} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 390 - 28,
          top: 180,
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
    </div>
  </ChapterLayout>
);

/* Cierre: cuadrícula de capítulos (vista alejada) */
const Mini: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ width: 1080, height: 1920, position: "relative", overflow: "hidden", borderRadius: 60 }}>{children}</div>
);

const Cierre: React.FC = () => (
  <AbsoluteFill>
    <ChapterBackground tone="navy" />
    <div
      style={{
        position: "absolute",
        top: 250,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: fonts.display,
        fontWeight: 700,
        fontSize: 76,
        letterSpacing: "-0.03em",
        color: colors.white,
        lineHeight: 1.1,
      }}
    >
      Un minuto para entrar.
      <br />
      <Accent tone="navy">Cinco para entenderte.</Accent>
    </div>
    <div
      style={{
        position: "absolute",
        top: 520,
        left: 90,
        display: "grid",
        gridTemplateColumns: "repeat(2, 430px)",
        gap: 40,
      }}
    >
      {[C01, C02, C03, C04].map((S, i) => (
        <div key={i} style={{ width: 430, height: 764, overflow: "hidden", borderRadius: 26, boxShadow: "0 20px 50px rgba(0,0,0,0.35)" }}>
          <div style={{ transform: "scale(0.398)", transformOrigin: "top left" }}>
            <Mini>
              <S />
            </Mini>
          </div>
        </div>
      ))}
    </div>
  </AbsoluteFill>
);

/* Hoja de estilo: paleta y tipografías */
const Swatch: React.FC<{ c: string; name: string; use: string; dark?: boolean }> = ({ c, name, use, dark }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: 18 }}>
    <span style={{ width: 96, height: 96, borderRadius: 22, background: c, border: `3px solid ${dark ? z.navy : "rgba(30,58,95,0.15)"}` }} />
    <div>
      <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 32, color: z.navy }}>{name}</div>
      <div style={{ fontFamily: fonts.body, fontSize: 24, color: z.secondary }}>
        {c} · {use}
      </div>
    </div>
  </div>
);

const Hoja: React.FC = () => (
  <AbsoluteFill>
    <ChapterBackground tone="light" />
    <div style={{ position: "absolute", top: 120, left: 90, right: 90 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Wordmark size={96} variant="light" />
        <Pill kind="navy">Serie · Cómo funciona</Pill>
      </div>
      <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 28, letterSpacing: "0.16em", color: z.secondary, margin: "60px 0 24px" }}>
        PALETA
      </div>
      <Swatch c={z.bg} name="Fondo claro" use="--zafi-bg · capítulos 01 y 04" />
      <Swatch c={z.navy} name="Navy" use="texto, hero, capítulo 02" dark />
      <Swatch c={z.electric} name="Azul eléctrico" use="acentos, marcador, capítulo 03" dark />
      <Swatch c={z.ghost} name="Azul claro" use="marcador suave, insignias" />
      <Swatch c={z.electricPale} name="Azul pálido" use="acentos sobre navy" />
      <Swatch c={z.success} name="Verde éxito" use="logros, pagado, salud" />
      <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 28, letterSpacing: "0.16em", color: z.secondary, margin: "50px 0 20px" }}>
        TIPOGRAFÍA
      </div>
      <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 84, letterSpacing: "-0.035em", color: z.navy, lineHeight: 1 }}>
        Outfit · titulares
      </div>
      <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: 76, color: z.electric, marginTop: 14 }}>
        DM Serif · acentos
      </div>
      <div style={{ fontFamily: fonts.body, fontSize: 40, color: z.secondary, marginTop: 14 }}>DM Sans · textos y pantallas de la app</div>
      <div style={{ marginTop: 40, fontFamily: fonts.display, fontWeight: 700, fontSize: 64, color: z.navy, letterSpacing: "-0.03em" }}>
        Cada quetzal <Mark tone="light">con un trabajo.</Mark>
      </div>
    </div>
  </AbsoluteFill>
);

const FRAMES = [Hoja, C01, C02, C03, C04, C05, C06, Cierre];

export const MockupSerie: React.FC = () => {
  const frame = useCurrentFrame();
  const S = FRAMES[Math.min(frame, FRAMES.length - 1)];
  return <S />;
};
