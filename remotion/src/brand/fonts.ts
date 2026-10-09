// Carga las mismas fuentes que usa la app (Outfit + DM Sans) desde public/fonts,
// así el render funciona sin internet. Remotion espera a que terminen de
// cargar antes de dibujar cada frame.
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const fontFamily = "Outfit";
export const bodyFamily = "DM Sans";
export const serifFamily = "DM Serif Display";

const load = (family: string, file: string, weight: string) =>
  loadFont({
    family,
    url: staticFile(`fonts/${file}-latin-${weight}-normal.woff2`),
    weight,
    format: "woff2",
  });

for (const w of ["400", "600", "700", "800", "900"]) load(fontFamily, "outfit", w);
for (const w of ["400", "500", "700"]) load(bodyFamily, "dm-sans", w);
for (const style of ["normal", "italic"] as const)
  loadFont({
    family: serifFamily,
    url: staticFile(`fonts/dm-serif-display-latin-400-${style}.woff2`),
    weight: "400",
    style,
    format: "woff2",
  });
