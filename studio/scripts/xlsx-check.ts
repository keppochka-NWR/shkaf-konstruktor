// Проверка сметы Excel в LibreOffice (менеджеры 22.10.2026, п. 8): npx tsx scripts/xlsx-check.ts [файл.xlsx | -] [папка-вывода]
// Без файла — собирает смету шкафа студии с двумя ящиками. LibreOffice headless пересчитывает формулы и выгружает каждый лист в CSV;
// скрипт сверяет «Расчётную цену», себестоимость и сумму цен изделий с estimate(). Код 1 — расхождение или LibreOffice не открыл файл.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { estimate } from "../src/pricing";
import { estimateXLSX } from "../src/estimateXlsx";
import { modulePrices } from "../src/itemPrices";
import { newProject } from "../src/project";

const SOFFICE = ["C:\\Program Files\\LibreOffice\\program\\soffice.exe", "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe"].find(existsSync) ?? "soffice";
const out = resolve(process.argv[3] ?? join(tmpdir(), "xlsx-check-" + Date.now()));
mkdirSync(out, { recursive: true });
const given = process.argv[2] && process.argv[2] !== "-" ? process.argv[2] : "";
let file = given ? resolve(given) : "";
const p = newProject(); p.modules[0].module.sections[0].drawers = 2;
const e = estimate(p);
if (!file) { file = join(out, "smeta.xlsx"); writeFileSync(file, await estimateXLSX(p, e)); }
// все листы — отдельными CSV (параметр фильтра -1), UTF-8 (76), разделитель «;» (59), формулы пересчитаны при загрузке
execFileSync(SOFFICE, ["--headless", "--norestore", "--convert-to", "csv:Text - txt - csv (StarCalc):59,34,76,1,,1049,false,true,false,false,false,-1", "--outdir", out, file], { stdio: "pipe", timeout: 120000 });
const csvs = readdirSync(out).filter((f) => f.endsWith(".csv")).sort();
console.log("LibreOffice: листов в CSV —", csvs.length, csvs.join(", "));
let bad = csvs.length < 3 ? 1 : 0;
const num = (s: string | undefined) => Number(String(s ?? "").replace(/[^\d,.-]/g, "").replace(",", "."));
for (const f of csvs) {
  const text = readFileSync(join(out, f), "utf8"), rows = text.split(/\r?\n/).map((r) => r.split(";").map((c) => c.replace(/^"|"$/g, "")));
  console.log("— " + f + ": строк " + rows.length);
  const find = (label: string) => rows.find((r) => r[1] === label);
  if (/Смета/.test(f) && !given) {
    const total = find("Расчётная цена"), cost = find("Себестоимость (закупка)");
    const okTotal = num(total?.[5]) === e.retail, okCost = Math.round(num(cost?.[5])) === e.knownCost;
    console.log(`   Расчётная цена ${total?.[5]} (смета ${e.retail}) ${okTotal ? "OK" : "FAIL"}; себестоимость ${cost?.[5]} (смета ${e.knownCost}) ${okCost ? "OK" : "FAIL"}`);
    if (!okTotal || !okCost) bad++;
  }
  if (/Кратко/.test(f) && !given) {
    const total = find("Итого"), items = modulePrices(p, e.retail);
    const ok = num(total?.[5]) === e.retail && items?.reduce((s, v) => s + v, 0) === e.retail;
    console.log(`   Итого ${total?.[5]} (смета ${e.retail}) ${ok ? "OK" : "FAIL"}`); if (!ok) bad++;
  }
  if (/Смета|Кратко/.test(f) && /\b(#ERR|Err:|#NAME|#VALUE)/.test(text)) { console.log("   ошибки формул в листе"); bad++; }
}
console.log(bad ? "ИТОГ: есть расхождения" : "ИТОГ: файл открыт LibreOffice, формулы пересчитаны, суммы совпадают со сметой");
process.exitCode = bad ? 1 : 0;
