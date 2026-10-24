/** Книга всех прайсов ГардерЁб (задача Макса 24.10.2026: «Собери в один Excel все прайсы, по которым идёт расчёт и по которым его нет»).
 *  npx tsx scripts/export-prices.ts [out.xlsx] [--check] [--vault <файл справочника>] [--json <out.json>]
 *  Данные — из кода калькулятора: таблицы и функции pricing.ts, hardware.ts, handles.ts, mesh.ts, alu.ts/aluData.ts, kupe.ts/kupeData.ts,
 *  facadesVernissage.ts/vernissageData.ts, catalog.ts, kitchen.ts, pendingPrices.ts, clientPrices.ts (розница — clientLine, как в публичной сборке).
 *  Литералы, которых нет в экспорте (кромка, штанга, фланец, список явных цен листов), читаются из исходника и сверяются с estimate().
 *  Позиции без цены: статический разбор add(…, null, …) в pricing.ts + прогон estimate() по шаблонам палитры, кухонным шаблонам, опциям
 *  и всем проектам examples/ и public/local-projects (в книгу — только тип проекта, без имён файлов и клиентов).
 *  В книге закупочные цены: файл кладётся ВНЕ репозитория (по умолчанию — Кухни\ГардерЁб\Прайсы), в git — только этот скрипт.
 *  --check: сверка книги с estimate() (каждая строка сметы с ценой из прогона → строка книги с той же ценой; итог двух тестовых
 *  проектов, пересчитанный по книге = estimate().retail). Обратный путь — scripts/import-price-corrections.ts. */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  estimate, decorPrice, slidePrice, guideKitPrice, kupeLdspPerM2, bazisPriced, lineGroup, isKupeLine, isVernissageLine,
  MARKUP_DEFAULT, VERNISSAGE_MARKUP_DEFAULT, SHEET_PRICE_DEFAULT, SHOP_WORK_LDSP_SHEET, SHOP_WORK_HDF_SHEET, HDF_SHEET, FALSH_GLUE_RETAIL_M2,
  LEG, LEG_M6, HINGE_FREE, PUSH_LATCH, FASTENERS, HARDWARE_KIT, DOWEL, PULLOUT_PRICE, LDSP_SHEET_M2, type PriceLine,
} from "../src/pricing";
import { clientLine } from "../src/clientPrices";
import { pendingPrice } from "../src/pendingPrices";
import { HINGE_BRANDS, SLIDE_SYSTEMS, SLIDES, type HingeBrand } from "../src/hardware";
import { HANDLES } from "../src/handles";
import { MESH, DEFAULT_MESH } from "../src/mesh";
import { ALU_PROFILES, ALU_FILLS, ALU_INSERTS, ALU_GASKET_PER_M, ALU_SOURCE, DEFAULT_ALU } from "../src/alu";
import { KUPE_SYSTEMS, KUPE_FILLS, KUPE_SOFT_CLOSE, KUPE_COMPLEX_WORK, KUPE_COMPLEX_THRESHOLD, KUPE_FILM_ARMOR, KUPE_FILM_SAFETY, KUPE_PROFILE_MULT, KUPE_VERSION } from "../src/kupeData";
import { isLdspFill } from "../src/kupe";
import { VERNISSAGE_SERIES, VERNISSAGE_NOTES, SERIES_LABEL, DEFAULT_VERNISSAGE, priceDateRu } from "../src/facadesVernissage";
import { V_ADILET_PRICES } from "../src/vernissageData";
import { catalog } from "../src/catalog";
import { RULES, initialModule, type Module } from "../src/model";
import { WORKTOP_CHOICES } from "../src/kitchen";
import { newProject, parseProject, type Project } from "../src/project";
import { createModule, createKupeWardrobe, KIND_LABEL, type ModuleKind } from "../src/paletteBuild";
import { KITCHEN_ITEMS, kitchenTemplate, kitchenProject, type KitchenItem } from "../src/kitchenProject";
import { createKitchenCornerRow, createKitchenURow } from "../src/kitchenCornerRow";
import { workbookFiles, workbookZip, str, num, empty, type XCell, type XSheet, type XStyle } from "../src/xlsx";

const HERE = dirname(fileURLToPath(import.meta.url)), STUDIO = resolve(HERE, ".."), SRC = join(STUDIO, "src");
const argv = process.argv.slice(2), flag = (f: string) => argv.includes(f), opt = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
const positional = argv.filter((a, i) => !a.startsWith("--") && !["--vault", "--json", "--audit"].includes(argv[i - 1] ?? ""));
const OUT = resolve(positional[0] ?? "C:/Users/My PC/Desktop/Claude Project/Кухни/ГардерЁб/Прайсы/Прайсы ГардерЁб 24.10.xlsx");
const VAULT = opt("--vault") ?? "C:/Users/My PC/Desktop/Работа/Vault/Личная система/Ресурсы/Производство/Закупочные цены поставщиков.md";
const TODAY = new Date().toLocaleDateString("ru-RU");

// ---------- исходники: номер строки для «Источник в коде» ----------
const srcCache = new Map<string, string[]>();
const srcLines = (file: string) => { let l = srcCache.get(file); if (!l) { l = readFileSync(join(SRC, file), "utf8").split(/\r?\n/); srcCache.set(file, l); } return l; };
const notFound: string[] = [];
/** file:line первой строки с needle (после строки с after, если задано). */
function loc(file: string, needle: string | RegExp, after?: string | RegExp): string {
  const ls = srcLines(file), has = (s: string, n: string | RegExp) => typeof n === "string" ? s.includes(n) : n.test(s);
  let from = 0;
  if (after !== undefined) { const a = ls.findIndex((s) => has(s, after)); if (a >= 0) from = a; }
  for (let i = from; i < ls.length; i++) if (has(ls[i], needle)) return `${file}:${i + 1}`;
  notFound.push(`${file}: ${String(needle)}`);
  return file;
}
const pricingText = () => srcLines("pricing.ts").join("\n");

// ---------- строки книги ----------
type Status = "считается" | "ориентир" | "после финального расчёта" | "нет цены" | "оценка";
type Row = {
  id: string; section: string; name: string; art?: string; unit: string;
  /** закупка (себестоимость строки сметы); null — нет закупки (только розница или нет цены) */
  cost: number | null; coef: number | string | null; retail: number | null; supplier: string; status: Status; src: string; note: string;
  /** только розница (цена клиента, поверх коэффициента) */
  retailOnly?: boolean;
  /** строки сметы, которые считаются по этой строке книги (кроме точного совпадения id) */
  match?: RegExp;
  /** константа кода (коэффициент, цена листа): исправление — новое значение константы */
  constant?: boolean;
  where?: string; need?: string;
};
const SHEETS = ["Плиты и ЛХДФ", "Кромка", "Петли", "Направляющие и ящики", "Ручки цеха", "Ручки Лемана", "Крепёж и мелочёвка", "Опоры, цоколь, штанги", "Подсветка",
  "Подъёмники и Premial", "Фасады Вернисаж", "Алюминиевые фасады", "Двери купе — профили", "Купе — наполнения и фурнитура", "Кухня — столешницы и мойки", "Работа и коэффициенты"] as const;
type SheetName = (typeof SHEETS)[number];
const book = new Map<SheetName, Row[]>(SHEETS.map((s) => [s, []]));
const put = (sheet: SheetName, r: Row) => { book.get(sheet)!.push(r); return r; };
const r2 = (v: number) => Math.round(v * 100) / 100;
/** Розница клиенту по строке сметы — функцией публичной сборки (clientLine): закупка × коэффициент сметы, Вернисаж × свой, розница как есть. */
function clientPrice(id: string, cost: number | null, retail = false): number | null {
  if (cost === null) return null;
  const l: PriceLine = { id, label: "", quantity: 1, unit: "", unitPrice: cost, source: "", ...(retail ? { retail: true } : {}) };
  return clientLine(l, MARKUP_DEFAULT, VERNISSAGE_MARKUP_DEFAULT, "markup").unitPrice;
}
function statusOf(source: string, price: number | null, pending = false): Status {
  if (pending) return "после финального расчёта";
  if (price === null) return "нет цены";
  if (/оценк|интерполяц|цена как у|как у кромки|как у 5×50/i.test(source)) return "оценка";
  if (/ориентир|старый калькулятор|норматив|подтвердить/i.test(source)) return "ориентир";
  return "считается";
}
const SUPPLIERS: [RegExp, string][] = [
  [/Мега-?Трейд|Мегатрейд/i, "Мега-Трейд"], [/ФАМ/, "ФАМ"], [/МДМ/, "МДМ"], [/Победа/, "Победа"], [/СФЗ|Lamarty|Ламарти/i, "СФЗ (Lamarty)"], [/Древиз/, "Древиз"],
  [/АТБ/, "АТБ"], [/МВМ/, "МВМ"], [/Лемана/i, "Лемана Про"], [/Вернисаж/, "Вернисаж"], [/Premial|Премиал/i, "Premial"], [/ФАС/, "ФАС"],
  [/Калькулятор купе/, "Калькулятор купе"], [/Калькулятор фасадов ALU/, "Калькулятор фасадов ALU"], [/Blum/, "Blum (дилеры)"], [/Pulse/, "Pulse (МДМ)"],
  [/Цех|цеха|Прайс цеха|Решение Макса|Цена Макса|решение Макса/i, "Цех (решение Макса)"], [/Старый калькулятор/i, "Старый калькулятор"],
];
const supplierOf = (s: string) => SUPPLIERS.find(([re]) => re.test(s))?.[1] ?? "";
function priced(sheet: SheetName, o: { id: string; section: string; name: string; art?: string; unit: string; cost: number | null; source: string; src: string; note?: string; retail?: boolean; vern?: boolean; match?: RegExp; supplier?: string; status?: Status; coef?: number | string | null }) {
  const pend = o.cost === null && !!pendingPrice(o.id);
  const isRetail = !!o.retail;
  return put(sheet, {
    id: o.id, section: o.section, name: o.name, art: o.art, unit: o.unit,
    cost: isRetail ? null : o.cost,
    coef: o.coef !== undefined ? o.coef : isRetail ? "розница" : o.cost === null ? null : o.vern ? VERNISSAGE_MARKUP_DEFAULT : MARKUP_DEFAULT,
    retail: isRetail ? o.cost : clientPrice(o.id, o.cost),
    supplier: o.supplier ?? supplierOf(o.source), status: o.status ?? statusOf(o.source, o.cost, pend), src: o.src,
    note: [o.source, isRetail ? "только розница: цена клиента, идёт поверх коэффициента" : "", pend ? pendingPrice(o.id)!.source : "", o.note ?? ""].filter(Boolean).join(" · "),
    retailOnly: isRetail, match: o.match,
  });
}

// ---------- 1. Плиты и ЛХДФ ----------
{
  // явные цены по декорам — объект sheets в pricing.ts (не экспортируется): читаем из исходника, цену берём функцией decorPrice
  const line = srcLines("pricing.ts").find((l) => l.startsWith("const sheets:"))!, explicit = [...line.matchAll(/'([^']+)':(\d+)/g)].map((m) => ({ n: m[1], v: Number(m[2]) }));
  for (const { n, v } of explicit) {
    const d = decorPrice(n);
    if (d.price !== v) throw Error(`decorPrice(${n}) = ${d.price}, в исходнике ${v}`);
    priced("Плиты и ЛХДФ", { id: "sheet:" + n, section: "ЛДСП 16 мм — явные цены (СФЗ / Победа)", name: "Lamarty 16 мм · " + n, unit: "лист", cost: d.price, source: d.source, src: loc("pricing.ts", `'${n}':`, "const sheets:"), note: "лист 2750×1830" });
  }
  const tierLine = srcLines("pricing.ts").find((l) => l.startsWith("const tierPrice"))!;
  const tiers = [...tierLine.matchAll(/'([А-ЯЁ]+)':\[(\d+),(\d+),(\d+)\]/g)].map((m) => ({ tier: m[1], v: [Number(m[2]), Number(m[3]), Number(m[4])] }));
  const colName = ["базовые тиснения (L,R,A,F,K,O,T,P,V)", "тиснения D, N, G, US", "тиснения N*, D*, U"];
  for (const t of tiers) t.v.forEach((v, c) => put("Плиты и ЛХДФ", {
    id: `tier:${t.tier}:${c}`, section: "Ценовые группы Lamarty 16 мм (прайс 01.01.2026)", name: `Группа ${t.tier} · ${colName[c]}`, unit: "лист", cost: v, coef: MARKUP_DEFAULT,
    retail: clientPrice("sheet:x", v), supplier: "СФЗ (Lamarty)", status: "считается", src: loc("pricing.ts", "const tierPrice"),
    note: "Цена листа для всех декоров каталога этой группы без явной цены (ниже). Исправление здесь меняет все такие декоры.",
  }));
  const explicitSet = new Set(explicit.map((e) => e.n));
  for (const c of [...catalog].sort((a, b) => a.tier.localeCompare(b.tier) || a.n.localeCompare(b.n, "ru"))) {
    if (explicitSet.has(c.n)) continue;
    const d = decorPrice(c.n);
    priced("Плиты и ЛХДФ", { id: "sheet:" + c.n, section: "Lamarty 16 мм — по группе " + c.tier, name: "Lamarty 16 мм · " + c.n, unit: "лист", cost: d.price, source: d.source, src: loc("catalog.ts", `"n": ${JSON.stringify(c.n)}`) + " · " + loc("pricing.ts", "const tierPrice"), note: c.cat + "; исправлять группу (строка tier:…) или задать явную цену декора" });
  }
  priced("Плиты и ЛХДФ", { id: "sheet:hdf", section: "ЛХДФ", name: "ЛХДФ 3 мм (ХДФ Kronospan 2800×2070×3)", unit: "лист", cost: HDF_SHEET, source: "Древиз: ХДФ Kronospan 2800×2070", src: loc("pricing.ts", "export const HDF_SHEET") });
  priced("Плиты и ЛХДФ", { id: "sheet:<декор>:<толщина>", section: "Другие толщины", name: "Плита не 16 мм (10/18/19/22/25/26/32) — любой декор", unit: "лист", cost: null, source: "Цена как у 16 мм — уточнить для толщины", src: loc("pricing.ts", "цена как у 16 мм"), status: "оценка", note: "Сейчас берётся цена 16 мм того же декора. В справочнике Ламарти есть 10/18/22/26 мм по группам — можно завести." });
}
// ---------- 2. Кромка ----------
{
  const t = pricingText();
  for (const m of t.matchAll(/add\('(edge\w+)','([^']+)',\w+,'м',([\d.]+),'([^']*)'\)/g)) priced("Кромка", { id: m[1], section: "Кромка (одна цена на все декоры)", name: m[2], unit: "м", cost: Number(m[3]), source: m[4], src: loc("pricing.ts", `add('${m[1]}'`), note: "В справочнике Победы есть цены кромки по декорам — лист «Поставщики — не подключено»" });
}
// ---------- 3. Петли ----------
{
  const brands = Object.keys(HINGE_BRANDS) as HingeBrand[];
  for (const b of brands) {
    const hb = HINGE_BRANDS[b], sfx = b === "gtv" ? "" : ":" + b, sec = "Петли " + hb.label + " (" + hb.note + ")";
    const at = loc("hardware.ts", `${b}: { label:`);
    priced("Петли", { id: "hinge" + sfx, section: sec, name: hb.soft.label + " · накладная", unit: "шт", cost: hb.soft.price, source: hb.soft.source, src: at });
    priced("Петли", { id: "hinge-inset" + sfx, section: sec, name: hb.soft.label + " · вкладная", unit: "шт", cost: hb.soft.price, source: hb.soft.source, src: at, note: "та же цена, что у накладной" });
    const free = b === "gtv" ? HINGE_FREE : hb.free;
    priced("Петли", { id: "hinge-push" + sfx, section: sec, name: (b === "gtv" ? "Петля GTV без пружины накладная" : hb.free.label + " · накладная") + " (push-to-open)", unit: "шт", cost: free.price, source: free.source, src: b === "gtv" ? loc("pricing.ts", "export const HINGE_FREE") : at });
    priced("Петли", { id: "hinge-push-inset" + sfx, section: sec, name: (b === "gtv" ? "Петля GTV без пружины вкладная COCA" : hb.free.label + " · вкладная") + " (push-to-open)", unit: "шт", cost: free.price, source: free.source, src: b === "gtv" ? loc("pricing.ts", "export const HINGE_FREE") : at });
  }
  priced("Петли", { id: "push-latch", section: "Открывание", name: "Толкатель push-to-open", unit: "шт", cost: PUSH_LATCH.price, source: PUSH_LATCH.source, src: loc("pricing.ts", "export const PUSH_LATCH") });
}
// ---------- 4. Направляющие и ящики ----------
{
  for (const sys of SLIDE_SYSTEMS) for (const L of SLIDES[sys.slide].lengths) {
    const q = slidePrice({ slide: sys.slide, operation: sys.motion, brand: sys.brand, length: L }), isDefault = sys.id === "ball-soft" || sys.id === "hidden-dtc-push";
    const s = q.source, at = sys.slide === "ball" ? (sys.motion === "soft-close" ? loc("pricing.ts", `${L}:{price:`, "const ball") : sys.motion === "simple" ? loc("pricing.ts", "sys.motion==='simple'") : loc("pricing.ts", "push-to-open ≈ +15 %"))
      : sys.brand === "dtc" ? loc("pricing.ts", "if(sys.brand==='dtc')") : sys.brand === "premial" ? loc("pricing.ts", "if(sys.brand==='premial')") : loc("pricing.ts", "const uni=hidden[L]");
    priced("Направляющие и ящики", { id: "slide:" + sys.slide + ":" + L + (isDefault ? "" : ":" + sys.id), section: "Ящики шкафов: " + sys.label, name: q.label + " — комплект", unit: "компл", cost: q.price, source: s, src: at });
  }
  for (const L of [250, 300, 350, 400, 450, 500, 550]) {
    const id = "versalite-h45:" + L, q = guideKitPrice(id);
    priced("Направляющие и ящики", { id, section: "Ящики кухни: Versalite Light H45", name: `Направляющие шариковые Versalite Light H45, ${L} мм — комплект`, unit: "компл", cost: q.price, source: q.source, src: loc("pricing.ts", "export function guideKitPrice") });
  }
  for (const m of MESH) priced("Направляющие и ящики", { id: "mesh:" + m.id, section: "Корзины и сетки Лемана Про (розница Лемана как база)", name: m.label + " · Лемана Про", art: m.art, unit: "шт", cost: m.price, source: "Лемана Про, розница 01.09.2026, арт. " + m.art, src: loc("mesh.ts", `item("${m.art}"`), note: "В модели «цена за лист» идёт сверху листов по рознице Лемана без коэффициента" });
}
// ---------- 5–6. Ручки ----------
for (const h of HANDLES) {
  const lem = h.vendor === "lemana";
  priced(lem ? "Ручки Лемана" : "Ручки цеха", { id: "handle:" + h.id, section: lem ? "Ручки Лемана Про — межосевое " + h.len : "Ручки цеха (закупка)", name: "Ручка " + h.label, art: h.art, unit: "шт", cost: h.price, source: h.source,
    src: loc("handles.ts", lem ? `lemana("${h.art}"` : `workshop("${h.id}"`), note: lem ? "Розница Лемана — база строки сметы: по коэффициенту × " + String(MARKUP_DEFAULT).replace(".", ",") + "; в «цене за лист» — сверху как есть" : "" });
}
// ---------- 7. Крепёж и мелочёвка ----------
{
  const F = "Крепёж и мелочёвка", at = (k: string) => loc("pricing.ts", `${k}:{price:`, "export const FASTENERS");
  priced(F, { id: "confirmat", section: "Крепёж корпуса", name: "Конфирмат 5×50 чёрный цинк", unit: "шт", cost: FASTENERS.confirmat.price, source: FASTENERS.confirmat.source, src: at("confirmat") });
  priced(F, { id: "confirmat-7x50", section: "Крепёж корпуса", name: "Конфирмат 7×50, Zn (кухни, как в Базисе)", unit: "шт", cost: FASTENERS.confirmat.price, source: "Цена как у 5×50 — уточнить по счёту", src: loc("pricing.ts", "add('confirmat-7x50'") });
  priced(F, { id: "confirmat:<имя Базиса>", section: "Крепёж корпуса", name: "Крепёж корпуса под именем Базиса (Евровинт 6×50 и т.п.)", unit: "шт", cost: FASTENERS.confirmat.price, source: "Цена как у 5×50 — уточнить по счёту", src: loc("pricing.ts", "add('confirmat:'+confName"), match: /^confirmat:/ });
  priced(F, { id: "confirmat-cap", section: "Крепёж корпуса", name: "Заглушка самоклеящаяся под конфирмат", unit: "шт", cost: FASTENERS.cap.price, source: FASTENERS.cap.source, src: at("cap") });
  priced(F, { id: "eccentric", section: "Крепёж корпуса", name: "Эксцентриковая стяжка D15 (бочонок + шток)", unit: "компл", cost: FASTENERS.eccentric.price, source: FASTENERS.eccentric.source, src: at("eccentric") });
  priced(F, { id: "shelf-holder", section: "Полкодержатели", name: "Полкодержатель Boyard p521", unit: "шт", cost: FASTENERS.shelfHolder.price, source: FASTENERS.shelfHolder.source, src: at("shelfHolder") });
  priced(F, { id: "shelf-holder:<артикул Базиса>", section: "Полкодержатели", name: "Полкодержатель под артикулом Базиса (металлический, MV05, D5, FLIPPER…)", unit: "шт", cost: FASTENERS.shelfHolder.price, source: "Артикул — как в Базисе; цена — оценка как у Boyard p521, подтвердить", src: loc("pricing.ts", "function addShelfHolders"), match: /^shelf-holder:/ });
  priced(F, { id: "dowel", section: "Крепёж корпуса", name: "Шкант 8×30 бук", unit: "шт", cost: DOWEL.price, source: DOWEL.source, src: loc("pricing.ts", "export const DOWEL") });
  priced(F, { id: "kit", section: "Мелочёвка", name: HARDWARE_KIT.label, unit: "корпус", cost: HARDWARE_KIT.price, source: HARDWARE_KIT.source, src: loc("pricing.ts", "export const HARDWARE_KIT") });
  const sm = /add\('screw35x16-rod','([^']+)',RULES\.rodMountScrews,'шт',([\d.]+),'([^']+)'\)/.exec(pricingText())!;
  priced(F, { id: "screw35x16-rod", section: "Мелочёвка", name: sm[1], unit: "шт", cost: Number(sm[2]), source: sm[3], src: loc("pricing.ts", "add('screw35x16-rod'"), note: `${RULES.rodMountScrews} шт на штангу (RULES.rodMountScrews)` });
  for (const [name, cat] of [["Шуруп 3,5х16", "прочее"], ["Саморез 4х30", "прочее"]] as const) {
    const q = bazisPriced(name)!;
    priced(F, { id: "bazisPriced:" + name, section: "Крепёж из спецификации Базиса с ценой цеха", name: name + " (имя Базиса)", unit: "шт", cost: q.price, source: q.source, src: loc("pricing.ts", name.startsWith("Шуруп") ? "/^шуруп 3" : "/^саморез 4"), note: `строка сметы bazis:<категория>:${name} — цена по имени Базиса (bazisPriced)`, match: new RegExp("^bazis:[^:]+:" + (name.startsWith("Шуруп") ? "шуруп 3[.,]5 ?[хx×*] ?16" : "саморез 4 ?[хx×*] ?30"), "i") });
    void cat;
  }
  priced(F, { id: "bazis:отверстие:<имя>", section: "Крепёж из спецификации Базиса с ценой цеха", name: "Отверстие-крепёж Базиса (3×3, 5×12…) — изделия нет", unit: "шт", cost: 0, source: "Как в проекте Базиса: отверстие-крепёж с позицией; изделия нет, сверловка — в «Работе цеха»", src: loc("pricing.ts", "add('bazis:отверстие:'"), match: /^bazis:отверстие:/, status: "считается" });
}
// ---------- 8. Опоры, цоколь, штанги ----------
{
  const O = "Опоры, цоколь, штанги", t = pricingText();
  priced(O, { id: "legs", section: "Опоры шкафов", name: "Опора регулируемая INTEGRATO TECH G с шипами", unit: "шт", cost: LEG.price, source: LEG.source, src: loc("pricing.ts", "export const LEG=") });
  priced(O, { id: "legs-m6", section: "Опоры шкафов", name: "Ножка мебельная M6×18 с гайкой (ножки ≤ 30 мм)", unit: "шт", cost: LEG_M6.price, source: LEG_M6.source, src: loc("pricing.ts", "export const LEG_M6") });
  const fl = /add\('flange25','([^']+)',1,'шт',([\d.]+),'([^']+)'\)/.exec(t)!;
  priced(O, { id: "flange25", section: "Штанги", name: fl[1], unit: "шт", cost: Number(fl[2]), source: fl[3], src: loc("pricing.ts", "add('flange25'") });
  for (const m of t.matchAll(/add\('(rod-oval|rod25)','([^']+)',d\.length\/1000,'м',([\d.]+),'([^']+)'\)/g)) priced(O, { id: m[1], section: "Штанги", name: m[2], unit: "м", cost: Number(m[3]), source: m[4], src: loc("pricing.ts", `add('${m[1]}'`) });
  for (const [name, len, re] of [["Фланец Д25", undefined, /^bazis:[^:]+:фланец ?д\.? ?25/i], ["Труба Д25", 1000, /^bazis:[^:]+:труба ?д\.? ?25.*:m$/i]] as const) {
    const q = bazisPriced(name, len)!;
    priced(O, { id: "bazisPriced:" + name, section: "Штанги из спецификации Базиса", name: name + " (имя Базиса)" + (len ? ", за метр" : ""), unit: len ? "м" : "шт", cost: q.price, source: q.source, src: loc("pricing.ts", name.startsWith("Фланец") ? "/^фланец" : "/^труба"), match: re });
  }
  priced(O, { id: "pullout:<длина>", section: "Аксессуары шкафов", name: "Выдвижной тремпель GTV", unit: "шт", cost: PULLOUT_PRICE, source: "Цена Макса 07.10.2026: 500 ₽ за тремпель", src: loc("pricing.ts", "export const PULLOUT_PRICE"), match: /^pullout:/, status: "ориентир", note: "Решение Макса 07.10.2026 — пока нет счёта поставщика" });
}
// ---------- 9. Подсветка ----------
{
  const at = (k: string) => loc("model.ts", k + ":");
  priced("Подсветка", { id: "light-stand", section: "Подсветка (розница цеха)", name: "Подсветка в стойках (вертикаль)", unit: "пог.м", cost: RULES.lightRetailPerM, retail: true, source: "Прайс цеха (розница), решение Макса 20.10.2026", src: at("lightRetailPerM"), match: /^light-stand(:|$)/, note: "Тип и тон подсветки на цену не влияют (своя строка на сочетание). Себестоимость для сверки маржи — LED-профиль LR39 (Мега-Трейд), лист «Поставщики — не подключено»" });
  priced("Подсветка", { id: "light-shelf", section: "Подсветка (розница цеха)", name: "Подсветка в полках (горизонталь)", unit: "пог.м", cost: RULES.shelfLightRetailPerM, retail: true, source: "Прайс цеха (розница), решение Макса 20.10.2026", src: at("shelfLightRetailPerM"), match: /^light-shelf(:|$)/ });
  priced("Подсветка", { id: "light-roof", section: "Подсветка (розница цеха)", name: "Подсветка в крыше нижнего модуля (горизонталь)", unit: "пог.м", cost: RULES.shelfLightRetailPerM, retail: true, source: "Прайс цеха (розница), решение Макса 20.10.2026", src: at("shelfLightRetailPerM"), match: /^light-roof(:|$)/ });
}
// ---------- 11. Фасады Вернисаж ----------
{
  const V = "Фасады Вернисаж";
  for (const s of VERNISSAGE_SERIES) for (const t of ["16", "18", "19"] as const) {
    const pr = s.prices[t]; if (!pr) continue;
    for (const [k, v] of Object.entries(pr)) priced(V, { id: `vernissage-price:${s.id}:${t}:${k}`, section: `Вернисаж · ${SERIES_LABEL[s.id]} · МДФ ${t} мм`, name: `${SERIES_LABEL[s.id]}, ${t} мм — ${s.columns[k] ?? k}`, unit: "м²", cost: v, vern: true, source: `Прайс Вернисаж от ${priceDateRu()}`, src: loc("vernissageData.ts", "export const V_SERIES"), note: `строки сметы vernissage:<фрезеровка>:… — цена м² из этой ячейки прайса (+ надбавки ниже); прайс: строка ${s.srcRows?.[t] ?? "?"}` });
  }
  for (const [sid, byT] of Object.entries(V_ADILET_PRICES)) for (const [t, cols] of Object.entries(byT ?? {})) for (const [k, v] of Object.entries(cols)) priced(V, { id: `vernissage-adilet:${sid}:${t}:${k}`, section: "Вернисаж · плёнка Адилет", name: `${SERIES_LABEL[sid as keyof typeof SERIES_LABEL]}, ${t} мм — Адилет, категория ${k.replace("cat", "")}`, unit: "м²", cost: v, vern: true, source: `Прайс Вернисаж от ${priceDateRu()}: плёнка Адилет`, src: loc("vernissageData.ts", "export const V_ADILET_PRICES") });
  const N = VERNISSAGE_NOTES, nat = loc("vernissageData.ts", "export const V_NOTES");
  priced(V, { id: "vernissage-hinge-boring", section: "Вернисаж · надбавки и правила", name: "Присадка под петли на фасадах Вернисаж", unit: "шт", cost: N.hingeBoringPerPc, vern: true, source: `Прайс Вернисаж от ${priceDateRu()}: присадка под петли`, src: nat });
  priced(V, { id: "vernissage-rule:patina", section: "Вернисаж · надбавки и правила", name: "Патина (к цене м²)", unit: "м²", cost: N.patinaPerM2, vern: true, source: "Прайс Вернисаж, примечание 4", src: nat, note: "прибавляется к цене м² фасада" });
  priced(V, { id: "vernissage-rule:lacquer", section: "Вернисаж · надбавки и правила", name: "Лак на матовую эмаль (к цене м²)", unit: "м²", cost: N.enamelMatteLacquerPerM2, vern: true, source: "Прайс Вернисаж", src: nat, note: "прибавляется к цене м² фасада" });
  for (const [k, label, unit] of [["framesAndGrillesMarkupPct", "Рамка под стекло / решётка — надбавка", "%"], ["enamelTwoSidedMarkupPct", "Эмаль с двух сторон — надбавка", "%"], ["mdf25MarkupPctVs16", "МДФ 25 мм — надбавка к цене 16 мм", "%"], ["minAreaM2Pvc", "Минимальная площадь фасада ПВХ (меньше — как эта)", "м²"]] as const)
    put(V, { id: "vernissage-rule:" + k, section: "Вернисаж · надбавки и правила", name: label, unit, cost: null, coef: N[k], retail: null, supplier: "Вернисаж", status: "считается", src: nat, note: `значение ${String(N[k]).replace(".", ",")} ${unit} (колонка «Коэффициент»); исправление — новое значение в «Исправленная закупка»`, constant: true });
  put(V, { id: "const:VERNISSAGE_MARKUP_DEFAULT", section: "Вернисаж · надбавки и правила", name: "Коэффициент Вернисажа: клиенту = закупка × коэффициент", unit: "×", cost: null, coef: VERNISSAGE_MARKUP_DEFAULT, retail: null, supplier: "Цех (решение Макса)", status: "считается", src: loc("pricing.ts", "export const VERNISSAGE_MARKUP_DEFAULT"), note: "Решение Макса 10.10.2026; в обеих моделях цены (по коэффициенту и «цена за лист» — сверху листов)", constant: true });
}
// ---------- 12. Алюминиевые фасады, стекло ----------
{
  const A = "Алюминиевые фасады";
  for (const p of ALU_PROFILES) priced(A, { id: "alu-profile:" + p.id, section: "Рамка ALU — профиль (цена клиента, калькулятор фасадов ALU)", name: "Профиль рамки " + p.label, unit: "м", cost: p.perM, retail: true, source: ALU_SOURCE + ": профиль, цена клиента за пог. м периметра", src: loc("aluData.ts", "export const ALU_CALC_PROFILES"), match: new RegExp("^alu-profile:" + p.id + ":"), note: "Цвет на цену не влияет: " + p.colors.map((c) => c.label).join(", ") + ". Закупка профиля — у МВМ (лист «Справочник поставщиков»)" });
  for (const f of ALU_FILLS) priced(A, { id: "alu-insert:" + f.id, section: "Рамка ALU — наполнение: " + f.group, name: "Наполнение рамки · " + f.label, unit: "м²", cost: f.perM2, retail: true, source: ALU_SOURCE + ": " + f.group + ", цена клиента за м² площади фасада", src: loc("aluData.ts", "export const ALU_CALC_FILLS") });
  priced(A, { id: "alu-seal", section: "Рамка ALU — профиль (цена клиента, калькулятор фасадов ALU)", name: "Уплотнитель рамки", unit: "м", cost: ALU_GASKET_PER_M, retail: true, source: ALU_SOURCE + ": уплотнитель по периметру фасада", src: loc("aluData.ts", "ALU_CALC_GASKET_PER_M") });
  for (const g of ALU_INSERTS) priced(A, { id: "glass-top:" + g.id, section: "Стекло крыши шкафа (закупка АТБ)", name: "Крыша · " + g.label, unit: "м²", cost: g.perM2, source: g.source, src: loc("alu.ts", `{ id: "${g.id}"`, "export const ALU_INSERTS") });
  priced(A, { id: "glass-top-temper", section: "Стекло крыши шкафа (закупка АТБ)", name: "Закалка стекла 4 мм", unit: "м²", cost: RULES.glassTopTemper, source: "АТБ, прайс 01.01.2026", src: loc("model.ts", "glassTopTemper:") });
  priced(A, { id: "glass-top-polish", section: "Стекло крыши шкафа (закупка АТБ)", name: "Полировка кромки стекла 4 мм", unit: "пог.м", cost: RULES.glassTopPolishPerM, source: "Прайс МВМ стеклообработка 13.01.2026", src: loc("model.ts", "glassTopPolishPerM:") });
}
// ---------- 13. Двери купе — профили ----------
{
  const K = "Двери купе — профили", at = loc("kupeData.ts", "export const KUPE_SYSTEMS"), src = "Калькулятор купе: профили " + KUPE_VERSION.profiles;
  for (const s of KUPE_SYSTEMS) for (const c of s.colors) {
    const sec = `${s.system} · ${s.profile}${s.kind === "hang" ? " · подвесная" : ""}`, base = `${s.system}:${c.name}`;
    const row = (id: string, name: string, v: number, match?: RegExp) => put(K, { id, section: sec, name: `${name} · ${s.system} · ${c.name}`, unit: "м", cost: v, coef: KUPE_PROFILE_MULT, retail: r2(v * KUPE_PROFILE_MULT), supplier: "Калькулятор купе", status: "считается", src: at + " · " + loc("kupe.ts", "const prof ="), note: src + " (закупка × " + KUPE_PROFILE_MULT + "); розничная позиция — коэффициент сметы сверху не берётся", match });
    row(`kupe-profile:ruchka:${base}`, "Профиль-ручка", c.ruchka);
    row(`kupe-profile:verh:${base}`, "Рамка верхняя", c.verh);
    row(`kupe-profile:niz:${base}`, "Рамка нижняя", c.niz);
    row(`kupe-profile:razd:${base}`, "Разделитель (горизонтальный и вертикальный)", c.razd, new RegExp("^kupe-profile:razd-[hv]:" + base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"));
    row(`kupe-track:top:${base}`, "Направляющая верхняя" + (s.kind === "hang" ? " (подвесная)" : ""), c.top);
    if (s.kind !== "hang") row(`kupe-track:bottom:${base}`, "Направляющая нижняя", c.bot);
  }
}
// ---------- 14. Двери купе — наполнения и фурнитура ----------
{
  const K = "Купе — наполнения и фурнитура", src = "Калькулятор купе: наполнения " + KUPE_VERSION.fillings, at = loc("kupeData.ts", "export const KUPE_FILLS");
  for (const f of KUPE_FILLS) {
    if (isLdspFill(f)) {
      const d = decorPrice(f.n), q = kupeLdspPerM2(f.n, MARKUP_DEFAULT);
      put(K, { id: "kupe-fill:" + f.n, section: "Наполнение: " + f.g, name: "Купе · наполнение " + f.n, unit: "м²", cost: d.price === null ? null : r2(d.price / LDSP_SHEET_M2), coef: d.price === null ? null : MARKUP_DEFAULT, retail: q.price, supplier: "СФЗ (Lamarty)", status: statusOf(q.source, q.price), src: at + " · " + loc("pricing.ts", "export function kupeLdspPerM2"), note: q.source + " · решение Макса 16.10.2026: лист декора по прайсу Lamarty в пересчёте на м² × коэффициент; исправлять цену листа декора (лист «Плиты и ЛХДФ»)" });
    } else priced(K, { id: "kupe-fill:" + f.n, section: "Наполнение: " + f.g, name: "Купе · наполнение " + f.n, unit: "м²", cost: f.p ?? null, retail: true, source: src, src: at });
  }
  priced(K, { id: "kupe-soft", section: "Фурнитура и работа", name: "Купе · доводчики (на дверь)", unit: "дв.", cost: KUPE_SOFT_CLOSE, retail: true, source: src, src: loc("kupeData.ts", "KUPE_SOFT_CLOSE") });
  priced(K, { id: "kupe-work:complex", section: "Фурнитура и работа", name: `Купе · сложная сборка (от ${KUPE_COMPLEX_THRESHOLD} секций)`, unit: "дв.", cost: KUPE_COMPLEX_WORK, retail: true, source: src, src: loc("kupeData.ts", "KUPE_COMPLEX_WORK") });
  for (const f of [KUPE_FILM_ARMOR, KUPE_FILM_SAFETY]) priced(K, { id: "kupe-film:" + f.name, section: "Фурнитура и работа", name: "Купе · " + f.name, unit: "м²", cost: f.p, retail: true, source: src, src: loc("kupeData.ts", f === KUPE_FILM_ARMOR ? "KUPE_FILM_ARMOR" : "KUPE_FILM_SAFETY") });
  const fam = new Map<string, { price: number; label: string; systems: string[] }>();
  for (const s of KUPE_SYSTEMS) if (s.hardwarePerDoor) { const g = fam.get(s.family) ?? { price: s.hardwarePerDoor, label: s.hardwareLabel ?? "комплект фурнитуры", systems: [] }; g.systems.push(s.system); fam.set(s.family, g); }
  for (const [family, g] of fam) priced(K, { id: "kupe-hardware:" + family, section: "Фурнитура и работа", name: "Купе · " + g.label + " (на дверь)", unit: "дв.", cost: g.price, retail: true, source: src, src: loc("kupeData.ts", "export const KUPE_SYSTEMS"), note: "системы: " + g.systems.join(", ") });
}
// ---------- 17. Работа и коэффициенты ----------
{
  const W = "Работа и коэффициенты";
  priced(W, { id: "work", section: "Работа цеха", name: "Работа цеха: ЛДСП (за лист раскроя)", unit: "лист", cost: SHOP_WORK_LDSP_SHEET, source: "Цех: решение Макса 20.10.2026 (было 2 500)", src: loc("pricing.ts", "export const SHOP_WORK_LDSP_SHEET") });
  priced(W, { id: "work-hdf", section: "Работа цеха", name: "Работа цеха: ЛХДФ (за лист; у кухонь не считается)", unit: "лист", cost: SHOP_WORK_HDF_SHEET, source: "Цех: решение Макса 20.10.2026", src: loc("pricing.ts", "export const SHOP_WORK_HDF_SHEET") });
  const sm = /add\('small','([^']+)',small,'шт',([\d.]+),'([^']+)'/.exec(pricingText())!;
  priced(W, { id: "small", section: "Работа цеха", name: sm[1], unit: "шт", cost: Number(sm[2]), source: sm[3] + " (норматив цеха)", src: loc("pricing.ts", "add('small'") });
  priced(W, { id: "falsh-glue", section: "Работа цеха", name: "Склейка фальш-панели: 2 плиты 16 в 32 мм (работа, клей)", unit: "м²", cost: FALSH_GLUE_RETAIL_M2, retail: true, source: "Цена цеха: склейка 1000 ₽/м² (решение Макса 16.10.2026)", src: loc("pricing.ts", "export const FALSH_GLUE_RETAIL_M2") });
  const c = (id: string, name: string, v: number, unit: string, src: string, note: string) => put(W, { id: "const:" + id, section: "Коэффициенты и модель цены", name, unit, cost: null, coef: v, retail: null, supplier: "Цех (решение Макса)", status: "считается", src, note: note + " · исправление — новое значение в «Исправленная закупка ₽»", constant: true });
  c("MARKUP_DEFAULT", "Коэффициент сметы: клиенту = закупка × коэффициент", MARKUP_DEFAULT, "×", loc("pricing.ts", "export const MARKUP_DEFAULT"), "по умолчанию; в проекте можно поменять (calculation.markup)");
  c("VERNISSAGE_MARKUP_DEFAULT", "Коэффициент фасадов Вернисаж", VERNISSAGE_MARKUP_DEFAULT, "×", loc("pricing.ts", "export const VERNISSAGE_MARKUP_DEFAULT"), "решение Макса 10.10.2026");
  c("KUPE_PROFILE_MULT", "Профили купе: розница = закупка × множитель (калькулятор купе)", KUPE_PROFILE_MULT, "×", loc("kupeData.ts", "export const KUPE_PROFILE_MULT"), "калькулятор купе v2.10, решение Макса 23.10.2026");
  put(W, { id: "const:SHEET_PRICE_DEFAULT", section: "Коэффициенты и модель цены", name: "Модель «цена за лист»: цена клиенту за лист ЛДСП (с кромкой, фурнитурой и работой)", unit: "лист", cost: null, coef: "розница", retail: SHEET_PRICE_DEFAULT, supplier: "Цех (решение Макса)", status: "считается", src: loc("pricing.ts", "export const SHEET_PRICE_DEFAULT"), note: "экономика цеха (модель 08.2026); сверху листов — розница, Леман, Вернисаж × 1,6 · исправление — в «Исправленная розница ₽»", constant: true, retailOnly: true });
}

// ---------- статический разбор add(…, null, …) в pricing.ts ----------
/** Аргументы вызова с позиции открывающей скобки: верхний уровень, с учётом строк, шаблонов ${…} и скобок. */
function callArgs(t: string, open: number): string[] {
  const out: string[] = []; let depth = 0, cur = "", i = open + 1, q: string | null = null, tpl = 0;
  for (; i < t.length; i++) {
    const ch = t[i];
    if (q) { cur += ch; if (ch === "\\") { cur += t[++i]; continue; } if (q === "`" && ch === "$" && t[i + 1] === "{") { tpl++; cur += t[++i]; q = null; continue; } if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { q = ch; cur += ch; continue; }
    if (ch === "}" && tpl > 0 && depth === 0) { tpl--; cur += ch; q = "`"; continue; }
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    if (ch === ")" || ch === "]" || ch === "}") { if (depth === 0) { out.push(cur.trim()); return out; } depth--; }
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  return out;
}
/** Шаблон id из выражения: 'a:'+x → a:*, `a:${x}` → a:* ; динамическое начало — null. */
function idPattern(e: string): string | null {
  const m = /^'([^']*)'(\+.*)?$/.exec(e); if (m) return m[1] + (m[2] ? "*" : "");
  const t = /^`([^`]*)`$/.exec(e); if (t) return t[1].replace(/\$\{[^}]*\}/g, "*");
  return null;
}
const literal = (e: string | undefined) => { if (!e) return ""; const m = /^'([^']*)'/.exec(e) ?? /^`([^`]*)`/.exec(e); return m ? m[1].replace(/\$\{[^}]*\}/g, "…") : ""; };
type Tpl = { pattern: string; re: RegExp; src: string; label: string; unit: string; source: string };
const templates: Tpl[] = [];
{
  const t = pricingText(), starts: number[] = [0];
  for (let i = 0; i < t.length; i++) if (t[i] === "\n") starts.push(i + 1);
  const lineOf = (pos: number) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; } return lo + 1; };
  for (const m of t.matchAll(/\badd\(/g)) {
    const a = callArgs(t, m.index! + 3);
    if (a.length < 6 || a[4] !== "null") continue;
    const pat = idPattern(a[0]); if (!pat) continue;
    const re = new RegExp("^" + pat.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
    if (templates.some((x) => x.pattern === pat)) continue;
    templates.push({ pattern: pat, re, src: "pricing.ts:" + lineOf(m.index!), label: literal(a[1]) || a[1].slice(0, 60), unit: literal(a[3]), source: literal(a[5]) });
  }
}
// правила «после финального расчёта» (pendingPrices.ts, массив RULES не экспортируется): из исходника, проверка — функцией pendingPrice
const pendingRules = srcLines("pendingPrices.ts").flatMap((l, i) => { const m = /^\s*\[\/(.+)\/, '(.+)'\],?\s*$/.exec(l); return m ? [{ re: new RegExp(m[1]), source: m[2], src: "pendingPrices.ts:" + (i + 1) }] : []; });

// ---------- прогон estimate() ----------
type Seen = { label: string; unit: string; price: number | null; source: string; pending: boolean; retail: boolean; qty: number; sets: number; where: Map<string, Set<string>>; samples: PriceLine[] };
const seen = new Map<string, Seen>();
const setsRun: Record<string, number> = {};
let setErrors = 0;
const failed: string[] = [];
const fail = (x: unknown, what = "сборка набора") => { setErrors++; failed.push(what + ": " + String((x as Error)?.message ?? x).slice(0, 140)); };
function run(cat: string, detail: string, p: Project) {
  let e; try { e = estimate(p); } catch (x) { setErrors++; failed.push(`${cat} ${detail}: смета — ${(x as Error).message}`); return; }
  setsRun[cat] = (setsRun[cat] ?? 0) + 1;
  for (const l of e.lines) {
    const s = seen.get(l.id) ?? { label: l.label, unit: l.unit, price: l.unitPrice, source: l.source, pending: !!l.pending, retail: !!l.retail, qty: 0, sets: 0, where: new Map(), samples: [] };
    s.qty += l.quantity; s.sets++; if (s.samples.length < 3) s.samples.push(l);
    const w = s.where.get(cat) ?? new Set<string>(); if (detail) w.add(detail); s.where.set(cat, w);
    seen.set(l.id, s);
  }
}
const proj = (modules: Project["modules"], kind?: "kitchen"): Project => ({ ...newProject(), ...(kind ? { kind } : {}), modules });
{
  const src = initialModule(), room = { width: 3600, depth: 3000, height: 2700 };
  const kinds: [ModuleKind, number, number, number][] = [["empty", 800, 2200, 600], ["shelves", 800, 2000, 400], ["wardrobe", 1000, 2200, 600], ["drawers", 600, 850, 550], ["corner", 1050, 2000, 450], ["desk", 1200, 750, 600], ["kupe", 1600, 2400, 100], ["kitchen-base", 600, 820, 560], ["kitchen-wall", 600, 720, 300], ["worktop", 2400, 38, 600]];
  for (const [k, w, h, d] of kinds) { try { run("Шаблон палитры", KIND_LABEL[k], newProject(createModule(k, w, h, d, src))); } catch (x) { fail(x); } }
  try { run("Шаблон палитры", "Шкаф-купе", proj(createKupeWardrobe(2400, 2400, 600, src))); } catch (x) { fail(x); }
  try { run("Шаблон палитры", "Шкаф-купе (двери внутри)", proj(createKupeWardrobe(2400, 2400, 600, src, undefined, "inside"))); } catch (x) { fail(x); }
  try { run("Шаблон палитры", "Кухня прямая", kitchenProject()); } catch (x) { fail(x); }
  try { run("Шаблон палитры", "Кухня угловая (Г)", proj(createKitchenCornerRow(src, { back: 3000, side: 2000, wing: "left", room }), "kitchen")); } catch (x) { fail(x); }
  try { run("Шаблон палитры", "Кухня П-образная", proj(createKitchenURow(src, { left: 2000, back: room.width, right: 2000, room }), "kitchen")); } catch (x) { fail(x); }
  for (const [k, it] of Object.entries(KITCHEN_ITEMS) as [KitchenItem, (typeof KITCHEN_ITEMS)[KitchenItem]][]) for (const w of it.widths) {
    try { run("Шаблон кухни", it.label + " " + w, { ...newProject(kitchenTemplate(k, w, src)), kind: "kitchen" }); } catch (x) { fail(x); }
  }
  // столешницы всех материалов кухни
  for (const c of WORKTOP_CHOICES) { try { const m = createModule("worktop", 2400, c.thickness, 600, src); m.worktop = { ...m.worktop!, material: c.material, thickness: c.thickness, cutouts: [{ kind: "sink", x: 600, width: 560, depth: 480 }, { kind: "hob", x: 1500, width: 560, depth: 480 }] }; run("Опция", "Столешница " + c.label + " с вырезами", newProject(m)); } catch (x) { fail(x); } }
  // опции шкафа «Для одежды» и комода — по одной
  const variant = (detail: string, kind: ModuleKind, f: (m: Module) => void, w = kind === "drawers" ? 600 : 1000, h = kind === "drawers" ? 850 : 2200) => { try { const m = createModule(kind, w, h, kind === "drawers" ? 550 : 600, src); f(m); run("Опция", detail, newProject(m)); } catch (x) { fail(x, "Опция " + detail); } };
  for (const b of ["pulse", "blum"] as HingeBrand[]) variant("Петли " + b, "wardrobe", (m) => { m.hingeBrand = b; });
  variant("Push-to-open", "wardrobe", (m) => { m.doorOpen = "push"; });
  variant("Вкладные двери", "wardrobe", (m) => { m.doorMount = "inset"; });
  variant("Push-to-open вкладные", "wardrobe", (m) => { m.doorOpen = "push"; m.doorMount = "inset"; });
  variant("Овальная штанга", "wardrobe", (m) => { m.rodType = "oval"; });
  variant("Пантограф", "wardrobe", (m) => { m.sections[0].pantograph = true; m.sections[0].rod = false; }, 800);
  variant("Тремпель", "wardrobe", (m) => { m.sections[0].pullouts = 1; });
  variant("Ножки 20 мм", "wardrobe", (m) => { m.feet = { height: 20 }; });
  variant("Ножки 100 мм", "wardrobe", (m) => { m.feet = { height: 100 }; });
  variant("Подсветка в стойках", "wardrobe", (m) => { m.standLight = true; });
  variant("Подсветка в полках", "wardrobe", (m) => { m.sections[0].shelfLight = true; });
  variant("Подсветка под крышей", "wardrobe", (m) => { m.sections[0].topLight = true; });
  variant("Стеклянная крыша", "wardrobe", (m) => { m.topGlass = "glass-clear"; });
  variant("Стеклянная полка", "wardrobe", (m) => { m.sections[0].glassShelves = [0]; });
  variant("Фасады ALU", "wardrobe", (m) => { m.alu = { ...DEFAULT_ALU }; }, 1000, 2000);
  variant("Фасады Вернисаж", "wardrobe", (m) => { m.vernissage = { ...DEFAULT_VERNISSAGE }; });
  variant("Фасадный материал сторонний", "wardrobe", (m) => { m.facadeMaterial = "external"; });
  variant("Подъёмный фасад", "wardrobe", (m) => { m.sections[0].doorHinges = ["top"]; });
  for (const sys of SLIDE_SYSTEMS) variant("Ящики: " + sys.label, "drawers", (m) => { const s = m.sections[0]; s.drawerConfigs = (s.drawerConfigs ?? []).map((c) => ({ ...c, slide: sys.slide, operation: sys.motion, brand: sys.brand })); });
  variant("Сетка Лемана", "drawers", (m) => { const s = m.sections[0]; s.drawerConfigs = (s.drawerConfigs ?? []).map((c, i) => i === 0 ? { ...c, mesh: DEFAULT_MESH, height: 185 } : c); }, 504);
  for (const lift of ["adagio", "sempre"] as const) { try { const m = kitchenTemplate("wall", 600, src); if (lift === "sempre") m.height = 560; m.sections[0].doorHinges = ["top"]; m.sections[0].doorLifts = [lift]; run("Опция", "Навесной: подъёмник Premial " + lift, proj([{ id: "m", x: 0, y: 1500, z: 0, rotation: 0, module: m }], "kitchen")); } catch (x) { fail(x); } }
  // проекты: примеры, заказы цеха, локальные проекты (кухни и шкафы Базиса) — только тип
  for (const dir of ["examples", "examples/orders", "public/local-projects"]) {
    const abs = join(STUDIO, dir); if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      if (!f.endsWith(".json") || f === "kitchens.json" || f === "wardrobes.json") continue;
      const cat = dir === "examples/orders" ? "Заказ цеха" : /^kitchen-k\d+/.test(f) ? "Кухня Базиса" : /^wardrobe-\d+\.json$/.test(f) ? "Шкаф Базиса (импорт)" : dir === "examples" ? "Пример студии" : "Проект студии";
      try { run(cat, "", parseProject(JSON.parse(readFileSync(join(abs, f), "utf8")))); } catch (x) { fail(x); }
    }
  }
}
// ---------- сортировка по листам: позиции без цены ----------
function sheetFor(id: string): SheetName | null {
  if (/^sheet:/.test(id)) return "Плиты и ЛХДФ";
  if (/^edge/.test(id)) return "Кромка";
  if (/^vernissage/.test(id)) return "Фасады Вернисаж";
  if (/^(hinge|push-latch)/.test(id)) return "Петли";
  if (/^(lift-mechanism|kitchen-lift:|premial-allegro:|bazis:(газлифт|подъёмник):)/.test(id)) return "Подъёмники и Premial";
  if (/^(slide:|versalite-h45:|guides:|firmax|modern-slide:|indigo:|start-sc:|axis-pro|axis-rail|mesh:|bazis:(направляющая|ящик-система|сушка|карго):)/.test(id)) return /^bazis:сушка/.test(id) ? "Кухня — столешницы и мойки" : "Направляющие и ящики";
  if (/^handle:lm/.test(id)) return "Ручки Лемана";
  if (/^(handle:|bazis:[^:]+:.*ручк)/i.test(id)) return "Ручки цеха";
  if (/^(legs|kitchen-leg|kitchen-clip|rod|flange|pullout|pantograph)/.test(id)) return "Опоры, цоколь, штанги";
  if (/^light-/.test(id)) return "Подсветка";
  if (/^(alu-|glass-)/.test(id)) return "Алюминиевые фасады";
  if (/^kupe-(profile|track):/.test(id)) return "Двери купе — профили";
  if (/^kupe-/.test(id)) return "Купе — наполнения и фурнитура";
  if (/^(worktop|premial-sink|kitchen-hanger|gola-|wallpanel:|plinth-external|facade-external|mat:)/.test(id)) return "Кухня — столешницы и мойки";
  if (/^(work|small|falsh-glue)/.test(id)) return "Работа и коэффициенты";
  if (/^(confirmat|eccentric|shelf-holder|dowel|kit$|screw|bazis:)/.test(id)) return "Крепёж и мелочёвка";
  return null;
}
/** Что нужно для позиции без цены — по аудиту «Не считается в смете 22.10» и справочнику поставщиков. */
const NEEDS: [RegExp, string][] = [
  [/^axis-pro:|^axis-rail:/, "Цена комплекта Axis PRO (Мегатрейд, счёт). Решение Макса: включать ли ориентир ~7 000 ₽ за ящик в итог"],
  [/^kitchen-leg$/, "Счёт ФАМ на опору H100-120 (INTEGRATO TECH G 127,40 ₽ есть — у шкафов)"],
  [/^kitchen-leg:/, "Цена опоры по имени Базиса; INTEGRATO TECH G — 127,40 ₽ (МДМ) уже есть"],
  [/^kitchen-clip/, "Счёт ФАМ на клипсу цоколя"],
  [/^kitchen-hanger/, "Счёт ФАС на навес (+ заглушка). Решение Макса: ориентир ~120 ₽ клиенту в итог?"],
  [/^worktop:edge:/, "Поставщик и цена обработки торца компакт/акрил/кварц, ₽/пог.м — Макс"],
  [/^worktop:(compact|acrylic|quartz):/, "Поставщик компакт/акрил/кварц и цена за м² — Макс"],
  [/^worktop-cut:/, "Цена работы выреза (Премиал) — Макс"],
  [/^worktop:/, "Прайс Премиал на столешницы (постформинг, ЛДСП, камень), ₽/пог.м — Макс"],
  [/^gola-/, "Поставщик и цена профиля Gola, ₽/пог.м — Макс"],
  [/^premial-/, "Закупка Premial (мойка 210245, бутылочница АЛЛЕГРО 060500/060502) — Макс"],
  [/^lift-mechanism:premial/, "Подбор и цена Premial АДАЖИО / СЕМПРЕ — Макс"],
  [/^lift-mechanism/, "Подбор механизма по массе фасада; в справочнике поставщиков есть MINILIFT NEW STRONG (ФАМ) — лист «Поставщики — не подключено»"],
  [/^kitchen-lift:/, "Цена газлифта PD-G-N02 / GL104 (комплект на боковину) — Макс"],
  [/^pantograph/, "Закупка пантографа GTV (9 000 ₽ в старом прайсе — цена продажи): дать закупку или считать 9 000 розницей — Макс"],
  [/^glass-shelf/, "Правило и цена стеклянной полки: стекло АТБ по м² + закалка + полировка (цены как у стекла крыши, лист «Алюминиевые фасады»); держатели — цена"],
  [/^versalite-h45:/, "Versalite H45 этой длины нет в закупке ФАМ (есть 250–500) — счёт или решение"],
  [/^hinge-false-panel/, "Артикул и поставщик петли под фальшпанель — Макс"],
  [/^hinge-bazis:/, "Цена петли этого типа (COCA без пружины — 80 ₽ ФАМ есть; полунакладная, под фальшпанель — Макс)"],
  [/^(firmax|modern-slide|indigo|start-sc|guides:)/, "Цена комплекта направляющих/ящика; часть есть в справочнике поставщиков (СТАРТ — Мега-Трейд и Бояринова, MODERN SLIDE 350 — ФАМ, Hettich Quadro 300 — Древиз): лист «Поставщики — не подключено»"],
  [/^facade-external|^plinth-external/, "Правило цены фасадов стороннего материала (например, по прайсу Вернисаж) — решение Макса"],
  [/^wallpanel:/, "Прайс стеновых панелей — Макс"],
  [/^mat:/, "Цена материала Базиса (пластик, металл) — можно 0 с пометкой"],
  [/^sheet:/, "Цена листа декора вне каталога Lamarty (Egger, Kronospan, МДФ, IDM) — прайс от Макса"],
  [/^unplaced/, "Решение технолога: сращивание или отдельная плита"],
  [/^bazis-hardware:raw/, "Технически: подсчёт фурнитуры из raw.hardware при импорте (цены петель, конфирматов, направляющих уже есть)"],
  [/^bazis:рафикс/, "Цена рафикса (полкодержатель-стяжка) — Макс"],
  [/^bazis:сушка/, "Цена сушки — Макс"],
  [/^bazis:.*(ручк|рейлинг)/i, "Сопоставить с каталогом ручек (UZ 819 — 100 ₽, рейлинги Лемана)"],
  [/^bazis:.*гвозд/i, "Гвоздь — копейки, можно поставить 0"],
  [/^bazis:/, "Цена по имени Базиса (справочник «имя Базиса → цена», как bazisPriced) — Макс / закупка"],
];
const needOf = (id: string) => NEEDS.find(([re]) => re.test(id))?.[1] ?? "Цена / поставщик — Макс";

/** Строка кода для позиции без шаблона add(…, null): фурнитура Базиса по имени, направляющие Базиса, столешницы, купе. */
function srcFallback(id: string): string {
  if (/^bazis:/.test(id)) return loc("pricing.ts", "const pr=bazisPriced(it.name");
  if (/^guides:|^firmax:|^modern-slide:/.test(id)) return loc("pricing.ts", "const g=guideKitLine(it.name)");
  if (/^sheet:/.test(id)) return loc("pricing.ts", "add('sheet:'+sheet.decor");
  if (/^worktop/.test(id)) return loc("kitchen.ts", "export function worktopLines") + " · " + loc("pricing.ts", "for(const l of worktopLines(a.module))");
  if (/^kupe-/.test(id)) return loc("kupe.ts", "export function kupeLines");
  if (/^hinge-bazis:/.test(id)) return loc("pricing.ts", "add('hinge-bazis:'");
  if (/^vernissage/.test(id)) return loc("pricing.ts", "add(`vernissage:");
  if (/^alu-/.test(id)) return loc("pricing.ts", "add('alu-profile:'");
  if (/^glass-top:/.test(id)) return loc("pricing.ts", "add('glass-top:'");
  return "pricing.ts";
}
// ---------- лист «НЕТ ЦЕНЫ» ----------
const nopr: Row[] = [];
{
  const tplOf = (id: string) => templates.find((t) => t.re.test(id));
  const pendOf = (id: string) => pendingRules.find((r) => r.re.test(id));
  const sectionOf = (id: string) => sheetFor(id) ?? "Прочее";
  for (const [id, s] of [...seen].sort((a, b) => a[0].localeCompare(b[0], "ru"))) {
    if (s.price !== null) continue;
    const t = tplOf(id), p = pendOf(id);
    const srcs = [t?.src, p?.src].filter(Boolean).join(" · ") || srcFallback(id);
    const pending = s.pending;
    nopr.push({ id, section: sectionOf(id), name: s.label, unit: s.unit, cost: null, coef: null, retail: null, supplier: pending ? (p?.source.split(":")[0] ?? "") : supplierOf(s.source), status: pending ? "после финального расчёта" : "нет цены", src: srcs, note: s.source,
      where: [...s.where].map(([cat, d]) => cat + (d.size ? " (" + [...d].slice(0, 5).join(", ") + (d.size > 5 ? ` и ещё ${d.size - 5}` : "") + ")" : "")).join("; ") + ` — всего ${Math.round(s.qty * 1000) / 1000} ${s.unit} в ${s.sets} наборах`,
      need: needOf(id) });
  }
  // шаблоны add(…, null) и правила pendingPrices, не встретившиеся в прогоне
  for (const t of templates) if (![...seen.keys()].some((id) => t.re.test(id) && seen.get(id)!.price === null)) {
    const sample = t.pattern.replace(/\*/g, "x"), pp = pendingPrice(sample);
    nopr.push({ id: t.pattern, section: sectionOf(sample), name: t.label, unit: t.unit, cost: null, coef: null, retail: null, supplier: pp ? pp.source.split(":")[0] : supplierOf(t.source), status: pp ? "после финального расчёта" : "нет цены", src: t.src, note: pp ? pp.source : t.source, where: "в прогоне не встретилось (шаблон строки в коде)", need: needOf(sample) });
  }
  for (const r of pendingRules) if (!nopr.some((n) => r.re.test(n.id) || r.re.test(n.id.replace(/\*/g, "x")))) {
    const sample = r.re.source.replace(/^\^/, "").replace(/\$$/, "").replace(/\\/g, "").replace(/\(.*?\)/g, "x").replace(/\[.*?\]/g, "L");
    nopr.push({ id: r.re.source, section: sectionOf(sample), name: "Правило «после финального расчёта»: " + r.source.split(" — ")[0], unit: "", cost: null, coef: null, retail: null, supplier: r.source.split(":")[0], status: "после финального расчёта", src: r.src, note: r.source, where: "в прогоне не встретилось (правило pendingPrices)", need: needOf(sample) });
  }
  // те же позиции — в тематические листы (статус «нет цены» / «после финального расчёта»)
  for (const n of nopr) { const sh = sheetFor(n.id.replace(/\*/g, "x")); if (sh && !book.get(sh)!.some((r) => r.id === n.id)) put(sh, { ...n, section: n.status === "нет цены" ? "Без цены (итог сметы «—»)" : "После финального расчёта (в итог не входит)" }); }
}
// строки книги с ценой, которые прогон не нашёл в смете (для сверки), и наоборот
const allRows = () => [...book.values()].flat();
function rowFor(id: string): Row | undefined {
  const rows = allRows();
  return rows.find((r) => r.id === id) ?? rows.find((r) => r.match?.test(id));
}
// строки сметы с ценой из прогона, которых нет в таблицах кода (толщины не 16 мм, направляющие Базиса по имени): своей строкой, цена — как в смете
const fromRun: string[] = [];
for (const [id, s] of [...seen].sort((a, b) => a[0].localeCompare(b[0], "ru"))) {
  if (s.price === null || /^vernissage:/.test(id) || rowFor(id)) continue;
  fromRun.push(`${id} = ${s.price}`);
  const th = /^sheet:(.+):(\d+(?:\.\d+)?)$/.exec(id), sh = sheetFor(id) ?? "Крепёж и мелочёвка";
  const src = th ? loc("pricing.ts", "add('sheet:'+sheet.decor") : id.startsWith("guides:") ? loc("pricing.ts", "export function guideKitPrice") : id.startsWith("bazis:") ? loc("pricing.ts", "const pr=bazisPriced(it.name") : "pricing.ts";
  priced(sh, { id, section: th ? "Другие толщины (сейчас по цене 16 мм)" : "Из спецификации Базиса (по имени)", name: s.label, unit: s.unit, cost: s.price, retail: s.retail, source: s.source, src, note: "строка из прогона смет (" + s.sets + " наборов)" });
}

// ---------- справочник поставщиков (Vault, только чтение) ----------
type Sup = { supplier: string; group: string; name: string; art: string; unit: string; price: number | null; raw: string; line: number };
const supRows: Sup[] = [];
if (existsSync(VAULT)) {
  const ls = readFileSync(VAULT, "utf8").split(/\r?\n/);
  let supplier = "", group = "", header: string[] = [], secNote = "";
  const numOf = (s: string) => { const t = s.replace(/\*/g, "").replace(/\s/g, "").replace(",", "."); const m = /^(\d+(?:\.\d+)?)/.exec(t); return m ? Number(m[1]) : null; };
  ls.forEach((l, i) => {
    if (/^## /.test(l)) { supplier = l.replace(/^##\s*/, "").replace(/[*⚠️]/g, "").trim(); group = ""; header = []; secNote = ""; return; }
    if (/^\*[^*]/.test(l) && supplier && !secNote) secNote = l;
    if (/^### /.test(l)) { group = l.replace(/^###\s*/, "").trim(); header = []; return; }
    if (/Чего в справочнике нет|Сравнение поставщиков/.test(supplier)) return;
    if (/^\|/.test(l)) {
      const cells = l.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^:?-{3,}:?$/.test(c))) return;
      if (!header.length) { header = cells; return; }
      const isNum = (c: string) => /^\**\s*\d/.test(c);
      const thick = /^Толщина/.test(header[0] ?? "");
      const name = (thick ? `ЛДСП Lamarty ${cells[0]} мм` : [cells[0], ...cells.slice(1).filter((c) => c && c !== "—" && !isNum(c))].join(" · ")).replace(/\*\*/g, ""), art = /\(([A-Z0-9][\w.\-/]+(?:\s[\w.\-/]+)?)\)/.exec(name)?.[1] ?? "";
      const ctx = header.join(" ") + " " + cells.join(" ") + " " + group + " " + secNote;
      const unit = thick ? "лист" : /₽\/м²/.test(ctx) ? "м²" : /м\.п\.|пог\.м/.test(ctx) ? "м" : /₽\/(шт|компл|лист|комп|м)(?![а-яa-z])/.exec(ctx)?.[1] ?? (/кромк/i.test(group) ? "м" : /лист/i.test(group + header.join(" ")) ? "лист" : "шт");
      cells.slice(1).forEach((c, k) => {
        if (!c || c === "—" || !isNum(c)) return;
        if (/Закупка|РРЦ/.test(header[k + 1] ?? "") === false && /клиентск/i.test(header[k + 1] ?? "")) return; // колонка «в клиентской расчётке» — не закупка
        let parts = c.split("/").map((x) => x.trim()).filter(Boolean); if (!parts.every(isNum)) parts = [c];
        const hdr = header[k + 1] ?? "";
        parts.forEach((pv, j) => {
          const v = numOf(pv);
          if (v === null && !/\d/.test(pv)) return;
          const tiersCol = ["базовые тиснения", "тиснения D, N, G, US", "тиснения N*, D*, U"];
          const suffix = (cells.length > 2 ? " · " + hdr : "") + (parts.length > 1 ? " · " + (thick ? tiersCol[j] ?? "вариант " + (j + 1) : "вариант " + (j + 1)) : "");
          supRows.push({ supplier, group, name: name + suffix, art, unit, price: /–/.test(pv) ? null : v, raw: pv, line: i + 1 });
        });
      });
      return;
    }
    // строки текста вида «<позиция> — 127,40 ₽/шт»
    for (const m of l.matchAll(/([A-Za-zА-ЯЁа-яё][^—;:.]{3,80}?)\s+—\s+([\d\s]+(?:,\d+)?)\s*₽(?:\/(\w+))?/g)) {
      if (!supplier) continue;
      supRows.push({ supplier, group, name: m[1].replace(/^\*+|\*+$/g, "").trim(), art: /\(([A-Z0-9][\w.\-/]+)\)/.exec(m[1])?.[1] ?? "", unit: m[3] ?? "шт", price: numOf(m[2]), raw: m[2], line: i + 1 });
    }
  });
}
const GENERIC = /^(мм|шт|для|без|под|компл|цена|мат|комп|лист|вариант|закупка|gtv|slide|ball|hidden|soft|push|simple|мебельная|накладная|доводчиком|шариковые|скрытого|монтажа|направляющие|направляющая|петля|ручка|группа|тиснения|базовые|lamarty|лдсп|профиль|рамка|рамки|наполнение|крыша|стекло|купе|sheet|handle|tier|insert|alu|fill|kupe|profile|track|top|bottom|чёрный|черный|хром|матовый|алюминий|серебро)$/;
const tokens = (s: string) => new Set((s.toLowerCase().replace(/ё/g, "е").replace(/([a-z]{2,})[\s-]+(\d{2,})/g, "$1$2").match(/[a-zа-я0-9]{3,}/g) ?? []).filter((t) => /[a-zа-я]/.test(t) && !GENERIC.test(t)));
const unitOk = (a: string, b: string) => { const n = (u: string) => u === "пог.м" ? "м" : /^(м|м²|лист)$/.test(u) ? u : "шт"; return !a || !b || n(a) === n(b); };
const supStatus = supRows.map((s) => {
  const st = tokens(s.name + " " + s.art), cands = allRows().filter((r) => (r.cost !== null || r.retail !== null) && unitOk(s.unit, r.unit));
  const overlap = (r: Row) => { const rt = tokens(r.name + " " + (r.art ?? "") + " " + r.id); let sc = 0; for (const t of st) if (rt.has(t)) sc++; return sc; };
  let best: { r: Row; score: number } | null = null;
  for (const r of cands) { const sc = overlap(r); if (sc && (!best || sc > best.score)) best = { r, score: sc }; }
  const priceHit = s.price === null ? undefined : cands.find((r) => r.cost !== null && Math.abs(r.cost - s.price!) <= Math.max(0.6, s.price! * 0.002) && overlap(r) > 0);
  if (priceHit) return { s, status: "подключено", row: priceHit };
  if (best && best.score >= 2) return { s, status: "в коде другая цена", row: best.r };
  return { s, status: "не подключено", row: undefined as Row | undefined };
});
// ---------- проверка (--check) ----------
type Check = { ok: number; bad: string[]; missing: string[]; vern: number };
function checkSeen(): Check {
  const c: Check = { ok: 0, bad: [], missing: [], vern: 0 };
  for (const [id, s] of seen) {
    if (s.price === null) continue;
    if (/^vernissage:/.test(id)) { c.vern++; continue; } // цена м² по серии/колонке/надбавкам — функцией vernissageFacadePrice, ячейки прайса в книге
    const r = rowFor(id); if (!r) { c.missing.push(`${id} (${s.price}, ${s.source})`); continue; }
    const want = s.retail ? r.retail : r.cost;
    if (want !== null && Math.abs(want - s.price) < 0.005) c.ok++; else c.bad.push(`${id}: смета ${s.price}, книга ${want}`);
  }
  return c;
}
/** Итог проекта, пересчитанный по ценам книги (формула estimate: (материалы + фурнитура) × коэффициент к сотне + Вернисаж к сотне + розница). */
function recompute(p: Project) {
  const e = estimate(p), price = (l: PriceLine) => { const r = rowFor(l.id); if (!r) throw Error("нет строки книги для " + l.id); return l.retail ? r.retail : r.cost; };
  const hardware = Math.round(e.lines.filter((l) => !l.retail && lineGroup(l.id) === "hardware").reduce((s, l) => s + l.quantity * (price(l) ?? 0), 0));
  const materialOwn = Math.round(e.lines.filter((l) => !l.retail && lineGroup(l.id) === "material" && !isVernissageLine(l.id)).reduce((s, l) => s + l.quantity * (price(l) ?? 0), 0));
  const retailOf = (g: "material" | "hardware") => Math.round(e.lines.filter((l) => l.retail && !isKupeLine(l.id) && lineGroup(l.id) === g).reduce((s, l) => s + l.quantity * (price(l) ?? 0), 0));
  const kupe = Math.round(e.lines.filter((l) => l.retail && isKupeLine(l.id)).reduce((s, l) => s + l.quantity * (price(l) ?? 0), 0));
  const total = Math.round((materialOwn + hardware) * MARKUP_DEFAULT / 100) * 100 + retailOf("material") + retailOf("hardware") + kupe;
  return { total, estimate: e.retail, lines: e.lines.length };
}

// ---------- книга xlsx ----------
// стили книги прайсов (свой styles.xml; индексы — ниже)
const S = { text: 0, title: 1, header: 2, cell: 3, money: 4, coef: 5, group: 6, note: 7, editText: 8, editMoney: 9, stRed: 10, stOrange: 11, stYellow: 12, stGreen: 13, subtitle: 14, bold: 15, qty: 16, para: 17, paraBold: 18, stBlue: 19 } as const;
const st = (v: number) => v as XStyle;
const BORDER = `<left style="thin"><color rgb="FFC9D3D6"/></left><right style="thin"><color rgb="FFC9D3D6"/></right><top style="thin"><color rgb="FFC9D3D6"/></top><bottom style="thin"><color rgb="FFC9D3D6"/></bottom><diagonal/>`;
const fill = (rgb: string) => `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
const xf = (num: number, font: number, fillId: number, border: number, align = "") => `<xf numFmtId="${num}" fontId="${font}" fillId="${fillId}" borderId="${border}" xfId="0"${num ? ' applyNumberFormat="1"' : ""} applyFont="1" applyFill="1" applyBorder="1"${align ? ' applyAlignment="1">' + align + "</xf>" : "/>"}`;
const TOP_WRAP = '<alignment vertical="top" wrapText="1"/>', RIGHT = '<alignment horizontal="right" vertical="top"/>', CENTER = '<alignment horizontal="center" vertical="top" wrapText="1"/>';
const PRICE_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.00&quot; ₽&quot;"/><numFmt numFmtId="165" formatCode="0.0##"/><numFmt numFmtId="166" formatCode="#,##0.###"/></numFmts><fonts count="7"><font><sz val="10"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="10"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="14"/><color rgb="FF23404C"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/><family val="2"/></font><font><i/><sz val="9"/><color rgb="FF637C85"/><name val="Arial"/><family val="2"/></font><font><sz val="10"/><color rgb="FF637C85"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="10"/><color rgb="FF23404C"/><name val="Arial"/><family val="2"/></font></fonts><fills count="11"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fill("FF23595F")}${fill("FFE7EFF0")}${fill("FFFFF4C2")}${fill("FFF8D7D3")}${fill("FFFCE3C4")}${fill("FFFFF9DB")}${fill("FFE3F1E3")}${fill("FFE4EEF8")}${fill("FFF2F2F2")}</fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>${BORDER}</border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="20">${[
  xf(0, 0, 0, 0), xf(0, 2, 0, 0), xf(0, 3, 2, 1, '<alignment horizontal="center" vertical="center" wrapText="1"/>'), xf(0, 0, 0, 1, TOP_WRAP), xf(164, 0, 0, 1, RIGHT), xf(165, 0, 0, 1, CENTER),
  xf(0, 6, 3, 1, '<alignment vertical="center"/>'), xf(0, 4, 0, 0, TOP_WRAP), xf(0, 0, 4, 1, TOP_WRAP), xf(164, 0, 4, 1, RIGHT), xf(0, 0, 5, 1, CENTER), xf(0, 0, 6, 1, CENTER), xf(0, 0, 7, 1, CENTER), xf(0, 0, 8, 1, CENTER),
  xf(0, 5, 0, 0), xf(0, 1, 0, 1, TOP_WRAP), xf(166, 0, 0, 1, RIGHT), xf(0, 0, 0, 0, TOP_WRAP), xf(0, 1, 0, 0, TOP_WRAP), xf(0, 0, 9, 1, CENTER),
].join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
const statusStyle = (s: Status) => st(s === "нет цены" ? S.stRed : s === "после финального расчёта" ? S.stOrange : s === "оценка" ? S.stYellow : s === "ориентир" ? S.stBlue : S.stGreen);
const COLS = ["ID", "Раздел", "Позиция", "Артикул", "Ед.", "Закупка ₽", "Коэффициент", "Розница клиенту ₽", "Поставщик", "Статус", "Источник в коде", "Комментарий"];
const MAX_COLS = ["Исправленная закупка ₽", "Исправленная розница ₽", "Комментарий Макса"];
const WIDTHS = [30, 22, 44, 13, 7, 13, 10, 14, 17, 15, 24, 52];
/** Высота строки по самому длинному тексту (не все программы подбирают высоту сами). */
function heightOf(texts: (string | undefined)[], widths: number[]): number | undefined {
  let lines = 1;
  texts.forEach((t, i) => { if (!t) return; const w = Math.max(4, widths[i] - 1); lines = Math.max(lines, t.split("\n").reduce((s, p) => s + Math.max(1, Math.ceil(p.length / w)), 0)); });
  return lines > 1 ? Math.min(160, 12.8 * lines + 2) : undefined;
}
function priceSheet(name: string, subtitle: string, rows: Row[], extra = false): XSheet {
  const head = [...COLS, ...(extra ? ["Где встречается", "Что нужно"] : []), ...MAX_COLS], widths = [...WIDTHS, ...(extra ? [40, 40] : []), 14, 14, 30];
  const out: XCell[][] = [[str(name, st(S.title))], [str(subtitle, st(S.subtitle))], head.map((h) => str(h, st(S.header)))], heights: (number | undefined)[] = [undefined, undefined, 30];
  let group = "";
  for (const r of rows) {
    if (r.section !== group) { group = r.section; out.push(head.map((_, i) => i === 1 ? str(group, st(S.group)) : empty(st(S.group)))); heights.push(undefined); }
    const costCell = r.cost !== null ? num(r.cost, st(S.money)) : str(r.retailOnly ? "только розница" : r.constant ? "" : "—", st(S.cell));
    const coefCell = typeof r.coef === "number" ? num(r.coef, st(S.coef)) : str(r.coef ?? "—", st(S.coef));
    const retailCell = r.retail !== null ? num(r.retail, st(S.money)) : str(r.constant ? "" : "—", st(S.cell));
    const cells: XCell[] = [str(r.id), str(r.section), str(r.name), str(r.art ?? ""), str(r.unit), costCell, coefCell, retailCell, str(r.supplier), str(r.status, statusStyle(r.status)), str(r.src), str(r.note),
      ...(extra ? [str(r.where ?? ""), str(r.need ?? "")] : []), empty(st(S.editMoney)), empty(st(S.editMoney)), empty(st(S.editText))];
    out.push(cells); heights.push(heightOf([r.id, "", r.name, "", "", "", "", "", r.supplier, r.status, r.src, r.note, ...(extra ? [r.where, r.need] : [])], widths));
  }
  return { name, rows: out, cols: widths, freeze: 3, heights, autoFilter: `A3:${String.fromCharCode(64 + head.length)}${Math.max(4, out.length)}`, landscape: true };
}
function textSheet(name: string, rows: [string, string, string][], widths = [30, 90, 40]): XSheet {
  const out: XCell[][] = [[str(name, st(S.title))], [str(`ГардерЁб: как калькулятор считает цену — выгрузка из кода ${TODAY}`, st(S.subtitle))], ["Тема", "Как считает калькулятор (простыми словами)", "Решение Макса (РЕШЕНИЯ.md) / где в коде"].map((h) => str(h, st(S.header)))];
  const heights: (number | undefined)[] = [undefined, undefined, 30];
  for (const [a, b, c] of rows) {
    if (!b && !c) { out.push([str(a, st(S.group)), empty(st(S.group)), empty(st(S.group))]); heights.push(undefined); continue; }
    out.push([str(a, st(S.bold)), str(b), str(c)]); heights.push(heightOf([a, b, c], widths));
  }
  return { name, rows: out, cols: widths, freeze: 3, heights };
}
const rub = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ").replace(".", ",");
const k = (n: number) => String(n).replace(".", ",");

async function main() {
  // лист НЕТ ЦЕНЫ: сначала «нет цены» (ломают итог), потом «после финального расчёта»
  nopr.sort((a, b) => (a.status === b.status ? 0 : a.status === "нет цены" ? -1 : 1) || a.section.localeCompare(b.section, "ru") || a.id.localeCompare(b.id, "ru"));
  const noPriceRows = nopr.map((r) => ({ ...r, section: (r.status === "нет цены" ? "Нет цены — итог «—» · " : "После финального расчёта (в итог не входит) · ") + r.section }));
  const supSheetRows: Row[] = [...supStatus].sort((a, b) => (a.status === b.status ? 0 : a.status === "не подключено" ? -1 : b.status === "не подключено" ? 1 : a.status.localeCompare(b.status))).map(({ s, status, row }, i) => ({
    id: `supplier:${i + 1}`, section: (status === "не подключено" ? "Не подключено (кандидаты) · " : status === "подключено" ? "Подключено (для сверки) · " : "Есть в коде с другой ценой · ") + s.supplier.replace(/\s*—.*$/, ""),
    name: s.name, art: s.art, unit: s.unit, cost: s.price, coef: s.price === null ? null : MARKUP_DEFAULT, retail: s.price === null ? null : clientPrice("x", s.price), supplier: s.supplier.replace(/\s*—.*$/, ""),
    status: status === "подключено" ? "считается" : "нет цены", src: `Vault: Закупочные цены поставщиков.md:${s.line}`,
    note: (status === "подключено" ? "в калькуляторе: " + row!.id + " (" + row!.cost + " ₽)" : status === "в коде другая цена" ? "похожая строка калькулятора: " + row!.id + " — " + (row!.cost ?? row!.retail) + " ₽" + (row!.retail !== null && row!.cost === null ? " (розница)" : "") : "в калькуляторе не используется — кандидат для подключения") + (s.price === null ? " · цена в справочнике: " + s.raw : "") + (s.group ? " · " + s.group : ""),
  }));
  const counts: [string, number][] = [...book].map(([n, r]) => [n, r.length]);
  const pend = nopr.filter((r) => r.status === "после финального расчёта").length, none = nopr.length - pend;
  const how: [string, string, string][] = [
    ["Две модели цены", "", ""],
    ["По коэффициенту (по умолчанию)", `Себестоимость строк сметы (закупка) × коэффициент ${k(MARKUP_DEFAULT)}. Материалы и фурнитура считаются отдельно, итог (материалы + фурнитура) × ${k(MARKUP_DEFAULT)} округляется до 100 ₽. Розница в колонке «Розница клиенту» — закупка × ${k(MARKUP_DEFAULT)} для одной единицы (так строку видит клиент в публичной сборке).`, `06.10.2026 — материалы и фурнитура в цене отдельно; ${loc("pricing.ts", "export const MARKUP_DEFAULT")}`],
    ["«Цена за лист» (модель цеха)", `Листы ЛДСП раскроя × ${rub(SHEET_PRICE_DEFAULT)} ₽ за лист: в эту цену входят плита, кромка, фурнитура и работа цеха. Сверху листов: розничные позиции (подсветка, купе, ALU, склейка фальша), ручки и сетки Лемана по рознице Лемана без коэффициента, фасады Вернисаж (закупка × ${k(VERNISSAGE_MARKUP_DEFAULT)}). Покупные материалы (фасады стороннего материала, столешницы, стеновые панели) и стекло крыши в эту модель сейчас не входят (purchasedOnTop не вызывается).`, `Сентябрь 2026 — цена «23 000 ₽/лист»; ${loc("pricing.ts", "export const SHEET_PRICE_DEFAULT")}, bySheet ${loc("pricing.ts", "const bySheet=")}`],
    ["Что поверх коэффициента", "", ""],
    ["Розничные позиции", `Идут к цене клиента как есть, коэффициент ${k(MARKUP_DEFAULT)} на них не берётся: двери купе (калькулятор купе v2.10, своя графа разбивки), фасады в алюминиевой рамке (калькулятор фасадов ALU — цены клиента), подсветка ${rub(RULES.lightRetailPerM)} ₽/пог.м в стойках и ${rub(RULES.shelfLightRetailPerM)} ₽/пог.м в полках и крыше, склейка фальш-панели ${rub(FALSH_GLUE_RETAIL_M2)} ₽/м². В книге у них «Закупка» = «только розница», «Коэффициент» = «розница».`, "16.10.2026 (склейка, купе отдельной графой), 18.10.2026 (ALU — калькулятор как источник истины), 20.10.2026 (подсветка 4000/3000)"],
    ["Фасады Вернисаж", `Покупное изделие: в смете закупка по прайсу Вернисаж от ${priceDateRu()}, клиенту — закупка × ${k(VERNISSAGE_MARKUP_DEFAULT)} (свой коэффициент вместо ${k(MARKUP_DEFAULT)}), отдельно округляется до 100 ₽. Цена м² — по серии фрезеровки × колонке покрытия × толщине; ПВХ меньше ${k(VERNISSAGE_NOTES.minAreaM2Pvc)} м² — как ${k(VERNISSAGE_NOTES.minAreaM2Pvc)}; надбавки: рамка/решётка +${VERNISSAGE_NOTES.framesAndGrillesMarkupPct} %, эмаль с двух сторон +${VERNISSAGE_NOTES.enamelTwoSidedMarkupPct} %, лак +${VERNISSAGE_NOTES.enamelMatteLacquerPerM2} ₽/м², патина +${VERNISSAGE_NOTES.patinaPerM2} ₽/м², МДФ 25 мм +${VERNISSAGE_NOTES.mdf25MarkupPctVs16} % к 16 мм; присадка под петли ${VERNISSAGE_NOTES.hingeBoringPerPc} ₽/шт.`, "10.10.2026 — Вернисаж: клиенту закупка × 1,6"],
    ["Профили купе", `В прайсе калькулятора купе профили — закупка за пог. м; розница = закупка × ${KUPE_PROFILE_MULT}. Наполнения купе — розница за м²; наполнение ЛДСП — лист декора по прайсу Lamarty / ${k(Math.round(LDSP_SHEET_M2 * 100) / 100)} м² × ${k(MARKUP_DEFAULT)}.`, "23.10.2026 — прайс купе: калькулятор v2.10 (−20 % к прайсу 29.04); 16.10.2026 — ЛДСП купе по прайсу Lamarty"],
    ["Ручки и сетки Лемана", `База строки сметы — розница Лемана Про (01.09.2026). По коэффициенту: × ${k(MARKUP_DEFAULT)} как остальная фурнитура; в «цене за лист» — сверху листов по рознице Лемана как есть.`, `${loc("pricing.ts", "export const isLemanaLine")}`],
    ["Работа цеха", "", ""],
    ["Лист ЛДСП / ЛХДФ", `Работа цеха — себестоимость за лист раскроя: ЛДСП ${rub(SHOP_WORK_LDSP_SHEET)} ₽, ЛХДФ ${rub(SHOP_WORK_HDF_SHEET)} ₽ (у кухонь работа по ЛХДФ не считается — вопрос открыт). Сам лист ЛХДФ — ${rub(HDF_SHEET)} ₽. Всё × ${k(MARKUP_DEFAULT)}. Детали уже 70 мм — обработка 300 ₽/шт (норматив). Мелочёвка корпуса — ${HARDWARE_KIT.price} ₽ на корпус (шкафы студии).`, "20.10.2026 — работа 3 500 ₽ за лист ЛДСП, ЛХДФ 1 060 + работа 2 000, всё × 2,2"],
    ["Плиты Lamarty", `Цена листа 2750×1830 16 мм: явная цена декора (прайс Победы = Lamarty «Спец» 01.01.2026) или цена ценовой группы декора (КЛАССИКА / ПРЕМИУМ / ЛЮКС) по колонке тиснения. Другие толщины пока по цене 16 мм (оценка).`, "16.10.2026 — цены листов из прайса Lamarty, клиенту × 2,2"],
    ["Направляющие", "Комплект = 2 шт (левая + правая) на ящик, для всех систем. Шариковые GTV Versalite — счета ФАМ (300 и 400 мм — интерполяция); скрытые DTC push 300 — счёт ФАМ, остальные длины и Unihopper/Premial — оценки (помечены).", "10.10.2026 — направляющие комплектами"],
    ["Позиции «после финального расчёта»", "", ""],
    ["Что это", `Позиции без счёта поставщика (pendingPrices.ts): клиент видит «Цена будет после финального расчёта конструктором», в итог не входят — итог занижен на их сумму. Сейчас правил ${pendingRules.length}: опоры и клипсы кухни (ФАМ), ящики Axis PRO (ориентир ~7 000 ₽ за комплект), релинги Axis, навесы с заглушками (ориентир ~120 ₽), столешницы и обработка торца, Gola, вырезы под мойку и варку, мойка и бутылочница Premial, петля под фальшпанель, подъёмные механизмы и газлифты, пантограф, стеклянная полка, Versalite H45 вне 350–500.`, "16.10.2026 — позиции кухни без счёта — «после финального расчёта»; 18.10 и 22.10 — дополнены"],
    ["«Нет цены»", `Строка без цены и не из списка «после расчёта» — итог сметы «—» (не считается), пока цену не дадут. В этой книге: без цены ${none} позиций, после финального расчёта ${pend} (лист «НЕТ ЦЕНЫ»).`, "аудит «Не считается в смете 22.10»"],
    ["Как пользоваться книгой", "", ""],
    ["Исправления", "Впишите новую закупку или розницу в жёлтые колонки «Исправленная закупка ₽» / «Исправленная розница ₽» (и при желании комментарий). Колонку ID не меняйте — по ней скрипт studio/scripts/import-price-corrections.ts покажет, что и где в коде изменится (без применения). Коэффициенты и константы (лист «Работа и коэффициенты», правила Вернисажа) исправляются новым значением в «Исправленная закупка ₽».", "ID — стабильный ключ строки сметы или таблицы в коде"],
    ["Статусы", "считается — цена по счёту/прайсу; оценка — расчётная, подтвердить счётом; ориентир — старый калькулятор, норматив или ориентир Макса; после финального расчёта — в итог не входит; нет цены — ломает итог.", ""],
    ["Листы книги", counts.map(([n, c]) => `${n}: ${c}`).join("; ") + `; НЕТ ЦЕНЫ: ${noPriceRows.length}; Справочник поставщиков: ${supSheetRows.length}.`, `Выгрузка: scripts/export-prices.ts, ${TODAY}`],
    ["Прогон смет", `Для списка позиций без цены estimate() прогнан по ${Object.values(setsRun).reduce((a, b) => a + b, 0)} наборам: ${Object.entries(setsRun).map(([c, n]) => `${c} — ${n}`).join(", ")}.`, "имена клиентов в книгу не попадают: только тип проекта"],
  ];
  // строки листа — группами по разделу в порядке первого появления
  for (const [n, rows] of book) { const order = [...new Set(rows.map((r) => r.section))]; book.set(n, order.flatMap((s) => rows.filter((r) => r.section === s))); }
  const sheets: XSheet[] = [textSheet("Как считается", how)];
  const subtitle = (n: string) => `Выгрузка из кода ГардерЁб ${TODAY} (ветка claude/release-2410). Закупка — себестоимость строки сметы; розница — как калькулятор считает клиенту в модели «по коэффициенту». Жёлтые колонки — для исправлений. ${n}`;
  for (const [n, rows] of book) sheets.push(priceSheet(n, subtitle(""), rows));
  sheets.push(priceSheet("НЕТ ЦЕНЫ", subtitle("Всё без цены: где встречается (тип проекта) и что нужно."), noPriceRows, true));
  sheets.push(priceSheet("Поставщики — не подключено", `Справочник поставщиков — не подключено. Vault «Закупочные цены поставщиков» (только чтение): какие закупочные цены справочника калькулятор не использует — кандидаты для подключения. Розница — для ориентира: закупка × ${k(MARKUP_DEFAULT)}.`, supSheetRows));
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, await workbookZip(workbookFiles(sheets, "Прайсы ГардерЁб", PRICE_STYLES)));
  console.log("Книга:", OUT);
  for (const s of sheets) console.log(`  ${s.name}: строк данных ${s.rows.length - 3}${s.name === "Как считается" ? "" : `, позиций ${s.rows.filter((r, i) => i > 2 && r[0]?.t === "s" && (r[0] as { v: string }).v).length}`}`);
  console.log(`Без цены: ${none}, после финального расчёта: ${pend}; шаблонов add(…, null) в pricing.ts: ${templates.length}; правил pendingPrices: ${pendingRules.length}`);
  console.log(`Прогон: ${JSON.stringify(setsRun)}, ошибок сборки/сметы ${setErrors}; уникальных строк сметы ${seen.size}`);
  console.log(`Справочник: ${supRows.length} цен; подключено ${supStatus.filter((s) => s.status === "подключено").length}, другая цена ${supStatus.filter((s) => s.status === "в коде другая цена").length}, не подключено ${supStatus.filter((s) => s.status === "не подключено").length}`);
  if (notFound.length) console.log("loc не нашёл:", notFound.slice(0, 20));
  if (failed.length) console.log("Не собрались/не посчитались наборы:", failed.length, "\n  " + failed.slice(0, 25).join("\n  "));
  if (fromRun.length) console.log(`Строк сметы с ценой вне таблиц кода (добавлены из прогона): ${fromRun.length}\n  ` + fromRun.slice(0, 15).join("\n  "));
  const json = opt("--json");
  if (json) writeFileSync(json, JSON.stringify({ sheets: Object.fromEntries([...book].map(([n, r]) => [n, r.map(({ match, ...x }) => ({ ...x, match: match?.source }))])), noPrice: nopr, supplier: supSheetRows }, null, 1));
  if (flag("--check")) {
    const c = checkSeen();
    console.log(`\nСВЕРКА со сметой: строк сметы с ценой — совпало ${c.ok}, расхождений ${c.bad.length}, нет в книге ${c.missing.length}, Вернисаж (по ячейкам прайса) ${c.vern}`);
    for (const b of c.bad.slice(0, 30)) console.log("  ≠", b);
    for (const m of c.missing.slice(0, 30)) console.log("  ? нет в книге:", m);
    const a = newProject(); a.modules[0].module.sections[0].drawers = 2;
    const tests: [string, Project][] = [["шкаф студии с двумя ящиками (newProject)", a]];
    const kupeEx = join(STUDIO, "examples", "kupe-wardrobe.project.json");
    if (existsSync(kupeEx)) tests.push(["шкаф-купе (examples/kupe-wardrobe)", parseProject(JSON.parse(readFileSync(kupeEx, "utf8")))]);
    const testLines = new Map<string, PriceLine>();
    const add = (n: string, f: (m: Module) => void, kind: ModuleKind = "wardrobe", w = 1000, h = 2200, d = 600) => { try { const m = createModule(kind, w, h, d, initialModule()); f(m); const p = newProject(m); tests.push([n, p]); } catch (x) { console.log("тестовый проект не собран:", n, (x as Error).message); } };
    add("«Для одежды» + подсветка + ручка Лемана + тремпель", (m) => { m.standLight = true; m.handleId = "lm86728212"; m.sections[0].pullouts = 1; });
    add("«Для одежды» 2000: фасады ALU + петли Blum + стеклянная крыша", (m) => { m.alu = { ...DEFAULT_ALU }; m.hingeBrand = "blum"; m.topGlass = "satin"; }, "wardrobe", 1000, 2000);
    add("Комод: скрытые Unihopper с доводчиком 450", (m) => { const s = m.sections[0]; s.drawerConfigs = (s.drawerConfigs ?? []).map((c) => ({ ...c, slide: "gtv0fpo", operation: "soft-close", brand: "unihopper", length: 450 })); }, "drawers", 600, 850, 550);
    for (const [n, p] of tests) {
      try { for (const l of estimate(p).lines) if (!testLines.has(l.id)) testLines.set(l.id, l); const r = recompute(p); console.log(`ИТОГ по книге: ${n} — книга ${r.total}, estimate ${r.estimate} ${r.total === r.estimate ? "OK" : "FAIL"} (${r.lines} строк)`); }
      catch (x) { console.log(`ИТОГ по книге: ${n} — ошибка: ${(x as Error).message}`); }
    }
    // выборка позиций разных листов: строка книги против строки сметы (тестовые проекты, иначе прогон)
    const sample = ["sheet:Белый", "sheet:Дуб Вотан", "sheet:hdf", "edge2", "hinge", "hinge:blum", "slide:ball:400", "slide:gtv0fpo:450:hidden-unihopper-soft", "handle:uz819-128", "handle:lm86728212", "confirmat", "legs", "light-stand", "work", "work-hdf", "alu-seal", "glass-top:satin", "kupe-soft", "pullout", "rod25", "dowel", "kit"];
    console.log("\nВЫБОРКА (книга ↔ строка estimate):");
    for (const id of sample) {
      const t = testLines.get(id) ?? [...testLines.values()].find((l) => l.id.startsWith(id + ":")), s = seen.get(id), r = rowFor(t?.id ?? id);
      const est = t ? { price: t.unitPrice, retail: !!t.retail, source: t.source, id: t.id } : s ? { price: s.price, retail: s.retail, source: s.source, id } : null;
      const bv = est?.retail ? r?.retail : r?.cost, ok = est && bv !== undefined && bv !== null && Math.abs(bv - (est.price ?? NaN)) < 0.005;
      const where = [...book].find(([, rs]) => r && rs.includes(r))?.[0] ?? "";
      console.log(`  ${ok ? "OK " : "?? "}${est?.id ?? id}: книга ${est?.retail ? "розница" : "закупка"} ${bv ?? "—"} (розница клиенту ${r?.retail ?? "—"}) | estimate ${est ? est.price + " · " + est.source.slice(0, 70) : "нет строки"} | лист «${where}», ${r?.src ?? ""}`);
    }
  }
}
await main();
