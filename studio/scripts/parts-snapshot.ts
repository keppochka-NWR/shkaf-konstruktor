// Снимок регрессии деталей: все шкафы студии (примеры, заказы, локальные проекты, шаблоны палитры) → .qa/parts-baseline.json.
// npx tsx scripts/parts-snapshot.ts --write   — записать эталон (перед правками)
// npx tsx scripts/parts-snapshot.ts           — сравнить с эталоном: какие детали появились, пропали, сдвинулись (код выхода 1 при отличиях)
// Кухонные проекты (kitchen-*) и шкафы из базы Базиса (wardrobe-*, wardrobes.json — сырой импорт) не входят: их меняем намеренно.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parts, initialModule, type Module } from "../src/model";
import { parseProject } from "../src/project";
import { createModule, type ModuleKind } from "../src/ModulePalette";

const out = ".qa/parts-baseline.json";
const sets = new Map<string, Module>();
const addProject = (label: string, file: string) => {
  try {
    const p = parseProject(JSON.parse(readFileSync(file, "utf8")));
    p.modules.forEach((a, i) => sets.set(`${label}#${i}:${a.module.name}`, a.module));
  } catch (e) { console.error("пропущен", label, (e as Error).message); }
};
for (const dir of ["examples", "examples/orders", "public/local-projects"]) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) if (f.endsWith(".json") && !f.startsWith("kitchen") && !/^wardrobe/.test(f)) addProject(`${dir}/${f}`, join(dir, f));
}
const kinds: [ModuleKind, number, number, number][] = [["empty", 800, 2200, 600], ["shelves", 800, 2000, 400], ["wardrobe", 1000, 2200, 600], ["drawers", 600, 850, 550], ["corner", 1050, 2000, 450], ["desk", 1200, 750, 600], ["kupe", 1600, 2400, 100]];
for (const [k, w, h, d] of kinds) { try { sets.set(`palette:${k}`, createModule(k, w, h, d, initialModule())); } catch (e) { console.error("палитра", k, (e as Error).message); } }

const r = (v: number) => Math.round(v * 100) / 100;
const snap: Record<string, Record<string, string>> = {};
for (const [k, m] of sets) {
  const rows: Record<string, string> = {}, ids = new Map<string, string>();
  // id секций у шаблонов палитры случайные — заменяем на порядковые s0, s1…
  const norm = (s: string) => s.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (u) => { if (!ids.has(u)) ids.set(u, "s" + ids.size); return ids.get(u)!; });
  for (const p of parts(m)) rows[norm(p.id)] = JSON.stringify([p.name, p.role, p.material, p.size.map(r), p.position.map(r), p.model?.file ?? ""]);
  snap[k] = rows;
}
if (process.argv.includes("--write")) {
  mkdirSync(".qa", { recursive: true });
  writeFileSync(out, JSON.stringify(snap));
  console.log("эталон записан:", Object.keys(snap).length, "изделий,", Object.values(snap).reduce((s, v) => s + Object.keys(v).length, 0), "деталей");
} else {
  const base = JSON.parse(readFileSync(out, "utf8")) as typeof snap;
  let diffs = 0;
  for (const k of new Set([...Object.keys(base), ...Object.keys(snap)])) {
    const a = base[k] ?? {}, b = snap[k] ?? {};
    const lines: string[] = [];
    for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(id in b)) lines.push(`  − ${id} ${a[id]}`);
      else if (!(id in a)) lines.push(`  + ${id} ${b[id]}`);
      else if (a[id] !== b[id]) lines.push(`  ~ ${id}\n      было  ${a[id]}\n      стало ${b[id]}`);
    }
    if (lines.length) { diffs += lines.length; console.log(k); console.log(lines.slice(0, 12).join("\n") + (lines.length > 12 ? `\n  … ещё ${lines.length - 12}` : "")); }
  }
  console.log(diffs ? `ОТЛИЧИЙ: ${diffs}` : "шкафы без изменений");
  process.exit(diffs ? 1 : 0);
}
