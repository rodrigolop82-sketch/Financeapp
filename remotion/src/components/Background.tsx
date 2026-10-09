import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { colors } from "../brand/theme";

type Props = { variant?: "navy" | "light" };

/** Fondo de marca con manchas de luz que se mueven lentamente. */
export const Background: React.FC<Props> = ({ variant = "navy" }) => {
  const frame = useCurrentFrame();
  const drift = (speed: number, range: number) =>
    Math.sin((frame / 30) * speed) * range;

  const isNavy = variant === "navy";
  const base = isNavy
    ? `linear-gradient(170deg, ${colors.navyDeep} 0%, ${colors.navy} 55%, ${colors.navyMid} 100%)`
    : `linear-gradient(170deg, ${colors.white} 0%, ${colors.surfaceTint} 60%, ${colors.electricGhost} 100%)`;
  const glowOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const blob = (
    color: string,
    size: number,
    x: number,
    y: number,
    opacity: number,
  ): React.CSSProperties => ({
    position: "absolute",
    width: size,
    height: size,
    left: x,
    top: y,
    borderRadius: "50%",
    background: color,
    filter: "blur(140px)",
    opacity: opacity * glowOpacity,
  });

  return (
    <AbsoluteFill style={{ background: base, overflow: "hidden" }}>
      <div
        style={blob(
          colors.electric,
          900,
          -300 + drift(0.4, 80),
          -200 + drift(0.3, 60),
          isNavy ? 0.45 : 0.18,
        )}
      />
      <div
        style={blob(
          colors.electricPale,
          800,
          500 + drift(0.35, 90),
          1300 + drift(0.5, 70),
          isNavy ? 0.3 : 0.2,
        )}
      />
    </AbsoluteFill>
  );
};
