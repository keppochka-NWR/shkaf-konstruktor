/** Обратный путь книги прайсов (scripts/export-prices.ts): читает заполненные Максом колонки «Исправленная закупка ₽» /
 *  «Исправленная розница ₽» / «Комментарий Макса» и печатает отчёт «что изменится» — ID, было → станет, файл:строка и что править.
 *  НИЧЕГО НЕ ПРИМЕНЯЕТ: код не меняется (заготовка; применение — отдельным шагом после согласования).
 *  npx tsx scripts/import-price-corrections.ts "<книга.xlsx>" [--csv <отчёт.csv>]
 *  Читает и книгу, сохранённую Excel/LibreOffice (общие строки sharedStrings), и исходную (inlineStr). Колонки — по заголовкам. */
import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "three/addons/libs/fflate.module.js";

const argv = process.argv.slice(2), file = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--csv");
const csvOut = argv.includes("--csv") ? argv[argv.indexOf("--csv") + 1] : undefined;
if (!file) { console.error('usage: import-price-corrections.ts "<книга.xlsx>" [--csv <отчёт.csv>]'); process.exit(2); }

const zip = unzipSync(new Uint8Array(readFileSync(file)));
const text = (name: string) => (zip[name] ? strFromU8(zip[name]) : "");
const unxml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d))).replace(/&amp;/g, "&");
// общие строки (книга, сохранённая Excel): <si><t>…</t></si> или с форматированием <si><r><t>…</t></r>…</si>
const shared = [...text("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => unxml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
// листы: имя → файл через workbook.xml.rels
const rels = new Map([...text("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => [/Id="([^"]+)"/.exec(m[1])?.[1] ?? "", /Target="([^"]+)"/.exec(m[1])?.[1] ?? ""]));
const sheets = [...text("xl/workbook.xml").matchAll(/<sheet\b([^>]*)\/>/g)].map((m) => ({ name: unxml(/name="([^"]*)"/.exec(m[1])?.[1] ?? ""), target: "xl/" + (rels.get(/r:id="([^"]+)"/.exec(m[1])?.[1] ?? "") ?? "").replace(/^\/?xl\//, "") }));
const colIndex = (ref: string) => { const c = /^[A-Z]+/.exec(ref)![0]; let n = 0; for (const ch of c) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
function readSheet(xmlText: string): (string | number | null)[][] {
  const rows: (string | number | null)[][] = [];
  for (const rm of xmlText.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const r: (string | number | null)[] = [];
    for (const cm of (rm[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1], body = cm[2] ?? "", ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1], t = /t="([^"]+)"/.exec(attrs)?.[1];
      if (!ref) continue;
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let val: string | number | null = null;
      if (t === "s") val = v !== undefined ? shared[Number(v)] ?? null : null;
      else if (t === "inlineStr") val = unxml([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(""));
      else if (t === "str" || t === "e") val = v !== undefined ? unxml(v) : null;
      else if (v !== undefined) val = Number(v);
      r[colIndex(ref)] = val;
    }
    rows.push(r);
  }
  return rows;
}
/** Число из ячейки: 2500, «2 500», «2 500,50 ₽». Пусто/текст — null. */
const numOf = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = v.replace(/[\s ₽]/g, "").replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
};
/** Что править в коде по виду ID (файлы, сгенерированные из других калькуляторов, правятся в источнике). */
function howTo(id: string, src: string): string {
  if (id.startsWith("const:")) return "константа " + id.slice(6) + " (" + src + ")";
  if (id.startsWith("tier:")) return "pricing.ts tierPrice: цена группы (все декоры группы без явной цены)";
  if (/^sheet:[^:]+$/.test(id) && /pricing\.ts:74/.test(src)) return "pricing.ts sheets: явная цена декора";
  if (/^sheet:[^:]+$/.test(id)) return "новая явная цена декора в pricing.ts sheets (сейчас — по группе tierPrice)";
  if (/^sheet:.+:\d+/.test(id)) return "цена другой толщины: новое правило в decorPrice/estimate (сейчас = цена 16 мм)";
  if (/^kupe-(profile|track|fill|soft|work|film|hardware)/.test(id)) return "kupeData.ts генерируется scripts/import-kupe.cjs из калькулятора купе (Calc\\kupe\\data): править прайс калькулятора и перегенерировать";
  if (/^alu-/.test(id)) return "aluData.ts генерируется scripts/import-alu.cjs из калькулятора фасадов ALU (calc-platform/data): править там и перегенерировать";
  if (/^vernissage/.test(id)) return "vernissageData.ts генерируется scripts/vernissage_data.py из прайса Вернисаж: править прайс/генератор";
  if (/^handle:/.test(id)) return "handles.ts: цена в строке каталога";
  if (/^mesh:/.test(id)) return "mesh.ts: цена в строке каталога";
  if (/^hinge/.test(id)) return "hardware.ts HINGE_BRANDS (GTV без пружины — pricing.ts HINGE_FREE)";
  if (/^slide:/.test(id)) return "pricing.ts ball / hidden / slidePrice (оценочные формулы — от опорных цен)";
  if (/^light-/.test(id)) return "model.ts RULES.lightRetailPerM / shelfLightRetailPerM (розница)";
  return "строка кода из колонки «Источник в коде»";
}

type Change = { sheet: string; id: string; name: string; costWas: number | null; costNew: number | null; retailWas: number | null; retailNew: number | null; coef: number | null; src: string; how: string; comment: string; warn: string[] };
const changes: Change[] = [], comments: Change[] = [];
for (const sh of sheets) {
  const rows = readSheet(text(sh.target));
  const hi = rows.findIndex((r) => r.includes("ID") && r.some((c) => typeof c === "string" && c.startsWith("Исправленная")));
  if (hi < 0) continue;
  const h = rows[hi].map((c) => String(c ?? "")), col = (name: string) => h.indexOf(name);
  const c = { id: col("ID"), name: col("Позиция"), cost: col("Закупка ₽"), coef: col("Коэффициент"), retail: col("Розница клиенту ₽"), src: col("Источник в коде"), newCost: col("Исправленная закупка ₽"), newRetail: col("Исправленная розница ₽"), comment: col("Комментарий Макса") };
  for (const r of rows.slice(hi + 1)) {
    const id = String(r[c.id] ?? "").trim(); if (!id) continue;
    const costNew = numOf(r[c.newCost]), retailNew = numOf(r[c.newRetail]), comment = String(r[c.comment] ?? "").trim();
    const badCost = r[c.newCost] !== undefined && r[c.newCost] !== null && r[c.newCost] !== "" && costNew === null, badRetail = r[c.newRetail] !== undefined && r[c.newRetail] !== null && r[c.newRetail] !== "" && retailNew === null;
    if (costNew === null && retailNew === null && !comment && !badCost && !badRetail) continue;
    const coef = numOf(r[c.coef]), costWas = numOf(r[c.cost]), retailWas = numOf(r[c.retail]), src = String(r[c.src] ?? "");
    const warn: string[] = [];
    if (badCost) warn.push(`«Исправленная закупка» не число: ${r[c.newCost]}`);
    if (badRetail) warn.push(`«Исправленная розница» не число: ${r[c.newRetail]}`);
    if (costNew !== null && retailNew !== null && coef !== null && Math.abs(costNew * coef - retailNew) > 0.5) warn.push(`закупка × ${coef} = ${Math.round(costNew * coef * 100) / 100}, а розница указана ${retailNew}: калькулятор возьмёт закупку`);
    if (retailNew !== null && costNew === null && costWas !== null && coef !== null) warn.push(`указана только розница: закупка станет ${Math.round(retailNew / coef * 100) / 100} (= ${retailNew} / ${coef}), либо меняется коэффициент`);
    if (/^supplier:/.test(id)) warn.push("строка справочника поставщиков: подключение к калькулятору — новая строка кода (ID позиции калькулятора в комментарии)");
    if (/[*<]/.test(id)) warn.push("шаблон строки (несколько позиций сметы): цена — на все строки шаблона");
    const ch: Change = { sheet: sh.name, id, name: String(r[c.name] ?? ""), costWas, costNew, retailWas, retailNew, coef, src, how: howTo(id, src), comment, warn };
    (costNew === null && retailNew === null && !badCost && !badRetail ? comments : changes).push(ch);
  }
}
// одно ID на нескольких листах (тематический лист и «НЕТ ЦЕНЫ») с разными значениями — конфликт
const byId = new Map<string, Change[]>();
for (const ch of changes) byId.set(ch.id, [...(byId.get(ch.id) ?? []), ch]);
for (const [, list] of byId) if (list.length > 1 && new Set(list.map((x) => `${x.costNew}|${x.retailNew}`)).size > 1) for (const x of list) x.warn.push("КОНФЛИКТ: другое значение для этого ID на листе " + list.filter((y) => y !== x).map((y) => "«" + y.sheet + "»").join(", "));
const fmt = (v: number | null) => (v === null ? "—" : String(v).replace(".", ","));
console.log(`Книга: ${file}\nИсправлений: ${changes.length} (уникальных ID ${byId.size}), только комментарии: ${comments.length}. НИЧЕГО НЕ ПРИМЕНЕНО — это отчёт.\n`);
for (const ch of changes) {
  console.log(`• ${ch.id}  [${ch.sheet}] ${ch.name}`);
  if (ch.costNew !== null && ch.id.startsWith("const:") || ch.costNew !== null && ch.id.startsWith("vernissage-rule:") && ch.costWas === null) console.log(`    значение: ${fmt(ch.coef)} → ${fmt(ch.costNew)}`);
  else if (ch.costNew !== null) console.log(`    закупка: ${fmt(ch.costWas)} → ${fmt(ch.costNew)}${ch.coef !== null && ch.costNew !== null ? `  (клиенту ${fmt(Math.round(ch.costNew * ch.coef * 100) / 100)} при × ${fmt(ch.coef)})` : ""}`);
  if (ch.retailNew !== null) console.log(`    розница: ${fmt(ch.retailWas)} → ${fmt(ch.retailNew)}`);
  console.log(`    где: ${ch.src || "—"} · ${ch.how}`);
  if (ch.comment) console.log(`    Макс: ${ch.comment}`);
  for (const w of ch.warn) console.log(`    ! ${w}`);
}
if (comments.length) { console.log("\nКомментарии без цены:"); for (const ch of comments) console.log(`• ${ch.id} [${ch.sheet}]: ${ch.comment}`); }
if (csvOut) {
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [["Лист", "ID", "Позиция", "Закупка было", "Закупка станет", "Розница было", "Розница станет", "Коэффициент", "Источник в коде", "Что править", "Комментарий Макса", "Предупреждения"].map(q).join(";"),
    ...[...changes, ...comments].map((c) => [c.sheet, c.id, c.name, fmt(c.costWas), fmt(c.costNew), fmt(c.retailWas), fmt(c.retailNew), fmt(c.coef), c.src, c.how, c.comment, c.warn.join(" | ")].map(q).join(";"))];
  writeFileSync(csvOut, "﻿" + lines.join("\r\n"));
  console.log("\nОтчёт CSV:", csvOut);
}
