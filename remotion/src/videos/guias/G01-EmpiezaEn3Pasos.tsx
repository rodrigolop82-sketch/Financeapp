// G01 · Guía práctica: empieza a controlar tus finanzas en 3 pasos.
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Check, Mic, Target, Utensils } from "lucide-react";
import { colors, fonts } from "../../brand/theme";
import {
  Background,
  CallToAction,
  CountUp,
  Headline,
  IconBubble,
  PhoneMockup,
  Reveal,
  SafeArea,
  SafeZoneGuide,
  StepBadge,
} from "../../components";
import { sec } from "../../config/formats";

export type EmpiezaEn3PasosProps = { mostrarZonasSeguras: boolean };

const T = 12;
const SCENES = [sec(3), sec(5), sec(5), sec(5), sec(4.5)];
export const G01_DURATION = SCENES.reduce((a, b) => a + b, 0) - T * (SCENES.length - 1);
const transition = linearTiming({ durationInFrames: T });

/** Escena de un paso: etiqueta + titular + pantalla de la app. */
const StepScene: React.FC<{ step: number; title: string; children: React.ReactNode }> = ({
  step,
  title,
  children,
}) => (
  <SafeArea gap={44}>
    <Reveal from="scale">
      <StepBadge step={step} />
    </Reveal>
    <Headline text={title} size={76} delay={6} />
    <Reveal delay={16} from="bottom" distance={220}>
      <PhoneMockup width={500} zoom={1.3}>
        <div style={{ padding: "70px 22px 0", fontFamily: fonts.body, height: "100%", boxSizing: "border-box" }}>
          {children}
        </div>
      </PhoneMockup>
    </Reveal>
  </SafeArea>
);

const Row: React.FC<{ label: string; value: React.ReactNode; color?: string }> = ({
  label,
  value,
  color = colors.navyDeep,
}) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "22px 24px",
      marginBottom: 16,
      borderRadius: 24,
      background: colors.white,
      boxShadow: "0 6px 18px rgba(13,31,54,0.08)",
      fontSize: 26,
      color: colors.ink700,
    }}
  >
    <span>{label}</span>
    <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 30, color }}>{value}</span>
  </div>
);

const Tip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      marginTop: 10,
      padding: "18px 20px",
      borderRadius: 20,
      background: colors.electricGhost,
      fontSize: 22,
      lineHeight: 1.35,
      color: colors.navy,
      textAlign: "center",
    }}
  >
    {children}
  </div>
);

const Paso1: React.FC = () => (
  <>
    <div style={{ fontSize: 24, color: colors.ink500, marginBottom: 20 }}>Tu mes en números</div>
    <Reveal delay={30}>
      <Row label="Ingresos" value={<CountUp to={8500} delay={34} />} color={colors.success} />
    </Reveal>
    <Reveal delay={40}>
      <Row label="Gastos fijos" value={<CountUp to={5200} delay={44} />} color={colors.danger} />
    </Reveal>
    <Reveal delay={50}>
      <Row label="Te queda" value={<CountUp to={3300} delay={56} />} color={colors.electric} />
    </Reveal>
    <Reveal delay={80}>
      <Tip>Zafi te sugiere ahorrar Q 850 este mes</Tip>
    </Reveal>
  </>
);

const Paso2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pulse = 1 + Math.max(0, Math.sin(frame / 5)) * 0.08 * (frame < 60 ? 1 : 0);
  const added = spring({ frame: frame - 60, fps, config: { damping: 13 } });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}>
      <div
        style={{
          fontSize: 26,
          color: colors.ink700,
          textAlign: "center",
          fontStyle: "italic",
          opacity: interpolate(frame, [25, 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        “Almuerzo, 45 quetzales”
      </div>
      <div style={{ transform: `scale(${pulse})`, margin: "28px 0" }}>
        <IconBubble icon={Mic} size={120} />
      </div>
      <div
        style={{
          width: "100%",
          opacity: added,
          transform: `translateY(${interpolate(added, [0, 1], [60, 0])}px)`,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: 16,
          borderRadius: 24,
          background: colors.white,
          boxShadow: "0 6px 18px rgba(13,31,54,0.1)",
          boxSizing: "border-box",
        }}
      >
        <IconBubble icon={Utensils} size={64} background={colors.warning} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 28, color: colors.navyDeep }}>Almuerzo</div>
          <div style={{ fontSize: 22, color: colors.ink500 }}>Comida · hoy</div>
        </div>
        <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 28, color: colors.danger, whiteSpace: "nowrap" }}>-Q 45</div>
      </div>
      <div
        style={{
          marginTop: 24,
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 24,
          color: colors.success,
          opacity: interpolate(frame, [75, 85], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        <Check size={28} color={colors.success} strokeWidth={3} /> Registrado
      </div>
      <div style={{ width: "100%", marginTop: 26, opacity: 0.55 }}>
        <Row label="Gasolina" value="-Q 200" color={colors.ink700} />
        <Row label="Café" value="-Q 25" color={colors.ink700} />
      </div>
    </div>
  );
};

const Paso3: React.FC = () => {
  const frame = useCurrentFrame();
  const pct = interpolate(frame, [30, 90], [0, 65], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 30 }}>
        <IconBubble icon={Target} size={80} background={colors.success} />
        <div>
          <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 30, color: colors.navyDeep }}>
            Fondo de emergencia
          </div>
          <div style={{ fontSize: 22, color: colors.ink500 }}>Meta: Q 10,000</div>
        </div>
      </div>
      <div style={{ height: 30, borderRadius: 99, background: colors.successLight, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: colors.success }} />
      </div>
      <div
        style={{
          marginTop: 16,
          fontFamily: fonts.display,
          fontWeight: 800,
          fontSize: 56,
          color: colors.success,
          textAlign: "center",
        }}
      >
        {Math.round(pct)}%
      </div>
      <Reveal delay={95}>
        <div
          style={{
            marginTop: 10,
            padding: "18px 22px",
            borderRadius: 20,
            background: colors.electricGhost,
            fontSize: 24,
            color: colors.navy,
            textAlign: "center",
          }}
        >
          ¡Vas muy bien! Sigue así
        </div>
      </Reveal>
      <Reveal delay={105} style={{ marginTop: 26 }}>
        <Row label="Viaje familiar" value="30%" color={colors.warning} />
        <Row label="Pagar tarjeta" value="80%" color={colors.electric} />
      </Reveal>
    </>
  );
};

export const EmpiezaEn3Pasos: React.FC<EmpiezaEn3PasosProps> = ({ mostrarZonasSeguras }) => (
  <AbsoluteFill>
    <Background />
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={SCENES[0]}>
        <SafeArea>
          <Headline text="Controla tus finanzas en *3 pasos*" size={112} />
        </SafeArea>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={transition} />

      <TransitionSeries.Sequence durationInFrames={SCENES[1]}>
        <StepScene step={1} title="Cuéntale a Zafi *cuánto ganas y gastas*">
          <Paso1 />
        </StepScene>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={transition} />

      <TransitionSeries.Sequence durationInFrames={SCENES[2]}>
        <StepScene step={2} title="Registra cada gasto *en segundos*">
          <Paso2 />
        </StepScene>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={transition} />

      <TransitionSeries.Sequence durationInFrames={SCENES[3]}>
        <StepScene step={3} title="Sigue tu plan y *mira tu progreso*">
          <Paso3 />
        </StepScene>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={transition} />

      <TransitionSeries.Sequence durationInFrames={SCENES[4]}>
        <CallToAction title="Empieza hoy, toma 2 minutos" />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    {mostrarZonasSeguras && <SafeZoneGuide />}
  </AbsoluteFill>
);
