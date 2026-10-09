import React from "react";
import { colors, fonts } from "./theme";

type Props = {
  size?: number;
  variant?: "dark" | "light";
  withTagline?: boolean;
};

/** Logotipo "zafi" igual al de la app (components/brand/Wordmark.tsx). */
export const Wordmark: React.FC<Props> = ({
  size = 160,
  variant = "dark",
  withTagline = false,
}) => {
  const base = variant === "dark" ? colors.white : colors.navy;
  const accent = variant === "dark" ? colors.electricPale : colors.electric;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <span
        style={{
          fontFamily: fonts.display,
          fontWeight: 800,
          fontSize: size,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          color: base,
        }}
      >
        zaf<span style={{ color: accent }}>i</span>
      </span>
      {withTagline && (
        <span
          style={{
            fontFamily: fonts.body,
            fontWeight: 500,
            fontSize: size * 0.13,
            whiteSpace: "nowrap",
            textAlign: "center",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            marginTop: size * 0.12,
            color: variant === "dark" ? colors.electricSoft : colors.electric,
          }}
        >
          tu planeador financiero
        </span>
      )}
    </div>
  );
};
