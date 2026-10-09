// Импорт кухонь из эталонов Базиса в проекты студии (сборка — buildKitchen.ts).
// npx tsx scripts/kitchen/import.ts [k14,k25|all] [папка]  → <папка>/kitchen-kNN.json + kitchens.json (по умолчанию public/local-projects;
// только локально, не публикуется). Сетки фурнитуры копируются в public/models/hardware/bazis.
import { readFileSync, readdirSync, writeFileSync, existsSync, copyFileSync, statSync, mkdirSync } from "node:fs";
import { parseProject } from "../../src/project";
import { buildKitchen } from "./buildKitchen";

const ET = "C:/Users/My PC/Desktop/Claude Project/Кухни/etalon", LIB = "C:/Users/My PC/Desktop/Claude Project/Кухни/hardware-lib/glb", PUB = "public/models/hardware/bazis";
const arg = process.argv[2] ?? "all";
const OUTDIR = process.argv[3] ?? "public/local-projects";
mkdirSync(OUTDIR, { recursive: true });
const files = readdirSync(ET).filter((f) => /^k\d\d\.json$/.test(f)).sort().filter((f) => arg === "all" || arg.split(",").includes(f.slice(0, 3)));
const index: { id: string; title: string; modules: number; parametric: number; raw: number }[] = existsSync(`${OUTDIR}/kitchens.json`) ? JSON.parse(readFileSync(`${OUTDIR}/kitchens.json`, "utf8")) : [];
const meshes = new Set<string>();

for (const f of files) {
  const k = f.slice(0, 3), e = JSON.parse(readFileSync(`${ET}/${f}`, "utf8"));
  const { project: p, parametric, raw, rowPanels, notes } = buildKitchen(e, meshes);
  let ok = true;
  try { parseProject(JSON.parse(JSON.stringify(p))); } catch (x) { ok = false; notes.push("не читается: " + (x as Error).message); }
  writeFileSync(`${OUTDIR}/kitchen-${k}.json`, JSON.stringify(p));
  const title = `Кухня ${k.toUpperCase()} · ${p.modules.length} объектов`;
  const at = index.findIndex((x) => x.id === k); const row = { id: k, title, modules: p.modules.length, parametric, raw };
  if (at >= 0) index[at] = row; else index.push(row);
  console.log(`${k}: модулей ${e.modules.length} · параметрических ${parametric} · сырых ${raw} · ряд ${rowPanels} дет. ${notes.length ? "· " + notes.join("; ") : ""}${ok ? "" : " · НЕ ЧИТАЕТСЯ"}`);
}
writeFileSync(`${OUTDIR}/kitchens.json`, JSON.stringify(index.sort((a, b) => a.id.localeCompare(b.id)), null, 1));
// сетки фурнитуры для сырых модулей
let copied = 0, bytes = 0;
for (const mid of meshes) {
  const src = `${LIB}/${mid}.glb`, dst = `${PUB}/${mid}.glb`;
  if (existsSync(src) && !existsSync(dst)) { copyFileSync(src, dst); copied++; bytes += statSync(src).size; }
}
console.log(`сетки фурнитуры: нужно ${meshes.size}, скопировано новых ${copied} (${Math.round(bytes / 1024)} КБ)`);
