// Заказ 7441182: сверка сборки МЫШЬЮ (файл, сохранённый менеджером кнопкой «Сохранить проект файлом») со сборкой ФУНКЦИЯМИ
// (scripts/order-7441182.ts → public/local-projects/order-7441182-*.json): детали (название, размеры, декор) и строки сметы.
// npx tsx scripts/order-7441182-compare.ts <manager.json> <functions.json> [out.json]
import { readFileSync, writeFileSync } from "node:fs";
import { parts } from "../src/model";
import { parseProject } from "../src/project";
import { estimate } from "../src/pricing";

const [mf, ff, outFile] = process.argv.slice(2);
const load = (f: string) => parseProject(JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, "")));
const a = load(mf), b = load(ff);
/** Деталь как строка: размеры (округлены до 0,5), декор, материал, роль; без id и координат модуля — имена корпусов у менеджера свои. */
const key = (p: ReturnType<typeof parts>[number]) => [p.role, p.material, p.decor, ...p.size.map((v) => Math.round(v * 2) / 2)].join("|") + "|" + p.name.replace(/\s+\d+$/, "");
const bag = (p: ReturnType<typeof load>) => { const m = new Map<string, number>(); for (const x of p.modules) for (const q of parts(x.module)) m.set(key(q), (m.get(key(q)) ?? 0) + 1); return m; };
const A = bag(a), B = bag(b), diff: string[] = [];
for (const k of new Set([...A.keys(), ...B.keys()])) if ((A.get(k) ?? 0) !== (B.get(k) ?? 0)) diff.push(`${k}: мышью ${A.get(k) ?? 0}, функциями ${B.get(k) ?? 0}`);
const ea = estimate(a), eb = estimate(b), lineDiff: string[] = [];
const lk = (e: typeof ea) => new Map(e.lines.map((l) => [l.id, `${Math.round(l.quantity * 1000) / 1000} ${l.unit} × ${l.unitPrice ?? "?"}`]));
const LA = lk(ea), LB = lk(eb);
for (const k of new Set([...LA.keys(), ...LB.keys()])) if (LA.get(k) !== LB.get(k)) lineDiff.push(`${k}: мышью ${LA.get(k) ?? "—"}, функциями ${LB.get(k) ?? "—"}`);
const pos = (p: typeof a) => p.modules.map((x) => `${x.module.width}×${x.module.height}×${x.module.depth} @ ${x.x},${x.y ?? 0},${x.z}`).sort();
const res = { manager: mf, functions: ff, partsTotal: { manager: [...A.values()].reduce((s, v) => s + v, 0), functions: [...B.values()].reduce((s, v) => s + v, 0) }, partsDiff: diff,
  price: { manager: ea.retail, functions: eb.retail }, sheets: { manager: ea.ldspSheets, functions: eb.ldspSheets }, linesDiff: lineDiff, positions: { manager: pos(a), functions: pos(b) } };
console.log(JSON.stringify(res, null, 1));
if (outFile) writeFileSync(outFile, JSON.stringify(res, null, 1));
