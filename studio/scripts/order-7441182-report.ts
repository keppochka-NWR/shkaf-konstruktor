// Заказ 7441182: цифры для отчёта «Расчёт.md» из проектов, собранных функциями (public/local-projects/order-7441182-*.json):
// цена клиенту по большей модели (решение Макса 26.10.2026) — по коэффициенту, за лист и показанная; разбивки обеих моделей;
// «после финального расчёта»; цены по изделиям в трёх моделях (modulePrices: доля итога, как в КП); разница вариантов.
// npx tsx scripts/order-7441182-report.ts [out.md] [out.json]
import { readFileSync, writeFileSync } from "node:fs";
import { parseProject } from "../src/project";
import { estimate, lineGroup } from "../src/pricing";
import { isOffSheetLine } from "../src/clientPrices";
import { modulePrices } from "../src/itemPrices";
import { pendingPrice } from "../src/pendingPrices";

const rub = (n: number) => (n < 0 ? "−" : "") + Math.abs(Math.round(n)).toLocaleString("ru-RU").replace(/ /g, " ") + " ₽";
const sgn = (n: number) => (n > 0 ? "+" : "") + rub(n);
const out: string[] = [];
type Item = { name: string; size: string; markup: number; sheet: number; shown: number };
const res: Record<string, { byMarkup: number; bySheet: number; retail: number; model: string; items: Item[] }> = {};
const names = ["Тумба с сиденьем 500", "Шкаф 430", "Антресоль 430 (на шкафу)", "Антресоль 500 (над нишей, навесная)"];
for (const [key, title] of [["ldsp", "Вариант 1 · всё ЛДСП"], ["mirror", "Вариант 2 · высокий фасад шкафа 430 зеркальный"]] as const) {
  const p = parseProject(JSON.parse(readFileSync(`public/local-projects/order-7441182-${key}.json`, "utf8")));
  const e = estimate(p), k = e.markup;
  if (e.byMarkup === null || e.retail === null) throw Error(key + ": смета не завершена");
  const sum = (f: (id: string) => boolean, retail = false) => e.lines.filter((l) => !!l.retail === retail && f(l.id)).reduce((s, l) => s + l.quantity * (l.unitPrice ?? 0), 0);
  const work = sum((id) => /^work(-hdf)?$/.test(id)), off = sum(isOffSheetLine), mat = sum((id) => lineGroup(id) === "material" && !/^work(-hdf)?$/.test(id) && !isOffSheetLine(id)), hw = sum((id) => lineGroup(id) === "hardware");
  const retail = e.lines.filter((l) => l.retail), retailSum = retail.reduce((s, l) => s + l.quantity * (l.unitPrice ?? 0), 0);
  const pm = modulePrices(p, e.byMarkup, "markup") ?? [], ps = modulePrices(p, e.bySheet, "sheet") ?? [], shown = modulePrices(p, e.retail) ?? [];
  res[key] = { byMarkup: e.byMarkup, bySheet: e.bySheet, retail: e.retail, model: e.model, items: p.modules.map((a, i) => ({ name: names[i] ?? a.module.name, size: `${a.module.width} × ${a.module.height} × ${a.module.depth}`, markup: pm[i] ?? 0, sheet: ps[i] ?? 0, shown: shown[i] ?? 0 })) };
  out.push(`### ${title}: **${rub(e.retail)}** (${e.model === "sheet" ? "за лист" : "по коэффициенту"} — больше)`, "");
  out.push(`Листов ЛДСП ${e.ldspSheets} (Каньон Ледяной — 2, Марципан — 1), учтённая себестоимость ${rub(e.knownCost)}.`, "");
  out.push("| Модель | Как считается | Цена клиенту |", "|---|---|---:|");
  out.push(`| По коэффициенту ${String(k).replace(".", ",")} | материалы ${rub(mat + off)} + работа цеха ${rub(work)} + фурнитура ${rub(hw)} = ${rub(mat + off + work + hw)} × ${String(k).replace(".", ",")}, + склейка посадочного ${rub(retailSum)} (розница), округление до 100 | ${e.model === "markup" ? "**" + rub(e.byMarkup) + "**" : rub(e.byMarkup)} |`);
  out.push(`| За лист ${rub(e.sheetPrice)} | ${e.ldspSheets} листа × ${rub(e.sheetPrice)} = ${rub(e.ldspSheets * e.sheetPrice)} (плита, кромка, фурнитура, работа внутри) + склейка посадочного ${rub(retailSum)}${e.offSheet ? ` + зеркало вне листа ${rub(off)} × ${String(k).replace(".", ",")} = ${rub(e.offSheet)}` : ""} | ${e.model === "sheet" ? "**" + rub(e.bySheet) + "**" : rub(e.bySheet)} |`);
  out.push(`| **Показана клиенту** | большая из двух | **${rub(e.retail)}** |`, "");
  out.push("После финального расчёта конструктором (в итог не входят):", "");
  for (const l of e.pending) out.push(`- ${l.label} — ${Math.round(l.quantity * 1000) / 1000} ${l.unit}; ${pendingPrice(l.id)?.source ?? l.source}`);
  out.push("", "Цены по изделиям (доля в итоге, как в КП; доли — по своей модели):", "", "| Изделие | Ш × В × Г, мм | По коэффициенту | За лист | **Показанная** |", "|---|---|---:|---:|---:|");
  for (const m of res[key].items) out.push(`| ${m.name} | ${m.size} | ${rub(m.markup)} | ${rub(m.sheet)} | **${rub(m.shown)}** |`);
  out.push(`| **Итого** | | ${rub(e.byMarkup)} | ${rub(e.bySheet)} | **${rub(e.retail)}** |`, "");
}
const a = res.ldsp, b = res.mirror;
out.push(`### Разница вариантов: **${sgn(b.retail - a.retail)}** за зеркальный фасад (по показанной цене; + наклейка зеркала после финального расчёта)`, "", "| Изделие | Вариант 1 | Вариант 2 | Разница |", "|---|---:|---:|---:|");
a.items.forEach((m, i) => out.push(`| ${m.name} | ${rub(m.shown)} | ${rub(b.items[i].shown)} | ${sgn(b.items[i].shown - m.shown)} |`));
out.push(`| **Итого** | **${rub(a.retail)}** | **${rub(b.retail)}** | **${sgn(b.retail - a.retail)}** |`);
const md = out.join("\n");
console.log(md);
const [file, json] = process.argv.slice(2);
if (file) writeFileSync(file, md);
if (json) writeFileSync(json, JSON.stringify(res, null, 1));
