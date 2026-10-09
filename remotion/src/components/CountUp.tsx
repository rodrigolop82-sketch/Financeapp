import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { BRAND } from "../brand/theme";

type Props = {
  to: number;
  from?: number;
  delay?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  style?: React.CSSProperties;
};

/** Número que cuenta hacia arriba (por defecto en quetzales). */
export const CountUp: React.FC<Props> = ({
  to,
  from = 0,
  delay = 0,
  duration = 45,
  prefix = `${BRAND.currency} `,
  suffix = "",
  decimals = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const value = interpolate(frame - delay, [0, duration], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const formatted = value.toLocaleString("es-GT", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};
