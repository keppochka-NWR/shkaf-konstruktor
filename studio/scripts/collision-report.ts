// Пересечения деталей во всех изделиях студии: шаблоны палитры, кухонные шаблоны, примеры, заказы, локальные проекты.
// npx tsx scripts/collision-report.ts [--all]   (--all — печатать каждую пару, иначе сводка по типам)
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parts, initialModule, type Module } from "../src/model";
import { parseProject } from "../src/project";
import { createModule, type ModuleKind } from "../src/ModulePalette";
import { kitchenBase, kitchenWall, kitchenWorktop } from "../src/kitchen";
import { partCollisions, hingeCollisions } from "../src/collisions";

const sets = new Map<string, Module>();
for (const dir of ["examples", "examples/orders", "public/local-projects"]) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) if (f.endsWith(".json")) {
    try { parseProject(JSON.parse(readFileSync(join(dir, f), "utf8"))).modules.forEach((a, i) => sets.set(`${f}#${i}:${a.module.name}`, a.module)); } catch (e) { console.error("пропущен", f, (e as Error).message); }
  }
}
const kinds: [ModuleKind, number, number, number][] = [["empty", 800, 2200, 600], ["shelves", 800, 2000, 400], ["wardrobe", 1000, 2200, 600], ["drawers", 600, 850, 550], ["corner", 1050, 2000, 450], ["desk", 1200, 750, 600]];
for (const [k, w, h, d] of kinds) sets.set(`palette:${k}`, createModule(k, w, h, d, initialModule()));
for (const w of [300, 450, 600, 800, 900]) {
  sets.set(`kitchen:base-doors ${w}`, kitchenBase(initialModule(), w));
  sets.set(`kitchen:base-drawers ${w}`, kitchenBase(initialModule(), w, "drawers"));
  sets.set(`kitchen:sink ${w}`, kitchenBase(initialModule(), w, "sink"));
  sets.set(`kitchen:wall ${w}`, kitchenWall(initialModule(), w));
}
sets.set("kitchen:worktop", kitchenWorktop(initialModule(), 2400));

const all = process.argv.includes("--all");
const kind = (id: string) => id.replace(/^(fast|ecc|shp|leg|kitchen-[a-z]+):.*/, "$1").replace(/^.*?:(hingecup|hingeplate|door|shelf|rail|drawer|handle|slide|back|top|bottom|left|right|divider|plinth|rod|flange|latch)\b.*$/, "$1").replace(/^[0-9a-f-]{36}:?/, "");
const byType = new Map<string, { n: number; where: Set<string>; depth: number }>();
let total = 0, hinge = 0;
for (const [k, m] of sets) {
  const c = partCollisions(parts(m), m);
  total += c.length; hinge += hingeCollisions(c).length;
  for (const x of c) {
    const t = [kind(x.a), kind(x.b)].sort().join(" × ");
    const r = byType.get(t) ?? { n: 0, where: new Set(), depth: 0 };
    r.n++; r.where.add(k.replace(/#\d+:.*/, "")); r.depth = Math.max(r.depth, x.depth); byType.set(t, r);
    if (all) console.log(`${k}: ${x.names[0]} [${x.a}] × ${x.names[1]} [${x.b}] — ${x.depth} мм`);
  }
}
console.log(`изделий ${sets.size}, пересечений ${total}, из них с петлями ${hinge}`);
for (const [t, r] of [...byType].sort((a, b) => b[1].n - a[1].n)) console.log(`${String(r.n).padStart(5)}  ${t}  (до ${r.depth} мм) — ${[...r.where].slice(0, 4).join(", ")}${r.where.size > 4 ? " …" : ""}`);
