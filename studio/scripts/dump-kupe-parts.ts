// Детали купе из kupeParts в JSON (для проверки разреза scripts/draw_kupe_assembly.py): npx tsx scripts/dump-kupe-parts.ts <out.json> [система]
import { writeFileSync } from "node:fs";
import { kupeParts } from "../src/kupe";
import { createKupeModule } from "../src/ModulePalette";
import { initialModule } from "../src/model";
const [out, system] = process.argv.slice(2);
const m = createKupeModule(1600, 2400, initialModule());
if (system) m.kupe = { ...m.kupe!, system };
writeFileSync(out, JSON.stringify({ height: m.height, depth: m.depth, system: m.kupe!.system, parts: kupeParts(m).map((p) => ({ id: p.id, size: p.size, position: p.position, model: p.model ?? null })) }));
console.log("saved", out);
