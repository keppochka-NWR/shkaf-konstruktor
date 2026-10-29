// Алюминиевые рамочные фасады. Цена — по калькулятору фасадов ALU (calc-platform, js/fasad-alu.js calcOneFasad), данные —
// из того же калькулятора: src/aluData.ts генерируется scripts/import-alu.cjs (один источник, вручную цены не дублируются).
// Цена фасада клиенту (решение: источник истины — калькулятор, 18.10.2026):
//   профиль ₽/м × периметр + наполнение ₽/м² × площадь фасада + уплотнитель ₽/м × периметр.
// Петли (в калькуляторе 2 шт до 1200 мм высоты, 3 — выше) в студии — своими строками фурнитуры (бренд петель модуля).
// Геометрия профиля (видимая ширина рамки, припуск вставки) — из бланка цеха «Расчет алюм.фасад рам.xls».
import { ALU_CALC_PROFILES, ALU_CALC_FILLS, ALU_CALC_GASKET_PER_M, ALU_CALC_VERSION } from "./aluData";
export type AluProfile = { id: string; label: string; face: number; allowance: number; narrow: boolean; perM: number; colors: { id: string; label: string }[] };
const calcProfile = (id: string) => { const p = ALU_CALC_PROFILES.find((x) => x.id === id); if (!p) throw Error("Профиль " + id + " не найден в калькуляторе фасадов ALU"); return p; };
const profile = (id: string, desc: string, face: number, narrow: boolean, colors: { id: string; label: string }[]): AluProfile => {
  const c = calcProfile(id);
  return { id, label: `${c.name} · ${desc}`, face, allowance: 29, narrow, perM: c.perM, colors };
};
/** Профили калькулятора; цвета — исполнения профиля (на цену в калькуляторе не влияют). */
export const ALU_PROFILES: AluProfile[] = [
  profile("F1-09", "узкая рамка 19 мм", 19, true, [
    { id: "silver", label: "серебро" }, { id: "white", label: "белый" }, { id: "black", label: "чёрный матовый" },
    { id: "gold", label: "золото матовое" }, { id: "champagne", label: "шампань матовый" }]),
  profile("F1-17", "рамка 20×19", 19, true, [
    { id: "silver", label: "серебро" }, { id: "white", label: "белый RAL 9016" }, { id: "black", label: "чёрный" },
    { id: "gold", label: "золото" }, { id: "cognac", label: "коньяк" }, { id: "champagne", label: "шампань" }]),
  profile("F1-19", "широкая рамка 45 мм", 45, false, [
    { id: "silver", label: "серебро" }, { id: "black", label: "чёрный" }, { id: "gold", label: "золото" }, { id: "cognac", label: "коньяк" }]),
];
/** Наполнение рамки — из калькулятора фасадов ALU: perM2 — цена клиента за м² площади фасада. */
export type AluFill = { id: string; label: string; group: string; perM2: number; mat: string; mirror: boolean; thickness: number };
/** Прежние id вставок (сохранённые проекты, заказ Вотан) → наименование в калькуляторе. */
const LEGACY_FILL: Record<string, string> = {
  "mirror-silver": "Зеркало Серебро 4мм", "mirror-bronze": "Зеркало Бронза 4мм", "mirror-graphite": "Зеркало Графит 4мм",
  "glass-clear": "Стекло прозрачное 4мм", "glass-bronze": "Стекло тонированное Бронза 4мм", "glass-graphite": "Стекло тонированное Графит 4мм",
  "satin": "Стекло сатин матовый 4мм", "lacobel-white": "Лакобель 9010 — белый (обычн. ст.)", "lacobel-black": "Лакобель 9005 — чёрный",
  "moru-bronze": "Мору бронза / графит", "satin-bronze": "Стекло сатин бронзовый",
};
const legacyByName = new Map(Object.entries(LEGACY_FILL).map(([id, n]) => [n, id]));
export const ALU_FILLS: AluFill[] = ALU_CALC_FILLS.map((f) => ({
  id: legacyByName.get(f.n) ?? "fill:" + f.n, label: f.n, group: f.g, perM2: f.p, mat: f.mat,
  mirror: f.g === "Зеркала" || /^Зеркало/.test(f.n) || f.mat === "mat-mirror", thickness: Number(/(\d)\s*мм/.exec(f.n)?.[1] ?? 4),
}));
export const ALU_FILL_GROUPS = [...new Set(ALU_FILLS.map((f) => f.group))];
export const ALU_SOURCE = `Калькулятор фасадов ALU ${ALU_CALC_VERSION.fasad}, наполнения ${ALU_CALC_VERSION.fillings}`;
export const ALU_GASKET_PER_M = ALU_CALC_GASKET_PER_M;

/** Стекло крыши шкафа (не рамка): закупка АТБ 01.01.2026, в смете × коэффициент, плюс закалка и полировка. */
export type AluInsert = { id: string; label: string; perM2: number | null; source: string; mirror?: boolean; thickness: number };
const atb = "АТБ, прайс 01.01.2026 (закупка)";
export const ALU_INSERTS: AluInsert[] = [
  { id: "mirror-silver", label: "Зеркало серебро 4 мм", perM2: 1530, source: atb, mirror: true, thickness: 4 },
  { id: "mirror-bronze", label: "Зеркало бронза 4 мм", perM2: 2190, source: atb, mirror: true, thickness: 4 },
  { id: "mirror-graphite", label: "Зеркало графит 4 мм", perM2: 2190, source: atb, mirror: true, thickness: 4 },
  { id: "glass-clear", label: "Стекло прозрачное 4 мм", perM2: 970, source: atb, thickness: 4 },
  { id: "glass-bronze", label: "Стекло тонированное бронза 4 мм", perM2: 1820, source: atb, thickness: 4 },
  { id: "glass-graphite", label: "Стекло тонированное графит 4 мм", perM2: 1820, source: atb, thickness: 4 },
  { id: "satin", label: "Сатин матовый 4 мм", perM2: 1600, source: atb, thickness: 4 },
  { id: "lacobel-white", label: "Лакобель 9010 белый", perM2: 1930, source: atb, thickness: 4 },
  { id: "lacobel-black", label: "Лакобель 9005 чёрный", perM2: 2040, source: atb, thickness: 4 },
];
export const ALU_EXTRAS = {
  frameDepth: 20, // толщина рамочного фасада для сцены и габарита
  // высота — по листу стекла наполнения (aluMaxHeight, решение Макса 29.10.2026: «высоту почти по максимуму размера стекла»);
  // прежний предел СТП 2000 снят. Ширина — по СТП, как было.
  maxW: 600,
} as const;
/** Стекло рамочного фасада у поставщика: прайс «Прайс Стекло 2025.xlsx», лист «Прайс-лист» от 16.09.2025 (та же редакция, что
 *  наполнения калькулятора ALU 2025.09.16), колонка «Размеры листов»; лист «ТЕХНИЧКА ПО СТЕКЛУ»: п. 6 — «максимальная длина в закалку
 *  3000», п. 24 — притупление кромки для алюминиевых рамок только у закалённого стекла 4 мм. Припуск профиля 29 мм — вставка = фасад − 29
 *  (бланк цеха «Расчет алюм.фасад рам.xls»). Предел высоты фасада — длинная сторона листа (не больше 3000): вставка выходит на 29 мм
 *  короче листа — запас на обрезку кромки листа. */
export const ALU_GLASS = {
  source: 'Прайс Стекло 2025.xlsx (16.09.2025): размеры листов; «ТЕХНИЧКА ПО СТЕКЛУ» п. 6 — закалка до 3000 мм',
  allowance: 29,
  temperMax: 3000,
  /** Стекло (не зеркало): «Максимальный размер листа, который входит в станок 2750×1200» (прайс, «ДЛЯ СПРАВКИ») — вставка не длиннее 2750.
   *  В прайсе строка стоит в разделе пескоструя; применяем ко всему закалённому стеклу рамок в запас — УТОЧНИТЬ у Макса. Зеркало — до 3000. */
  machineMax: 2750,
  /** «ДЛЯ СПРАВКИ: ЗЕРКАЛО | СТЕКЛО 4–10 мм — 2550×1605» — для наполнений, у которых в прайсе размер листа не указан. */
  standardSheet: [2550, 1605] as [number, number],
};
/** Лист поставщика по наименованию наполнения калькулятора ALU (мм, длинная × короткая сторона) — колонка «Размеры листов» прайса;
 *  нет в таблице (узорчатые заказные: в прайсе размер не указан) — стандартный лист 2550×1605 с пометкой. */
const ALU_FILL_SHEET: [RegExp, [number, number]][] = [
  [/^Зеркало (Серебро|Бронза|Графит) [46]мм$/, [3210, 2250]],
  [/^Стекло тонированное (Бронза|Графит)/, [3210, 2250]],
  [/^Кризет/, [2100, 1600]],
  [/^Зеркало Серебро: Магнолия|^Стекло (Фуджи|Штукатурка|Богема)/, [2510, 1565]],
  [/^Стекло Феникс/, [3210, 1300]],
  [/^Дарк Грей/, [3200, 1070]],
  [/^Мору \(Флутис\)/, [3050, 2000]],
  [/^Мору бронза/, [2440, 1050]],
  [/^Зеркало серебро \(зел|^Зеркало Crystalvision|^Стекло прозрачное|^Стекло просветл|^Стекло сатин|^Данди|^Зеркало Бронза: Уади|^Лакобель/, [2550, 1605]],
];
/** Предел высоты рамочного фасада по наполнению: лист стекла поставщика (длинная сторона по высоте), не длиннее закалки 3000 мм. */
export function aluMaxHeight(a: AluFacade): { maxH: number; glassMax: number; sheet: [number, number]; fill: string; standard: boolean; cap: string } {
  const f = aluFill(a.insert), name = f?.label ?? a.insert, hit = ALU_FILL_SHEET.find(([re]) => re.test(name));
  const sheet = hit ? hit[1] : ALU_GLASS.standardSheet, mirror = !!f?.mirror;
  // зеркало: лист, не длиннее 3000 (закалка); стекло: ещё и вставка не длиннее станка 2750 (фасад = вставка + припуск)
  const lim = mirror ? ALU_GLASS.temperMax : ALU_GLASS.machineMax + ALU_GLASS.allowance, maxH = Math.min(sheet[0], lim);
  const cap = sheet[0] <= lim ? '' : mirror ? 'закалка до ' + ALU_GLASS.temperMax : 'вставка стекла не длиннее ' + ALU_GLASS.machineMax + ' (станок)';
  return { maxH, glassMax: maxH - ALU_GLASS.allowance, sheet, fill: name, standard: !hit, cap };
}
/** Высота, с которой стекло Мору заметно выгибает: «ТЕХНИЧКА ПО СТЕКЛУ» п. 26 — «4х2500х500 — изгиб мало заметен, 4х2000х1000 — заметная
 *  изогнутость»; там же: «Стекло MORU в закалку принимается только под ответственность заказчика». */
export const MORU_TALL_H = 2000;
/** Предупреждения по наполнению для фасадов заданной высоты (не ошибка — заказ возможен). */
export function aluFillWarnings(a: AluFacade, heights: number[]): string[] {
  const name = aluFill(a.insert)?.label ?? "";
  if (!/^Мору/.test(name) || !heights.some((h) => h > MORU_TALL_H)) return [];
  return [`${name}, фасады выше ${MORU_TALL_H} мм: стекло Мору в закалку поставщик принимает только под ответственность заказчика — риск выгиба (у поставщика 4×2000×1000 — «заметная изогнутость»). Согласовать с клиентом.`];
}
export type AluFacade = { profile: string; color: string; insert: string };
export const DEFAULT_ALU: AluFacade = { profile: "F1-09", color: "silver", insert: "mirror-silver" };
export function aluProfile(id: string) { return ALU_PROFILES.find((p) => p.id === id); }
export function aluColor(profile: string, color: string) { return aluProfile(profile)?.colors.find((c) => c.id === color); }
/** Наполнение рамки по id (калькулятор фасадов ALU). */
export function aluFill(id: string) { return ALU_FILLS.find((i) => i.id === id); }
/** Вид наполнения в 3D: прежние id оставлены (у них свои эффекты), остальное — по классу вида калькулятора (mat-*). */
export function aluFillLookId(f: AluFill): string {
  if (!f.id.startsWith("fill:")) return f.id;
  const m = f.mat;
  if (m === "mat-mirror") return "mirror-silver";
  if (m === "mat-bronze-mirror") return f.mirror ? "mirror-bronze" : "glass-bronze";
  if (m === "mat-graphite-mirror" || m === "mat-dark-glass") return f.mirror ? "mirror-graphite" : "glass-graphite";
  if (m === "mat-tinted") return "glass-bronze";
  if (m === "mat-satin") return "satin";
  if (m === "mat-lacobel-black") return "lacobel-black";
  if (m === "mat-lacobel-white" || m === "mat-ldsp-wood") return "lacobel-white";
  return "glass-clear";
}
/** Стекло крыши по id. */
export function aluInsert(id: string) { return ALU_INSERTS.find((i) => i.id === id); }
export function aluLabel(a: AluFacade) { const p = aluProfile(a.profile), c = aluColor(a.profile, a.color), i = aluFill(a.insert); return `${p?.label ?? a.profile} · ${c?.label ?? a.color} · ${i?.label ?? a.insert}`; }
/** Цена клиента одного фасада по калькулятору фасадов ALU (без петель): профиль + наполнение + уплотнитель. */
export function aluFacadePrice(a: AluFacade, w: number, h: number) {
  const p = aluProfile(a.profile), f = aluFill(a.insert), perimeter = 2 * (w + h) / 1000, area = w * h / 1e6;
  const profileCost = p ? perimeter * p.perM : NaN, fillCost = f ? area * f.perM2 : NaN, gasketCost = perimeter * ALU_GASKET_PER_M;
  return { perimeter, area, profileCost, fillCost, gasketCost, total: profileCost + fillCost + gasketCost };
}
/** Размер вставки по припуску профиля: фасад минус припуск по каждому габариту. */
export function aluInsertSize(a: AluFacade, w: number, h: number) { const al = aluProfile(a.profile)?.allowance ?? 0; return { w: w - al, h: h - al }; }
