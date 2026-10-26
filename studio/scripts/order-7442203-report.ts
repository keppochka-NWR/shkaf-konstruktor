// Заказ 7442203: данные для отчёта — цена клиенту по изделиям (modulePrices, как «Цены по изделиям» в КП), разбивка сметы,
// позиции «после финального расчёта», варианты материалов. npx tsx scripts/order-7442203-report.ts [out.json]
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parseProject, applyAutoFillers, type Project } from "../src/project";
import { estimate, lineGroup } from "../src/pricing";
import { moduleQuote } from "../src/itemPrices";
import { project, CORNER_IDS, PENCIL_IDS } from "./order-7442203";

function summary(p: Project) {
  const e = estimate(p), total = e.retail!, q = moduleQuote(p, total)!;
  const share = (ids: string[]) => p.modules.reduce((s, a, i) => s + (ids.includes(a.id) ? q.prices[i] : 0), 0);
  const cost = (f: (id: string) => boolean) => Math.round(e.lines.filter((l) => !l.retail && f(l.id)).reduce((s, l) => s + l.quantity * (l.unitPrice ?? 0), 0));
  return {
    total, corner: share(CORNER_IDS), pencil: share(PENCIL_IDS), split: e.split, retailExtras: e.retailExtras, markup: e.markup, knownCost: e.knownCost, sheets: e.ldspSheets, bySheet: e.bySheet,
    costMaterialSheets: cost((id) => id.startsWith("sheet:")), costEdge: cost((id) => /^edge|^small$/.test(id)), costWork: cost((id) => /^work/.test(id)), costHardware: cost((id) => lineGroup(id) === "hardware"),
    pending: e.lines.filter((l) => l.pending).map((l) => ({ id: l.id, label: l.label, q: l.quantity, unit: l.unit })),
    retail: e.lines.filter((l) => l.retail).map((l) => ({ label: l.label, q: l.quantity, price: l.unitPrice })),
    lines: e.lines.map((l) => ({ id: l.id, label: l.label, q: l.quantity, unit: l.unit, price: l.unitPrice, retail: !!l.retail, pending: !!l.pending })),
  };
}
const base = applyAutoFillers(parseProject(JSON.parse(JSON.stringify(project))));
const out: Record<string, unknown> = { base: summary(base) };
for (const [d, f] of [["Бамбук", "МАРЦИПАН"], ["Кейптаун", "Тэффи"], ["Кейптаун", "МАРЦИПАН"]]) {
  const v: Project = structuredClone(base); v.modules.forEach((a) => { a.module.decor = d; a.module.facadeDecor = f; });
  const s = summary(v); out[`${d}/${f}`] = { total: s.total, corner: s.corner, pencil: s.pencil, sheets: s.sheets };
}
void execFileSync;
const file = process.argv[2];
if (file) writeFileSync(file, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, (k, v) => (k === "lines" ? undefined : v), 1));
