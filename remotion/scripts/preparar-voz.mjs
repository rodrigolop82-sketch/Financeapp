// Prepara la narración de un video: nivela el volumen (-16 LUFS), recorta
// silencios al inicio y al final, y guarda la duración de cada clip.
//
//   node scripts/preparar-voz.mjs c01
//
// Lee  public/audio/voz/<video>/original/NN.mp3
// Crea public/audio/voz/<video>/NN.mp3 y src/videos/como-funciona/tiempos/<video>.json
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const video = process.argv[2];
if (!video) {
  console.error("Uso: node scripts/preparar-voz.mjs <video>   (ej. c01)");
  process.exit(1);
}
const dir = path.join("public", "audio", "voz", video);
const src = path.join(dir, "original");
const outJson = path.join("src", "videos", "como-funciona", "tiempos", `${video}.json`);

// Requiere ffmpeg instalado (Mac: `brew install ffmpeg`). El ffmpeg que trae
// Remotion no incluye los filtros de silencio y volumen.
const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" });
const probe = (file) =>
  Number(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], {
      encoding: "utf8",
    }).trim(),
  );

const trim = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02";
const filter = `${trim},areverse,${trim},areverse,loudnorm=I=-16:TP=-1.5:LRA=11`;

const tiempos = {};
for (const file of fs.readdirSync(src).filter((f) => f.endsWith(".mp3")).sort()) {
  const out = path.join(dir, file);
  ff(["-y", "-i", path.join(src, file), "-af", filter, "-ar", "44100", "-b:a", "192k", out]);
  tiempos[path.basename(file, ".mp3")] = Math.round(probe(out) * 1000) / 1000;
}
fs.mkdirSync(path.dirname(outJson), { recursive: true });
fs.writeFileSync(outJson, JSON.stringify(tiempos, null, 2) + "\n");
console.log(tiempos);
