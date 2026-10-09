// Piezas para tipografía cinética fluida (entradas con máscara, máquina de escribir…).
import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

/** Curva "expo out": arranca rápido y frena suave. */
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
/** Curva "in-out" para transiciones de pantalla completa. */
export const easeInOut = Easing.bezier(0.7, 0, 0.3, 1);

/** interpolate con clamp y easing por defecto. */
export const tween = (
  frame: number,
  [a, b]: [number, number],
  [from, to]: [number, number],
  easing = easeOut,
) =>
  interpolate(frame, [a, b], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

type LineRevealProps = {
  children: React.ReactNode;
  /** Frame en que entra */
  delay?: number;
  /** Frame en que sale hacia arriba (opcional) */
  exitAt?: number;
  duration?: number;
  style?: React.CSSProperties;
};

/** Línea de texto que sube desde detrás de una máscara (entrada limpia, sin fade). */
export const LineReveal: React.FC<LineRevealProps> = ({
  children,
  delay = 0,
  exitAt,
  duration = 18,
  style,
}) => {
  const frame = useCurrentFrame();
  const enter = tween(frame, [delay, delay + duration], [110, 0]);
  const exit = exitAt === undefined ? 0 : tween(frame, [exitAt, exitAt + duration], [0, -110], easeInOut);
  return (
    <div style={{ overflow: "hidden", paddingBottom: "0.08em", marginBottom: "-0.08em", ...style }}>
      <div style={{ transform: `translateY(${enter + exit}%)` }}>{children}</div>
    </div>
  );
};

/** Escribe el texto letra por letra. */
export const Typewriter: React.FC<{
  text: string;
  delay?: number;
  charsPerFrame?: number;
  cursor?: boolean;
}> = ({ text, delay = 0, charsPerFrame = 2, cursor = false }) => {
  const frame = useCurrentFrame();
  const count = Math.max(0, Math.floor((frame - delay) * charsPerFrame));
  const done = count >= text.length;
  return (
    <span>
      {text.slice(0, count)}
      {cursor && !done && count > 0 && <span style={{ opacity: 0.5 }}>|</span>}
    </span>
  );
};
