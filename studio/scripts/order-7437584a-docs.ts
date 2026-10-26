// Заказ 7437584 (изделия 1 и 3): документы функциями студии — КП (quoteHTML → PDF), смета Excel (estimateXLSX), разбивка по изделиям.
// npx tsx scripts/order-7437584a-docs.ts <папка вывода> [снимок.png для КП]
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { chromium } from "playwright";
import { build, productOf, ORDER } from "./order-7437584a";
import { estimate, lineGroup, type PriceLine } from "../src/pricing";
import { estimateXLSX } from "../src/estimateXlsx";
import { quoteHTML } from "../src/exports";
import { moduleQuote } from "../src/itemPrices";
import type { Project } from "../src/project";

const [out = ".", image] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const p = build();
const e = estimate(p);
const rub = (v: number) => Math.round(v).toLocaleString("ru-RU") + " ₽";
/** Разбивка клиенту: материалы (плита, кромка, обработка), работа цеха, фурнитура, розница (склейка), после финального расчёта. */
function breakdown(q: Project) {
  const r = estimate(q), k = r.markup, cost = (l: PriceLine) => l.quantity * (l.unitPrice ?? 0);
  const own = r.lines.filter((l) => !l.retail && l.unitPrice !== null);
  const work = own.filter((l) => /^work(-hdf)?$/.test(l.id)).reduce((s, l) => s + cost(l), 0) * k;
  const material = own.filter((l) => lineGroup(l.id) === "material" && !/^work(-hdf)?$/.test(l.id)).reduce((s, l) => s + cost(l), 0) * k;
  const hardware = own.filter((l) => lineGroup(l.id) === "hardware").reduce((s, l) => s + cost(l), 0) * k;
  const retail = r.lines.filter((l) => l.retail).reduce((s, l) => s + cost(l), 0);
  return { r, material, work, hardware, retail, pending: r.pending.map((l) => `${l.label} — ${l.quantity} ${l.unit}`) };
}
const total = e.retail!;
const mq = moduleQuote(p, total);
const lines: string[] = [];
lines.push(`# Заказ ${ORDER} — изделия 1 и 3: смета студии`, "", `Итог клиенту (обе части одним заказом, общий раскрой): **${rub(total)}**, листов ЛДСП ${e.ldspSheets}, коэффициент ${e.markup}.`, "");
for (const k of [1, 3]) {
  const idx = p.modules.map((m, i) => (productOf(m) === k ? i : -1)).filter((i) => i >= 0);
  const share = mq ? idx.reduce((s, i) => s + mq.prices[i], 0) : null;
  const b = breakdown({ ...p, modules: p.modules.filter((m) => productOf(m) === k) });
  lines.push(`## Изделие ${k}`, "", `- Цена в составе заказа (доля общего итога по изделиям, как в КП): **${share === null ? "—" : rub(share)}**`,
    `- Отдельным заказом (свой раскрой): ${rub(b.r.retail ?? 0)} · листов ЛДСП ${b.r.ldspSheets}`,
    `- Разбивка отдельного заказа: материалы ${rub(b.material)} · работа цеха ${rub(b.work)} · фурнитура ${rub(b.hardware)} · розница (склейка) ${rub(b.retail)} (до округления итога к 100 ₽)`,
    `- После финального расчёта (в цену не входят): ${b.pending.length ? b.pending.join("; ") : "нет"}`, "",
    "| Позиция | Кол-во | Цена закупки | Сумма |", "|---|---|---|---|",
    ...b.r.lines.map((l) => `| ${l.label}${l.retail ? " (розница)" : ""}${l.pending ? " — после финального расчёта" : ""} | ${l.quantity} ${l.unit} | ${l.unitPrice ?? "—"} | ${l.unitPrice === null ? "—" : Math.round(l.quantity * l.unitPrice)} |`), "");
}
// Решение Макса 26.10: цена клиенту — от БОЛЬШЕЙ из моделей (коэффициент 2,2 или «цена за лист 23 000» + то, что вне листовой модели)
const models = (q: Project) => { const r = estimate(q), s = estimate({ ...q, calculation: { markup: r.markup, overrides: {}, ...(q.calculation ?? {}), model: "sheet", sheetPrice: 23000 } }); return { markup: r.byMarkup ?? 0, sheet: s.bySheet, shown: Math.max(r.byMarkup ?? 0, s.bySheet), sheets: r.ldspSheets }; };
lines.push("## Цена по двум моделям (решение Макса 26.10: показываем большую)", "", "| | Коэффициент 2,2 | Лист 23 000 + вне листа | Показанная (большая) | Листов |", "|---|---|---|---|---|");
for (const [name, q] of [["Изделие 1 (отдельно)", { ...p, modules: p.modules.filter((m) => productOf(m) === 1) }], ["Изделие 3 (отдельно)", { ...p, modules: p.modules.filter((m) => productOf(m) === 3) }], ["Заказ целиком (общий раскрой)", p]] as [string, Project][]) { const v = models(q); lines.push(`| ${name} | ${rub(v.markup)} | ${rub(v.sheet)} | **${rub(v.shown)}** | ${v.sheets} |`); }
lines.push("");
const all = breakdown(p);
lines.push("## Весь заказ (общий раскрой)", "", `материалы ${rub(all.material)} · работа цеха ${rub(all.work)} · фурнитура ${rub(all.hardware)} · розница ${rub(all.retail)} · итог ${rub(total)}`, `После финального расчёта: ${all.pending.join("; ") || "нет"}`, "");
writeFileSync(`${out}/смета-изделия-1-3.md`, lines.join("\n"));
writeFileSync(`${out}/Смета заказ ${ORDER} изделия 1-3.xlsx`, await estimateXLSX(p, e));
const img = image && existsSync(image) ? "data:image/png;base64," + readFileSync(image).toString("base64") : undefined;
const html = quoteHTML(p, `Заказ ${ORDER}`, String(total), "Изделие 1 — шкаф в прихожую справа от двери (антресоль с откидным фасадом, скамья, щит, подвесной ящик). Изделие 3 — шкаф в прихожую слева от входной двери 1600 × 2590 × 400. ЛДСП Lamarty Клауд. Позиции «после финального расчёта» в цену не входят.", img, { cost: e, items: mq?.prices ?? null, pending: mq?.pending ?? null });
writeFileSync(`${out}/КП заказ ${ORDER} изделия 1-3.html`, html);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
await page.pdf({ path: `${out}/КП заказ ${ORDER} изделия 1-3.pdf`, format: "A4", printBackground: true, margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" } });
await browser.close();
console.log(lines.slice(0, 3).join("\n"));
for (const k of [1, 3]) console.log(lines.find((l) => l.startsWith(`## Изделие ${k}`)), "|", lines[lines.findIndex((l) => l.startsWith(`## Изделие ${k}`)) + 2], "|", lines[lines.findIndex((l) => l.startsWith(`## Изделие ${k}`)) + 3], "|", lines[lines.findIndex((l) => l.startsWith(`## Изделие ${k}`)) + 4], "|", lines[lines.findIndex((l) => l.startsWith(`## Изделие ${k}`)) + 5]);
console.log(lines.find((l) => l.startsWith("материалы")));
