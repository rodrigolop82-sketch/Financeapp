// F01 · ¿Qué es Zafi? — recorrido rápido por las funcionalidades principales.
import React from "react";
import { AbsoluteFill } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import {
  FileText,
  HeartPulse,
  MessageCircle,
  Mic,
  Target,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { Wordmark } from "../../brand/Wordmark";
import { BRAND, colors, fonts } from "../../brand/theme";
import {
  Background,
  CallToAction,
  CountUp,
  FeatureCard,
  Headline,
  IconBubble,
  PhoneMockup,
  Reveal,
  SafeArea,
  SafeZoneGuide,
} from "../../components";
import { sec } from "../../config/formats";

export type QueEsZafiProps = { mostrarZonasSeguras: boolean };

const T = 12; // duración de cada transición (frames)
const SCENES = [sec(3), sec(2.5), sec(4.5), sec(4.5), sec(4), sec(4.5)];
export const F01_DURATION = SCENES.reduce((a, b) => a + b, 0) - T * (SCENES.length - 1);

const transition = linearTiming({ durationInFrames: T });

const FeatureList: React.FC<{
  title: string;
  items: { icon: typeof Mic; title: string; description: string; accent?: string }[];
}> = ({ title, items }) => (
  <SafeArea gap={44}>
    <Headline text={title} size={88} />
    {items.map((item, i) => (
      <Reveal key={item.title} delay={14 + i * 12} from="right" style={{ width: "100%" }}>
        <FeatureCard {...item} />
      </Reveal>
    ))}
  </SafeArea>
);

const DashboardScene: React.FC = () => (
  <SafeArea gap={50}>
    <Headline text="Tu dinero, *claro* en un vistazo" size={80} />
    <Reveal delay={12} from="bottom" distance={200}>
      <PhoneMockup width={520} zoom={1.25}>
        <div style={{ padding: "80px 26px 0", fontFamily: fonts.body }}>
          <div style={{ fontSize: 26, color: colors.ink500 }}>Disponible este mes</div>
          <div
            style={{
              fontFamily: fonts.display,
              fontWeight: 800,
              fontSize: 72,
              color: colors.navyDeep,
              letterSpacing: "-0.03em",
            }}
          >
            <CountUp to={4250} delay={25} />
          </div>
          {[
            { label: "Comida", pct: 0.62, color: colors.electric },
            { label: "Transporte", pct: 0.4, color: colors.success },
            { label: "Entretenimiento", pct: 0.85, color: colors.warning },
          ].map((row, i) => (
            <Reveal key={row.label} delay={35 + i * 8} style={{ marginTop: 34 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 26,
                  color: colors.ink700,
                  marginBottom: 10,
                }}
              >
                <span>{row.label}</span>
                <span>{Math.round(row.pct * 100)}%</span>
              </div>
              <div style={{ height: 18, borderRadius: 99, background: colors.electricGhost }}>
                <div
                  style={{
                    height: "100%",
                    width: `${row.pct * 100}%`,
                    borderRadius: 99,
                    background: row.color,
                  }}
                />
              </div>
            </Reveal>
          ))}
          <Reveal delay={65} style={{ marginTop: 36 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                padding: 20,
                borderRadius: 24,
                background: colors.white,
                boxShadow: "0 6px 18px rgba(13,31,54,0.08)",
              }}
            >
              <IconBubble icon={HeartPulse} size={70} background={colors.success} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, color: colors.ink500, whiteSpace: "nowrap" }}>Tu salud financiera</div>
                <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 28, color: colors.navyDeep, whiteSpace: "nowrap" }}>
                  Muy buena
                </div>
              </div>
              <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 48, color: colors.success }}>
                <CountUp to={78} delay={70} prefix="" />
              </div>
            </div>
          </Reveal>
        </div>
      </PhoneMockup>
    </Reveal>
  </SafeArea>
);

export const QueEsZafi: React.FC<QueEsZafiProps> = ({ mostrarZonasSeguras }) => (
  <AbsoluteFill>
    <Background />
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={SCENES[0]}>
        <SafeArea>
          <Headline text="¿A fin de mes *no sabes* a dónde se fue tu *dinero?*" size={104} />
        </SafeArea>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={transition} />

      <TransitionSeries.Sequence durationInFrames={SCENES[1]}>
        <SafeArea gap={30}>
          <Reveal>
            <div style={{ fontFamily: fonts.body, fontSize: 56, color: colors.electricSoft }}>
              Conoce a
            </div>
          </Reveal>
          <Reveal delay={8} from="scale">
            <Wordmark size={300} withTagline />
          </Reveal>
        </SafeArea>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={transition} />

      <TransitionSeries.Sequence durationInFrames={SCENES[2]}>
        <FeatureList
          title="Registra *sin esfuerzo*"
          items={[
            { icon: Mic, title: "Con tu voz", description: "Dilo y Zafi lo anota" },
            { icon: FileText, title: "Estado de cuenta", description: "Súbelo en foto o PDF" },
            { icon: MessageCircle, title: "Chat con Zafi", description: "Pregunta lo que quieras" },
          ]}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={transition} />

      <TransitionSeries.Sequence durationInFrames={SCENES[3]}>
        <FeatureList
          title="Planea con *claridad*"
          items={[
            { icon: Wallet, title: "Presupuesto", description: "Hecho a tu medida", accent: colors.success },
            { icon: Target, title: "Metas de ahorro", description: "Solo o en familia", accent: colors.warning },
            { icon: TrendingDown, title: "Sal de deudas", description: "Un plan paso a paso", accent: colors.danger },
          ]}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={transition} />

      <TransitionSeries.Sequence durationInFrames={SCENES[4]}>
        <DashboardScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={transition} />

      <TransitionSeries.Sequence durationInFrames={SCENES[5]}>
        <CallToAction subtitle={`${BRAND.url} · link en la bio`} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    {mostrarZonasSeguras && <SafeZoneGuide />}
  </AbsoluteFill>
);
