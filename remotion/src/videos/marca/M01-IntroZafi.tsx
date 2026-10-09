// M01 · Intro de Zafi — tipografía cinética rápida y fluida.
// Mensaje: Zafi no es otra app para anotar gastos, es tu asesor financiero personal.
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Check, Sparkles } from "lucide-react";
import { BRAND, colors, fonts } from "../../brand/theme";
import {
  Background,
  easeInOut,
  LineReveal,
  PhoneMockup,
  SafeArea,
  SafeZoneGuide,
  tween,
  Typewriter,
} from "../../components";

export type IntroZafiProps = { mostrarZonasSeguras: boolean };

// Línea de tiempo (frames absolutos, 30 fps)
const S = {
  dot: { from: 0, dur: 50 },
  question: { from: 30, dur: 80 },
  no: { from: 104, dur: 54 },
  advisor: { from: 150, dur: 70 },
  phone: { from: 212, dur: 175 },
  contrast: { from: 380, dur: 52 },
  logo: { from: 425, dur: 85 },
};
export const M01_DURATION = S.logo.from + S.logo.dur;

const display: React.CSSProperties = {
  fontFamily: fonts.display,
  fontWeight: 800,
  letterSpacing: "-0.04em",
  lineHeight: 0.95,
  color: colors.white,
  textAlign: "center",
};

/** Salida con desenfoque hacia arriba, para encadenar escenas sin cortes. */
const useBlurExit = (start: number, length = 12) => {
  const frame = useCurrentFrame();
  const p = tween(frame, [start, start + length], [0, 1], easeInOut);
  return {
    transform: `translateY(${-160 * p}px) scale(${1 - 0.08 * p})`,
    filter: `blur(${24 * p}px)`,
    opacity: 1 - p,
  } as React.CSSProperties;
};

/* ───────────── 1 + 2 · Punto que se expande y la pregunta ───────────── */

/** Capa azul: nace como el punto de la "i" y se cierra con una cortina curva. */
const ElectricLayer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 9, stiffness: 180 } });
  const grow = tween(frame, [20, 44], [0, 1], easeInOut);
  const radius = 34 * pop + grow * 1200;
  const curtain = tween(frame, [S.no.from, S.no.from + 18], [0, 100], easeInOut);
  const round = curtain > 0 ? 600 * Math.sin((curtain / 100) * Math.PI) : 0;

  if (frame >= S.no.from + 18) return null;
  const clipPath =
    curtain > 0
      ? `inset(0px 0px ${curtain}% 0px round 0 0 ${round}px ${round}px)`
      : `circle(${radius}px at 50% 50%)`;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 40%, ${colors.electricLight}, ${colors.electricDark})`,
        clipPath,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const Question: React.FC = () => {
  const frame = useCurrentFrame();
  const strike = tween(frame, [46, 58], [0, 100], easeInOut);
  const exit = useBlurExit(62, 14);
  const size = 132;
  return (
    <SafeArea>
      <div style={{ position: "relative", ...exit }}>
        <div style={{ ...display, fontSize: size }}>
          <LineReveal delay={6}>¿Otra app</LineReveal>
          <LineReveal delay={10}>para anotar</LineReveal>
          <LineReveal delay={14}>
            <span style={{ color: colors.navyDeep }}>gastos?</span>
          </LineReveal>
        </div>
        <div
          style={{
            position: "absolute",
            left: -20,
            top: "52%",
            height: 22,
            width: `calc(${strike}% + 40px)`,
            maxWidth: "calc(100% + 40px)",
            borderRadius: 99,
            background: colors.navyDeep,
            transform: "rotate(-6deg)",
            opacity: strike > 0 ? 1 : 0,
          }}
        />
      </div>
    </SafeArea>
  );
};

/* ───────────── 3 · "No." ───────────── */

const NoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slam = spring({ frame: frame - 10, fps, config: { damping: 11, stiffness: 220 } });
  const zoomOut = tween(frame, [40, 54], [0, 1], easeInOut);
  return (
    <SafeArea gap={30}>
      <div
        style={{
          ...display,
          fontSize: 440,
          transform: `scale(${interpolate(slam, [0, 1], [2.6, 1]) + zoomOut * 5})`,
          filter: `blur(${interpolate(slam, [0, 0.6], [30, 0], { extrapolateRight: "clamp" }) + zoomOut * 20}px)`,
          opacity: interpolate(slam, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }) * (1 - zoomOut),
        }}
      >
        No<span style={{ color: colors.electricPale }}>.</span>
      </div>
      <div style={{ ...display, fontSize: 76, fontWeight: 600, color: colors.electricSoft, opacity: 1 - zoomOut }}>
        <LineReveal delay={20}>Es mucho más.</LineReveal>
      </div>
    </SafeArea>
  );
};

/* ───────────── 4 · "tu asesor financiero personal" ───────────── */

const AdvisorScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoomIn = tween(frame, [0, 14], [0.7, 1]);
  const pill = spring({ frame: frame - 22, fps, config: { damping: 12, stiffness: 160 } });
  const exit = useBlurExit(56, 14);
  return (
    <SafeArea gap={10}>
      <div style={{ transform: `scale(${zoomIn})`, ...exit, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ ...display, fontSize: 80, fontWeight: 600, color: colors.electricSoft }}>
          <LineReveal delay={2}>Zafi es tu</LineReveal>
        </div>
        <div style={{ ...display, fontSize: 200, marginTop: 20 }}>
          <LineReveal delay={8}>asesor</LineReveal>
        </div>
        <div style={{ ...display, fontSize: 132 }}>
          <LineReveal delay={13}>
            <span
              style={{
                backgroundImage: `linear-gradient(90deg, ${colors.electricPale}, ${colors.white})`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                paddingRight: 8,
              }}
            >
              financiero
            </span>
          </LineReveal>
        </div>
        <div
          style={{
            marginTop: 40,
            padding: "18px 56px",
            borderRadius: 999,
            background: colors.electric,
            boxShadow: `0 20px 60px ${colors.electric}99`,
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 84,
            letterSpacing: "-0.03em",
            color: colors.white,
            transform: `scale(${pill}) rotate(${interpolate(pill, [0, 1], [-12, -3])}deg)`,
          }}
        >
          personal
        </div>
      </div>
    </SafeArea>
  );
};

/* ───────────── 5 · El teléfono: diagnóstico → plan → acompañamiento ───────────── */

const PHASES = [
  { at: 12, title: "Te dice", accent: "dónde estás" },
  { at: 62, title: "Te arma", accent: "un plan claro" },
  { at: 112, title: "Te acompaña", accent: "cada mes" },
];
const PHONE_W = 640;
const ZOOM = 1.6;
const SCREEN_W = (PHONE_W * (1 - 0.07)) / ZOOM;

const screenText: React.CSSProperties = { fontFamily: fonts.body, color: colors.ink700 };
const screenTitle: React.CSSProperties = {
  fontFamily: fonts.display,
  fontWeight: 700,
  fontSize: 30,
  color: colors.navyDeep,
  marginBottom: 18,
};

const Gauge: React.FC<{ value: number }> = ({ value }) => {
  const r = 120;
  const len = Math.PI * r;
  return (
    <svg width={300} height={170} viewBox="0 0 300 170">
      <path d={`M 30 150 A ${r} ${r} 0 0 1 270 150`} fill="none" stroke={colors.electricGhost} strokeWidth={26} strokeLinecap="round" />
      <path
        d={`M 30 150 A ${r} ${r} 0 0 1 270 150`}
        fill="none"
        stroke={colors.success}
        strokeWidth={26}
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - value / 100)}
      />
      <text x={150} y={140} textAnchor="middle" fontFamily={fonts.display} fontWeight={800} fontSize={64} fill={colors.navyDeep}>
        {Math.round(value)}
      </text>
    </svg>
  );
};

const DiagnosticoScreen: React.FC<{ local: number }> = ({ local }) => {
  const value = tween(local, [8, 40], [0, 72]);
  const rows = [
    { label: "Deuda controlada", color: colors.success },
    { label: "Ahorro bajo", color: colors.warning },
    { label: "Mucho gasto en comida", color: colors.danger },
  ];
  return (
    <div style={screenText}>
      <div style={screenTitle}>Tu diagnóstico</div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Gauge value={value} />
      </div>
      <div style={{ textAlign: "center", fontSize: 22, marginBottom: 20 }}>Salud financiera</div>
      {rows.map((r, i) => (
        <div
          key={r.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            marginBottom: 10,
            borderRadius: 18,
            background: colors.white,
            fontSize: 21,
            boxShadow: "0 4px 14px rgba(13,31,54,0.07)",
            opacity: tween(local, [20 + i * 6, 30 + i * 6], [0, 1]),
            transform: `translateX(${tween(local, [20 + i * 6, 32 + i * 6], [40, 0])}px)`,
          }}
        >
          <span style={{ width: 14, height: 14, borderRadius: 99, background: r.color }} />
          {r.label}
        </div>
      ))}
    </div>
  );
};

const PlanScreen: React.FC<{ local: number }> = ({ local }) => {
  const items = ["Arma tu fondo de emergencia", "Paga primero la tarjeta más cara", "Ahorra 10% de cada ingreso"];
  return (
    <div style={screenText}>
      <div style={screenTitle}>Tu plan de acción</div>
      {items.map((t, i) => {
        const enter = tween(local, [4 + i * 7, 18 + i * 7], [0, 1]);
        const checked = local > 28 + i * 7;
        return (
          <div
            key={t}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: 16,
              marginBottom: 12,
              borderRadius: 20,
              background: colors.white,
              boxShadow: "0 4px 14px rgba(13,31,54,0.07)",
              opacity: enter,
              transform: `translateY(${(1 - enter) * 40}px)`,
            }}
          >
            <span
              style={{
                minWidth: 44,
                height: 44,
                borderRadius: 99,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: checked ? colors.success : colors.electricGhost,
                color: checked ? colors.white : colors.electric,
                fontFamily: fonts.display,
                fontWeight: 800,
                fontSize: 22,
              }}
            >
              {checked ? <Check size={24} strokeWidth={3.5} color={colors.white} /> : i + 1}
            </span>
            <span style={{ fontSize: 21, lineHeight: 1.25 }}>{t}</span>
          </div>
        );
      })}
      <div
        style={{
          marginTop: 8,
          fontSize: 19,
          textAlign: "center",
          color: colors.electric,
          opacity: tween(local, [36, 44], [0, 1]),
        }}
      >
        Ordenado por prioridad, hecho para ti
      </div>
    </div>
  );
};

const Bubble: React.FC<{ from: "user" | "zafi"; children: React.ReactNode; style?: React.CSSProperties }> = ({
  from,
  children,
  style,
}) => (
  <div
    style={{
      alignSelf: from === "user" ? "flex-end" : "flex-start",
      maxWidth: "86%",
      padding: "14px 18px",
      borderRadius: 22,
      borderBottomRightRadius: from === "user" ? 6 : 22,
      borderBottomLeftRadius: from === "zafi" ? 6 : 22,
      background: from === "user" ? colors.electric : colors.white,
      color: from === "user" ? colors.white : colors.ink700,
      boxShadow: "0 4px 14px rgba(13,31,54,0.08)",
      fontSize: 21,
      lineHeight: 1.35,
      ...style,
    }}
  >
    {children}
  </div>
);

const ChatScreen: React.FC<{ local: number }> = ({ local }) => {
  const userIn = tween(local, [2, 12], [0, 1]);
  const typing = local > 12 && local < 22;
  const reply = "Sí. Si apartas Q 600 al mes desde hoy, llegas a diciembre sin deudas. ¿Creo la meta?";
  return (
    <div style={{ ...screenText, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...screenTitle, display: "flex", alignItems: "center", gap: 10 }}>
        <Sparkles size={26} color={colors.electric} /> Zafi
      </div>
      <Bubble from="user" style={{ opacity: userIn, transform: `translateY(${(1 - userIn) * 30}px)` }}>
        ¿Me alcanza para viajar en diciembre?
      </Bubble>
      {typing && (
        <Bubble from="zafi">
          <span style={{ letterSpacing: 4 }}>{".".repeat(1 + (Math.floor(local / 3) % 3))}</span>
        </Bubble>
      )}
      {local >= 22 && (
        <Bubble from="zafi">
          <Typewriter text={reply} delay={22} charsPerFrame={3.2} />
        </Bubble>
      )}
      <div
        style={{
          alignSelf: "flex-start",
          padding: "12px 22px",
          borderRadius: 99,
          background: colors.success,
          color: colors.white,
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 20,
          opacity: tween(local, [50, 56], [0, 1]),
          transform: `scale(${tween(local, [50, 58], [0.6, 1])})`,
        }}
      >
        Crear meta
      </div>
    </div>
  );
};

const PhoneScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 90 } });
  const exit = tween(frame, [S.phone.dur - 14, S.phone.dur], [0, 1], easeInOut);
  const phase = PHASES.filter((p) => frame >= p.at - 4).length - 1;
  const track = PHASES.reduce(
    (x, p, i) => (i === 0 ? x : x + tween(frame, [p.at - 6, p.at + 8], [0, 1], easeInOut)),
    0,
  );
  // Inclinación suave que cambia con cada fase: da sensación de cámara en movimiento
  const tilt = Math.sin(frame / 22) * 4;

  return (
    <SafeArea gap={34} justify="flex-start">
      <div style={{ height: 190, flexShrink: 0, position: "relative", width: "100%" }}>
        {PHASES.map((p, i) => (
          <div key={p.title} style={{ position: "absolute", inset: 0, ...display, fontSize: 84 }}>
            <LineReveal delay={p.at} exitAt={i < PHASES.length - 1 ? PHASES[i + 1].at - 8 : S.phone.dur - 14}>
              {p.title}
            </LineReveal>
            <LineReveal delay={p.at + 4} exitAt={i < PHASES.length - 1 ? PHASES[i + 1].at - 6 : S.phone.dur - 12}>
              <span style={{ color: colors.electricPale }}>{p.accent}</span>
            </LineReveal>
          </div>
        ))}
      </div>
      <div
        style={{
          perspective: 1800,
          transform: `translateY(${interpolate(enter, [0, 1], [900, 0]) + exit * 300}px) scale(${1 - exit * 0.2})`,
          opacity: 1 - exit,
        }}
      >
        <div
          style={{
            transform: `rotateX(${interpolate(enter, [0, 1], [35, 0])}deg) rotateY(${tilt}deg)`,
          }}
        >
          <PhoneMockup width={PHONE_W} zoom={ZOOM}>
            <div
              style={{
                display: "flex",
                width: SCREEN_W * 3,
                height: "100%",
                transform: `translateX(${-track * SCREEN_W}px)`,
              }}
            >
              {[DiagnosticoScreen, PlanScreen, ChatScreen].map((Screen, i) => (
                <div key={i} style={{ width: SCREEN_W, padding: "54px 20px 0", boxSizing: "border-box" }}>
                  {/* Solo animamos la pantalla visible o vecina */}
                  {Math.abs(phase - i) <= 1 && <Screen local={frame - PHASES[i].at} />}
                </div>
              ))}
            </div>
          </PhoneMockup>
        </div>
      </div>
    </SafeArea>
  );
};

/* ───────────── 6 · Contraste ───────────── */

const ContrastScene: React.FC = () => {
  const frame = useCurrentFrame();
  const strike = tween(frame, [12, 20], [0, 100], easeInOut);
  const exit = useBlurExit(40, 12);
  return (
    <SafeArea gap={70}>
      <div style={{ ...exit, display: "flex", flexDirection: "column", alignItems: "center", gap: 60 }}>
        <div style={{ ...display, fontSize: 96, color: colors.ink400, position: "relative" }}>
          <LineReveal delay={0}>Otras apps</LineReveal>
          <LineReveal delay={3}>anotan.</LineReveal>
          <div
            style={{
              position: "absolute",
              left: 0,
              bottom: 40,
              height: 12,
              width: `${strike}%`,
              borderRadius: 99,
              background: colors.danger,
            }}
          />
        </div>
        <div style={{ ...display, fontSize: 124 }}>
          <LineReveal delay={14}>Zafi te</LineReveal>
          <LineReveal delay={18}>
            <span style={{ color: colors.electricPale }}>asesora.</span>
          </LineReveal>
        </div>
      </div>
    </SafeArea>
  );
};

/* ───────────── 7 · Logo final ───────────── */

const LogoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const size = 300;
  const stem = tween(frame, [8, 20], [0, 1]);
  const dropT = spring({ frame: frame - 14, fps, config: { damping: 7, stiffness: 140, mass: 0.7 } });
  const dotY = interpolate(dropT, [0, 1], [-900, 0]);
  const landed = frame - 22;
  const ripple = tween(landed, [0, 30], [0, 1]);
  const dot = size * 0.2;

  return (
    <SafeArea gap={40}>
      <div style={{ position: "relative", display: "flex", alignItems: "flex-end" }}>
        {"zaf".split("").map((ch, i) => (
          <div key={ch} style={{ ...display, fontSize: size, lineHeight: 1, letterSpacing: 0 }}>
            <LineReveal delay={i * 3} duration={16}>
              {ch}
            </LineReveal>
          </div>
        ))}
        {/* La "i" se dibuja a mano para animar el palito y el punto por separado */}
        <div style={{ position: "relative", width: size * 0.26, height: size * 0.92, marginLeft: size * 0.02 }}>
          <div
            style={{
              position: "absolute",
              bottom: size * 0.15,
              left: (size * 0.26 - size * 0.17) / 2,
              width: size * 0.17,
              height: size * 0.53,
              borderRadius: size * 0.04,
              background: colors.electricPale,
              transformOrigin: "bottom",
              transform: `scaleY(${stem})`,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: size * 0.06,
              left: (size * 0.26 - dot) / 2,
              width: dot,
              height: dot,
              borderRadius: 99,
              background: colors.electricPale,
              transform: `translateY(${dotY}px)`,
              opacity: frame >= 14 ? 1 : 0,
            }}
          />
          {landed > 0 && (
            <div
              style={{
                position: "absolute",
                top: size * 0.06 + dot / 2,
                left: size * 0.13,
                width: 900 * ripple,
                height: 900 * ripple,
                transform: "translate(-50%, -50%)",
                borderRadius: 999,
                border: `4px solid ${colors.electricPale}`,
                opacity: 0.6 * (1 - ripple),
              }}
            />
          )}
        </div>
      </div>
      <div
        style={{
          ...display,
          fontFamily: fonts.body,
          fontWeight: 500,
          fontSize: 36,
          letterSpacing: "0.14em",
          whiteSpace: "nowrap",
          textTransform: "uppercase",
          color: colors.electricSoft,
        }}
      >
        <LineReveal delay={26}>tu asesor financiero personal</LineReveal>
      </div>
      <div
        style={{
          marginTop: 40,
          padding: "26px 60px",
          borderRadius: 999,
          background: colors.white,
          color: colors.navyDeep,
          fontFamily: fonts.display,
          fontWeight: 800,
          fontSize: 48,
          opacity: tween(frame, [36, 46], [0, 1]),
          transform: `translateY(${tween(frame, [36, 50], [40, 0])}px)`,
        }}
      >
        Pruébalo gratis · {BRAND.url}
      </div>
    </SafeArea>
  );
};

/* ───────────── Composición ───────────── */

export const IntroZafi: React.FC<IntroZafiProps> = ({ mostrarZonasSeguras }) => {
  const frame = useCurrentFrame();
  // Zoom de cámara muy lento durante todo el video: todo se siente vivo.
  const camera = 1 + (frame / M01_DURATION) * 0.05;
  return (
    <AbsoluteFill style={{ background: colors.navyDeep }}>
      <Background />
      <AbsoluteFill style={{ transform: `scale(${camera})` }}>
        <Sequence from={S.no.from} durationInFrames={S.no.dur}>
          <NoScene />
        </Sequence>
        <Sequence from={S.advisor.from} durationInFrames={S.advisor.dur}>
          <AdvisorScene />
        </Sequence>
        <Sequence from={S.phone.from} durationInFrames={S.phone.dur}>
          <PhoneScene />
        </Sequence>
        <Sequence from={S.contrast.from} durationInFrames={S.contrast.dur}>
          <ContrastScene />
        </Sequence>
        <Sequence from={S.logo.from} durationInFrames={S.logo.dur}>
          <LogoScene />
        </Sequence>
      </AbsoluteFill>
      <ElectricLayer>
        <Sequence from={S.question.from} durationInFrames={S.question.dur}>
          <Question />
        </Sequence>
      </ElectricLayer>
      {mostrarZonasSeguras && <SafeZoneGuide />}
    </AbsoluteFill>
  );
};
