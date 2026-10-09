// Configuración de Remotion: https://www.remotion.dev/docs/config
// Aplica a `npm run dev` (Studio) y a los renders desde la CLI.
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
// Calidad alta para que Instagram/TikTok no destruyan el video al recomprimir.
Config.setCrf(18);
Config.setPixelFormat("yuv420p");
Config.setOverwriteOutput(true);
