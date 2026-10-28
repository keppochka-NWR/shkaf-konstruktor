// Свод цен локальных проектов и заказов (до/после правки раскроя и сметы): npx tsx scripts/price-sweep.ts <out.json>
// Печатает только метки (номер заказа или порядковый номер проекта) — имена файлов локальных проектов могут содержать данные клиентов.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseProject } from "../src/project";
import { estimate } from "../src/pricing";
import { nest } from "../src/exports";

const out = process.argv[2];
if (!out) { console.error("usage: price-sweep.ts <out.json>"); process.exit(2); }
const dir = "public/local-projects", rows: Record<string, unknown>[] = [];
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];
files.forEach((f, i) => {
  const order = /(\d{7})(?:-([a-z]))?(?:-(ldsp|mirror))?/.exec(f);
  const label = order ? "заказ " + order[1] + (order[2] ? "-" + order[2] : "") + (order[3] ? " " + order[3] : "") : "P" + String(i + 1).padStart(3, "0");
  try {
    const p = parseProject(JSON.parse(readFileSync(join(dir, f), "utf8")));
    const plan = nest(p), e = estimate(p, plan);
    const kitchen = p.modules.length > 0 && p.modules.every((a) => a.module.kitchen || a.module.raw || a.module.worktop);
    rows.push({ file: f, label, kitchen, sheets: e.ldspSheets, hdf: plan.filter((s) => s.material === "hdf").length, retail: e.retail, byMarkup: e.byMarkupKnown, bySheet: e.bySheet, model: e.model, lines: Object.fromEntries(e.lines.map((l) => [l.id, [l.quantity, l.unitPrice]])) });
  } catch (err) { rows.push({ file: f, label, error: String((err as Error).message).slice(0, 80) }); }
});
writeFileSync(out, JSON.stringify(rows));
console.log("проектов:", rows.length, "ошибок:", rows.filter((r) => r.error).length);
