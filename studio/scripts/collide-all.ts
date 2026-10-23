// Пересечения деталей и ошибки проверки по всем изделиям набора parts-snapshot (примеры, заказы, локальные проекты, шаблоны палитры):
// npx tsx scripts/collide-all.ts [out.json] — для сравнения «до/после» правки правил (имена клиентов маскируются).
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parts, initialModule, validate, type Module } from "../src/model";
import { parseProject } from "../src/project";
import { createModule, type ModuleKind } from "../src/ModulePalette";
import { partCollisions } from "../src/collisions";
import { isWardrobeImportFile, maskPersonal } from "./wardrobe/files";

const sets = new Map<string, Module>();
for (const dir of ["examples", "examples/orders", "public/local-projects"]) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) if (f.endsWith(".json") && !f.startsWith("kitchen") && !isWardrobeImportFile(f)) {
    try { parseProject(JSON.parse(readFileSync(join(dir, f), "utf8"))).modules.forEach((a, i) => sets.set(maskPersonal(`${dir}/${f}`) + `#${i}`, a.module)); } catch { /* как в snapshot */ }
  }
}
const kinds: [ModuleKind, number, number, number][] = [["empty", 800, 2200, 600], ["shelves", 800, 2000, 400], ["wardrobe", 1000, 2200, 600], ["drawers", 600, 850, 550], ["corner", 1050, 2000, 450], ["desk", 1200, 750, 600], ["kupe", 1600, 2400, 100]];
for (const [k, w, h, d] of kinds) { try { sets.set(`palette:${k}`, createModule(k, w, h, d, initialModule())); } catch { /* */ } }
const res: Record<string, { hits: string[]; errors: string[] }> = {};
for (const [k, m] of sets) {
  let hits: string[] = [];
  try { hits = partCollisions(parts(m), m).map((c) => c.names.join(" × ")); } catch (e) { hits = ["ошибка: " + (e as Error).message]; }
  res[k] = { hits, errors: validate(m) };
}
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(res));
const bad = Object.entries(res).filter(([, v]) => v.hits.length || v.errors.length);
console.log(`изделий ${Object.keys(res).length}, с пересечениями ${Object.values(res).filter((v) => v.hits.length).length}, с ошибками проверки ${Object.values(res).filter((v) => v.errors.length).length}`);
for (const [k, v] of bad.slice(0, 40)) console.log(" ", k, v.hits.length ? "× " + v.hits.slice(0, 2).join("; ") : "", v.errors.length ? "! " + v.errors[0] : "");
