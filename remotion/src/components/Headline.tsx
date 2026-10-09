import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fonts } from "../brand/theme";

type Props = {
  /** Texto. Envuelve palabras en *asteriscos* para resaltarlas en azul. */
  text: string;
  size?: number;
  color?: string;
  highlight?: string;
  delay?: number;
  /** Frames entre palabra y palabra */
  stagger?: number;
  align?: "center" | "left";
  weight?: number;
};

/** Titular que aparece palabra por palabra, estilo Reels/TikTok. */
export const Headline: React.FC<Props> = ({
  text,
  size = 96,
  color = colors.white,
  highlight = colors.electricPale,
  delay = 0,
  stagger = 3,
  align = "center",
  weight = 800,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Marca cada palabra como resaltada si está entre *asteriscos* (pueden ser varias).
  let inside = false;
  const words = text.split(" ").map((raw) => {
    const opens = raw.startsWith("*");
    if (opens) inside = true;
    const highlighted = inside;
    if (raw.replace(/[.,!?¡¿:;]+$/, "").endsWith("*")) inside = false;
    return { word: raw.replace(/\*/g, ""), highlighted };
  });

  return (
    <div
      style={{
        fontFamily: fonts.display,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1.08,
        letterSpacing: "-0.03em",
        textAlign: align,
        color,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "center" ? "center" : "flex-start",
        columnGap: size * 0.25,
      }}
    >
      {words.map(({ word, highlighted }, i) => {
        const p = spring({
          frame: frame - delay - i * stagger,
          fps,
          config: { damping: 12, stiffness: 160 },
        });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              color: highlighted ? highlight : undefined,
              opacity: interpolate(p, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
              transform: `translateY(${interpolate(p, [0, 1], [40, 0])}px) scale(${interpolate(p, [0, 1], [0.85, 1])})`,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
