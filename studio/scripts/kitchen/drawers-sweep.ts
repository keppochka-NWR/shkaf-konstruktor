// Прогон правок размеров по параметрическим модулям кухонь Базиса (public/local-projects/kitchen-kNN.json, только локально):
// width−100 / width+100 (ящики не пересчитываются — как в App.tsx), height+100 / depth+100 с refitKDrawers (как в KitchenPanel).
// «Тихая» поломка — validate() молчит, а partCollisions() находит пересечение деталей (кроме помеченных «как в проекте Базиса»):
// модуль сохранится с пересечением, и проверка этого не покажет. Печатает такие модули; тот же прогон — tests/kitchen-drawers-safety.test.ts.
// npx tsx scripts/kitchen/drawers-sweep.ts [папка проектов] [правки через запятую: width-100,width+100,height+100,depth+100] [out.md]
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { parts, validate, type Module } from "../../src/model";
import { parseProject } from "../../src/project";
import { partCollisions } from "../../src/collisions";
import { refitKDrawers } from "../../src/kitchenDrawers";

export type SweepChange = "none" | "width-100" | "width+100" | "height+100" | "depth+100";
export const SWEEP_CHANGES: SweepChange[] = ["width-100", "width+100", "height+100", "depth+100"];
export type SweepHit = { kitchen: string; index: number; name: string; change: SweepChange; collisions: number; /** пересечений у нетронутого модуля (уже было) */ base: number; first: string };
export type SweepResult = { kitchens: number; modules: number; checked: number; hits: SweepHit[] };

/** Параметрический модуль кухни Базиса: правила m.kitchen, не сырой, не объект ряда/столешница/купе/угловой. */
export const isParametric = (m: Module) => !!m.kitchen && !m.raw && !m.worktop && !m.kupe && !m.corner;

/** Правка размера как в интерфейсе: ширина — только поле (ящики на всю ширину), высота/глубина — с пересчётом ящиков. */
export function applyChange(m: Module, change: SweepChange): Module {
  const n: Module = structuredClone(m);
  if (change === "none") return n;
  if (change.startsWith("width")) { n.width += change.endsWith("-100") ? -100 : 100; return n; }
  if (change === "height+100") { n.height += 100; if (n.kdrawers) n.kdrawers = refitKDrawers(n, "height"); return n; }
  n.depth += 100; if (n.kdrawers) n.kdrawers = refitKDrawers(n, "depth");
  return n;
}
/** Пересечения, о которых проверка должна была сказать: без помеченных «как в проекте Базиса» (отверстие в пазу подсветки k31). */
export function silentCollisions(m: Module) { return partCollisions(parts(m), m).filter((c) => !c.bazis); }

export function drawersSweep(dir = "public/local-projects", changes: SweepChange[] = SWEEP_CHANGES, only?: (m: Module) => boolean): SweepResult {
  const hits: SweepHit[] = [];
  let modules = 0, checked = 0, kitchens = 0;
  if (!existsSync(dir)) return { kitchens, modules, checked, hits };
  for (const f of readdirSync(dir).filter((x) => /^kitchen-k\d\d\.json$/.test(x)).sort()) {
    const p = parseProject(JSON.parse(readFileSync(`${dir}/${f}`, "utf8")));
    const kitchen = f.slice(8, 11);
    kitchens++;
    p.modules.forEach((a, index) => {
      const m = a.module;
      if (!isParametric(m) || (only && !only(m))) return;
      modules++;
      const base = validate(m).length ? -1 : silentCollisions(m).length;
      for (const change of changes) {
        const n = applyChange(m, change);
        if (validate(n).length) continue;
        checked++;
        const cs = silentCollisions(n);
        if (cs.length) hits.push({ kitchen, index, name: m.name, change, collisions: cs.length, base, first: `${cs[0].names[0]} × ${cs[0].names[1]} (${cs[0].depth})` });
      }
    });
  }
  return { kitchens, modules, checked, hits };
}

export function sweepReport(r: SweepResult, changes: SweepChange[] = SWEEP_CHANGES): string {
  const lines = [`# Тихие пересечения после правки размера: модулей ${r.modules} в ${r.kitchens} кухнях, прогонов без ошибок проверки ${r.checked}, тихих ${r.hits.length}`, ""];
  for (const c of changes) {
    const hs = r.hits.filter((h) => h.change === c);
    lines.push(`## ${c}: ${hs.length}`);
    for (const h of hs) lines.push(`- ${h.kitchen} #${h.index} «${h.name}»: пересечений ${h.collisions}${h.base > 0 ? ` (у нетронутого ${h.base})` : ""} — ${h.first}`);
    lines.push("");
  }
  return lines.join("\n");
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("kitchen/drawers-sweep.ts")) {
  const [dirArg, changesArg, out] = process.argv.slice(2);
  const changes = changesArg ? (changesArg.split(",") as SweepChange[]) : SWEEP_CHANGES;
  const r = drawersSweep(dirArg || "public/local-projects", changes);
  const md = sweepReport(r, changes);
  if (out) writeFileSync(out, md);
  console.log(md);
}
