// Motor de la serie "Cómo funciona Zafi".
// Cada video se describe con capítulos (fondo, etiqueta, titular, contenido)
// y un cierre. La duración de cada capítulo sale de su narración
// (tiempos/<video>.json, generado con scripts/preparar-voz.mjs).
import React from "react";
import {
  AbsoluteFill,
  Audio,
  Freeze,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Wordmark } from "../../brand/Wordmark";
import { BRAND, colors, fonts } from "../../brand/theme";
import { easeInOut, SafeZoneGuide, tween } from "../../components";
import { SAFE, VERTICAL } from "../../config/formats";
import { ChapterBackground, Eyebrow, Tone, toneStyle, z } from "./ui";

const FPS = VERTICAL.fps;

/** La voz entra unos frames después de que aparece el capítulo. */
export const VOICE_DELAY = 8;
const TAIL = 14;
const TYPE_START = 2;
const TYPE_CPS = 1.5; // letras por frame

/** Frame (dentro del capítulo) en que la voz llega al segundo `sec` de su clip. */
export const v = (sec: number) => VOICE_DELAY + Math.round(sec * FPS);

/* ───────────── Titular que se escribe ───────────── */

export type Seg =
  | string
  | { t: string; s: "mark" | "markSoft" | "accent" | "accentBox" }
  | { br: true };

const segText = (seg: Seg) => (typeof seg === "string" ? seg : "br" in seg ? "" : seg.t);
export const headlineLength = (segs: Seg[]) => segs.reduce((n, s) => n + segText(s).length, 0);
export const typingFrames = (segs: Seg[]) => Math.ceil(headlineLength(segs) / TYPE_CPS);

export const TypedHeadline: React.FC<{ segs: Seg[]; tone: Tone; size?: number; align?: "left" | "center" }> = ({
  segs,
  tone,
  size = 118,
  align = "left",
}) => {
  const frame = useCurrentFrame();
  const t = toneStyle(tone);
  let budget = Math.max(0, Math.floor((frame - TYPE_START) * TYPE_CPS));
  const total = headlineLength(segs);
  const typing = budget < total;
  const caretOn = typing || Math.floor(frame / 15) % 2 === 0;
  const out: React.ReactNode[] = [];

  segs.forEach((seg, i) => {
    if (typeof seg !== "string" && "br" in seg) {
      out.push(<br key={i} />);
      return;
    }
    const full = segText(seg);
    const shown = full.slice(0, budget);
    budget = Math.max(0, budget - full.length);
    if (!shown) return;
    if (typeof seg === "string") {
      out.push(<span key={i}>{shown}</span>);
      return;
    }
    const markSolid = tone === "electric" ? { background: colors.white, color: z.electric } : { background: z.electric, color: colors.white };
    const style: React.CSSProperties =
      seg.s === "mark"
        ? { ...markSolid, padding: "0 0.12em 0.04em", borderRadius: 10, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }
        : seg.s === "markSoft"
          ? { background: z.ghost, color: z.navy, padding: "0 0.12em 0.04em", borderRadius: 10, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }
          : {
              fontFamily: fonts.serif,
              fontStyle: "italic",
              fontWeight: 400,
              letterSpacing: "-0.01em",
              color: seg.s === "accentBox" ? (tone === "electric" ? z.electric : z.navy) : t.accent,
              ...(seg.s === "accentBox"
                ? { background: colors.white, padding: "0 0.12em", borderRadius: 10, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }
                : {}),
            };
    out.push(
      <span key={i} style={style}>
        {shown}
      </span>,
    );
  });

  return (
    <div
      style={{
        fontFamily: fonts.display,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1.06,
        letterSpacing: "-0.035em",
        color: t.text,
        textAlign: align,
      }}
    >
      {out}
      <span
        style={{
          display: "inline-block",
          width: size * 0.06,
          height: size * 0.85,
          marginLeft: size * 0.04,
          verticalAlign: "-0.1em",
          background: t.accent,
          opacity: caretOn && frame < typingFrames(segs) + 40 ? 1 : 0,
        }}
      />
    </div>
  );
};

/* ───────────── Animaciones de contenido ───────────── */

/** Tarjeta que sube desde abajo y se acomoda con un pequeño giro. */
export const CardIn: React.FC<{ at?: number; rotate?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  at = 0,
  rotate = -1.2,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config: { damping: 15, stiffness: 120 } });
  return (
    <div
      style={{
        transform: `translateY(${(1 - p) * 800}px) rotate(${rotate + (1 - p) * 8}deg)`,
        opacity: Math.min(1, p * 3),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Aparece con fade y una subida corta. */
export const Appear: React.FC<{ at: number; y?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  at,
  y = 24,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const p = tween(frame, [at, at + 10], [0, 1]);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * y}px)`, ...style }}>{children}</div>;
};

/** Aparece con un pequeño rebote (insignias, botones). */
export const PopIn: React.FC<{ at: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ at, style, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config: { damping: 10, stiffness: 200 } });
  return <div style={{ transform: `scale(${p})`, opacity: Math.min(1, p * 2), transformOrigin: "left center", ...style }}>{children}</div>;
};

/* ───────────── Capítulos y video ───────────── */

export type SfxCue = { at: number; name: "pop" | "whoosh" | "tic" | "campanita"; volume?: number };

export type ChapterDef = {
  tone: Tone;
  eyebrow: { n: string; label: string };
  headline: Seg[];
  headlineSize?: number;
  /** Contenido de la mitad inferior (usa useCurrentFrame local al capítulo). */
  Body: React.FC;
  /** Clip de narración: public/audio/voz/<video>/<audio>.mp3 */
  audio: string;
  sfx?: SfxCue[];
};

export type OutroDef = {
  headline: Seg[];
  audio: string;
  cta?: string;
  /** Capítulos que se muestran en la vista alejada (por defecto los 4 primeros). */
  tiles?: number[];
};

export type VideoDef = {
  id: string; // carpeta de audio, ej. "c01"
  chapters: ChapterDef[];
  outro: OutroDef;
  tiempos: Record<string, number>;
};

const chapterLength = (def: VideoDef, ch: ChapterDef) =>
  Math.max(VOICE_DELAY + Math.round(def.tiempos[ch.audio] * FPS) + TAIL, typingFrames(ch.headline) + 60);

const OUTRO_GRID = 58;
const outroLength = (def: VideoDef) => OUTRO_GRID + VOICE_DELAY + Math.round(def.tiempos[def.outro.audio] * FPS) + 45;

export const videoLength = (def: VideoDef) =>
  def.chapters.reduce((n, ch) => n + chapterLength(def, ch), 0) + outroLength(def);

/** Un capítulo completo: fondo, etiqueta, titular y contenido. */
const ChapterView: React.FC<{ ch: ChapterDef; enter?: boolean }> = ({ ch, enter = true }) => {
  const frame = useCurrentFrame();
  const p = enter ? tween(frame, [0, 8], [0, 1]) : 1;
  const { Body } = ch;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <ChapterBackground tone={ch.tone} />
      <AbsoluteFill style={{ transform: `translateY(${(1 - p) * 70}px)`, opacity: p }}>
        <div
          style={{
            position: "absolute",
            top: SAFE.top + 20,
            left: SAFE.left + 10,
            right: SAFE.right - 30,
            display: "flex",
            flexDirection: "column",
            gap: 34,
          }}
        >
          <Eyebrow tone={ch.tone} {...ch.eyebrow} />
          <TypedHeadline segs={ch.headline} tone={ch.tone} size={ch.headlineSize} />
        </div>
        <div style={{ position: "absolute", top: 820, left: SAFE.left, width: 860 }}>
          <Body />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Sfx: React.FC<SfxCue> = ({ at, name, volume = 0.4 }) => (
  <Sequence from={Math.max(0, at)} layout="none">
    <Audio src={staticFile(`audio/sfx/${name}.wav`)} volume={volume} />
  </Sequence>
);

/** Tecleo suave mientras se escribe el titular. */
const TypingSfx: React.FC<{ segs: Seg[] }> = ({ segs }) => {
  const n = typingFrames(segs);
  const ticks: number[] = [];
  for (let f = TYPE_START; f < TYPE_START + n; f += 3) ticks.push(f);
  return (
    <>
      {ticks.map((f) => (
        <Sfx key={f} at={f} name="tic" volume={0.14} />
      ))}
    </>
  );
};

/** Cierre: vista alejada de los capítulos y tarjeta final con logo. */
const Outro: React.FC<{ def: VideoDef }> = ({ def }) => {
  const frame = useCurrentFrame();
  const zoom = tween(frame, [0, 24], [0, 1], easeInOut);
  const toEnd = tween(frame, [OUTRO_GRID - 8, OUTRO_GRID + 4], [0, 1], easeInOut);
  const lengths = def.chapters.map((c) => chapterLength(def, c));
  const idx = def.outro.tiles ?? [0, 1, 2, 3];
  const shots = idx.map((i) => def.chapters[i]);
  // 4 escenas en 2 columnas; 5 o 6 en 3 columnas
  const cols = shots.length > 4 ? 3 : 2;
  const gap = cols === 3 ? 28 : 36;
  const tileW = cols === 3 ? 250 : 360;
  const tileH = (tileW * 16) / 9;
  const scale = tileW / 1080;
  // Zoom: empieza enfocado en la última escena (a pantalla completa) y se aleja hasta la cuadrícula
  const gridScale = 1 + (1 - zoom) * (1080 / tileW - 1);
  const gridW = tileW * cols + gap * (cols - 1);
  const gridLeft = (1080 - gridW) / 2 - (SAFE.right - SAFE.left) / 2;
  const gridTop = cols === 3 ? 600 : 560;
  const last = shots.length - 1;
  const ox = (last % cols) * (tileW + gap) + tileW / 2;
  const oy = Math.floor(last / cols) * (tileH + gap) + tileH / 2;
  const dx = (1 - zoom) * (540 - (gridLeft + ox));
  const dy = (1 - zoom) * (960 - (gridTop + oy));
  return (
    <AbsoluteFill>
      <ChapterBackground tone="navy" />
      <AbsoluteFill style={{ opacity: 1 - toEnd, transform: `scale(${1 - toEnd * 0.08})`, filter: `blur(${toEnd * 10}px)` }}>
        <div style={{ position: "absolute", top: SAFE.top + 10, left: SAFE.left, right: SAFE.right - SAFE.left, opacity: zoom }}>
          <TypedHeadline segs={def.outro.headline} tone="navy" size={76} align="center" />
        </div>
        <div
          style={{
            position: "absolute",
            top: gridTop,
            left: gridLeft,
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, ${tileW}px)`,
            gap,
            transform: `translate(${dx}px, ${dy}px) scale(${gridScale})`,
            transformOrigin: `${ox}px ${oy}px`,
          }}
        >
          {shots.map((ch, i) => (
            <div
              key={i}
              style={{
                width: tileW,
                height: tileH,
                overflow: "hidden",
                borderRadius: 24 / gridScale + 4,
                boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
              }}
            >
              <div style={{ width: 1080, height: 1920, transform: `scale(${scale})`, transformOrigin: "top left", position: "relative" }}>
                <Freeze frame={Math.round(lengths[idx[i]] * 0.85)}>
                  <ChapterView ch={ch} enter={false} />
                </Freeze>
              </div>
            </div>
          ))}
        </div>
      </AbsoluteFill>
      <Sequence from={OUTRO_GRID - 4}>
        <EndCard cta={def.outro.cta} />
      </Sequence>
    </AbsoluteFill>
  );
};

const EndCard: React.FC<{ cta?: string }> = ({ cta = "Pruébalo gratis" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bg = tween(frame, [0, 10], [0, 1], easeInOut);
  const logo = spring({ frame: frame - 6, fps, config: { damping: 13, stiffness: 140 } });
  const btn = spring({ frame: frame - 22, fps, config: { damping: 12, stiffness: 160 } });
  const url = tween(frame, [30, 40], [0, 1]);
  return (
    <AbsoluteFill style={{ clipPath: `circle(${bg * 150}% at 50% 50%)` }}>
      <ChapterBackground tone="light" />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingRight: SAFE.right - SAFE.left, gap: 46 }}>
        <div style={{ transform: `scale(${0.6 + logo * 0.4})`, opacity: Math.min(1, logo * 2) }}>
          <Wordmark size={220} variant="light" />
        </div>
        <div style={{ textAlign: "center", opacity: tween(frame, [12, 22], [0, 1]) }}>
          <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 80, letterSpacing: "-0.035em", lineHeight: 1.05, color: z.navy }}>
            Tu asesor financiero
            <br />
            <span style={{ fontFamily: fonts.serif, fontStyle: "italic", fontWeight: 400, color: z.electric }}>personal.</span>
          </div>
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
            fontSize: 46,
            transform: `scale(${btn})`,
          }}
        >
          {cta}
        </div>
        <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 34, color: z.electricDark, opacity: url }}>{BRAND.url}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export type SerieProps = { mostrarZonasSeguras: boolean };

export const SerieVideo: React.FC<{ def: VideoDef; mostrarZonasSeguras: boolean }> = ({ def, mostrarZonasSeguras }) => {
  let from = 0;
  const parts = def.chapters.map((ch) => {
    const len = chapterLength(def, ch);
    const start = from;
    from += len;
    return { ch, start, len };
  });
  const outroStart = from;
  const voice = (name: string) => staticFile(`audio/voz/${def.id}/${name}.mp3`);

  return (
    <AbsoluteFill style={{ background: z.bg }}>
      {parts.map(({ ch, start, len }, i) => (
        <Sequence key={i} from={start} durationInFrames={len}>
          <ChapterView ch={ch} />
          <Sequence from={VOICE_DELAY} layout="none">
            <Audio src={voice(ch.audio)} />
          </Sequence>
          <TypingSfx segs={ch.headline} />
          {i > 0 && <Sfx at={0} name="whoosh" volume={0.3} />}
          {(ch.sfx ?? []).map((s, k) => (
            <Sfx key={k} {...s} />
          ))}
        </Sequence>
      ))}
      <Sequence from={outroStart}>
        <Outro def={def} />
        <Sfx at={0} name="whoosh" volume={0.3} />
        <Sequence from={OUTRO_GRID} layout="none">
          <Sequence from={VOICE_DELAY} layout="none">
            <Audio src={voice(def.outro.audio)} />
          </Sequence>
          <Sfx at={4} name="campanita" volume={0.35} />
        </Sequence>
      </Sequence>
      {mostrarZonasSeguras && <SafeZoneGuide />}
    </AbsoluteFill>
  );
};

/** Toque de dedo: círculo que aparece y se expande sobre un punto. */
export const Tap: React.FC<{ at: number; x: number; y: number }> = ({ at, x, y }) => {
  const frame = useCurrentFrame();
  const p = tween(frame, [at, at + 14], [0, 1]);
  if (frame < at || frame > at + 14) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x - 45,
        top: y - 45,
        width: 90,
        height: 90,
        borderRadius: 99,
        background: "rgba(37,99,235,0.25)",
        border: "4px solid rgba(37,99,235,0.6)",
        transform: `scale(${0.6 + p * 0.8})`,
        opacity: 1 - p,
        pointerEvents: "none",
        zIndex: 50,
      }}
    />
  );
};
