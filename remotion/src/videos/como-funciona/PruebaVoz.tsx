// Video de prueba (~10 s) para validar la voz de la narración y el estilo de la serie.
import React from "react";
import { AbsoluteFill, Audio, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Wordmark } from "../../brand/Wordmark";
import { colors, fonts } from "../../brand/theme";
import { SafeZoneGuide, tween } from "../../components";
import { SAFE } from "../../config/formats";
import { Accent, Bar, Card, CardLabel, ChapterBackground, Eyebrow, Headline, Mark, Pill, Tone, TxRow, z } from "./ui";

export type PruebaVozProps = {
  voz: "mujer" | "hombre";
  conAudio: boolean;
  mostrarZonasSeguras: boolean;
};

export const PRUEBA_DURATION = 315;

/** Momentos (en frames) en que empieza cada frase, medidos con las pausas reales del audio. */
const CUES: Record<PruebaVozProps["voz"], { file: string; b: number; c: number; d: number }> = {
  mujer: { file: "audio/voz/prueba-mujer-elena.mp3", b: 68, c: 120, d: 220 },
  hombre: { file: "audio/voz/prueba-hombre-julian.mp3", b: 66, c: 111, d: 207 },
};
const VOICE_START = 3;

/* ───────────── Piezas animadas ───────────── */

/** Texto que se escribe letra por letra (como el titular del ejemplo). */
const Typed: React.FC<{ text: string; start?: number; cps?: number; children?: (shown: string) => React.ReactNode }> = ({
  text,
  start = 0,
  cps = 1.6,
  children,
}) => {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.min(text.length, Math.floor((frame - start) * cps)));
  const shown = text.slice(0, n);
  return <>{children ? children(shown) : shown}</>;
};

/** Entrada de tarjeta: sube desde abajo y se acomoda con un pequeño giro. */
const CardIn: React.FC<{ delay?: number; rotate?: number; children: React.ReactNode }> = ({ delay = 0, rotate = -1.5, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 120 } });
  return (
    <div
      style={{
        transform: `translateY(${(1 - p) * 700}px) rotate(${rotate + (1 - p) * 8}deg)`,
        opacity: Math.min(1, p * 3),
      }}
    >
      {children}
    </div>
  );
};

/** Escena con fondo de capítulo y un pequeño empuje al entrar. */
const Chapter: React.FC<{ tone: Tone; children: React.ReactNode }> = ({ tone, children }) => {
  const frame = useCurrentFrame();
  const p = tween(frame, [0, 8], [0, 1]);
  return (
    <AbsoluteFill>
      <ChapterBackground tone={tone} />
      <AbsoluteFill style={{ transform: `translateY(${(1 - p) * 60}px)`, opacity: p }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

const Top: React.FC<{ children: React.ReactNode }> = ({ children }) => (
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
    {children}
  </div>
);

const Bottom: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: "absolute", top: 860, left: SAFE.left, width: 860 }}>{children}</div>
);

/* ───────────── Escenas ───────────── */

const SceneHoy: React.FC = () => (
  <Chapter tone="light">
    <Top>
      <Eyebrow tone="light" n="01" label="Tu día" />
      <Headline tone="light" size={128}>
        <Typed text="¿Sabes cuánto puedes gastar hoy?" start={4} cps={1.1}>
          {(s) => {
            const cut = "¿Sabes cuánto puedes ".length;
            return (
              <>
                {s.slice(0, cut)}
                {s.length > cut && <Mark tone="light">{s.slice(cut)}</Mark>}
              </>
            );
          }}
        </Typed>
      </Headline>
    </Top>
  </Chapter>
);

const SceneSi: React.FC = () => {
  const frame = useCurrentFrame();
  const amount = Math.round(tween(frame, [8, 30], [0, 245]));
  return (
    <Chapter tone="navy">
      <Top>
        <Eyebrow tone="navy" n="02" label="Con Zafi" />
        <Headline tone="navy" size={128}>
          Con Zafi, <Accent tone="navy">sí.</Accent>
        </Headline>
      </Top>
      <Bottom>
        <CardIn delay={4} rotate={1.2}>
          <Card pad={30}>
            <div style={{ background: z.navy, borderRadius: 24, padding: "30px 32px", color: colors.white }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 24, color: z.heroMuted }}>
                <span style={{ width: 12, height: 12, borderRadius: 99, background: z.success }} />
                Vas bien este mes
              </span>
              <div style={{ fontSize: 26, color: z.heroMuted, marginTop: 18 }}>Hoy puedes gastar</div>
              <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 104, lineHeight: 1 }}>Q {amount}</div>
              <div style={{ marginTop: 20 }}>
                <Bar pct={tween(frame, [8, 30], [0, 58])} track={z.heroTrack} height={14} />
              </div>
            </div>
          </Card>
        </CardIn>
      </Bottom>
    </Chapter>
  );
};

const SceneAnota: React.FC = () => {
  const frame = useCurrentFrame();
  const rows = [
    { at: 34, emoji: "🛒", name: "Súper", sub: "Supermercado · hoy", amount: "Q 640" },
    { at: 44, emoji: "🚕", name: "Uber", sub: "Transporte · hoy", amount: "Q 38" },
  ];
  const tip = tween(frame, [62, 74], [0, 1]);
  return (
    <Chapter tone="electric">
      <Top>
        <Eyebrow tone="electric" n="03" label="En segundos" />
        <Headline tone="electric" size={124}>
          Anótalo y <Accent tone="electric" boxed>listo.</Accent>
        </Headline>
      </Top>
      <Bottom>
        <CardIn delay={2} rotate={-1.2}>
          <Card>
            <CardLabel>Agregar</CardLabel>
            <div
              style={{
                padding: "20px 24px",
                borderRadius: 20,
                border: `3px solid ${z.border}`,
                fontSize: 34,
                color: z.ink,
                minHeight: 50,
              }}
            >
              <Typed text="súper 640 y uber 38" start={6} cps={0.9} />
              <span style={{ color: z.electric }}>|</span>
            </div>
            <div style={{ marginTop: 12 }}>
              {rows.map((r, i) => {
                const p = tween(frame, [r.at, r.at + 8], [0, 1]);
                return (
                  <div key={r.name} style={{ opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}>
                    <TxRow {...r} last={i === rows.length - 1} />
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 14, opacity: tip, transform: `scale(${0.9 + tip * 0.1})`, transformOrigin: "left" }}>
              <Pill kind="info" size={24}>
                ✦ Zafi: aparta Q 850 para tu meta
              </Pill>
            </div>
          </Card>
        </CardIn>
      </Bottom>
    </Chapter>
  );
};

const SceneLogo: React.FC = () => {
  const frame = useCurrentFrame();
  const btn = tween(frame, [26, 38], [0, 1]);
  return (
    <Chapter tone="light">
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingRight: SAFE.right - SAFE.left, gap: 50 }}>
        <CardIn rotate={0}>
          <Wordmark size={210} variant="light" />
        </CardIn>
        <div style={{ textAlign: "center" }}>
          <Headline tone="light" size={84}>
            Tu asesor financiero
            <br />
            <Accent tone="light">personal.</Accent>
          </Headline>
        </div>
        <div
          style={{
            padding: "28px 72px",
            borderRadius: 28,
            background: z.electric,
            border: `4px solid ${z.navy}`,
            boxShadow: `10px 10px 0 ${z.navy}`,
            color: colors.white,
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 44,
            opacity: btn,
            transform: `translateY(${(1 - btn) * 30}px)`,
          }}
        >
          Pruébalo gratis
        </div>
      </AbsoluteFill>
    </Chapter>
  );
};

/* ───────────── Composición ───────────── */

const Sfx: React.FC<{ at: number; name: string; volume?: number }> = ({ at, name, volume = 0.6 }) => (
  <Sequence from={at} layout="none">
    <Audio src={staticFile(`audio/sfx/${name}.wav`)} volume={volume} />
  </Sequence>
);

export const PruebaVoz: React.FC<PruebaVozProps> = ({ voz, conAudio, mostrarZonasSeguras }) => {
  const c = CUES[voz];
  return (
    <AbsoluteFill style={{ background: z.bg }}>
      <Sequence durationInFrames={c.b}>
        <SceneHoy />
      </Sequence>
      <Sequence from={c.b} durationInFrames={c.c - c.b}>
        <SceneSi />
      </Sequence>
      <Sequence from={c.c} durationInFrames={c.d - c.c}>
        <SceneAnota />
      </Sequence>
      <Sequence from={c.d}>
        <SceneLogo />
      </Sequence>

      {conAudio && (
        <>
          <Sequence from={VOICE_START} layout="none">
            <Audio src={staticFile(c.file)} />
          </Sequence>
          {/* Efectos: tecleo, cambios de capítulo, tarjetas y logro */}
          {[6, 12, 18, 24, 30, 36].map((f) => (
            <Sfx key={f} at={f} name="tic" volume={0.25} />
          ))}
          <Sfx at={c.b - 4} name="whoosh" volume={0.35} />
          <Sfx at={c.b + 10} name="pop" volume={0.4} />
          <Sfx at={c.c - 4} name="whoosh" volume={0.35} />
          <Sfx at={c.c + 34} name="pop" volume={0.35} />
          <Sfx at={c.c + 44} name="pop" volume={0.35} />
          <Sfx at={c.d - 4} name="whoosh" volume={0.35} />
          <Sfx at={c.d + 8} name="campanita" volume={0.4} />
        </>
      )}
      {mostrarZonasSeguras && <SafeZoneGuide />}
    </AbsoluteFill>
  );
};
