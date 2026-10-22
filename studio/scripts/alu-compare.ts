// Сверка цен рамочных алюминиевых фасадов: студия (alu.ts → смета) против калькулятора фасадов ALU.
//   npx tsx scripts/alu-compare.ts                      — таблица по записанным эталонам (ALU_CASES + ALU_CHECK_CASES)
//   npx tsx scripts/alu-compare.ts <путь к calc-platform> — живая сверка: исполняет ОРИГИНАЛЬНЫЙ код калькулятора
//     (data/fillings.js, data/fasad-alu-data.js, js/fasad-alu.js → calcOneFasad) в песочнице node:vm и сверяет с ним
//     и цены фасадов, и данные src/aluData.ts (профили × наценка, наполнения по порядку, уплотнитель, версии).
// Эталоны в тестах (tests/alu-calc.test.ts) — записанные числа, тест не зависит от локальной копии калькулятора.
// ВАЖНО: совпадает цена ФАСАДА (профиль + наполнение + уплотнитель). Полная цена вместе с петлями у студии и калькулятора РАЗНАЯ:
//  - число петель: калькулятор — 2 до 1200 мм высоты, 3 выше; студия — правило цеха hingeCount (2 до 900, 3 до 1600, 4 до 2000,
//    5 выше, +1 при ширине больше 450), как у всех распашных фасадов шкафов (решение Макса: шкафы не трогать);
//  - цена петли: калькулятор — 220 × 2 = 440 ₽ за GTV стандарт; студия — строка фурнитуры GTV с доводчиком по своему прайсу
//    и общей наценке (решение: петли и фурнитура — отдельными строками сметы, не внутри цены фасада);
//  - подъёмник при открывании вверх: калькулятор — комплект 1000 × 2 = 2000 ₽ к фасаду; студия — строкой механизма.
// Поэтому «фасад + петли» в студии не равен итогу калькулятора (например, 446×1996: 12 134,50 + 4 петли студии против 13 455).
// Случай 4 («Мору (Флутис)») есть только в незакоммиченной правке групп наполнений калькулятора (см. ALU_CALC_SOURCE в aluData.ts).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createContext, runInContext } from "node:vm";
import { aluFacadePrice, ALU_FILLS } from "../src/alu";
import { ALU_CALC_FILLS, ALU_CALC_GASKET_PER_M, ALU_CALC_PROFILES, ALU_CALC_VERSION } from "../src/aluData";
import { hingeCount, HINGE_BRANDS } from "../src/hardware";
import { MARKUP_DEFAULT } from "../src/pricing";
type AluCase = { profile: string; w: number; h: number; fill: string; calc: number; calcNoHinge: number; calcHinges: number;
  hinge?: "gtv-std" | "hettich" | "gtv-air"; openDir?: "left" | "right" | "up"; note?: string };
export const ALU_CASES = [
  { profile: "F1-09", w: 396, h: 716, fill: "Стекло прозрачное 4мм", calc: 5859, calcNoHinge: 4978.99, calcHinges: 2 },
  { profile: "F1-17", w: 446, h: 1996, fill: "Стекло сатин матовый 4мм", calc: 13455, calcNoHinge: 12134.5, calcHinges: 3 },
  { profile: "F1-19", w: 596, h: 2396, fill: "Зеркало Серебро 4мм", calc: 27478, calcNoHinge: 26158.37, calcHinges: 3 },
  { profile: "F1-17", w: 296, h: 916, fill: "Мору (Флутис)", calc: 8097, calcNoHinge: 7217.14, calcHinges: 2 },
  { profile: "F1-19", w: 896, h: 356, fill: "Лакобель 9005 — чёрный", calc: 11431, calcNoHinge: 10550.97, calcHinges: 2 },
] as const satisfies readonly AluCase[];
/** Сверка 22.10.2026: 10 разных фасадов (граничные размеры, все три профиля, все группы наполнений, петли и подъёмник).
 *  Эталон посчитан оригинальным calcOneFasad калькулятора (ветка calc-ready-1018, 62dc254 + незакоммиченные группы наполнений):
 *  calcNoHinge = profileCost + glassCost + gasketCost; calc = Math.round(total) — с петлями (hinge, по умолчанию GTV стандарт)
 *  и подъёмником (openDir 'up'), как цена за штуку на экране калькулятора. */
export const ALU_CHECK_CASES = [
  { profile: "F1-17", w: 196, h: 296, fill: "Стекло прозрачное 4мм", calc: 2706, calcNoHinge: 1825.63, calcHinges: 2, note: "маленький" },
  { profile: "F1-09", w: 446, h: 2696, fill: "Зеркало Бронза 4мм", calc: 21472, calcNoHinge: 20152.04, calcHinges: 3, note: "высокий, выше 2000" },
  { profile: "F1-19", w: 1196, h: 396, fill: "Лакобель 9003 — белый (просветл. ст.)", openDir: "up", calc: 18230, calcNoHinge: 15350.29, calcHinges: 2, note: "широкий откидной, подъёмник" },
  { profile: "F1-19", w: 596, h: 1200, fill: "Стекло сатин графит", calc: 19080, calcNoHinge: 18200.5, calcHinges: 2, note: "граница петель 1200" },
  { profile: "F1-17", w: 596, h: 1201, fill: "Зеркало Crystalvision 6мм", hinge: "hettich", calc: 15645, calcNoHinge: 9644.69, calcHinges: 3, note: "граница 1201, петли Hettich" },
  { profile: "F1-09", w: 397.5, h: 716, fill: "Стекло тонированное Графит 4мм", openDir: "right", calc: 6439, calcNoHinge: 5558.8, calcHinges: 2, note: "дробная ширина, прежний id glass-graphite" },
  { profile: "F1-09", w: 296, h: 2000, fill: "Мору бронза / графит", calc: 19497, calcNoHinge: 18176.85, calcHinges: 3, note: "узкий высокий, прежний id moru-bronze" },
  { profile: "F1-17", w: 496, h: 1396, fill: "Узорчатое Бронза (Паве, Лабиринт и др)", hinge: "gtv-air", calc: 62561, calcNoHinge: 20560.74, calcHinges: 3, note: "узорчатое заказное, GTV Air Soft" },
  { profile: "F1-19", w: 596, h: 1796, fill: "Зеркало Серебро: Лабиринт", calc: 42645, calcNoHinge: 41325.3, calcHinges: 3, note: "самое дорогое наполнение" },
  { profile: "F1-09", w: 446, h: 896, fill: "Лакобель 1236 — светло-коричневый", calc: 10144, calcNoHinge: 9263.81, calcHinges: 2, note: "лакобель под дерево" },
] as const satisfies readonly AluCase[];

/** Студия: цена фасада по alu.ts и та же сумма так, как её даёт смета (pricing.ts округляет количество строк до 0,001). */
export function studioAlu(c: AluCase) {
  const f = ALU_FILLS.find((x) => x.label === c.fill);
  if (!f) return null;
  const s = aluFacadePrice({ profile: c.profile, color: "silver", insert: f.id }, c.w, c.h), r3 = (v: number) => Math.round(v * 1000) / 1000;
  const perM = s.profileCost / s.perimeter, estimate = r3(s.perimeter) * perM + r3(s.area) * f.perM2 + r3(s.perimeter) * ALU_CALC_GASKET_PER_M;
  return { ...s, estimate };
}

type CalcResult = { missing?: true; noHinge: number; total: number; hingeCount: number; hingeCost: number; liftCost: number };
type CalcData = { version: string; fillings: string; groups: string[]; markup: number; gasket: number;
  profiles: { id: string; name: string; pricePerM: number }[]; fills: { g: string; n: string; p: number; mat: string }[] };
/** Исполняет оригинальный код калькулятора (без DOM: initFasadModule + calcOneFasad) и возвращает его данные и расчёт случаев. */
export function runCalculator(root: string, cases: readonly AluCase[]): CalcData & { res: CalcResult[] } {
  const ctx = createContext({ document: { getElementById: () => null } });
  for (const f of ["data/fillings.js", "data/fasad-alu-data.js", "js/fasad-alu.js"])
    runInContext(readFileSync(join(root, f), "utf8").replace(/^﻿/, ""), ctx, { filename: f });
  ctx.__cases = cases;
  return JSON.parse(runInContext(`(function(){
    initFasadModule();
    var res = __cases.map(function(c){
      fasadProfileId = c.profile;
      var idx = fasadFills.map(function(f){ return f.n; }).indexOf(c.fill);
      if (idx < 0) return { missing: true };
      var r = calcOneFasad(c.w, c.h, idx, c.hinge || 'gtv-std', c.openDir || 'left');
      r.noHinge = r.profileCost + r.glassCost + r.gasketCost;
      return r;
    });
    return JSON.stringify({ version: FASAD_ALU_VERSION, fillings: FILLINGS_VERSION, groups: FASAD_FILL_GROUPS, markup: FASAD_PROF_MARKUP,
      gasket: FASAD_GASKET, profiles: FASAD_PROFILES, fills: fasadFills.map(function(f){ return { g: f.g, n: f.n, p: f.p, mat: f.mat }; }), res: res });
  })()`, ctx));
}

/** Расхождения данных студии (aluData.ts) с данными калькулятора; пусто — данные совпадают. */
export function aluDataDiff(d: CalcData): string[] {
  const out: string[] = [];
  if (d.version !== ALU_CALC_VERSION.fasad || d.fillings !== ALU_CALC_VERSION.fillings)
    out.push(`версии: калькулятор ${d.version}/${d.fillings}, студия ${ALU_CALC_VERSION.fasad}/${ALU_CALC_VERSION.fillings}`);
  if (d.gasket !== ALU_CALC_GASKET_PER_M) out.push(`уплотнитель: калькулятор ${d.gasket}, студия ${ALU_CALC_GASKET_PER_M}`);
  const ids = (a: { id: string }[]) => a.map((p) => p.id).join(",");
  if (ids(d.profiles) !== ids(ALU_CALC_PROFILES)) out.push(`профили: калькулятор ${ids(d.profiles)}, студия ${ids(ALU_CALC_PROFILES)}`);
  for (const p of d.profiles) {
    const s = ALU_CALC_PROFILES.find((x) => x.id === p.id), perM = Math.round(p.pricePerM * d.markup * 100) / 100;
    if (s && s.perM !== perM) out.push(`профиль ${p.id}: калькулятор ${p.pricePerM} × ${d.markup} = ${perM}, студия ${s.perM}`);
  }
  if (d.fills.length !== ALU_CALC_FILLS.length) out.push(`наполнений: калькулятор ${d.fills.length}, студия ${ALU_CALC_FILLS.length}`);
  d.fills.forEach((f, i) => {
    const s = ALU_CALC_FILLS[i];
    if (!s || s.n !== f.n || s.p !== f.p || s.g !== f.g || s.mat !== f.mat) out.push(`наполнение №${i}: калькулятор ${f.g}/${f.n}/${f.p}, студия ${s ? s.g + "/" + s.n + "/" + s.p : "—"}`);
  });
  return out;
}

if (process.argv[1]?.endsWith("alu-compare.ts")) {
  const root = process.argv[2], all: readonly AluCase[] = [...ALU_CASES, ...ALU_CHECK_CASES];
  const live = root ? runCalculator(root, all) : null, hinge = HINGE_BRANDS.gtv.soft.price * MARKUP_DEFAULT, rub = (v: number) => (Math.round(v * 100) / 100).toFixed(2);
  if (live) {
    console.log(`Калькулятор ${root}: фасады ALU ${live.version}, наполнения ${live.fillings}, группы: ${live.groups.join(", ")}`);
    const diff = aluDataDiff(live);
    console.log(diff.length ? "ДАННЫЕ РАСХОДЯТСЯ:\n  " + diff.join("\n  ") : "Данные aluData.ts совпадают с калькулятором (профили × наценка, наполнения по порядку, уплотнитель, версии).");
  }
  console.log("№ | профиль | размер | наполнение | калькулятор без петель | студия (alu.ts) | смета (кол-во до 0,001) | итог калькулятора с петлями | петли калькулятор / студия");
  let bad = 0;
  all.forEach((c, i) => {
    const s = studioAlu(c), lr = live?.res[i], calcNoHinge = lr ? (lr.missing ? NaN : lr.noHinge) : c.calcNoHinge;
    const calc = lr ? (lr.missing ? NaN : Math.round(lr.total)) : c.calc, ok = !!s && Math.abs(s.total - calcNoHinge) < 0.01;
    if (!ok) bad++;
    if (lr && !lr.missing && (Math.abs(lr.noHinge - c.calcNoHinge) >= 0.01 || Math.round(lr.total) !== c.calc)) { bad++; console.log(`  ! записанный эталон устарел: ${c.calcNoHinge} / ${c.calc}`); }
    const n = hingeCount(c.h, c.w);
    console.log(`${i + 1} | ${c.profile} | ${c.w}×${c.h} | ${c.fill}${c.openDir === "up" ? " · вверх" : ""}${c.hinge && c.hinge !== "gtv-std" ? " · " + c.hinge : ""} | ${rub(calcNoHinge)} | ${s ? rub(s.total) : "нет в студии"} | ${s ? rub(s.estimate) : "—"} | ${calc} | ${c.calcHinges} / ${n} × ${hinge.toFixed(1)} — ${ok ? "совпадает" : "РАСХОДИТСЯ"}`);
  });
  console.log(bad ? `Расхождений: ${bad}` : "Все цены фасадов (без петель) совпадают с калькулятором до копейки.");
  if (bad) process.exitCode = 1;
}
