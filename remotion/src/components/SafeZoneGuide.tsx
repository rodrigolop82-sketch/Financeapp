import React from "react";
import { AbsoluteFill } from "remotion";
import { SAFE } from "../config/formats";

/**
 * Guía visual (solo para revisar en el Studio): marca en rojo las zonas
 * que Instagram/TikTok tapan con su interfaz. Actívala con la prop
 * `mostrarZonasSeguras` del video.
 */
export const SafeZoneGuide: React.FC = () => {
  const zone: React.CSSProperties = {
    position: "absolute",
    background: "rgba(239, 68, 68, 0.28)",
    border: "2px dashed rgba(239, 68, 68, 0.9)",
  };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ ...zone, top: 0, left: 0, right: 0, height: SAFE.top }} />
      <div style={{ ...zone, bottom: 0, left: 0, right: 0, height: SAFE.bottom }} />
      <div
        style={{
          ...zone,
          top: SAFE.top,
          bottom: SAFE.bottom,
          right: 0,
          width: SAFE.right,
        }}
      />
    </AbsoluteFill>
  );
};
