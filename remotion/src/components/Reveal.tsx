import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

type Props = {
  children: React.ReactNode;
  /** Frames de espera antes de aparecer */
  delay?: number;
  /** Desde dónde entra */
  from?: "bottom" | "top" | "left" | "right" | "scale";
  distance?: number;
  style?: React.CSSProperties;
};

/** Hace aparecer cualquier elemento con un rebote suave. */
export const Reveal: React.FC<Props> = ({
  children,
  delay = 0,
  from = "bottom",
  distance = 80,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });
  const offset = interpolate(p, [0, 1], [distance, 0]);
  const transform = {
    bottom: `translateY(${offset}px)`,
    top: `translateY(${-offset}px)`,
    left: `translateX(${-offset}px)`,
    right: `translateX(${offset}px)`,
    scale: `scale(${interpolate(p, [0, 1], [0.6, 1])})`,
  }[from];

  return (
    <div
      style={{
        opacity: interpolate(p, [0, 0.6], [0, 1], { extrapolateRight: "clamp" }),
        transform,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
