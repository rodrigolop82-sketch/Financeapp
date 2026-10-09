import React from "react";
import type { LucideIcon } from "lucide-react";
import { colors } from "../brand/theme";

type Props = {
  icon: LucideIcon;
  size?: number;
  color?: string;
  background?: string;
};

export const IconBubble: React.FC<Props> = ({
  icon: Icon,
  size = 110,
  color = colors.white,
  background = colors.electric,
}) => (
  <div
    style={{
      width: size,
      height: size,
      minWidth: size,
      borderRadius: size * 0.3,
      background,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: `0 16px 40px ${background}55`,
    }}
  >
    <Icon size={size * 0.52} color={color} strokeWidth={2.2} />
  </div>
);
