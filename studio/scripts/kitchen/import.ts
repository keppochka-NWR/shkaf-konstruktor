// Импорт кухонь из эталонов Базиса в проекты студии (сборка — buildKitchen.ts): модуль, прошедший сверку (PASS), — параметрический;
// остальные — «сырые» (детали Базиса как есть). Объекты ряда (столешница, цоколь, стеновые панели, профили) — отдельный сырой объект «Ряд».
// npx tsx scripts/kitchen/import.ts [k14,k25|all] [outDir] [--et=<папка эталонов>] [--out=<папка проектов>]
//   → <outDir|public/local-projects>/kitchen-kNN.json + kitchens.json (только локально, не публикуется). Сетки фурнитуры копируются
//   в public/models/hardware/bazis.
//   outDir (вторым аргументом или --out) — своя папка вместо общей local-projects (рабочие копии не пишут в общую);
//   --et (или KITCHEN_ETALON) — другая сборка эталонов; основная — Кухни\etalon (Кухни\etalon-n3 — та же сборка, k*.json совпадают).
import { readFileSync, readdirSync, writeFileSync, existsSync, copyFileSync, statSync, mkdirSync } from "node:fs";
import { parseProject } from "../../src/project";
import { buildKitchen } from "./buildKitchen";

const argv = process.argv.slice(2), opt = (n: string) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3), pos = argv.filter((a) => !a.startsWith("--"));
const ET = opt("et") ?? process.env.KITCHEN_ETALON ?? "C:/Users/My PC/Desktop/Claude Project/Кухни/etalon", LIB = "C:/Users/My PC/Desktop/Claude Project/Кухни/hardware-lib/glb", PUB = "public/models/hardware/bazis";
// своя папка вывода (вторым аргументом или --out): рабочие копии не пишут в общую public/local-projects
const OUTDIR = opt("out") ?? pos[1] ?? "public/local-projects";
if (!existsSync(OUTDIR)) mkdirSync(OUTDIR, { recursive: true });
const arg = pos[0] ?? "all";
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
