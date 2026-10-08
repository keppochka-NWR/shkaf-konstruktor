// Проверка кухонных шаблонов: ошибки правил студии, кухонные детали, смета. npx tsx scripts/kitchen-check.ts
import { initialModule, validate, parts } from "../src/model";
import { kitchenBase, kitchenWall, kitchenWorktop } from "../src/kitchen";
import { newProject } from "../src/project";
import { estimate } from "../src/pricing";

const cases = [
  ["нижний", kitchenBase(initialModule(), 600)],
  ["с ящиками", kitchenBase(initialModule(), 600, "drawers")],
  ["под мойку", kitchenBase(initialModule(), 800, "sink")],
  ["навесной", kitchenWall(initialModule(), 600)],
  ["столешница", kitchenWorktop(initialModule(), 2400)],
] as const;
for (const [name, m] of cases) {
  const e = validate(m), ps = parts(m);
  console.log(`${name}: ошибки ${e.length ? e.join(" | ") : "нет"} | деталей ${ps.length} | ${ps.filter((p) => /kitchen|worktop|leg|rail/.test(p.id)).map((p) => p.id).join(", ")}`);
  if (!e.length) {
    const p = newProject(m); const est = estimate(p);
    console.log("   смета:", est.lines.filter((l) => /worktop|leg|hanger/.test(l.id)).map((l) => `${l.label} ${l.quantity} ${l.unit} × ${l.unitPrice ?? "?"}`).join("; "), "| листов", est.ldspSheets);
  }
}
