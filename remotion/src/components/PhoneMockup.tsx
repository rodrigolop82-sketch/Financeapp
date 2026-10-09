import React from "react";
import { colors } from "../brand/theme";

type Props = {
  children: React.ReactNode;
  width?: number;
  screenBackground?: string;
  /** Agranda el contenido de la pantalla para que se lea bien en el celular */
  zoom?: number;
  style?: React.CSSProperties;
};

/** Marco de teléfono para mostrar pantallas de la app (o capturas en <Img/>). */
export const PhoneMockup: React.FC<Props> = ({
  children,
  width = 560,
  screenBackground = colors.surfaceTint,
  zoom = 1,
  style,
}) => {
  const height = width * 2.05;
  const bezel = width * 0.035;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: width * 0.13,
        background: "#0B1220",
        padding: bezel,
        boxShadow:
          "0 60px 120px rgba(0,0,0,0.45), inset 0 0 0 3px rgba(255,255,255,0.08)",
        position: "relative",
        ...style,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: width * 0.1,
          background: screenBackground,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div style={{ zoom, width: "100%", height: "100%" }}>{children}</div>
        {/* Isla dinámica */}
        <div
          style={{
            position: "absolute",
            top: width * 0.035,
            left: "50%",
            transform: "translateX(-50%)",
            width: width * 0.3,
            height: width * 0.075,
            borderRadius: 999,
            background: "#0B1220",
          }}
        />
      </div>
    </div>
  );
};
