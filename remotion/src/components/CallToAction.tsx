import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Wordmark } from "../brand/Wordmark";
import { BRAND, colors, fonts } from "../brand/theme";
import { Reveal } from "./Reveal";
import { SafeArea } from "./SafeArea";

type Props = {
  title?: string;
  button?: string;
  subtitle?: string;
};

/** Escena final con logo, botón y enlace. Úsala al cierre de cada video. */
export const CallToAction: React.FC<Props> = ({
  title = "Toma el control de tu dinero hoy",
  button = "Empieza gratis",
  subtitle = `${BRAND.url} · link en la bio`,
}) => {
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(frame / 6) * 0.025;
  const shine = interpolate(frame % 60, [0, 60], [-120, 220]);

  return (
    <SafeArea gap={70}>
      <Reveal from="scale">
        <Wordmark size={220} withTagline />
      </Reveal>
      <Reveal delay={10}>
        <div
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 72,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: colors.white,
            textAlign: "center",
          }}
        >
          {title}
        </div>
      </Reveal>
      <Reveal delay={20}>
        <div
          style={{
            transform: `scale(${pulse})`,
            position: "relative",
            overflow: "hidden",
            padding: "38px 90px",
            borderRadius: 999,
            background: colors.electric,
            boxShadow: `0 24px 60px ${colors.electric}88`,
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 60,
            color: colors.white,
          }}
        >
          {button}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${shine}%`,
              width: "30%",
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
              transform: "skewX(-20deg)",
            }}
          />
        </div>
      </Reveal>
      <Reveal delay={30}>
        <div
          style={{
            fontFamily: fonts.body,
            fontWeight: 500,
            fontSize: 42,
            color: colors.electricSoft,
          }}
        >
          {subtitle}
        </div>
      </Reveal>
    </SafeArea>
  );
};
