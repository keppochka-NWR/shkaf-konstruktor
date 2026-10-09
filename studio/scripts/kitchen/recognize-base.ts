// Распознавание нижних модулей и пеналов Базиса: «как в Базисе, ничего сверх» — флаги кухни по составу фурнитуры проекта.
// Отдельный файл, чтобы не конфликтовать с соседями по fromEtalon.ts. Правила выведены статистикой по 34 кухням (207 нижних и пеналов):
//  - фасады без петель и без направляющих — 42 модуля: фасад есть, петель нет (фальш-фасад, «забыли», фасад ящика без ящика);
//  - без опор — 34 модуля: дно на полу или на своём цоколе;
//  - без крепежа — 10 модулей (k32): в проекте нет ни конфирматов, ни эксцентриков, ни шкантов, ни полкодержателей.
import type { Module } from "../../src/model";
import type { RefModule } from "./compare";

const FASTENERS = ["конфирмат", "эксцентрик", "шкант", "полкодержатель"];

/** Ставит kitchen.hinges / noLegs / fasteners по фурнитуре эталона. fronts — число фасадов перед корпусом (распознаны в fromEtalon). */
export function recognizeBaseExtras(ref: RefModule, m: Module, fronts: number): string[] {
  const notes: string[] = [], k = m.kitchen;
  if (!k) return notes;
  const has = (c: string) => ref.hardware.some((h) => h.category === c);
  // фасады есть, петель и ящиков нет — фасады без петель (не подъёмный: у него петли тоже есть)
  // ящик без направляющих (k20 m11: царги TANDEMBOX в «ящик-система») и подъёмный на газлифте (k11 m09–m11) — не распашной фасад;
  // ручка-рейлинг в «ящик-система» (k09 m04) — не ящик
  const drawerKit = ref.hardware.some((h) => h.category === "ящик-система" && !/ручк/i.test(h.name));
  if (fronts > 0 && !has("петля") && !has("направляющая") && !has("газлифт") && !drawerKit && !m.kdrawers?.length) {
    m.doors = true; k.hinges = false;
    notes.push("фасады без петель — как в Базисе");
  }
  if ((k.role === "base" || k.role === "tall") && !has("опора")) { k.noLegs = true; notes.push("без опор — как в Базисе"); }
  // крепёж и под другим разделом: «Евровинт 6х50» Базис кладёт в «прочее» (k33, k34) — это тоже конфирмат, крепёж есть
  if (!FASTENERS.some(has) && !ref.hardware.some((h) => /евровинт|конфирмат|эксцентрик|шкант|полкодерж/i.test(h.name))) { k.fasteners = false; notes.push("без крепежа — как в Базисе"); }
  const all = edgesAllAround(ref);
  if (all) { m.edgeScheme = { ...(m.edgeScheme ?? { t: all }), all: true }; notes.push("кромка по кругу у всех деталей корпуса — как в Базисе"); }
  else if (!m.edgeScheme && edgesNone(ref)) { m.edgeScheme = { t: 0 }; notes.push("без кромки — как в Базисе"); }
  else if (k.role === "base" && m.edgeScheme?.t && sideTopBare(ref)) { m.edgeScheme = { ...m.edgeScheme, sideTop: false }; notes.push("верх боковин без кромки — как в Базисе"); }
  const pf = pinInsetFront(ref, m.shelfPinInset);
  if (pf !== undefined) { m.shelfPinInsetFront = pf; notes.push(`передние полкодержатели в ${pf} от переднего торца полки (задние в ${m.shelfPinInset}) — как в Базисе`); }
  return notes;
}

/** Полкодержатели не симметричны по глубине полки (61 из 244 полок Базиса): отступ передних от переднего торца нижней полки с держателями,
 *  если он не равен заднему (back — shelfPinInset, распознанный по той же полке). */
export function pinInsetFront(ref: RefModule, back: number | undefined): number | undefined {
  if (back === undefined) return undefined;
  const pins = ref.hardware.filter((h) => h.category === "полкодержатель");
  const r1 = (v: number) => Math.round(v * 10) / 10;
  for (const s of ref.panels.filter((p) => p.axis === "y").sort((a, b) => a.box[1] - b.box[1])) {
    const ps = pins.filter((h) => Math.abs(h.pos[1] - s.box[1]) < 2);
    if (ps.length < 2 || Math.abs(r1(Math.min(...ps.map((h) => h.pos[2] - s.box[2]))) - back) > 0.05) continue;
    const front = r1(s.box[5] - Math.max(...ps.map((h) => h.pos[2])));
    return Math.abs(front - back) > 0.5 ? front : undefined;
  }
  return undefined;
}

/** Нижний: боковины кромлены, но верхний торец — нет (k03, k20 — 16 из 290 боковин нижних модулей). */
export function sideTopBare(ref: RefModule): boolean {
  type P = RefModule["panels"][number] & { edges?: { side: string; thick: number }[] };
  const sides = (ref.panels as P[]).filter((p) => (p.kind === "ldsp" || p.kind === "mdf") && p.axis === "x" && p.box[4] - p.box[1] > 200).sort((a, b) => a.box[0] - b.box[0]);
  if (sides.length < 2) return false;
  const ed = [sides[0], sides[sides.length - 1]].map((s) => new Set((s.edges ?? []).filter((e) => e.thick > 0).map((e) => e.side)));
  return ed.every((e) => e.size > 0 && !e.has("+y"));
}

/** Детали корпуса ЛДСП (без фасадов) с их кромкой. */
function bodyPanels(ref: RefModule) {
  const sides = ref.panels.filter((p) => p.kind === "ldsp" && p.axis === "x");
  const front = Math.max(0, ...sides.map((p) => p.box[5]));
  return ref.panels.filter((p) => p.kind === "ldsp" && !(p.axis === "z" && p.box[2] >= front - 1)) as (RefModule["panels"][number] & { edges?: { side: string; thick: number }[] })[];
}
/** Без кромки вовсе (k23 — 15 из 422 модулей): ни на одной детали корпуса нет кромки. */
export function edgesNone(ref: RefModule): boolean {
  const body = bodyPanels(ref);
  return body.length > 0 && body.every((p) => !(p.edges ?? []).some((e) => e.thick > 0));
}

/** Кромка по кругу (k11, k32 — 36 из 422 модулей): у каждой детали корпуса ЛДСП кромлены все четыре торца. Возвращает толщину кромки или 0. */
export function edgesAllAround(ref: RefModule): number {
  const body = bodyPanels(ref);
  if (!body.length || !body.every((p) => new Set((p.edges ?? []).filter((e) => e.thick > 0).map((e) => e.side)).size >= 4)) return 0;
  return body[0].edges!.find((e) => e.thick > 0)!.thick;
}
