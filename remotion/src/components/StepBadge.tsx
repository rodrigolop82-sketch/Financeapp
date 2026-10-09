import React from "react";
import { colors, fonts } from "../brand/theme";

/** Etiqueta "PASO 1" para guías prácticas. */
export const StepBadge: React.FC<{ step: number; label?: string }> = ({
  step,
  label = "Paso",
}) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 18,
      padding: "14px 34px 14px 14px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.12)",
      border: "2px solid rgba(255,255,255,0.18)",
      fontFamily: fonts.display,
      fontWeight: 700,
      fontSize: 40,
      color: colors.white,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
    }}
  >
    <span
      style={{
        width: 72,
        height: 72,
        borderRadius: 999,
        background: colors.electric,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 42,
        letterSpacing: 0,
      }}
    >
      {step}
    </span>
    {label} {step}
  </div>
);
