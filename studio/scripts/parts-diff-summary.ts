// Свод отличий от эталона parts-snapshot по видам деталей: npx tsx scripts/parts-diff-summary.ts
// (тот же набор изделий, что scripts/parts-snapshot.ts; эталон .qa/parts-baseline.json). Печатает по изделиям: сколько деталей какого вида
// изменилось и как (размер/положение по осям), без имён клиентов — только ключи файлов примеров и шаблонов.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parts, initialModule, type Module } from "../src/model";
import { parseProject } from "../src/project";
import { createModule, type ModuleKind } from "../src/ModulePalette";
import { isWardrobeImportFile } from "./wardrobe/files";

const base = JSON.parse(readFileSync(".qa/parts-baseline.json", "utf8")) as Record<string, Record<string, string>>;
const sets = new Map<string, Module>();
for (const dir of ["examples", "examples/orders", "public/local-projects"]) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) if (f.endsWith(".json") && !f.startsWith("kitchen") && !isWardrobeImportFile(f)) {
    try { parseProject(JSON.parse(readFileSync(join(dir, f), "utf8"))).modules.forEach((a, i) => sets.set(`${dir}/${f}#${i}:${a.module.name}`, a.module)); } catch { /* как в snapshot */ }
  }
}
const kinds: [ModuleKind, number, number, number][] = [["empty", 800, 2200, 600], ["shelves", 800, 2000, 400], ["wardrobe", 1000, 2200, 600], ["drawers", 600, 850, 550], ["corner", 1050, 2000, 450], ["desk", 1200, 750, 600], ["kupe", 1600, 2400, 100]];
for (const [k, w, h, d] of kinds) { try { sets.set(`palette:${k}`, createModule(k, w, h, d, initialModule())); } catch { /* */ } }
const r = (v: number) => Math.round(v * 100) / 100;
const kind = (id: string, name: string) => /:shelf:\d+$/.test(id) ? (/жёсткая/.test(name) ? "полка жёсткая" : "полка съёмная") : /:drawer-cap$/.test(id) ? "полка над ящиками" : /:divider$/.test(id) ? "перегородка"
  : /^layout:/.test(id) ? "проём (составной)" : /^shp:/.test(id) ? "полкодержатель" : /^(fast|ecc|dowel):/.test(id) ? "крепёж" : /hinge/.test(id) ? "петля" : /light/.test(id) ? "подсветка" : "прочее: " + name;
const total = new Map<string, number>();
let modules = 0;
for (const [k, m] of sets) {
  const a = base[k]; if (!a) continue;
  const ids = new Map<string, string>(), norm = (s: string) => s.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (u) => { if (!ids.has(u)) ids.set(u, "s" + ids.size); return ids.get(u)!; });
  const b: Record<string, string> = {};
  for (const p of parts(m)) b[norm(p.id)] = JSON.stringify([p.name, p.role, p.material, p.size.map(r), p.position.map(r), p.model?.file ?? ""]);
  const by = new Map<string, string[]>();
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[id] === b[id]) continue;
    const pa = a[id] ? JSON.parse(a[id]) : null, pb = b[id] ? JSON.parse(b[id]) : null, kk = kind(id, (pb ?? pa)[0]);
    const what = !pa ? "+" : !pb ? "−" : `${pa[3][2]}→${pb[3][2]} по глубине` + (pa[3][0] !== pb[3][0] || pa[3][1] !== pb[3][1] ? ` · габарит ${pa[3].join("×")}→${pb[3].join("×")}` : "") + (pa[4][0] !== pb[4][0] || pa[4][1] !== pb[4][1] ? " · сдвиг X/Y" : "");
    (by.get(kk) ?? by.set(kk, []).get(kk)!).push(what);
    total.set(kk, (total.get(kk) ?? 0) + 1);
  }
  if (!by.size) continue;
  modules++;
  console.log(k.replace(/#.*$/, (s) => s.slice(0, 3)) + ":", [...by].map(([kk, v]) => `${kk} ${v.length} (${[...new Set(v)].slice(0, 2).join("; ")})`).join(" | "));
}
console.log(`\nИзделий с отличиями: ${modules} из ${Object.keys(base).length}`);
for (const [kk, n] of [...total].sort((x, y) => y[1] - x[1])) console.log(`  ${kk}: ${n}`);
