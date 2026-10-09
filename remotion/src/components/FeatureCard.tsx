import React from "react";
import type { LucideIcon } from "lucide-react";
import { colors, fonts } from "../brand/theme";
import { IconBubble } from "./IconBubble";

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  accent?: string;
  width?: number | string;
};

/** Tarjeta con ícono + título + descripción corta. */
export const FeatureCard: React.FC<Props> = ({
  icon,
  title,
  description,
  accent = colors.electric,
  width = "100%",
}) => (
  <div
    style={{
      width,
      display: "flex",
      alignItems: "center",
      gap: 36,
      padding: "34px 40px",
      borderRadius: 40,
      background: "rgba(255,255,255,0.97)",
      boxShadow: "0 24px 60px rgba(13,31,54,0.35)",
      boxSizing: "border-box",
    }}
  >
    <IconBubble icon={icon} background={accent} />
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 50,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          color: colors.navyDeep,
        }}
      >
        {title}
      </div>
      {description && (
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 34,
            lineHeight: 1.3,
            color: colors.ink500,
          }}
        >
          {description}
        </div>
      )}
    </div>
  </div>
);
