// Заказ 7437584, изделия 2, 4, 5: КП (PDF через системный Chrome), смета Excel и таблица цен по изделиям — из сборки функциями.
// npx tsx scripts/order-7437584-b-docs.ts <outDir>
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { estimate } from "../src/pricing";
import { estimateXLSX } from "../src/estimateXlsx";
import { quoteHTML } from "../src/exports";
import { modulePrices } from "../src/itemPrices";
import { lineGroup } from "../src/pricing";
import { orderProject, PRODUCTS } from "./order-7437584-b";

const out = process.argv[2];
mkdirSync(out, { recursive: true });
const p = orderProject(), e = estimate(p), total = e.byMarkup ?? e.bySheet ?? 0;
writeFileSync(`${out}/smeta-7437584-izd-2-4-5.xlsx`, await estimateXLSX(p, e));
const mp = modulePrices(p, total) ?? [];
const rows = PRODUCTS.map(([label, re]) => {
  const sub = { ...p, modules: p.modules.filter((a) => re.test(a.module.name)) }, es = estimate(sub);
  const kupe = es.lines.filter((l) => l.id.startsWith("kupe")).reduce((s, l) => s + (l.total ?? 0), 0);
  const mat = es.lines.filter((l) => !l.retail && lineGroup(l.id) === "material").reduce((s, l) => s + (l.total ?? 0), 0);
  const hw = es.lines.filter((l) => !l.retail && lineGroup(l.id) === "hardware").reduce((s, l) => s + (l.total ?? 0), 0);
  return { label, share: p.modules.reduce((s, a, i) => (re.test(a.module.name) ? s + (mp[i] ?? 0) : s), 0), alone: es.byMarkup ?? es.bySheet, sheets: es.ldspSheets, kupeDoors: kupe, materialCost: Math.round(mat), hardwareCost: Math.round(hw), pending: es.pending?.length ?? 0 };
});
const kupeTotal = e.lines.filter((l) => l.id.startsWith("kupe")).reduce((s, l) => s + (l.total ?? 0), 0);
const summary = { total, markup: e.markup, sheets: e.ldspSheets, split: e.split, retailExtras: e.retailExtras, kupeDoors: kupeTotal, pending: (e.pending ?? []).map((l) => l.label), missing: e.missing.map((l) => l.label), rows,
  lines: e.lines.map((l) => ({ id: l.id, label: l.label, q: Math.round(l.quantity * 1000) / 1000, unit: l.unit, price: l.unitPrice, total: l.total, retail: !!l.retail })) };
writeFileSync(`${out}/estimate-7437584-izd-2-4-5.json`, JSON.stringify(summary, null, 1));
const html = quoteHTML(p, "Заказ 7437584", total.toLocaleString("ru-RU") + " ₽", "Изделия 2, 4, 5. Двери купе — ЛДСП Клауд (материал дверей не указан, допущение). Позиции «после финального расчёта» в итог не входят.");
writeFileSync(`${out}/kp-7437584-izd-2-4-5.html`, html);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
await page.pdf({ path: `${out}/kp-7437584-izd-2-4-5.pdf`, format: "A4", printBackground: true });
await browser.close();
console.log(JSON.stringify({ total, sheets: e.ldspSheets, split: e.split, retail: e.retailExtras, kupeDoors: kupeTotal, rows, pending: summary.pending, missing: summary.missing }, null, 1));
