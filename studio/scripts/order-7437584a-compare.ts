// Заказ 7437584 (а): сравнение сборки мышью (проект из localStorage сценария) со сборкой функциями (order-7437584a.ts).
// npx tsx scripts/order-7437584a-compare.ts <mouse-project.json>
import { readFileSync } from "node:fs";
import { build } from "./order-7437584a";
import { parseProject, applyAutoFillers, type Project, type PlacedModule } from "../src/project";
import { parts } from "../src/model";
import { estimate } from "../src/pricing";

const mouse = applyAutoFillers(parseProject(JSON.parse(readFileSync(process.argv[2], "utf8"))));
const fn = build();
const sig = (a: PlacedModule) => parts(a.module).filter((p) => p.role !== "fastener" || true).map((p) => `${p.role}|${p.material}|${p.size.map((v) => Math.round(v)).join("×")}|${p.position.map((v) => Math.round(v)).join(",")}`).sort();
const key = (a: PlacedModule) => `${Math.round(a.x)}:${Math.round(a.y ?? 0)}`;
let diffs = 0;
const used = new Set<string>();
for (const f of fn.modules) {
  const m = mouse.modules.find((x) => !used.has(x.id) && Math.abs(x.x - f.x) < 2 && Math.abs((x.y ?? 0) - (f.y ?? 0)) < 2);
  if (!m) { console.log(`НЕТ мышью: ${f.module.name} (${key(f)})`); diffs++; continue; }
  used.add(m.id);
  const a = sig(f), b = sig(m), onlyF = a.filter((s) => !b.includes(s)), onlyM = b.filter((s) => !a.includes(s));
  if (onlyF.length || onlyM.length) { diffs++; console.log(`≠ ${f.module.name} (${key(f)}): только функциями ${onlyF.length}, только мышью ${onlyM.length}`); for (const s of onlyF.slice(0, 4)) console.log("   ф " + s); for (const s of onlyM.slice(0, 4)) console.log("   м " + s); }
  else console.log(`= ${f.module.name} (${key(f)}): деталей ${a.length}`);
}
for (const m of mouse.modules) if (!used.has(m.id)) { console.log(`ЛИШНИЙ мышью: ${m.module.name} (${key(m)})`); diffs++; }
const ef = estimate(fn), em = estimate(mouse as Project);
console.log(`Цена: функциями ${ef.retail} ₽, мышью ${em.retail} ₽; листов ${ef.ldspSheets} / ${em.ldspSheets}; модулей с расхождением: ${diffs}`);
const lf = new Map(ef.lines.map((l) => [l.id, l.quantity])), lm = new Map(em.lines.map((l) => [l.id, l.quantity]));
for (const id of new Set([...lf.keys(), ...lm.keys()])) if (lf.get(id) !== lm.get(id)) console.log(`  строка ${id}: функциями ${lf.get(id) ?? "—"}, мышью ${lm.get(id) ?? "—"}`);
