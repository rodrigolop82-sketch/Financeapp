import React from "react";
import { AbsoluteFill } from "remotion";
import { SAFE } from "../config/formats";

type Props = {
  children: React.ReactNode;
  justify?: React.CSSProperties["justifyContent"];
  align?: React.CSSProperties["alignItems"];
  gap?: number;
};

/** Contenedor que mantiene el contenido fuera de las zonas que tapa la app. */
export const SafeArea: React.FC<Props> = ({
  children,
  justify = "center",
  align = "center",
  gap = 40,
}) => (
  <AbsoluteFill
    style={{
      paddingTop: SAFE.top,
      paddingBottom: SAFE.bottom,
      paddingLeft: SAFE.left,
      paddingRight: SAFE.right,
      display: "flex",
      flexDirection: "column",
      justifyContent: justify,
      alignItems: align,
      gap,
    }}
  >
    {children}
  </AbsoluteFill>
);
