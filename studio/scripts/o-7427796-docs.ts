// КП (PDF), смета Excel и цены по изделиям для заказа 7427796 — функциями студии (quoteHTML, estimateXLSX, moduleQuote).
// npx tsx scripts/o-7427796-docs.ts — читает local-projects и снимки заказа, пишет документы в папку заказа (вне git).
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { parseProject } from "../src/project";
import { estimate } from "../src/pricing";
import { quoteHTML, quoteBreakdown, splitRows } from "../src/exports";
import { estimateXLSX } from "../src/estimateXlsx";
import { moduleQuote } from "../src/itemPrices";
import { describeModule, plainFeatures } from "../src/quoteDescribe";
import { nodeSwatches } from "./kpSwatches"; // образцы текстур в КП (26.10.2026: были пустые квадраты)

const LP = "C:/Users/My PC/Desktop/Claude Project/Конструктор-claude/studio/public/local-projects/";
const OUT = "C:/Users/My PC/Desktop/Claude Project/Кухни/ГардерЁб/Заказы/7427796/";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const summary: Record<string, unknown> = {};
for (const [v, title] of [["ldsp", "Вариант 1 — дверь ЛДСП"], ["mirror", "Вариант 2 — зеркальная дверь"]] as const) {
  const p = parseProject(JSON.parse(readFileSync(LP + `order-7427796-${v}.json`, "utf8")));
  const e = estimate(p), price = e.retail!;
  const mq = moduleQuote(p, price);
  p.offer = { customer: "Заказ 7427796 · " + title, price: String(price), notes: "" };
  const img = "data:image/png;base64," + readFileSync(OUT + `снимки-${v}/1-3d-room-side.png`).toString("base64");
  const html = quoteHTML(p, "Заказ 7427796 · " + title, String(price), "Цена — по большей из двух моделей (коэффициент или цена за лист с зеркалом сверху). Фурнитура Blum. Позиции после финального расчёта конструктором в цену не входят.", img, { swatches: await nodeSwatches(p), cost: e, items: mq?.prices ?? null, pending: mq?.pending ?? null });
  writeFileSync(OUT + `КП 7427796 — ${v === "ldsp" ? "вариант 1 ЛДСП" : "вариант 2 зеркало"}.html`, html, "utf8");
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({ path: OUT + `КП 7427796 — ${v === "ldsp" ? "вариант 1 ЛДСП" : "вариант 2 зеркало"}.pdf`, format: "A4", printBackground: true, margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" } });
  await page.close();
  writeFileSync(OUT + `Смета 7427796 — ${v === "ldsp" ? "вариант 1 ЛДСП" : "вариант 2 зеркало"}.xlsx`, await estimateXLSX(p, e));
  const split = quoteBreakdown(String(price), e);
  summary[v] = {
    price, byMarkup: e.byMarkup, bySheet: e.bySheet, bySheetFull: e.bySheet, outsideSheet: e.offSheet, priceMax: e.maxModel, sheets: e.ldspSheets,
    byModuleMarkup: e.byMarkup === null ? null : moduleQuote(p, e.byMarkup)?.prices ?? null, byModuleSheet: moduleQuote(p, e.bySheet)?.prices ?? null, knownCost: e.knownCost, split: split ? splitRows(split) : null,
    modules: p.modules.map((a, i) => ({ name: a.module.name, size: describeModule(a.module).size, price: mq?.prices[i] ?? null, pending: mq?.pending[i] ?? false, kind: describeModule(a.module).kind, filling: [...describeModule(a.module).filling, ...plainFeatures(a.module)], materials: describeModule(a.module).materials })),
    pending: e.pending.map((l) => ({ label: l.label, q: l.quantity, unit: l.unit, source: l.source })),
    lines: e.lines.map((l) => ({ id: l.id, label: l.label, q: l.quantity, unit: l.unit, price: l.unitPrice, retail: !!l.retail, pending: !!l.pending, source: l.source })),
  };
}
await browser.close();
writeFileSync(OUT + "расчёт-данные.json", JSON.stringify(summary, null, 1), "utf8");
for (const [v, s] of Object.entries(summary) as [string, any][]) {
  console.log(`== ${v}: показано ${s.price} ₽ (коэф. ${s.byMarkup}; лист ${s.bySheet} + вне листа ${s.outsideSheet} = ${s.bySheetFull}); листов ${s.sheets}; разбивка ${JSON.stringify(s.split)}`);
  console.log("   по изделиям коэф.: " + JSON.stringify(s.byModuleMarkup) + " · лист: " + JSON.stringify(s.byModuleSheet));
  for (const m of s.modules) console.log(`   ${m.name} ${m.size}: ${m.price} ₽${m.pending ? " (+ позиции после расчёта)" : ""}`);
}
