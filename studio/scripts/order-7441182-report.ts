// Заказ 7441182: цифры для отчёта «Расчёт.md» из проектов, собранных функциями (public/local-projects/order-7441182-*.json):
// цена клиенту, разбивка (материалы, работа цеха, фурнитура, розница поверх коэффициента, «после финального расчёта»),
// цены по изделиям (modulePrices — как в КП), разница вариантов. npx tsx scripts/order-7441182-report.ts [out.md]
import { readFileSync, writeFileSync } from "node:fs";
import { parseProject } from "../src/project";
import { estimate, lineGroup } from "../src/pricing";
import { modulePrices } from "../src/itemPrices";
import { pendingPrice } from "../src/pendingPrices";

const rub = (n: number) => Math.round(n).toLocaleString("ru-RU").replace(/ /g, " ") + " ₽";
const out: string[] = [];
const res: Record<string, { retail: number; mods: { name: string; size: string; price: number }[] }> = {};
for (const [key, title] of [["ldsp", "Вариант 1 · всё ЛДСП"], ["mirror", "Вариант 2 · высокий фасад шкафа 430 зеркальный"]] as const) {
  const p = parseProject(JSON.parse(readFileSync(`public/local-projects/order-7441182-${key}.json`, "utf8")));
  const e = estimate(p), k = e.markup;
  const sum = (f: (id: string) => boolean, retail = false) => e.lines.filter((l) => !!l.retail === retail && f(l.id)).reduce((s, l) => s + l.quantity * (l.unitPrice ?? 0), 0);
  const work = sum((id) => /^work(-hdf)?$/.test(id)), mat = sum((id) => lineGroup(id) === "material" && !/^work(-hdf)?$/.test(id)), hw = sum((id) => lineGroup(id) === "hardware");
  const retail = e.lines.filter((l) => l.retail);
  const names = ["Тумба с сиденьем 500", "Шкаф 430", "Антресоль 430 (на шкафу)", "Антресоль 500 (над нишей, навесная)"];
  const mp = modulePrices(p, e.retail) ?? [];
  res[key] = { retail: e.retail ?? 0, mods: p.modules.map((a, i) => ({ name: names[i] ?? a.module.name, size: `${a.module.width} × ${a.module.height} × ${a.module.depth}`, price: mp[i] ?? 0 })) };
  out.push(`### ${title}: **${rub(e.retail ?? 0)}**`, "");
  out.push(`Коэффициент ${String(k).replace(".", ",")}, листов ЛДСП ${e.ldspSheets} (Каньон Ледяной — 2, Марципан — 1), себестоимость учтённая ${rub(e.knownCost)}.`, "");
  out.push("| Часть цены | Себестоимость | Клиенту |", "|---|---:|---:|");
  out.push(`| Материалы (ЛДСП, ЛХДФ, кромка, крепёж корпуса${key === "mirror" ? ", зеркало, плёнка, полировка" : ""}) | ${rub(mat)} | ${rub(mat * k)} |`);
  out.push(`| Работа цеха (3 500 ₽/лист ЛДСП, 2 000 ₽/лист ЛХДФ) | ${rub(work)} | ${rub(work * k)} |`);
  out.push(`| Фурнитура (петли, ручки, опоры, штанга) | ${rub(hw)} | ${rub(hw * k)} |`);
  for (const l of retail) out.push(`| ${l.label} — розница поверх коэффициента | — | ${rub(l.quantity * (l.unitPrice ?? 0))} |`);
  out.push(`| Округление итога до 100 ₽ | | ${rub((e.retail ?? 0) - (mat + work + hw) * k - retail.reduce((s, l) => s + l.quantity * (l.unitPrice ?? 0), 0))} |`);
  out.push(`| **Итого клиенту** | | **${rub(e.retail ?? 0)}** |`, "");
  out.push("После финального расчёта конструктором (в итог не входят):", "");
  for (const l of e.pending) out.push(`- ${l.label} — ${Math.round(l.quantity * 1000) / 1000} ${l.unit}; ${pendingPrice(l.id)?.source ?? l.source}`);
  out.push("", "Цены по изделиям (как в КП, modulePrices — доля в итоге):", "", "| Изделие | Ш × В × Г, мм | Цена |", "|---|---|---:|");
  for (const m of res[key].mods) out.push(`| ${m.name} | ${m.size} | ${rub(m.price)} |`);
  out.push("");
}
const a = res.ldsp, b = res.mirror;
out.push(`### Разница вариантов: **+${rub(b.retail - a.retail)}** за зеркальный фасад (+ наклейка зеркала после финального расчёта)`, "", "| Изделие | Вариант 1 | Вариант 2 | Разница |", "|---|---:|---:|---:|");
a.mods.forEach((m, i) => out.push(`| ${m.name} | ${rub(m.price)} | ${rub(b.mods[i].price)} | ${b.mods[i].price - m.price >= 0 ? "+" : ""}${rub(b.mods[i].price - m.price)} |`));
out.push(`| **Итого** | **${rub(a.retail)}** | **${rub(b.retail)}** | **+${rub(b.retail - a.retail)}** |`);
const md = out.join("\n");
console.log(md);
const [file] = process.argv.slice(2);
if (file) writeFileSync(file, md);
