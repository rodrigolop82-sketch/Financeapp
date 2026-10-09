// Formato vertical para Instagram Reels y TikTok (9:16).
export const VERTICAL = {
  width: 1080,
  height: 1920,
  fps: 30,
} as const;

/** Convierte segundos a frames con el fps del formato vertical. */
export const sec = (s: number) => Math.round(s * VERTICAL.fps);

/**
 * Zonas seguras: áreas que tapan la interfaz de Instagram/TikTok
 * (usuario, descripción, botones de like/compartir). No pongas texto
 * importante dentro de estos márgenes.
 */
export const SAFE = {
  top: 220,
  bottom: 420,
  left: 72,
  right: 160,
} as const;
