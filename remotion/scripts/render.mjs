// Renderiza videos a out/<id>.mp4 listos para Instagram Reels y TikTok.
//
//   npm run render -- F01-QueEsZafi            → un video
//   npm run render -- F01-QueEsZafi G01-...    → varios
//   npm run render:all                         → todos (menos la plantilla)
import { execFileSync } from "node:child_process";

const ENTRY = "src/index.ts";
const args = process.argv.slice(2);
const extra = args.filter((a) => a.startsWith("--") && a !== "--all");
let ids = args.filter((a) => !a.startsWith("--"));

if (args.includes("--all")) {
  const list = execFileSync("npx", ["remotion", "compositions", ENTRY, "--quiet"], {
    encoding: "utf8",
  });
  ids = list.split(/\s+/).filter((id) => id && id !== "Plantilla");
}

if (ids.length === 0) {
  console.error("Indica qué video renderizar, p. ej.: npm run render -- F01-QueEsZafi");
  process.exit(1);
}

for (const id of ids) {
  console.log(`\n▶ Renderizando ${id}…`);
  execFileSync("npx", ["remotion", "render", ENTRY, id, `out/${id}.mp4`, ...extra], {
    stdio: "inherit",
  });
}
console.log("\n✔ Listo. Los videos están en la carpeta out/");
