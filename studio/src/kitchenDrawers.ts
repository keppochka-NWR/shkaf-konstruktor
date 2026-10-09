// Ящики кухни по проектам Базиса цеха (база проектов цеха, разбор 09.10.2026).
// Система Axis PRO (GTV): металлические царги H-86/120/168/200, дно и задняя стенка ЛДСП 16, направляющие скрытого монтажа
// на боковинах корпуса, держатели фасада и задней стенки, заглушки царг. Все смещения — от точки направляющей Базиса:
// внутренняя грань боковины (x), высота направляющей (y), передняя кромка корпуса (z). Сверено по 23 модулям с Axis PRO
// (k04–k30, 40 ящиков): смещения одинаковые у всех, разброс 0.
import type { Module, Part } from "./model";
import { qrot, type Quat } from "./quat";

export type KDrawerSystem = "axis-pro" | "firmax-ldsp" | "versalite-h45" | "start-sc" | "indigo" | "modern-slide";
/** Короб ящика Firmax скрытого монтажа (ЛДСП 16), по 37 ящикам Базиса (k03–k31): боковины в gap от боковин корпуса, длина len;
 *  дно между боковинами на bottomUp выше их низа (10, у мелких 5); задняя стенка и фальшпанель — между боковинами на дне, до верха боковин.
 *  Конфирматы ставятся в Базисе вручную (шаг разный), поэтому их высоты храним как в проекте: conf — от низа задней стенки
 *  (фальшпанель — те же), confBottom — от торцов дна. По умолчанию — самые частые в базе. */
export type FirmaxBox = { y: number; h: number; len: number; bottomUp?: number; gap?: number; front?: number; conf?: number[]; confBottom?: number; screws?: boolean; rearHoles?: boolean;
  /** Точки направляющих Базиса (у Firmax без сетки ставятся произвольно): [от внутренней грани левой боковины, от пола, от передней кромки]. По умолчанию — две в точке runnerY. */
  runs?: [number, number, number][];
  /** Шурупы 3,5×30 фальшпанели в фасад (часть проектов): [от внутренней грани левой боковины ящика, от низа фальшпанели]; true — по правилу
   *  большинства (два в 60 от боковин и 40 ниже верха, один посередине в 60 над низом). */
  faceScrews?: true | [number, number][];
  /** Versalite: конфирматы дна в заднюю стенку и фальшпанель снизу — от внутренней грани боковины ящика (по умолчанию 59). */
  confUnder?: number };
export type FirmaxDrawer = { system: "firmax-ldsp"; y0: number; y1: number; runnerY: number; box: FirmaxBox;
  /** Поля Axis PRO у Firmax не используются (остаются при смене системы, чтобы вернуть царгу/цвет). */
  h?: 86 | 120 | 168 | 200; len?: 300 | 400 | 450 | 500 | 550; color?: "white" | "anthracite"; backH?: number; faceScrews?: boolean };
/** Короб ЛДСП 16 на шариковых направляющих Versalite Light H45 (19 ящиков Базиса, k05–k31): боковины в 13 от боковин корпуса
 *  (направляющая 12,7), дно между боковинами у их низа, задняя стенка и фальшпанель на дне. Точка направляющей Базиса —
 *  внутренняя грань боковины корпуса × высота оси направляющей × передняя кромка короба; len — длина направляющей (сетка Базиса),
 *  короб бывает длиннее (555 на 550, 524 на 500). */
export type VersaliteDrawer = { system: "versalite-h45"; y0: number; y1: number; runnerY: number; len: VersaliteLen; box: FirmaxBox;
  h?: 86 | 120 | 168 | 200; color?: "white" | "anthracite"; backH?: number; faceScrews?: boolean };
/** Ящик Boyard СТАРТ (Soft-Closing, 16 ящиков Базиса k17/k21/k27): металлические боковины SB08 H84 / SB19 H118 / SB20 H167
 *  (у SB20 — рейлинг), дно и задняя стенка ЛДСП 16, направляющие СТАРТ на боковинах корпуса. Точка направляющей Базиса —
 *  внутренняя грань боковины корпуса × ось направляющей × передняя кромка ящика (front — утопание от передней кромки корпуса). */
export type StartDrawer = { system: "start-sc"; y0: number; y1: number; runnerY: number; len: 400 | 500; sb: "SB08" | "SB19" | "SB20";
  /** Рейлинг (у SB20 в базе всегда), держатель рейлинга над осью (по умолчанию 201,4), задняя стенка не по правилу, утопание. */
  rail?: boolean; railDy?: number; backH?: number; /** Высоты рейлингов над осью, если не один на 206,5 (Базис k27: два, 206,5 и 260,5). */ railYs?: number[]; front?: number; box?: undefined;
  /** Внутренний ящик за фасадом другого ящика (Базис k17: SB08 утоплен на 16) — без своего фасада. */
  inner?: boolean;
  /** Кромка как в проекте Базиса, если не по правилу (дно без кромки; задняя стенка по кругу, у SB08 — ±y):
   *  bottom — дно по кругу (k17), back — "y" только верх/низ, "all" по кругу. */
  edge?: { bottom?: boolean; back?: "y" | "all" };
  /** Поля Axis PRO не используются (остаются при смене системы). */
  h?: 86 | 120 | 168 | 200; color?: "white" | "anthracite"; faceScrews?: boolean };
/** Ящик Indigo (Базис k16: 7 ящиков): металлические царги H=90 / H=175 (орион серый или белые), направляющие Indigo 500,
 *  дно и задняя стенка ЛДСП 16. Точка Базиса — внутренняя грань боковины корпуса × ось направляющей × передняя кромка корпуса. */
export type IndigoDrawer = { system: "indigo"; y0: number; y1: number; runnerY: number; hc: 90 | 175; len: 500; h?: 86 | 120 | 168 | 200; color?: "white" | "anthracite";
  box?: undefined; backH?: number; faceScrews?: boolean };
/** Короб ЛДСП 16 на направляющих MODERN SLIDE (Базис k09: 4 ящика, без сетки направляющей — в студии процедурная деталь):
 *  боковины в 8,5 от корпуса, дно на 13 выше их низа, задняя стенка и фальшпанель на дне, конфирматы D5×35. */
export type ModernDrawer = { system: "modern-slide"; y0: number; y1: number; runnerY: number; box: FirmaxBox; h?: 86 | 120 | 168 | 200; len?: number; color?: "white" | "anthracite"; backH?: number; faceScrews?: boolean };
export const MODERN = { gap: 8.5, bottomUp: 13, confBottom: 37, confUnder: 83.5 };
export type BoxDrawer = FirmaxDrawer | VersaliteDrawer | ModernDrawer;
export type KDrawer = AxisDrawer | FirmaxDrawer | VersaliteDrawer | StartDrawer | IndigoDrawer | ModernDrawer;
export const isFirmax = (k: KDrawer): k is FirmaxDrawer => k.system === "firmax-ldsp";
export const isVersalite = (k: KDrawer): k is VersaliteDrawer => k.system === "versalite-h45";
/** Ящик с коробом ЛДСП (Firmax или Versalite). */
export const isBox = (k: KDrawer): k is BoxDrawer => k.system === "firmax-ldsp" || k.system === "versalite-h45" || k.system === "modern-slide";
export const isModern = (k: KDrawer): k is ModernDrawer => k.system === "modern-slide";
export const isStart = (k: KDrawer): k is StartDrawer => k.system === "start-sc";
export const isIndigo = (k: KDrawer): k is IndigoDrawer => k.system === "indigo";
export const isAxis = (k: KDrawer): k is AxisDrawer => k.system === "axis-pro" || (!isBox(k) && !isStart(k) && !isIndigo(k));
/** Indigo по Базису (k16, разброс 0): царга на 44 ниже оси, дно на 5 ниже оси (уже корпуса на 19, глубина 479,2 от 0,4),
 *  задняя стенка на 11,4 выше оси (уже на 42, 147,2 / 62,2), «3x3» в боковину корпуса, заднюю стенку и фасад. */
export const INDIGO = {
  run65: [19, 28, 37, 51, 60, 69, 243, 252, 261, 275, 284, 293], side3: [37, 69, 261, 293],
  175: { back: 147.2, back3: [23.2, 55.2, 119.2], front3: [22, 54, 118, 150], top: 160 },
  90: { back: 62.2, back3: [24, 56], front3: [22, 54], top: 73.2 },
  mesh: { runner: ["437755c651e6", "d49e8211a82d"] as LR, "175": ["c4b2a89adf2b", "5a8cbf34bbdc"] as LR, "175:white": ["5e4e4dbaf65f", "ac7784ef1cd3"] as LR, "90": ["b619d0529510", "13141e62e630"] as LR },
};
export function indigoTop(k: IndigoDrawer) { return k.runnerY + Math.max(INDIGO[k.hc].top, 11.4 + (k.backH ?? INDIGO[k.hc].back)); }
export function indigoFits(m: Module, k: IndigoDrawer) { return k.runnerY - 44 >= axisFloor(m) - 0.01 && indigoTop(k) <= Math.min(k.y1 - 15, axisCeiling(m) - AXIS_FIT.ceiling) + 0.01; }
/** Раскладка Indigo: ось на 44 над низом фасада, не ниже пола + 54 (царга на 10 над дном); царга H=175, если входит, иначе H=90. */
export function indigoLayout(m: Module, n: number, ratios?: number[], keep?: IndigoDrawer[]): IndigoDrawer[] {
  const floor = axisFloor(m), r1 = (v: number) => Math.round(v * 10) / 10;
  return axisLayout(m, n, ratios).map((a) => {
    const runnerY = r1(Math.max(a.y0 + 44, floor + 54)), at = (hc: 90 | 175): IndigoDrawer => ({ system: "indigo", y0: a.y0, y1: a.y1, runnerY, hc, len: 500, ...(keep?.[0]?.color === "white" ? { color: "white" as const } : {}) });
    const big = at(175); return indigoFits(m, big) ? big : at(90);
  });
}
/** СТАРТ по Базису: смещения от точки направляющей (side — низ боковины и дна, holder — держатель задней стенки, 3×3 держателя и
 *  крепления фасада, заглушка [x слева, x справа, y]); задняя стенка по умолчанию (SB20 — с рейлингом). Разброс 0 по 16 ящикам. */
export const START = {
  SB08: { side: -18, back: 84, holder: 14, holder3: [0, 32], front3: [0, 32], cap: [9, 7.5, 40.5], top: 68 },
  SB19: { side: -7, back: 118, holder: 27, holder3: [3, 35, 67], front3: [0, 32, 64], cap: [23.8, 22.3, 73], top: 111.5 },
  SB20: { side: -7, back: 220, holder: 27, holder3: [-2, 30, 62, 94], front3: [0, 32, 96, 128], cap: [23.8, 22.3, 40.5], top: 213.4 },
} as const;
export const START_LENGTHS = [400, 500] as const;
const START_SIDES: Record<string, Partial<Record<number, LR>>> = { SB08: { 500: ["72a20437a230", "a5bbfd825aec"] }, SB19: { 500: ["02d2bd8953aa", "0125df73e770"] }, SB20: { 400: ["c559468967dc", "438a84bba726"], 500: ["074cb8c40d56", "f3c0a93af446"] } };
export function startAvailable(sb: StartDrawer["sb"], len: number) { return !!START_SIDES[sb]?.[len]; }
/** Длина ящика (по направляющей / коробу). */
export const kdLen = (k: KDrawer) => (isBox(k) ? k.box.len : k.len);
export const VERSALITE_LENGTHS = [350, 400, 450, 500, 550] as const;
export type VersaliteLen = (typeof VERSALITE_LENGTHS)[number];
/** Правила Versalite Light H45 по 19 ящикам Базиса: зазор до корпуса 13 (18 из 19), дно у низа боковин (19/19),
 *  конфирматы дна от торцов 58 и снизу 59 от боковин (самые частые), короб от низа фасада +24 и до верха фасада −21 (медианы:
 *  посадка в Базисе ручная, разброс 9–53 и 17–76), ось направляющей — середина боковины (самое частое; в Базисе тоже вручную),
 *  длина — самая длинная, что входит с запасом 20 от задней кромки (7 из 9 модулей). */
export const VERSALITE = { t: 16, gap: 13, bottomUp: 0, confBottom: 58, confUnder: 59, below: 24, above: 21, spare: 20, runT: 12.7 };
export type AxisDrawer = {
  system: "axis-pro";
  /** Фасад ящика: низ и верх от пола модуля (зазоры между фасадами — как в проекте). */
  y0: number; y1: number;
  /** Высота направляющей от пола модуля (точка Базиса: низ дна ящика + 22). */
  runnerY: number;
  /** Высота царги и длина ящика (направляющей). */
  h: 86 | 120 | 168 | 200; len: 300 | 400 | 450 | 500 | 550;
  box?: undefined;
  color?: "white" | "anthracite";
  /** Высота задней стенки, если не по царге (с рейлингом выше). */
  backH?: number;
  /** Держатель фасада дополнительно на саморезах 3×3 (часть проектов Базиса: D3×3 в фасад в тех же точках). */
  faceScrews?: boolean;
};

export const AXIS_HEIGHTS = [86, 120, 168, 200] as const;
export const AXIS_LENGTHS = [300, 400, 450, 500, 550] as const;
/** Задняя стенка ЛДСП 16 по высоте царги (Базис). */
export const AXIS_BACK: Record<AxisDrawer["h"], number> = { 86: 84, 120: 116, 168: 167, 200: 199 };
/** Отверстия направляющей в боковине (от передней кромки): D5×2,1 под фиксаторы и D3×3 под саморезы. */
const RUNNER_D5: Record<AxisDrawer["len"], number[]> = { 300: [37, 69, 165, 197], 400: [37, 69, 229, 261], 450: [37, 69, 261, 293], 500: [37, 69, 261, 293], 550: [37, 69, 261, 293] };
const RUNNER_D3: Record<AxisDrawer["len"], number[]> = { 300: [37, 197], 400: [37, 261], 450: [37, 261], 500: [37, 261], 550: [37, 261] };
/** Саморезы держателя задней стенки (по высоте от его точки): D3×3 + накол D5×1. */
const REAR_SCREWS: Record<AxisDrawer["h"], number[]> = { 86: [0, 32], 120: [0, 32, 64], 168: [-13, 51, 115], 200: [19, 83, 147] };
/** Держатель фасада AB (H-86, H-120) — 2 самореза в фасад, CD (H-168, H-200) — 4; D3,5×4,5. */
const FRONT_SCREWS: Record<AxisDrawer["h"], number[]> = { 86: [0, 32], 120: [0, 32], 168: [0, 32, 96, 128], 200: [0, 32, 96, 128] };

type LR = [string, string];
/** Сетки Базиса (studio/public/models/hardware/bazis): [левая, правая]. */
const M = {
  runner: { white: { 300: ["e9538d57c536", "ea2d3c180472"], 400: ["de6a70b1ee6d", "7c48260e1bd9"], 450: ["32e9b7720957", "8417b2053789"], 500: ["d50b3f8e4044", "2dd6d671c3af"], 550: ["f824985e3ab9", "1cb05f841d4b"] },
    anthracite: { 450: ["e260dc885a13", "0ec6c64cb09f"], 500: ["01b741cf2532", "04284d10e0ba"] } } as Record<string, Partial<Record<number, LR>>>,
  side: {
    "white:86": { 450: ["38772e64a95a", "0f58af4db06e"], 500: ["74842f26698e", "aeb96fe26711"], 550: ["dcf6377dcec8", "d0fa4ea5b04d"] },
    "anthracite:86": { 500: ["7ad3cec5b42e", "572009977dc4"] },
    "white:120": { 300: ["9c6ead4bb54a", "6cb67aa5ee53"], 400: ["df6a26bca395", "ba984557da84"], 450: ["c7c8406f7df3", "e28410250b3e"], 500: ["b973f4d241ea", "79c2a3c5f72f"] },
    "anthracite:120": { 450: ["30d6e0c101b4", "eca71f8de6d0"], 500: ["d734350342f8", "2de5a247ad08"] },
    "white:168": { 450: ["20563c0250dc", "5f3fd5b63592"], 500: ["32f82cfcacd1", "dbdc7da730f2"] },
    "white:200": { 400: ["a0876e5aefe0", "0c01b05e15f7"], 450: ["a50a06a1b5e4", "926bc3aced9f"], 500: ["0ace9d8ac766", "eee4801f5927"], 550: ["54a746dddae0", "addca433ffa2"] },
    "anthracite:200": { 450: ["e0024dae9908", "99626bd9c6e9"], 500: ["d5bc178a3770", "0f1af9834999"] },
  } as Record<string, Partial<Record<number, LR>>>,
  rear: { "white:86": ["f33f4e6a8e34", "6e0efaa87267"], "anthracite:86": ["9ac2f0cbc8c6", "68b5e508fbc7"], "white:120": ["3353d728c985", "5f3cb9a5c4e6"], "anthracite:120": ["134731d10ac9", "e51d7baf2d8d"],
    "white:168": ["2cd91ccf14f7", "8bb977634a44"], "white:200": ["b568b4be44b0", "36895ea7ccb5"], "anthracite:200": ["e92a7d65f086", "9ef861805a9d"] } as Record<string, LR>,
  frontAB: ["62c7f38d07a5", "eb6669539ac7"] as LR, frontCD: ["d523f301821f", "db8cd4e72974"] as LR,
  cap: { white: "b01bfd1a40d6", anthracite: "e05d5e178312" } as Record<string, string>,
};
/** Versalite Light H45: сетки Базиса [левая, правая] по длине; присадка и шурупы 3,5×16 — по FurnList.Holes (одинаковы во всех
 *  проектах): в боковину корпуса D6×1 и D3×3 от передней кромки короба, в боковину ящика (на 12,7 от корпуса) D3×1,2, D5×1,2, D3×3. */
const VL: Record<VersaliteLen, { mesh: LR; corp6: number[]; corp3: number[]; box3: number[]; box12: number[]; box5: number[] }> = {
  350: { mesh: ["5af01c0bf792", "fcc769449796"], corp6: [37, 101, 197, 340.9], corp3: [37, 101], box3: [34, 130, 258], box12: [34, 130, 258, 312.8], box5: [] },
  400: { mesh: ["d47cd65130d3", "46e7f4dd40b1"], corp6: [37, 101, 197, 391], corp3: [37, 101], box3: [34, 162, 322], box12: [34, 162, 322, 362.8], box5: [295] },
  450: { mesh: ["5e4f21fc2c6b", "7ab0422cefda"], corp6: [37, 101, 197, 261, 440.9], corp3: [37, 261], box3: [34, 194, 354], box12: [34, 194, 354, 412.8], box5: [332.5] },
  500: { mesh: ["ed63f368aba0", "9f61c1d9d4d8"], corp6: [37, 101, 197, 261, 325, 490.9], corp3: [37, 261], box3: [34, 226, 418], box12: [34, 226, 418, 462.8], box5: [358.5] },
  550: { mesh: ["188b3778a7e0", "44ce2a52827c"], corp6: [37, 101, 197, 261, 325, 541], corp3: [37, 261], box3: [34, 226, 450], box12: [34, 226, 450, 512.8], box5: [383.5] },
};
/** СТАРТ: сетки Базиса [левая, правая] и присадка направляющей (D6×1,5 в боковину корпуса, от передней кромки ящика). */
const ST = {
  runner: { 400: ["de6b6792732b", "bf2604d3a957"], 500: ["02f8322e1c2d", "e1badd104edf"] } as Record<number, LR>,
  run6: { 400: [37, 69, 229, 261], 500: [37, 69, 261, 293] } as Record<number, number[]>,
  holder: { SB08: ["ab45b486eb89", "16cdcd572fbe"], SB19: ["eadc87c8cb76", "c18d20bcb55d"], SB20: ["1699a555f72b", "bcab6c2b155a"] } as Record<string, LR>,
  front: { SB08: "3a0d6f79183f", SB19: "dd3a808347cb", SB20: "a143ac3c3d4e" } as Record<string, string>,
  rail: { 400: ["bf79e6da64e4", "469404df69fa"], 500: ["c9ccdfa531b5", "081c9de43790"] } as Record<number, LR>,
  railHolder: ["9656ef5ba47d", "246b3879a4d7"] as LR, cap: "d9702aded033",
};
const S = Math.SQRT1_2;
const Q_RUN: [Quat, Quat] = [[S, 0, S, 0], [S, 0, -S, 0]]; // ось направляющей X → −Z (от фронта к стене), Z → внутрь корпуса
const Q_BOX: Quat = [0, 0, 1, 0];                           // царга и держатели: разворот на 180° вокруг Y
/** Габариты сеток Базиса в их осях [x0,y0,z0,x1,y1,z1] — из GLB (POSITION min/max), для проверки пересечений и посадки. */
const BBOX: Record<string, number[]> = {
  "01b741cf2532": [7.0, -44.0, 0.0, 497.0, 10.0, 37.5],
  "04284d10e0ba": [-497.0, -44.0, 0.0, -7.0, 10.0, 37.5],
  "0ace9d8ac766": [-38.5, -26.0, -0.0, 8.4, 174.5, 493.0],
  "0c01b05e15f7": [-8.4, -26.0, -0.0, 38.5, 174.5, 393.0],
  "0ec6c64cb09f": [-447.0, -44.0, 0.0, -7.0, 10.0, 37.5],
  "0f1af9834999": [-8.4, -26.0, -0.0, 38.5, 174.5, 493.0],
  "0f58af4db06e": [-8.4, -26.0, -0.0, 38.5, 59.5, 443.0],
  "134731d10ac9": [-6.5, -34.0, -16.0, 36.5, 84.0, 1.0],
  "1cb05f841d4b": [-547.0, -44.0, 0.0, -7.0, 10.0, 37.5],
  "20563c0250dc": [-38.5, -26.0, -0.0, 8.4, 142.5, 443.0],
  "2cd91ccf14f7": [-6.5, -34.0, -16.0, 36.5, 135.0, 1.0],
  "2dd6d671c3af": [-497.0, -44.0, 0.0, -7.0, 10.0, 37.5],
  "2de5a247ad08": [-8.4, -26.0, -0.0, 38.5, 91.5, 493.0],
  "30d6e0c101b4": [-38.5, -26.0, -0.0, 8.4, 91.5, 443.0],
  "32e9b7720957": [7.0, -44.0, 0.0, 447.0, 10.0, 37.5],
  "32f82cfcacd1": [-38.5, -26.0, -0.0, 8.4, 142.5, 493.0],
  "3353d728c985": [-6.5, -34.0, -16.0, 36.5, 84.0, 1.0],
  "36895ea7ccb5": [-36.5, -34.0, -16.0, 6.5, 167.0, 1.0],
  "38772e64a95a": [-38.5, -26.0, -0.0, 8.4, 59.5, 443.0],
  "54a746dddae0": [-38.5, -26.0, -0.0, 8.4, 174.5, 543.0],
  "572009977dc4": [-8.4, -26.0, -0.0, 38.5, 59.5, 493.0],
  "5f3cb9a5c4e6": [-36.5, -34.0, -16.0, 6.5, 84.0, 1.0],
  "5f3fd5b63592": [-8.4, -26.0, -0.0, 38.5, 142.5, 443.0],
  "62c7f38d07a5": [-3.0, -4.0, -0.0, 3.0, 36.0, 38.0],
  "68b5e508fbc7": [-36.5, -34.0, -16.0, 6.5, 52.0, 1.0],
  "6cb67aa5ee53": [-8.4, -26.0, -0.0, 38.5, 91.5, 293.0],
  "6e0efaa87267": [-36.5, -34.0, -16.0, 6.5, 52.0, 1.0],
  "74842f26698e": [-38.5, -26.0, -0.0, 8.4, 59.5, 493.0],
  "79c2a3c5f72f": [-8.4, -26.0, -0.0, 38.5, 91.5, 493.0],
  "7ad3cec5b42e": [-38.5, -26.0, -0.0, 8.4, 59.5, 493.0],
  "7c48260e1bd9": [-397.0, -44.0, 0.0, -7.0, 10.0, 37.5],
  "8417b2053789": [-447.0, -44.0, 0.0, -7.0, 10.0, 37.5],
  "8bb977634a44": [-36.5, -34.0, -16.0, 6.5, 135.0, 1.0],
  "926bc3aced9f": [-8.4, -26.0, -0.0, 38.5, 174.5, 443.0],
  "99626bd9c6e9": [-8.4, -26.0, -0.0, 38.5, 174.5, 443.0],
  "9ac2f0cbc8c6": [-6.5, -34.0, -16.0, 36.5, 52.0, 1.0],
  "9c6ead4bb54a": [-38.5, -26.0, -0.0, 8.4, 91.5, 293.0],
  "9ef861805a9d": [-36.5, -34.0, -16.0, 6.5, 167.0, 1.0],
  "a0876e5aefe0": [-38.5, -26.0, -0.0, 8.4, 174.5, 393.0],
  "a50a06a1b5e4": [-38.5, -26.0, -0.0, 8.4, 174.5, 443.0],
  "addca433ffa2": [-8.4, -26.0, -0.0, 38.5, 174.5, 543.0],
  "aeb96fe26711": [-8.4, -26.0, -0.0, 38.5, 59.5, 493.0],
  "b01bfd1a40d6": [-17.5, -21.5, 0.0, 17.5, 21.5, 1.5],
  "b568b4be44b0": [-6.5, -34.0, -16.0, 36.5, 167.0, 1.0],
  "b973f4d241ea": [-38.5, -26.0, -0.0, 8.4, 91.5, 493.0],
  "ba984557da84": [-8.4, -26.0, -0.0, 38.5, 91.5, 393.0],
  "c7c8406f7df3": [-38.5, -26.0, -0.0, 8.4, 91.5, 443.0],
  "d0fa4ea5b04d": [-8.4, -26.0, -0.0, 38.5, 59.5, 543.0],
  "d50b3f8e4044": [7.0, -44.0, 0.0, 497.0, 10.0, 37.5],
  "d523f301821f": [-3.0, -4.0, -0.0, 3.0, 132.0, 38.0],
  "d5bc178a3770": [-38.5, -26.0, -0.0, 8.4, 174.5, 493.0],
  "d734350342f8": [-38.5, -26.0, -0.0, 8.4, 91.5, 493.0],
  "db8cd4e72974": [-3.0, -4.0, -0.0, 3.0, 132.0, 38.0],
  "dbdc7da730f2": [-8.4, -26.0, -0.0, 38.5, 142.5, 493.0],
  "dcf6377dcec8": [-38.5, -26.0, -0.0, 8.4, 59.5, 543.0],
  "de6a70b1ee6d": [7.0, -44.0, 0.0, 397.0, 10.0, 37.5],
  "df6a26bca395": [-38.5, -26.0, -0.0, 8.4, 91.5, 393.0],
  "e0024dae9908": [-38.5, -26.0, -0.0, 8.4, 174.5, 443.0],
  "e05d5e178312": [-17.5, -21.5, 0.0, 17.5, 21.5, 1.5],
  "e260dc885a13": [7.0, -44.0, 0.0, 447.0, 10.0, 37.5],
  "e28410250b3e": [-8.4, -26.0, -0.0, 38.5, 91.5, 443.0],
  "e51d7baf2d8d": [-36.5, -34.0, -16.0, 6.5, 84.0, 1.0],
  "e92a7d65f086": [-6.5, -34.0, -16.0, 36.5, 167.0, 1.0],
  "e9538d57c536": [7.0, -44.0, 0.0, 297.0, 10.0, 37.5],
  "ea2d3c180472": [-297.0, -44.0, 0.0, -7.0, 10.0, 37.5],
  "eb6669539ac7": [-3.0, -4.0, -0.0, 3.0, 36.0, 38.0],
  "eca71f8de6d0": [-8.4, -26.0, -0.0, 38.5, 91.5, 443.0],
  "eee4801f5927": [-8.4, -26.0, -0.0, 38.5, 174.5, 493.0],
  "f33f4e6a8e34": [-6.5, -34.0, -16.0, 36.5, 52.0, 1.0],
  "f824985e3ab9": [7.0, -44.0, 0.0, 547.0, 10.0, 37.5],
  // Versalite Light H45 (левые — вдоль +x, правые — вдоль −x; высота 44, толщина 12,7)
  "5af01c0bf792": [0, -22, 0, 350.5, 22, 12.7], "fcc769449796": [-350.5, -22, 0, 0, 22, 12.7],
  "d47cd65130d3": [0, -22, 0, 400.5, 22, 12.7], "46e7f4dd40b1": [-400.5, -22, 0, 0, 22, 12.7],
  "5e4f21fc2c6b": [0, -22, 0, 450.5, 22, 12.7], "7ab0422cefda": [-450.5, -22, 0, 0, 22, 12.7],
  "ed63f368aba0": [0, -22, 0, 500.5, 22, 12.7], "9f61c1d9d4d8": [-500.5, -22, 0, 0, 22, 12.7],
  "188b3778a7e0": [0, -22, 0, 550.5, 22, 12.7], "44ce2a52827c": [-550.5, -22, 0, 0, 22, 12.7],
  // Indigo (k16)
  "437755c651e6": [7, -44, 0, 503, 8, 45], "d49e8211a82d": [-503, -44, 0, -7, 8, 45],
  "c4b2a89adf2b": [8.7, 27.2, -493, 46.5, 204, 0], "5a8cbf34bbdc": [-46.5, 27.2, -493, -8.7, 204, 0], "5e4e4dbaf65f": [8.7, 27.2, -493, 46.5, 204, 0], "ac7784ef1cd3": [-46.5, 27.2, -493, -8.7, 204, 0],
  "b619d0529510": [8.7, 27.2, -493, 46.5, 117.2, 0], "13141e62e630": [-46.5, 27.2, -493, -8.7, 117.2, 0],
  // Boyard СТАРТ
  "de6b6792732b": [9, -33, 0, 400, 27, 32], "bf2604d3a957": [-400, -33, 0, -9, 27, 32], "02f8322e1c2d": [9, -33, 0, 500, 27, 32], "e1badd104edf": [-500, -33, 0, -9, 27, 32],
  "72a20437a230": [-18, -1, 0, 31, 86, 492], "a5bbfd825aec": [-31, -1, 0, 18, 86, 492], "02d2bd8953aa": [-18, -1, 0, 28.5, 118.5, 492], "0125df73e770": [-28.5, -1, 0, 18, 118.5, 492],
  "c559468967dc": [-18, -1, 0, 28.5, 167.5, 392], "438a84bba726": [-28.5, -1, 0, 18, 167.5, 392], "074cb8c40d56": [-18, -1, 0, 28.5, 167.5, 492], "f3c0a93af446": [-28.5, -1, 0, 18, 167.5, 492],
  "ab45b486eb89": [-7, -16, -18, 35.5, 52, 0.75], "16cdcd572fbe": [-35.5, -16, -18, 7, 52, 0.75], "eadc87c8cb76": [-8, -18, -18, 35, 84, 0.75], "c18d20bcb55d": [-35, -18, -18, 8, 84, 0.75],
  "1699a555f72b": [-8, -18, -18, 35, 133, 0.75], "bcab6c2b155a": [-35, -18, -18, 8, 133, 0.75], "9656ef5ba47d": [-7.5, -11.6, -18, 38, 11.6, 3], "246b3879a4d7": [-38, -11.6, -18, 7.5, 11.6, 3],
  "d9702aded033": [-22, -15, 0, 22, 15, 1.5], "3a0d6f79183f": [-4.5, -4, 0, 4.5, 36, 41], "dd3a808347cb": [-4.5, -4, 0, 4.5, 68, 41], "a143ac3c3d4e": [-4.5, -4, 0, 4.5, 132, 41],
  "bf79e6da64e4": [-8.5, -17.1, 0, 7.5, 6.9, 386.5], "469404df69fa": [-7.5, -17.1, 0, 8.5, 6.9, 386.5], "c9ccdfa531b5": [-8.5, -17.1, 0, 7.5, 6.9, 486.5], "081c9de43790": [-7.5, -17.1, 0, 8.5, 6.9, 486.5],
};
/** Верх деталей ящика над направляющей (по сеткам): царга, держатель задней стенки, держатель фасада. */
const SIDE_TOP: Record<AxisDrawer["h"], number> = { 86: 3.5 + 59.5, 120: 3.5 + 91.5, 168: 3.5 + 142.5, 200: 3.5 + 174.5 };
const REAR_TOP: Record<AxisDrawer["h"], number> = { 86: 11 + 52, 120: 11 + 84, 168: 11 + 135, 200: 11 + 167 };
/** Направляющая — 44 мм ниже своей точки (сетка Axis PRO). */
export const AXIS_RUNNER_DOWN = 44;
/** Запасы раскладки (по базе: верх ящика не ближе 21,5 к верху фасада; до царг корпуса — 5). */
export const AXIS_FIT = { facadeTop: 21.5, ceiling: 5 };
/** Верх короба ящика от пола модуля: задняя стенка, царга, держатель — что выше. */
export function axisTop(k: KDrawer) { if (isBox(k)) return k.box.y + k.box.h; if (isStart(k)) return startTop(k); if (isIndigo(k)) return indigoTop(k); return k.runnerY + Math.max(-22 + (k.backH ?? AXIS_BACK[k.h]), SIDE_TOP[k.h], REAR_TOP[k.h]); }
/** Низ под царгами/крышей корпуса (нижний кухонный: царги 16 лёжа у верха; на ребре — их высота). */
export function axisCeiling(m: Module) {
  const top = (m.rails ?? []).filter((r) => r.place.endsWith("top") && r.at === undefined).map((r) => (r.lay === "flat" ? 16 : r.height));
  return m.height - Math.max(m.topType === "none" ? 0 : 16, ...top, 0);
}
/** Ящик входит: верх короба не ближе запасов к верху своего фасада и к царгам корпуса. */
export function axisFits(m: Module, k: KDrawer) { if (isBox(k)) return firmaxFits(m, k); if (isStart(k)) return startFits(m, k); if (isIndigo(k)) return indigoFits(m, k); return axisTop(k) <= Math.min(k.y1 - AXIS_FIT.facadeTop, axisCeiling(m) - AXIS_FIT.ceiling) + 1e-6; }
/** Габарит повёрнутой сетки в осях модуля: размер и центр. */
function aabb(origin: number[], q: Quat, b: number[]): { size: [number, number, number]; position: [number, number, number] } {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const x of [b[0], b[3]]) for (const y of [b[1], b[4]]) for (const z of [b[2], b[5]]) {
    const v = qrot(q, [x, y, z]);
    for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], origin[i] + v[i]); hi[i] = Math.max(hi[i], origin[i] + v[i]); }
  }
  return { size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], position: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2] };
}

/** Раскладка ящиков Axis PRO по правилам из базы (40 ящиков): фасады от низа корпуса до верха с отступом faceGap и зазором 3;
 *  направляющая — в 59 мм над низом фасада (нижнего — над дном); царга — самая высокая, чья задняя стенка не выше фасада минус 10;
 *  длина — самая длинная, что входит в корпус с запасом 25. ratios — доли высот фасадов снизу вверх (по умолчанию нижний крупнее). */
export function axisLayout(m: Module, n: number, ratios?: number[], keep?: Pick<AxisDrawer, "color" | "faceScrews">): AxisDrawer[] {
  const color = keep?.color;
  const g = m.faceGap ?? 1.5, gap = m.faceGapBetween ?? 3, feet = m.feet?.height ?? m.plinthHeight ?? 0;
  const innerBottom = axisFloor(m), y0 = feet + g, y1 = m.height - g, avail = y1 - y0 - (n - 1) * gap;
  const base = ratios?.length === n ? ratios : n === 1 ? [1] : n === 2 ? [0.5, 0.5] : n === 3 ? [0.44, 0.28, 0.28] : Array.from({ length: n }, (_, i) => (i === 0 ? 1.5 : 1));
  const sum = base.reduce((s, v) => s + v, 0);
  const hs = base.map((r) => Math.round((avail * r) / sum * 2) / 2);
  hs[n - 1] = Math.round((avail - hs.slice(0, -1).reduce((s, v) => s + v, 0)) * 10) / 10; // остаток — верхнему, сумма точно по корпусу
  let y = y0;
  return hs.map((fh) => {
    const runnerY = Math.round(Math.max(y + 59, innerBottom + 59) * 10) / 10, y1r = Math.round((y + fh) * 10) / 10;
    const at = (hh: AxisDrawer["h"], len: AxisDrawer["len"]): AxisDrawer => ({ system: "axis-pro", y0: Math.round(y * 10) / 10, y1: y1r, runnerY, h: hh, len, ...(color ? { color } : {}), ...(keep?.faceScrews ? { faceScrews: true } : {}) });
    // царга — самая высокая, что входит; длина — самая длинная из тех, на которые есть модели этой высоты (в цвете ящиков)
    const pick = (hh: AxisDrawer["h"]): AxisDrawer | undefined => { const len = axisBestLen(m, hh, color); return len ? at(hh, len) : undefined; };
    const cands = [...AXIS_HEIGHTS].reverse().map(pick).filter((c): c is AxisDrawer => !!c);
    // в цвете ящиков нет модели под эту глубину — цвет и саморезы НЕ меняются молча: ящик остаётся в своём цвете, проверка
    // покажет «нет модели», а кнопки, которые к этому ведут, отключены (critic qdrawers B2)
    const k = cands.find((c) => axisFits(m, c)) ?? cands[cands.length - 1] ?? at(120, [...AXIS_LENGTHS].reverse().find((l) => l <= axisMaxLen(m)) ?? 300);
    y += fh + gap;
    return k;
  });
}
/** Запас по глубине: ящик не длиннее глубины корпуса минус 25 (база Базиса). Одно правило для раскладки и пересчёта. */
export const AXIS_DEPTH_SPARE = 25;
export function axisMaxLen(m: Module) { return m.depth - AXIS_DEPTH_SPARE; }
/** Самая длинная длина Axis PRO с моделью Базиса на эту царгу и цвет, что входит в глубину корпуса. */
export function axisBestLen(m: Module, h: AxisDrawer["h"], color?: AxisDrawer["color"]): AxisDrawer["len"] | undefined {
  return [...AXIS_LENGTHS].reverse().find((l) => l <= axisMaxLen(m) && axisAvailable({ h, len: l, color }));
}
/** Ящик с другой царгой: длина подбирается заново под глубину корпуса (у H-200 нет 300, у H-86 и H-168 — короче 450). */
export function withAxisH(m: Module, k: AxisDrawer, h: AxisDrawer["h"]): AxisDrawer {
  const { backH: _b, ...rest } = k, len = axisBestLen(m, h, k.color);
  return { ...rest, h, ...(len ? { len } : {}) };
}
/** Наименьший фасад верхнего ящика, в который входит самая низкая царга с моделью под эту глубину и цвет:
 *  направляющая 59 над низом фасада + верх короба + запас 21,5 до верха фасада (H-86 → 143,5). */
export function kdrawerMinTop(m: Module) {
  const k0 = m.kdrawers?.[0], color = k0 && isAxis(k0) ? k0.color : undefined;
  const t = AXIS_HEIGHTS.filter((h) => !!axisBestLen(m, h, color)).map((h) => 59 + axisTop({ system: "axis-pro", y0: 0, y1: 0, runnerY: 0, h, len: 500 }) + AXIS_FIT.facadeTop);
  return t.length ? Math.ceil(Math.min(...t) * 2) / 2 : 100;
}
/** Наибольший фасад ящика i (не верхнего): верхнему остаётся kdrawerMinTop, иначе доли перенормируются, введённое
 *  не выполняется и верхний ящик не входит (critic qdrawers minor: фасад 2 = 500 давал 417 и верхний 83,5). */
export function kdrawerFacadeMax(m: Module, i: number) {
  const ks = m.kdrawers ?? [], top = ks[ks.length - 1], k = ks[i];
  return !k || !top ? 100 : Math.max(100, Math.floor(Math.min(700, k.y1 - k.y0 + top.y1 - top.y0 - kdrawerMinTop(m))));
}
/** Фасад ящика i = v (не больше kdrawerFacadeMax), остаток — верхнему; раскладка заново с цветом и саморезами. */
export function setKDrawerFacade(m: Module, i: number, v: number): KDrawer[] | undefined {
  const ks = m.kdrawers; if (!ks?.length || i >= ks.length - 1) return ks;
  const r = ks.map((k) => k.y1 - k.y0), x = Math.max(100, Math.min(v, kdrawerFacadeMax(m, i)));
  r[r.length - 1] += r[i] - x; r[i] = x;
  return relayoutKDrawers(m, r.length, r);
}
/** Почему раскладка на n ящиков недоступна (для подсказки кнопки), или undefined. */
export function relayoutProblem(m: Module, n: number): string | undefined {
  const ks = relayoutKDrawers(m, n);
  const fitsK = (mm: Module, k: KDrawer) => axisFits(mm, k);
  if (!ks.every((k) => fitsK(m, k))) {
    // по высоте не входит из-за глубины: у низких царг (H-86, H-168) нет длин короче 450 — назвать глубину, с которой войдёт
    const d = [325, 425, 475, 525, 575].find((dd) => dd > m.depth && relayoutKDrawers({ ...m, depth: dd }, n).every((k) => fitsK(m, k) && (!isAxis(k) || axisAvailable(k))));
    const sn = ({ "versalite-h45": "Versalite", "firmax-ldsp": "Firmax", "start-sc": "СТАРТ", indigo: "Indigo", "modern-slide": "MODERN SLIDE", "axis-pro": "Axis PRO" } as Record<string, string>)[ks[0]?.system ?? "axis-pro"] ?? "Axis PRO";
    return d && sn === "Axis PRO" ? `На глубину ${m.depth} столько ящиков Axis PRO не входит (низких царг такой длины нет) — нужна глубина от ${d}` : `Столько ящиков ${sn} по высоте корпуса не входит`;
  }
  const miss = ks.filter(isAxis).find((k) => !axisAvailable(k));
  if (miss) return `Нет модели Axis PRO на H-${miss.h}, ${miss.len} мм${miss.color === "anthracite" ? ", антрацит" : ""} под эту глубину — смените цвет или глубину`;
  if (ks.some((k) => isAxis(k) && k.len > axisMaxLen(m))) return "Ящик не входит в глубину корпуса";
  return undefined;
}
/** Пересчитать ящики после изменения корпуса. Глубина — только длина ящика (по высоте ничего не двигается); высота, опоры,
 *  нижние царги — раскладка заново с теми же долями фасадов. Цвет и саморезы держателей сохраняются; у Firmax — саморезы 3×3,
 *  шурупы фасада, 5×12, зазор, отступ от фронта, конфирматы дна (см. firmaxLayout). */
export function refitKDrawers(m: Module, what: "height" | "depth" = "height"): KDrawer[] | undefined {
  const ks = m.kdrawers; if (!ks?.length) return ks;
  if (isStart(ks[0])) return startLayout(m, ks.length, ks.map((k) => k.y1 - k.y0), ks.filter(isStart));
  if (isIndigo(ks[0])) return what === "depth" ? ks : indigoLayout(m, ks.length, ks.map((k) => k.y1 - k.y0), ks.filter(isIndigo));
  if (isModern(ks[0])) return what === "depth" ? ks.map((k) => (isModern(k) ? { ...k, box: { ...k.box, len: Math.min(k.box.len, m.depth) } } : k)) : modernLayout(m, ks.length, ks.map((k) => k.y1 - k.y0), ks.filter(isModern));
  if (isVersalite(ks[0])) {
    if (what === "depth") { const len = versaliteLen(m); return ks.map((k) => (isVersalite(k) ? { ...k, len, box: { ...k.box, len } } : k)); }
    return versaliteLayout(m, ks.length, ks.map((k) => k.y1 - k.y0), ks.filter(isVersalite));
  }
  if (isFirmax(ks[0])) {
    if (what === "depth") return ks.map((k) => (isFirmax(k) ? { ...k, box: { ...k.box, len: firmaxLen(m) } } : k));
    return firmaxLayout(m, ks.length, ks.map((k) => k.y1 - k.y0), ks.filter(isFirmax));
  }
  const k0 = ks[0], again = () => axisLayout(m, ks.length, ks.map((k) => k.y1 - k.y0), isAxis(k0) ? k0 : undefined);
  if (what === "depth") {
    // та же царга — только длина; если на эту царгу нет длины под новую глубину — раскладка заново (critic qdrawers B1)
    const lens = ks.map((k) => (isAxis(k) ? axisBestLen(m, k.h, k.color) : undefined));
    if (ks.some((k, i) => isAxis(k) && !lens[i])) return again();
    return ks.map((k, i) => (isAxis(k) ? { ...k, len: lens[i]! } : k));
  }
  return again();
}
/** Новое число ящиков или доли фасадов — с цветом и саморезами текущих ящиков; система — как у текущих. */
export function relayoutKDrawers(m: Module, n: number, ratios?: number[], system?: KDrawerSystem): KDrawer[] {
  const k0 = m.kdrawers?.[0], sys = system ?? k0?.system ?? "axis-pro";
  if (sys === "versalite-h45") return versaliteLayout(m, n, ratios, m.kdrawers?.filter(isVersalite));
  if (sys === "start-sc") return startLayout(m, n, ratios, m.kdrawers?.filter(isStart));
  if (sys === "indigo") return indigoLayout(m, n, ratios, m.kdrawers?.filter(isIndigo));
  if (sys === "modern-slide") return modernLayout(m, n, ratios, m.kdrawers?.filter(isModern));
  return sys === "firmax-ldsp" ? firmaxLayout(m, n, ratios, m.kdrawers?.filter(isFirmax)) : axisLayout(m, n, ratios, k0 && isAxis(k0) ? k0 : undefined);
}
/** Раскладка MODERN SLIDE (Базис k09): короб от низа фасада +35 до верха фасада −35 (не ниже пола + 10, не ближе 5 к царгам),
 *  короб 490 под направляющую 500 (в базе только она), если входит в глубину, иначе на 28 короче глубины. */
export function modernLayout(m: Module, n: number, ratios?: number[], keep?: ModernDrawer[]): ModernDrawer[] {
  const floor = axisFloor(m), ceil = axisCeiling(m) - AXIS_FIT.ceiling, r1 = (v: number) => Math.round(v * 10) / 10, len = Math.min(490, r1(m.depth - 28));
  return axisLayout(m, n, ratios).map((a, i) => {
    const y = r1(Math.max(a.y0 + 35, floor + 10)), top = r1(Math.min(a.y1 - 35, ceil)), box: FirmaxBox = { y, h: r1(top - y), len };
    const o = (keep?.[i] ?? keep?.[0])?.box;
    if (o) for (const key of ["gap", "front", "confBottom", "confUnder"] as const) if (o[key] !== undefined) box[key] = o[key];
    if (o?.faceScrews) box.faceScrews = true;
    return { system: "modern-slide" as const, y0: a.y0, y1: a.y1, runnerY: y, box };
  });
}
/** Верх ящика СТАРТ от пола модуля: боковина, задняя стенка, рейлинг — что выше. */
export function startTop(k: StartDrawer) { const s = START[k.sb]; return k.runnerY + Math.max(s.top, s.side + (k.backH ?? s.back), ...(k.rail ? (k.railYs ?? [206.5]).map((dy) => dy + 6.9) : [])); }
/** Ящик СТАРТ входит: верх не ближе 20 к верху фасада и 5 к царгам, низ боковины не ниже пола. */
export function startFits(m: Module, k: StartDrawer) { return k.runnerY + START[k.sb].side >= axisFloor(m) - 0.01 && startTop(k) <= Math.min(k.y1 - 20, axisCeiling(m) - AXIS_FIT.ceiling) + 0.01; }
/** Раскладка СТАРТ по базе: фасады — как у Axis PRO; ось направляющей на 64 над низом фасада (медиана 16 ящиков), но не ниже
 *  пола + 54 (низ боковины SB20 на 7 ниже оси); боковина — самая высокая, что входит (SB20 с рейлингом → SB19 → SB08);
 *  длина 500, если входит с запасом 20 от задней кромки, иначе 400 (SB08/SB19 в базе только 500). keep — утопание и рейлинг. */
export function startLayout(m: Module, n: number, ratios?: number[], keep?: StartDrawer[]): StartDrawer[] {
  const floor = axisFloor(m), r1 = (v: number) => Math.round(v * 10) / 10, len: 400 | 500 = m.depth - 20 >= 500 ? 500 : 400;
  return axisLayout(m, n, ratios).map((a, i) => {
    const runnerY = r1(Math.max(a.y0 + 64, floor + 54)), own = keep?.[i];
    const at = (sb: StartDrawer["sb"]): StartDrawer => ({ system: "start-sc", y0: a.y0, y1: a.y1, runnerY, len, sb, ...(sb === "SB20" ? { rail: true } : {}), ...(own?.edge ? { edge: { ...own.edge } } : {}) });
    const cands = (["SB20", "SB19", "SB08"] as const).filter((sb) => startAvailable(sb, len)).map(at);
    return cands.find((c) => startFits(m, c)) ?? cands[cands.length - 1] ?? at("SB20");
  });
}
/** Versalite: самая длинная направляющая, что входит с запасом 20 от задней кромки; мельче 370 — самая короткая 350. */
export function versaliteLen(m: Module): VersaliteLen { return [...VERSALITE_LENGTHS].reverse().find((l) => l <= m.depth - VERSALITE.spare) ?? VERSALITE_LENGTHS[0]; }
/** Раскладка Versalite: фасады — как у Axis PRO; короб от низа фасада +24 (не ниже пола + 10) до верха фасада −21 (не ближе 5
 *  к царгам корпуса), короб по длине направляющей, ось направляющей — середина боковины. keep — текущие ящики Versalite: зазор,
 *  отступ от фронта, конфирматы дна (от торцов и снизу) переносятся; высоты конфирматов задней стенки — у той же высоты короба. */
export function versaliteLayout(m: Module, n: number, ratios?: number[], keep?: VersaliteDrawer[]): VersaliteDrawer[] {
  const floor = axisFloor(m), ceil = axisCeiling(m) - AXIS_FIT.ceiling, len = versaliteLen(m), r1 = (v: number) => Math.round(v * 10) / 10;
  return axisLayout(m, n, ratios).map((a, i) => {
    const y = r1(Math.max(a.y0 + VERSALITE.below, floor + 10)), top = r1(Math.min(a.y1 - VERSALITE.above, ceil)), h = r1(top - y);
    const box: FirmaxBox = { y, h, len };
    const own = keep?.[i], k = own ?? keep?.[0];
    if (k) {
      const o = k.box;
      for (const key of ["gap", "front", "confBottom", "confUnder"] as const) if (o[key] !== undefined) box[key] = o[key];
      if (own?.box.conf?.length && Math.abs(own.box.h - h) < 0.05) box.conf = [...own.box.conf];
    }
    return { system: "versalite-h45" as const, y0: a.y0, y1: a.y1, runnerY: r1(y + h / 2), len, box };
  });
}

/** Firmax: длины коробов в проектах Базиса цеха (390, 440, 490, 540); берём самую длинную, что входит с запасом 40 от задней кромки.
 *  Мельче 430 запаса 40 нет ни у одной длины — тогда самая короткая 390 без запаса (например, D=407 — 17 мм до задней кромки):
 *  короче коробов в базе нет. Такой ящик допустим, пока он входит в корпус — это ловят kitchenDrawerErrors (короб длиннее
 *  глубины) и пересечения с задней стенкой корпуса. */
export const FIRMAX_LENGTHS = [390, 440, 490, 540] as const;
export const FIRMAX = { t: 16, gap: 5, bottomUp: 10, confBottom: 69, sideDown: 30, topUnder: 30, rail: { w: 12 } };
export function firmaxLen(m: Module) { return [...FIRMAX_LENGTHS].reverse().find((l) => l <= m.depth - 40) ?? FIRMAX_LENGTHS[0]; }
/** Конфирматы задней стенки по высоте (от её низа): до 90 — один посередине, выше — два, в 32–40 от краёв (частые в базе). */
export function firmaxConf(backH: number): number[] {
  if (backH < 90) return [Math.round(backH / 2 * 10) / 10];
  const e = Math.min(40, Math.max(30, backH / 4));
  return [Math.round(e * 10) / 10, Math.round((backH - e) * 10) / 10];
}
/** Раскладка Firmax: фасады — как у Axis PRO; короб — от фасада вниз на 30 (не ниже пола + 10), верх на 30 ниже верха фасада
 *  и не ближе 5 к царгам корпуса. Точка направляющей — низ фасада (не ниже пола), как у большинства проектов Базиса.
 *  Саморезы направляющих 3×3 в боковинах корпуса — по умолчанию есть (17 из 19 модулей Firmax в базе, как и 5×12).
 *  keep — текущие ящики Firmax (смена высоты корпуса, числа ящиков, долей фасадов): присадка и посадка короба переносятся —
 *  саморезы 3×3, шурупы фасада (свои точки — пока входят в новую фальшпанель, иначе по правилу большинства), 5×12, зазор
 *  до корпуса, отступ от фронта, конфирматы дна; у того же ящика — дно над низом боковин и высоты конфирматов (другая высота
 *  короба: нижний держит отступ от низа задней стенки, верхний — от её верха; не входят — по правилу большинства). Точки
 *  направляющих Базиса (runs) не переносятся: они привязаны к старым фасадам, новая точка — низ фасада, по паре на ящик. */
export function firmaxLayout(m: Module, n: number, ratios?: number[], keep?: FirmaxDrawer[]): FirmaxDrawer[] {
  const floor = axisFloor(m), ceil = axisCeiling(m) - AXIS_FIT.ceiling, len = firmaxLen(m);
  return axisLayout(m, n, ratios).map((a, i) => {
    const y = Math.round(Math.max(a.y0 + FIRMAX.sideDown, floor + 10) * 10) / 10, top = Math.round(Math.min(a.y1 - FIRMAX.topUnder, ceil) * 10) / 10;
    const h = Math.round((top - y) * 10) / 10, box: FirmaxBox = { y, h, len, screws: true };
    const own = keep?.[i], k = own ?? keep?.[0];
    if (k) {
      const o = k.box;
      if (!o.screws) delete box.screws; // в проекте Базиса без 3×3 (2 из 19) — так и оставляем
      if (o.rearHoles === false) box.rearHoles = false;
      if (o.gap !== undefined) box.gap = o.gap;
      if (o.front !== undefined) box.front = o.front;
      if (o.confBottom !== undefined) box.confBottom = o.confBottom;
      const same = own && Math.abs(own.box.h - h) < 0.05;
      if (own?.box.bottomUp !== undefined && own.box.bottomUp < h - FIRMAX.t - 20) box.bottomUp = own.box.bottomUp;
      const backH = h - (box.bottomUp ?? FIRMAX.bottomUp) - FIRMAX.t;
      if (own?.box.conf?.length) {
        // высоты конфирматов Базиса: та же высота короба — как есть; иначе нижний держит отступ от низа, верхний — от верха
        // задней стенки, если их столько же, сколько по правилу для новой высоты, и между ними не меньше 32
        const oc = own.box.conf, oldH = own.box.h - (own.box.bottomUp ?? FIRMAX.bottomUp) - FIRMAX.t, def = firmaxConf(backH);
        const moved = oc.length === 2 ? [oc[0], Math.round((backH - (oldH - oc[1])) * 10) / 10] : oc.map((c) => Math.round(c / oldH * backH * 10) / 10);
        if (same) box.conf = [...oc];
        else if (oc.length === def.length && moved.every((c) => c >= 8 && c <= backH - 8) && (moved.length < 2 || moved[1] - moved[0] >= 32)) box.conf = moved;
      }
      if (o.faceScrews === true) box.faceScrews = true;
      else if (Array.isArray(o.faceScrews)) box.faceScrews = same && o.faceScrews.every(([, sy]) => sy > 0 && sy < backH) ? o.faceScrews.map((p) => [p[0], p[1]] as [number, number]) : true;
    }
    return { system: "firmax-ldsp" as const, y0: a.y0, y1: a.y1, runnerY: Math.round(Math.max(a.y0, floor) * 10) / 10, box };
  });
}
/** Переключатель панели: саморезы 3×3 направляющих (screws) или шурупы фальшпанели в фасад (faceScrews) у всех ящиков Firmax.
 *  Включение шурупов фасада не трогает свои точки из Базиса, у остальных — правило большинства. */
export function firmaxSetScrews(ks: KDrawer[], what: "screws" | "faceScrews", on: boolean): KDrawer[] {
  return ks.map((k) => {
    if (!isFirmax(k)) return k;
    const box = { ...k.box };
    if (!on) delete box[what]; else if (what === "screws") box.screws = true; else if (!box.faceScrews) box.faceScrews = true;
    return { ...k, box };
  });
}
export function firmaxFits(m: Module, k: BoxDrawer) {
  return k.box.h >= 60 && k.box.y >= axisFloor(m) - 0.01 && k.box.y + k.box.h <= Math.min(k.y1, axisCeiling(m) - AXIS_FIT.ceiling) + 0.01;
}
/** Геометрия короба Firmax в осях модуля: x0/xr — внутренние грани боковин корпуса, F — передняя кромка корпуса. */
function firmaxGeom(k: BoxDrawer, x0: number, xr: number, F: number) {
  const vl = isVersalite(k), md = isModern(k), b = k.box, t = FIRMAX.t, gap = b.gap ?? (vl ? VERSALITE.gap : md ? MODERN.gap : FIRMAX.gap), bu = b.bottomUp ?? (vl ? VERSALITE.bottomUp : md ? MODERN.bottomUp : FIRMAX.bottomUp);
  const zf = F - (b.front ?? 0), zb = zf - b.len, sl = x0 + gap, sr = xr - gap, yb = b.y + bu, backY = yb + t, top = b.y + b.h;
  return { t, gap, bu, zf, zb, sl, sr, yb, backY, top, backH: top - backY };
}

/** Есть ли модели Базиса на это сочетание (царга нужной длины и высоты, держатели, направляющая; антрацит — свои сетки). */
export function axisAvailable(k: Pick<AxisDrawer, "h" | "len" | "color"> | BoxDrawer | StartDrawer | IndigoDrawer) {
  if ("system" in k && k.system === "start-sc") return startAvailable(k.sb, k.len);
  if ("system" in k && k.system === "indigo") return k.len === 500 && (k.hc === 90 || k.hc === 175);
  if ("system" in k && (k.system === "firmax-ldsp" || k.system === "versalite-h45" || k.system === "modern-slide")) return true; // короб ЛДСП: Firmax без сеток, у Versalite сетки на все длины
  const a = k as Pick<AxisDrawer, "h" | "len" | "color">, col = a.color ?? "white";
  return !!M.side[`${col}:${a.h}`]?.[a.len] && !!M.rear[`${col}:${a.h}`] && !!M.runner[col]?.[a.len];
}
/** Пол под ящиками: верх дна корпуса или нижних царг (лёжа 16, на ребре — их высота). */
export function axisFloor(m: Module) {
  const base = (m.feet?.height ?? m.plinthHeight ?? 0) + (m.bottomType === "none" ? 0 : 16);
  const low = (m.rails ?? []).filter((r) => r.place.endsWith("bottom")).map((r) => (r.lay === "flat" ? 16 : r.height));
  return base + Math.max(0, ...low);
}

export function axisLabel(k: KDrawer) { if (isModern(k)) return `MODERN SLIDE, короб ЛДСП ${k.box.h}×${k.box.len} мм`; if (isIndigo(k)) return `Indigo H=${k.hc}, ${k.len} мм${k.color === "white" ? ", белая" : ", орион серый"}`; if (isStart(k)) return `СТАРТ ${k.sb} H${k.sb === "SB20" ? 167 : START[k.sb].back}, ${k.len} мм${k.rail ? ", рейлинг" : ""}`; if (isVersalite(k)) return `Versalite Light H45 ${k.len}, короб ЛДСП ${k.box.h}×${k.box.len} мм`; if (isFirmax(k)) return `Firmax ЛДСП, короб ${k.box.h}×${k.box.len} мм`; return `Axis PRO H-${k.h}, ${k.len} мм${k.color === "anthracite" ? ", антрацит" : ""}`; }

/** Детали ящиков кухонного модуля: фасады, дно и задняя стенка ЛДСП, фурнитура Axis PRO сетками Базиса. */
export function kitchenDrawerParts(m: Module, out: Part[], faceGap: number, facadeT: number, faceAir: number) {
  const L = out.find((p) => p.id === "left"), R = out.find((p) => p.id === "right");
  if (!m.kdrawers?.length || !L || !R) return;
  const x0 = L.position[0] + L.size[0] / 2, xr = R.position[0] - R.size[0] / 2, F = Math.min(L.position[2] + L.size[2] / 2, R.position[2] + R.size[2] / 2);
  const t = 16;
  const metal = (id: string, name: string, mesh: string, origin: [number, number, number], q: Quat): Part => {
    const g = aabb(origin, q, BBOX[mesh] ?? [-5, -5, -5, 5, 5, 5]);
    return { id, name, size: g.size, position: g.position, length: Math.max(...g.size), width: [...g.size].sort((a, b) => b - a)[1], thickness: Math.min(...g.size), role: "drawer", material: "metal", decor: "", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0],
      model: { file: `hardware/bazis/${mesh}.glb`, length: "y", native: true, origin, quat: q } };
  };
  const board = (id: string, name: string, lo: number[], hi: number[], grainAxis: 0 | 1 | 2): Part => {
    const size: [number, number, number] = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]].map((v) => Math.round(v * 100) / 100) as [number, number, number];
    const rest = size.filter((_, i) => i !== grainAxis);
    return { id, name, size, position: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], length: size[grainAxis], width: Math.max(...rest), thickness: Math.min(...rest),
      role: "drawer", material: "board", decor: m.decor, grain: "length", grainAxis, edge: [0, 0, 0, 0] };
  };
  m.kdrawers.forEach((k, j) => {
    const id = `kd:${j}`;
    const sideIn = (s: 0 | 1) => (s ? xr : x0), dir = (s: 0 | 1) => (s ? -1 : 1);
    // фасад ящика (фасадный материал или ЛДСП — как у дверей модуля)
    const fw = m.width - 2 * faceGap, fh = k.y1 - k.y0;
    if (!(isStart(k) && k.inner)) out.push({ id: `${id}:facade`, name: `Фасад ящика ${j + 1}`, size: [fw, fh, facadeT], position: [m.width / 2, (k.y0 + k.y1) / 2, F + faceAir + facadeT / 2], length: fh, width: fw, thickness: facadeT,
      role: "drawer", material: "board", decor: m.drawerFacadeDecor ?? m.facadeDecor, grain: "length", grainAxis: 1, edge: [2, 2, 2, 2] });
    if (isIndigo(k)) {
      // Indigo: дно и задняя стенка ЛДСП 16, царги и направляющие сетками Базиса, «3x3» — как в проекте
      const s0 = INDIGO[k.hc], y = k.runnerY, bd = 479.2, backH = k.backH ?? s0.back, bw = xr - x0 - 19, kw = xr - x0 - 42;
      out.push({ id: `${id}:bottom`, name: `Дно ящика ${j + 1} (Indigo)`, size: [bw, t, bd], position: [(x0 + xr) / 2, y - 5 + t / 2, F - 0.4 - bd / 2], length: bw, width: bd, thickness: t,
        role: "drawer", material: "board", decor: m.decor, grain: "length", grainAxis: 0, edge: [0, 0, 0, 0] });
      out.push({ id: `${id}:back`, name: `Задняя стенка ящика ${j + 1} (Indigo)`, size: [kw, backH, t], position: [(x0 + xr) / 2, y + 11.4 + backH / 2, F - 490 + t / 2], length: kw, width: backH, thickness: t,
        role: "drawer", material: "board", decor: m.decor, grain: "length", grainAxis: 0, edge: [2, 2, 2, 2] });
      const cm = k.hc === 175 && k.color === "white" ? INDIGO.mesh["175:white"] : INDIGO.mesh[String(k.hc) as "175" | "90"];
      for (const s of [0, 1] as const) {
        const x = sideIn(s), d = dir(s), lr = s ? "R" : "L", side = s ? "правая" : "левая";
        out.push(metal(`${id}:slide:${lr}`, `Направляющая Indigo ${k.len} ${side}`, INDIGO.mesh.runner[s], [x, y, F], Q_RUN[s]));
        out.push(metal(`${id}:sys:side:${lr}`, `Царга Indigo H=${k.hc} ${k.len} ${side}`, cm[s], [x, y - 44, F], [1, 0, 0, 0]));
        for (const dz of INDIGO.side3) out.push(screwAt(`${id}:screw:run${lr}:${dz}`, [x, y, F - dz], "Саморез 3×3 (направляющая Indigo)"));
        for (const dy of s0.back3) out.push(screwAt(`${id}:screw:ig:rear${lr}:${dy}`, [x + d * 29, y + dy, F - 490], "Саморез 3×3 (царга Indigo в заднюю стенку)"));
        for (const dy of s0.front3) out.push(screwAt(`${id}:screw:ig:front${lr}:${dy}`, [x + d * 15, y + dy, F], "Саморез 3×3 (царга Indigo в фасад)"));
      }
      return;
    }
    if (isStart(k)) {
      // Boyard СТАРТ: дно и задняя стенка ЛДСП 16, металлические боковины, держатели, крепления фасада, рейлинг — сетками Базиса
      const s0 = START[k.sb], Fk = F - (k.front ?? 0), y = k.runnerY, yb = y + s0.side, rz = Fk - k.len + 8;
      const bd = k.len - 24, bw = xr - x0 - 75, backH = k.backH ?? s0.back, kw = xr - x0 - 87;
      out.push({ id: `${id}:bottom`, name: `Дно ящика ${j + 1} (СТАРТ)`, size: [bw, t, bd], position: [(x0 + xr) / 2, yb + t / 2, Fk - bd / 2], length: bw, width: bd, thickness: t,
        role: "drawer", material: "board", decor: m.decor, grain: "length", grainAxis: 0, edge: [0, 0, 0, 0] });
      out.push({ id: `${id}:back`, name: `Задняя стенка ящика ${j + 1} (СТАРТ)`, size: [kw, backH, t], position: [(x0 + xr) / 2, yb + backH / 2, rz + t / 2], length: kw, width: backH, thickness: t,
        role: "drawer", material: "board", decor: m.decor, grain: "length", grainAxis: 0, edge: [2, 2, 2, 2] });
      for (const s of [0, 1] as const) {
        const x = sideIn(s), d = dir(s), lr = s ? "R" : "L", side = s ? "правая" : "левая";
        out.push(metal(`${id}:slide:${lr}`, `Направляющая СТАРТ Soft-Closing ${k.len} ${side}`, ST.runner[k.len][s], [x, y, Fk], Q_RUN[s]));
        const sm = START_SIDES[k.sb]?.[k.len] ?? START_SIDES.SB20[500]!;
        out.push(metal(`${id}:sys:side:${lr}`, `Боковина СТАРТ ${k.sb} ${k.len} ${side}`, sm[s], [x + d * 37.5, yb, Fk], Q_BOX));
        out.push(metal(`${id}:sys:rear:${lr}`, `Держатель задней стенки СТАРТ ${k.sb} ${side}`, ST.holder[k.sb][s], [x + d * 52.5, y + s0.holder, rz], Q_BOX));
        out.push(metal(`${id}:sys:front:${lr}`, `Крепление фасада СТАРТ ${k.sb} ${side}`, ST.front[k.sb], [x + d * 15.5, y + 14.5, Fk], Q_BOX));
        out.push(metal(`${id}:cap:${lr}`, `Заглушка СТАРТ ${side}`, ST.cap, [x + d * s0.cap[s], y + s0.cap[2], Fk - 32], Q_RUN[1]));
        // шурупы 3,5×16 направляющей в боковину корпуса; «3x3» Базиса — саморезы держателя в заднюю стенку и крепления в фасад
        for (const dz of [37, 261]) out.push(screwAt(`${id}:screw:run${lr}:${dz}`, [x, y + 16, Fk - dz], "Шуруп 3,5×16 (направляющая СТАРТ)"));
        for (const dy of s0.holder3) out.push(screwAt(`${id}:screw:st:rear${lr}:${dy}`, [x + d * 52.5, y + s0.holder + dy, rz], "Саморез 3×3 (держатель задней стенки СТАРТ)"));
        for (const dy of s0.front3) out.push(screwAt(`${id}:screw:st:front${lr}:${dy}`, [x + d * 15.5, y + 14.5 + dy, Fk], "Саморез 3×3 (крепление фасада СТАРТ)"));
        if (k.rail) {
          const ry = y + (k.railDy ?? 201.4);
          (k.railYs ?? [206.5]).forEach((dy, ri) => { out.push(metal(`${id}:sys:rail:${lr}${ri ? ri : ""}`, `Рейлинг СТАРТ ${k.len} ${side}`, ST.rail[k.len][s], [x + d * 15.5, y + dy, Fk], Q_BOX)); out.push(screwAt(`${id}:screw:st:rail${lr}:${ri}`, [x + d * 15.5, y + dy, Fk], "Саморез 3×3 (рейлинг СТАРТ)")); });
          out.push(metal(`${id}:sys:railholder:${lr}`, `Держатель рейлинга СТАРТ ${side}`, ST.railHolder[s], [x + d * 52.5, ry, rz], Q_BOX));
          out.push(screwAt(`${id}:screw:st:railholder${lr}`, [x + d * 52.5, ry, rz], "Саморез 3×3 (держатель рейлинга СТАРТ)"));
        }
      }
      return;
    }
    if (isVersalite(k)) {
      // Versalite Light H45: короб ЛДСП 16 (боковины, дно у их низа, задняя стенка и фальшпанель на дне), шариковые направляющие
      // сетками Базиса между боковиной корпуса и боковиной ящика, шурупы 3,5×16, конфирматы короба (как в проектах цеха)
      const g = firmaxGeom(k, x0, xr, F), b = k.box, vl = VL[k.len] ?? VL[500], nm = "Versalite";
      out.push(board(`${id}:fx:side:L`, `Боковина ящика ${j + 1} левая (${nm})`, [g.sl, b.y, g.zb], [g.sl + g.t, g.top, g.zf], 2));
      out.push(board(`${id}:fx:side:R`, `Боковина ящика ${j + 1} правая (${nm})`, [g.sr - g.t, b.y, g.zb], [g.sr, g.top, g.zf], 2));
      out.push(board(`${id}:fx:bottom`, `Дно ящика ${j + 1} (${nm})`, [g.sl + g.t, g.yb, g.zb], [g.sr - g.t, g.yb + g.t, g.zf], 0));
      out.push(board(`${id}:fx:back`, `Задняя стенка ящика ${j + 1} (${nm})`, [g.sl + g.t, g.backY, g.zb], [g.sr - g.t, g.top, g.zb + g.t], 0));
      out.push(board(`${id}:fx:front`, `Фальшпанель ящика ${j + 1} (${nm})`, [g.sl + g.t, g.backY, g.zf - g.t], [g.sr - g.t, g.top, g.zf], 0));
      for (const s of [0, 1] as const) {
        const x = sideIn(s), d = dir(s), lr = s ? "R" : "L", side = s ? "правая" : "левая", head = s ? g.sr : g.sl, ax: "+x" | "-x" = s ? "-x" : "+x";
        out.push(metal(`${id}:slide:${lr}`, `Направляющая шариковая Versalite Light H45 ${k.len} ${side}`, vl.mesh[s], [x, k.runnerY, g.zf], Q_RUN[s]));
        // шурупы 3,5×16: направляющая в боковину корпуса и в боковину ящика (на толщине направляющей 12,7)
        for (const dz of vl.corp3) out.push(screwAt(`${id}:screw:run${lr}:${dz}`, [x, k.runnerY, g.zf - dz], "Шуруп 3,5×16 (направляющая Versalite в корпус)"));
        for (const dz of vl.box3) out.push(screwAt(`${id}:screw:vlb:${lr}:${dz}`, [x + d * VERSALITE.runT, k.runnerY, g.zf - dz], "Шуруп 3,5×16 (направляющая Versalite в ящик)"));
        // конфирматы: боковина → задняя стенка и фальшпанель, боковина → дно (от торцов)
        for (const dy of b.conf ?? firmaxConf(g.backH)) for (const [w, z] of [["back", g.zb + 8], ["front", g.zf - 8]] as const) out.push(conf(`fast:${id}:fx:${w}:${lr}:${dy}`, [head, g.backY + dy, z], ax, nm));
        const e = b.confBottom ?? VERSALITE.confBottom;
        for (const z of [g.zb + e, g.zf - e]) out.push(conf(`fast:${id}:fx:bottom:${lr}:${Math.round(z)}`, [head, g.yb + 8, z], ax, nm));
        // дно → задняя стенка и фальшпанель снизу (Базис: 2 + 2 конфирмата в 8 от торцов дна)
        const cu = b.confUnder ?? VERSALITE.confUnder, ux = s ? g.sr - g.t - cu : g.sl + g.t + cu;
        for (const [w, z] of [["back", g.zb + 8], ["front", g.zf - 8]] as const) out.push(conf(`fast:${id}:fx:under:${w}:${lr}`, [ux, g.yb, z], "+y", nm));
      }
      return;
    }
    if (isModern(k)) {
      // MODERN SLIDE: короб ЛДСП 16 как в Базисе k09; направляющая в Базисе без сетки — процедурный профиль под дном (честная подпись)
      const g = firmaxGeom(k, x0, xr, F), b = k.box, nm = "MODERN SLIDE";
      out.push(board(`${id}:fx:side:L`, `Боковина ящика ${j + 1} левая (${nm})`, [g.sl, b.y, g.zb], [g.sl + g.t, g.top, g.zf], 2));
      out.push(board(`${id}:fx:side:R`, `Боковина ящика ${j + 1} правая (${nm})`, [g.sr - g.t, b.y, g.zb], [g.sr, g.top, g.zf], 2));
      out.push(board(`${id}:fx:bottom`, `Дно ящика ${j + 1} (${nm})`, [g.sl + g.t, g.yb, g.zb], [g.sr - g.t, g.yb + g.t, g.zf], 0));
      out.push(board(`${id}:fx:back`, `Задняя стенка ящика ${j + 1} (${nm})`, [g.sl + g.t, g.backY, g.zb], [g.sr - g.t, g.top, g.zb + g.t], 0));
      out.push(board(`${id}:fx:front`, `Фальшпанель ящика ${j + 1} (${nm})`, [g.sl + g.t, g.backY, g.zf - g.t], [g.sr - g.t, g.top, g.zf], 0));
      (b.runs ?? [[g.gap, b.y, -b.len - 10], [xr - x0 - g.gap, b.y, -b.len - 10]]).forEach((r, i) => {
        const s = (i % 2) as 0 | 1, lr = s ? "R" : "L", side = s ? "правая" : "левая", d = dir(s), inner = s ? g.sr - g.t : g.sl + g.t, rx0 = inner + d * 0.5, rx1 = inner + d * (0.5 + FIRMAX.rail.w);
        out.push({ id: `${id}:slide:${lr}${i > 1 ? i : ""}`, name: `Направляющая MODERN SLIDE ${b.len + 10} ${side} (процедурная: в Базисе без сетки)`, size: [FIRMAX.rail.w, Math.max(1, g.bu - 1), b.len - 10], position: [(rx0 + rx1) / 2, b.y + g.bu / 2, g.zf - (b.len - 10) / 2],
          length: b.len - 10, width: FIRMAX.rail.w, thickness: Math.max(1, g.bu - 1), role: "drawer", material: "metal", decor: "", grain: "length", grainAxis: 2, edge: [0, 0, 0, 0], anchor: [x0 + r[0], r[1], F + r[2]] });
      });
      if (b.faceScrews) {
        const iw = g.sr - g.sl - 2 * g.t, pts = b.faceScrews === true ? [[67.5, g.backH - 31.5], [iw - 67.5, g.backH - 31.5]] : b.faceScrews;
        pts.forEach(([dx, dy], i) => out.push(screwAt(`${id}:screw:fxf:${i}`, [g.sl + g.t + dx, g.backY + dy, g.zf - g.t], "Саморез 4×30 (фальшпанель в фасад)")));
      }
      for (const s of [0, 1] as const) {
        const lr = s ? "R" : "L", d = dir(s), head = s ? g.sr : g.sl, ax: "+x" | "-x" = s ? "-x" : "+x";
        // конфирматы D5×35 (Базис): ids fast:ms — общая присадка даёт D8×16 + D5×35
        for (const dy of b.conf ?? firmaxConf(g.backH)) for (const [w, z] of [["back", g.zb + 8], ["front", g.zf - 8]] as const) out.push(conf(`fast:ms:${id}:${w}:${lr}:${dy}`, [head, g.backY + dy, z], ax, nm));
        const e = b.confBottom ?? MODERN.confBottom;
        for (const z of [g.zb + e, g.zf - e]) out.push(conf(`fast:ms:${id}:bottom:${lr}:${Math.round(z)}`, [head, g.yb + 8, z], ax, nm));
        const cu = b.confUnder ?? MODERN.confUnder, ux = s ? g.sr - g.t - cu : g.sl + g.t + cu;
        for (const [w, z] of [["back", g.zb + 8], ["front", g.zf - 8]] as const) out.push(conf(`fast:ms:${id}:under:${w}:${lr}`, [ux, g.yb, z], "+y", nm));
        if (b.screws !== false) for (const dz of [37, 261]) out.push(screwAt(`${id}:screw:fx3:${lr}:${dz}`, [sideIn(s), g.yb + 8, g.zf - dz], "Саморез 3,5×16 (направляющая MODERN SLIDE)"));
        if (b.rearHoles !== false) out.push(screwAt(`${id}:screw:fx5:${lr}`, [head + d * 23, g.yb + 11, g.zb], "Отверстие 5×12 (зацеп MODERN SLIDE)"));
      }
      return;
    }
    if (isFirmax(k)) {
      // Firmax скрытого монтажа: короб ЛДСП 16 (боковины, дно, задняя стенка, фальшпанель), направляющие под дном, конфирматы
      const g = firmaxGeom(k, x0, xr, F), b = k.box;
      out.push(board(`${id}:fx:side:L`, `Боковина ящика ${j + 1} левая (Firmax)`, [g.sl, b.y, g.zb], [g.sl + g.t, g.top, g.zf], 2));
      out.push(board(`${id}:fx:side:R`, `Боковина ящика ${j + 1} правая (Firmax)`, [g.sr - g.t, b.y, g.zb], [g.sr, g.top, g.zf], 2));
      out.push(board(`${id}:fx:bottom`, `Дно ящика ${j + 1} (Firmax)`, [g.sl + g.t, g.yb, g.zb], [g.sr - g.t, g.yb + g.t, g.zf], 0));
      out.push(board(`${id}:fx:back`, `Задняя стенка ящика ${j + 1} (Firmax)`, [g.sl + g.t, g.backY, g.zb], [g.sr - g.t, g.top, g.zb + g.t], 0));
      out.push(board(`${id}:fx:front`, `Фальшпанель ящика ${j + 1} (Firmax)`, [g.sl + g.t, g.backY, g.zf - g.t], [g.sr - g.t, g.top, g.zf], 0));
      // направляющие Firmax в Базисе без сетки: тонкий металлический профиль под дном у боковины, по длине ящика; точка — как у Базиса
      (b.runs ?? [[0, k.runnerY, 0], [0, k.runnerY, 0]]).forEach((r, i) => {
        const s = (i % 2) as 0 | 1, lr = s ? "R" : "L", side = s ? "правая" : "левая", d = dir(s), inner = s ? g.sr - g.t : g.sl + g.t;
        const rx0 = inner + d * 0.5, rx1 = inner + d * (0.5 + FIRMAX.rail.w);
        out.push({ id: `${id}:slide:${lr}${i > 1 ? i : ""}`, name: `Направляющая скрытого монтажа Firmax ${b.len} ${side}`, size: [FIRMAX.rail.w, Math.max(1, g.bu - 1), b.len - 10], position: [(rx0 + rx1) / 2, b.y + g.bu / 2, g.zf - (b.len - 10) / 2],
          length: b.len - 10, width: FIRMAX.rail.w, thickness: Math.max(1, g.bu - 1), role: "drawer", material: "metal", decor: "", grain: "length", grainAxis: 2, edge: [0, 0, 0, 0], anchor: [x0 + r[0], r[1], F + r[2]] });
      });
      if (b.faceScrews) {
        // фальшпанель ниже 100 (низкий верхний ящик после смены высоты): 60 и «40 ниже верха» выходят за неё — все три посередине по высоте
        const iw = g.sr - g.sl - 2 * g.t, lo = g.backH < 100, pts = b.faceScrews === true ? [[60, lo ? g.backH / 2 : g.backH - 40], [iw - 60, lo ? g.backH / 2 : g.backH - 40], [iw / 2, lo ? g.backH / 2 : 60]] : b.faceScrews;
        pts.forEach(([dx, dy], i) => out.push(screwAt(`${id}:screw:fxf:${i}`, [g.sl + g.t + dx, g.backY + dy, g.zf - g.t], "Шуруп 3,5×30 (фальшпанель в фасад)")));
      }
      for (const s of [0, 1] as const) {
        const lr = s ? "R" : "L", d = dir(s);
        // конфирматы короба: боковина → задняя стенка и фальшпанель (высоты как в проекте), боковина → дно (от торцов)
        const head = s ? g.sr : g.sl, ax: "+x" | "-x" = s ? "-x" : "+x";
        for (const dy of b.conf ?? firmaxConf(g.backH)) for (const [nm, z] of [["back", g.zb + 8], ["front", g.zf - 8]] as const) out.push(conf(`fast:${id}:fx:${nm}:${lr}:${dy}`, [head, g.backY + dy, z], ax));
        const e = b.confBottom ?? FIRMAX.confBottom;
        for (const z of [g.zb + e, g.zf - e]) out.push(conf(`fast:${id}:fx:bottom:${lr}:${Math.round(z)}`, [head, g.yb + 8, z], ax));
        // «3x3» — саморезы направляющей в боковину корпуса; «5x12» — под зацеп направляющей в задний торец дна
        if (b.screws) for (const dz of b.len >= 440 ? [37, 261] : [37, 165]) out.push(screwAt(`${id}:screw:fx3:${lr}:${dz}`, [sideIn(s), g.yb + 10, g.zf - dz], "Саморез 3×3 (направляющая Firmax)"));
        if (b.rearHoles !== false) out.push(screwAt(`${id}:screw:fx5:${lr}`, [head + d * 23, g.yb + 11, g.zb], "Отверстие 5×12 (зацеп Firmax)"));
      }
      return;
    }
    const col = k.color ?? "white", key = `${col}:${k.h}`, ry = k.runnerY;
    // дно: между царгами (37,5 от боковин), от передней кромки на длину ящика − 24; задняя стенка — за дном, ширина на 12 меньше
    const bw = xr - x0 - 75, bd = k.len - 24;
    out.push({ id: `${id}:bottom`, name: `Дно ящика ${j + 1} (${axisLabel(k)})`, size: [bw, t, bd], position: [(x0 + xr) / 2, ry - 22 + t / 2, F - bd / 2], length: bw, width: bd, thickness: t,
      role: "drawer", material: "board", decor: m.decor, grain: "length", grainAxis: 0, edge: [0, 0, 0, 0] });
    const backH = k.backH ?? AXIS_BACK[k.h], kw = xr - x0 - 87;
    out.push({ id: `${id}:back`, name: `Задняя стенка ящика ${j + 1}`, size: [kw, backH, t], position: [(x0 + xr) / 2, ry - 22 + backH / 2, F - k.len + 8 + t / 2], length: kw, width: backH, thickness: t,
      role: "drawer", material: "board", decor: m.decor, grain: "length", grainAxis: 0, edge: [2, 2, 2, 2] }); // без схемы кухни — как у шкафов 2 мм; со схемой — kitchenEdges
    for (const s of [0, 1] as const) {
      const x = sideIn(s), d = dir(s), lr = s ? "R" : "L", side = s ? "правая" : "левая";
      const run = (M.runner[col]?.[k.len] ?? M.runner.white[k.len])!;
      out.push(metal(`${id}:slide:${lr}`, `Направляющая Axis PRO ${k.len} ${side}`, run[s], [x, ry, F], Q_RUN[s]));
      const sm = (M.side[key]?.[k.len] ?? M.side[`white:${k.h}`]?.[k.len] ?? M.side["white:86"][500])!;
      out.push(metal(`${id}:sys:side:${lr}`, `Царга Axis PRO H-${k.h} ${k.len} ${side}`, sm[s], [x + d * 15.5, ry + 3.5, F], Q_BOX));
      const fm = k.h >= 168 ? M.frontCD : M.frontAB;
      out.push(metal(`${id}:sys:front:${lr}`, `Держатель фасада Axis PRO ${k.h >= 168 ? "CD" : "AB"} ${side}`, fm[s], [x + d * 15.5, ry + 3.5, F], Q_BOX));
      const rm = M.rear[key] ?? M.rear[`white:${k.h}`];
      out.push(metal(`${id}:sys:rear:${lr}`, `Держатель задней стенки Axis PRO H-${k.h} ${side}`, rm[s], [x + d * 53, ry + 11, F - k.len + 8], Q_BOX));
      out.push(metal(`${id}:cap:${lr}`, `Заглушка царги Axis PRO ${side}`, M.cap[col] ?? M.cap.white, [x + d * 20.1, ry + 24.5, F - 27.5], Q_RUN[s]));
      // саморезы 3×3: направляющая — в боковину корпуса, держатель — в заднюю стенку ящика
      for (const dz of RUNNER_D3[k.len]) out.push(screw(`${id}:screw:run${lr}:${dz}`, [x, ry, F - dz]));
      for (const dy of REAR_SCREWS[k.h]) out.push(screw(`${id}:screw:rear${lr}:${dy}`, [x + d * 53, ry + 11 + dy, F - k.len + 8]));
      if (k.faceScrews) for (const dy of FRONT_SCREWS[k.h]) out.push(screw(`${id}:screw:front${lr}:${dy}`, [x + d * 15.5, ry + 3.5 + dy, F]));
    }
  });
}
function screwAt(id: string, at: [number, number, number], name: string): Part { return { ...screw(id, at), name }; }
/** Конфирмат 7×50 короба ЛДСП: головка на наружной пласти боковины ящика, ось внутрь (модель «Евровинт 7х50» Базиса);
 *  «+y» — снизу через дно в заднюю стенку/фальшпанель (Versalite). */
function conf(id: string, head: [number, number, number], axis: "+x" | "-x" | "+y", sys = "Firmax"): Part {
  const up = axis === "+y", s = axis === "-x" ? -1 : 1;
  return { id, name: `Конфирмат 7×50 (короб ящика ${sys})`, size: up ? [7, 50, 7] : [50, 7, 7], position: up ? [head[0], head[1] + 25, head[2]] : [head[0] + s * 25, head[1], head[2]], length: 50, width: 7, thickness: 7, role: "fastener", material: "metal", decor: "", grain: "length", grainAxis: up ? 1 : 0, edge: [0, 0, 0, 0],
    model: { file: "hardware/bazis/f660d89fba1a.glb", length: "y", native: true, origin: head, quat: up ? [0.5, 0.5, 0.5, 0.5] : s > 0 ? [1, 0, 0, 0] : [0, 0, 1, 0] } };
}
function screw(id: string, at: [number, number, number]): Part {
  return { id, name: "Саморез 3×3 (крепление Axis PRO)", size: [3, 3, 3], position: at, length: 3, width: 3, thickness: 3, role: "drawer", material: "metal", decor: "", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0] };
}

/** Присадка ящиков Axis PRO (по FurnList.Holes Базиса). */
export function kitchenDrawerHoles(m: Module, ps: Part[], push: (src: string, at: [number, number, number], dir: [number, number, number], d: number, depth: number) => void) {
  if (!m.kdrawers?.length) return;
  m.kdrawers.forEach((k, j) => {
    const id = `kd:${j}`;
    if (isIndigo(k)) {
      // Indigo (FurnList.Holes Базиса): направляющая — 12 × D6,5×2 в боковину корпуса; «3x3» — D3×3 в боковину, заднюю стенку, фасад
      for (const lr of ["L", "R"] as const) {
        const run = ps.find((p) => p.id === `${id}:slide:${lr}`);
        if (!run?.model?.origin) continue;
        const [x, y, F] = run.model.origin, d = lr === "L" ? 1 : -1;
        for (const dz of INDIGO.run65) push(`${id}:run${lr}:${dz}`, [x, y, F - dz], [-d, 0, 0], 6.5, 2);
        for (const p of ps.filter((q) => q.id.startsWith(`${id}:screw:run${lr}:`))) push(p.id, p.position, [-d, 0, 0], 3, 3);
        for (const p of ps.filter((q) => q.id.startsWith(`${id}:screw:ig:rear${lr}:`) || q.id.startsWith(`${id}:screw:ig:front${lr}:`))) push(p.id, p.position, [0, 0, 1], 3, 3);
      }
      return;
    }
    if (isStart(k)) {
      // СТАРТ (FurnList.Holes Базиса): направляющая — D6×1,5 и шурупы D3×3 в боковину корпуса; держатель — D4,2×0,75 в пласть и
      // D3,5×0,75 в торец задней стенки; крепление фасада и рейлинг — D4×6 в фасад; держатель рейлинга — D4×3; «3x3» — D3×3
      const s0 = START[k.sb];
      for (const lr of ["L", "R"] as const) {
        const run = ps.find((p) => p.id === `${id}:slide:${lr}`);
        if (!run?.model?.origin) continue;
        const [x, y, Fk] = run.model.origin, d = lr === "L" ? 1 : -1, rz = Fk - k.len + 8;
        for (const dz of ST.run6[k.len] ?? []) push(`${id}:run${lr}:d6:${dz}`, [x, y + 16, Fk - dz], [-d, 0, 0], 6, 1.5);
        for (const p of ps.filter((q) => q.id.startsWith(`${id}:screw:run${lr}:`))) push(p.id, p.position, [-d, 0, 0], 3, 3);
        for (const dy of s0.holder3) push(`${id}:rear${lr}:${dy}`, [x + d * 52.5, y + s0.holder + dy, rz], [0, 0, 1], 4.2, 0.75);
        push(`${id}:rear${lr}:end`, [x + d * 43.5, y + s0.holder + (k.sb === "SB08" ? 16 : 7), rz + 8], [d, 0, 0], 3.5, 0.75);
        for (const dy of s0.front3) push(`${id}:front${lr}:${dy}`, [x + d * 15.5, y + 14.5 + dy, Fk], [0, 0, 1], 4, 6);
        if (k.rail) { for (const dy of k.railYs ?? [206.5]) push(`${id}:rail${lr}:${dy}`, [x + d * 15.5, y + dy, Fk], [0, 0, 1], 4, 6); push(`${id}:railholder${lr}`, [x + d * 52.5, y + (k.railDy ?? 201.4), rz], [0, 0, 1], 4, 3); }
        for (const p of ps.filter((q) => q.id.startsWith(`${id}:screw:st:`) && q.id.match(/(rear|front|rail|railholder)([LR])/)?.[2] === lr)) push(p.id, p.position, [0, 0, 1], 3, 3);
      }
      return;
    }
    if (isVersalite(k)) {
      // Versalite: направляющая — D6×1 в боковину корпуса, D3×1,2 и D5×1,2 в боковину ящика; шурупы 3,5×16 — D3×3 (FurnList.Holes Базиса)
      const vl = VL[k.len] ?? VL[500];
      for (const lr of ["L", "R"] as const) {
        const run = ps.find((p) => p.id === `${id}:slide:${lr}`);
        if (!run?.model?.origin) continue;
        const [x, y, zf] = run.model.origin, out = lr === "L" ? -1 : 1, bx = x - out * VERSALITE.runT;
        for (const dz of vl.corp6) push(`${id}:run${lr}:d6:${dz}`, [x, y, zf - dz], [out, 0, 0], 6, 1);
        for (const dz of vl.box12) push(`${id}:run${lr}:d3:${dz}`, [bx, y, zf - dz], [-out, 0, 0], 3, 1.2);
        for (const dz of vl.box5) push(`${id}:run${lr}:d5:${dz}`, [bx, y, zf - dz], [-out, 0, 0], 5, 1.2);
        for (const dz of vl.corp3) push(`${id}:screw:run${lr}:${dz}`, [x, y, zf - dz], [out, 0, 0], 3, 3);
        for (const dz of vl.box3) push(`${id}:screw:vlb:${lr}:${dz}`, [bx, y, zf - dz], [-out, 0, 0], 3, 3);
      }
      return;
    }
    if (isFirmax(k) || isModern(k)) {
      // Firmax: D3×3 в боковину корпуса («3x3»), D5×12 в задний торец дна («5x12»); конфирматы (D8×16 + D5×37) — общей присадкой fast:
      // шуруп 3,5×30 фальшпанели: D5×16 насквозь через фальшпанель + D3×3 в тыльную пласть фасада
      const fac = ps.find((q) => q.id === `${id}:facade`);
      for (const p of ps.filter((q) => q.id.startsWith(`${id}:screw:fxf:`))) {
        push(p.id, p.position, [0, 0, 1], 5, 16);
        if (fac) push(p.id + ":facade", [p.position[0], p.position[1], fac.position[2] - fac.size[2] / 2], [0, 0, 1], 3, 3);
      }
      for (const p of ps.filter((q) => q.id.startsWith(`${id}:screw:fx`) && !q.id.includes(":fxf:"))) {
        const lr = p.id.split(":")[4];
        if (p.id.includes(":fx3:")) push(p.id, p.position, [lr === "L" ? -1 : 1, 0, 0], 3, 3);
        else push(p.id, p.position, [0, 0, 1], 5, 12);
      }
      return;
    }
    for (const lr of ["L", "R"] as const) {
      const run = ps.find((p) => p.id === `${id}:slide:${lr}`), rear = ps.find((p) => p.id === `${id}:sys:rear:${lr}`), front = ps.find((p) => p.id === `${id}:sys:front:${lr}`);
      if (!run?.model?.origin || !rear?.model?.origin || !front?.model?.origin) continue;
      const [x, y, F] = run.model.origin, into: [number, number, number] = [lr === "L" ? -1 : 1, 0, 0];
      // направляющая: D5×2,1 (фиксаторы) и D3×3 (саморезы) во внутреннюю пласть боковины
      for (const dz of RUNNER_D5[k.len]) push(`${id}:run${lr}:${dz}`, [x, y, F - dz], into, 5, 2.1);
      for (const dz of RUNNER_D3[k.len]) push(`${id}:screw:run${lr}:${dz}`, [x, y, F - dz], into, 3, 3);
      // держатель задней стенки: накол D5×1 + саморез D3×3 в тыльную пласть задней стенки ящика
      const [rx, ryy, rz] = rear.model.origin;
      for (const dy of REAR_SCREWS[k.h]) { push(`${id}:rear${lr}:${dy}`, [rx, ryy + dy, rz], [0, 0, 1], 5, 1); push(`${id}:screw:rear${lr}:${dy}`, [rx, ryy + dy, rz], [0, 0, 1], 3, 3); }
      // держатель фасада: саморезы D3,5×4,5 в тыльную пласть фасада
      const [fx, fy, fz] = front.model.origin;
      for (const dy of FRONT_SCREWS[k.h]) { push(`${id}:front${lr}:${dy}`, [fx, fy + dy, fz], [0, 0, 1], 3.5, 4.5); if (k.faceScrews) push(`${id}:screw:front${lr}:${dy}`, [fx, fy + dy, fz], [0, 0, 1], 3, 3); }
    }
  });
}

export function kitchenDrawerErrors(m: Module): string[] {
  const e: string[] = [];
  const ks = m.kdrawers; if (!ks) return e;
  if (!Array.isArray(ks) || ks.length > 6) return ["Ящиков кухни — не больше шести."];
  ks.forEach((k, j) => {
    const p = `Ящик ${j + 1}: `;
    if (isIndigo(k)) {
      if (![k.y0, k.y1, k.runnerY].every(Number.isFinite) || k.y1 - k.y0 < 60 || k.y0 < 0 || k.y1 > m.height) { e.push(p + "фасад от 60 мм в пределах высоты модуля."); return; }
      if (!axisAvailable(k)) { e.push(p + "Indigo — царга H=90 или H=175, длина 500 (модели Базиса цеха)."); return; }
      if (k.len > m.depth - 7) e.push(p + `ящик Indigo ${k.len} не входит в глубину корпуса ${m.depth}.`);
      if (k.runnerY - 44 < axisFloor(m) - 0.01) e.push(p + `ящик Indigo на ${k.runnerY} уходит в дно корпуса (пол под ящиками ${axisFloor(m)}).`);
      if (indigoTop(k) > axisCeiling(m) + 0.01) e.push(p + `царга Indigo H=${k.hc} упирается в царги корпуса: верх ${Math.round(indigoTop(k) * 10) / 10}, царги с ${axisCeiling(m)}.`);
      for (let i = 0; i < j; i++) { const o = ks[i]; if (k.y0 < o.y1 - 0.01 && o.y0 < k.y1 - 0.01) e.push(p + `фасад пересекается с ящиком ${i + 1}.`); }
      return;
    }
    if (isStart(k)) {
      if (![k.y0, k.y1, k.runnerY].every(Number.isFinite) || k.y1 - k.y0 < 60 || k.y0 < 0 || k.y1 > m.height) { e.push(p + "фасад от 60 мм в пределах высоты модуля."); return; }
      if (!START[k.sb] || !(START_LENGTHS as readonly number[]).includes(k.len)) { e.push(p + "СТАРТ — боковины SB08/SB19/SB20, длина 400 или 500."); return; }
      if (!startAvailable(k.sb, k.len)) e.push(p + `СТАРТ ${k.sb} ${k.len} мм — нет модели в проектах Базиса цеха (есть: SB08/500, SB19/500, SB20/400, SB20/500).`);
      if (k.len > m.depth - (k.front ?? 0) - 7) e.push(p + `ящик СТАРТ ${k.len} не входит в глубину корпуса ${m.depth}.`);
      if (m.width - 32 < 180) e.push(p + "СТАРТ — внутренняя ширина корпуса от 180 мм (держатели задней стенки по 52,5 от боковин).");
      if (k.runnerY + START[k.sb].side < axisFloor(m) - 0.01) e.push(p + `ящик СТАРТ на ${k.runnerY} уходит в дно корпуса (пол под ящиками ${axisFloor(m)}).`);
      if (startTop(k) > axisCeiling(m) + 0.01) e.push(p + `ящик СТАРТ ${k.sb} упирается в царги корпуса: верх ${Math.round(startTop(k) * 10) / 10}, царги с ${axisCeiling(m)}.`);
      if (k.backH !== undefined && (!Number.isFinite(k.backH) || k.backH < 60 || k.backH > 400)) e.push(p + "задняя стенка 60–400 мм.");
      for (let i = 0; i < j; i++) { const o = ks[i]; if (k.y0 < o.y1 - 0.01 && o.y0 < k.y1 - 0.01 && !k.inner && !(isStart(o) && o.inner)) e.push(p + `фасад пересекается с ящиком ${i + 1}.`); }
      return;
    }
    if (isVersalite(k)) {
      const b = k.box;
      if (![k.y0, k.y1, k.runnerY, b?.y, b?.h, b?.len].every(Number.isFinite) || k.y1 - k.y0 < 60 || k.y0 < 0 || k.y1 > m.height) { e.push(p + "фасад от 60 мм в пределах высоты модуля."); return; }
      if (!VERSALITE_LENGTHS.includes(k.len)) e.push(p + "длина направляющей Versalite Light H45 — 350, 400, 450, 500 или 550.");
      if (b.h < 60) e.push(p + "короб Versalite — боковины от 60 мм.");
      if (k.runnerY - 22 < b.y - 0.01 || k.runnerY + 22 > b.y + b.h + 0.01) e.push(p + `направляющая H45 на ${k.runnerY} выходит за боковину ящика (${b.y}–${Math.round((b.y + b.h) * 10) / 10}).`);
      if (b.len < k.len - 0.01) e.push(p + `короб ${b.len} короче направляющей ${k.len}.`);
      if (b.len > m.depth - (b.front ?? 0) + 0.01) e.push(p + `короб Versalite ${b.len} не входит в глубину корпуса ${m.depth}.`);
      if (m.width - 32 - 2 * (b.gap ?? VERSALITE.gap) - 32 < 100) e.push(p + "Versalite — узкий корпус: между боковинами ящика меньше 100 мм.");
      if (b.y < axisFloor(m) - 0.01) e.push(p + `короб Versalite на ${b.y} уходит в дно корпуса (пол под ящиками ${axisFloor(m)}).`);
      if (b.y + b.h > axisCeiling(m) + 0.01) e.push(p + `короб Versalite упирается в царги корпуса: верх ${Math.round((b.y + b.h) * 10) / 10}, царги с ${axisCeiling(m)}.`);
      for (let i = 0; i < j; i++) { const o = ks[i]; if (k.y0 < o.y1 - 0.01 && o.y0 < k.y1 - 0.01) e.push(p + `фасад пересекается с ящиком ${i + 1}.`); if (isBox(o) && b.y < o.box.y + o.box.h - 0.01 && o.box.y < b.y + b.h - 0.01) e.push(p + `короб пересекается с коробом ящика ${i + 1}.`); }
      return;
    }
    if (isFirmax(k) || isModern(k)) {
      const b = k.box, fx = isModern(k) ? "MODERN SLIDE" : "Firmax";
      if (![k.y0, k.y1, k.runnerY, b?.y, b?.h, b?.len].every(Number.isFinite) || k.y1 - k.y0 < 60 || k.y0 < 0 || k.y1 > m.height) { e.push(p + "фасад от 60 мм в пределах высоты модуля."); return; }
      if (b.h < 60) e.push(p + `короб ${fx} — боковины от 60 мм.`);
      if (b.len > m.depth - (b.front ?? 0) + 0.01 || b.len < 250) e.push(p + `короб ${fx} ${b.len} не входит в глубину корпуса ${m.depth}.`);
      if (m.width - 32 - 2 * (b.gap ?? FIRMAX.gap) - 32 < 100) e.push(p + `${fx} — узкий корпус: между боковинами ящика меньше 100 мм.`);
      if (b.y < axisFloor(m) - 0.01) e.push(p + `короб ${fx} на ${b.y} уходит в дно корпуса (пол под ящиками ${axisFloor(m)}).`);
      if (b.y + b.h > axisCeiling(m) + 0.01) e.push(p + `короб ${fx} упирается в царги корпуса: верх ${Math.round((b.y + b.h) * 10) / 10}, царги с ${axisCeiling(m)}.`);
      for (let i = 0; i < j; i++) { const o = ks[i]; if (k.y0 < o.y1 - 0.01 && o.y0 < k.y1 - 0.01) e.push(p + `фасад пересекается с ящиком ${i + 1}.`); if (isBox(o) && b.y < o.box.y + o.box.h - 0.01 && o.box.y < b.y + b.h - 0.01) e.push(p + `короб пересекается с коробом ящика ${i + 1}.`); }
      return;
    }
    if (k.system !== "axis-pro") e.push(p + "система ящиков — Axis PRO или Firmax ЛДСП.");
    if (!AXIS_HEIGHTS.includes(k.h)) e.push(p + "высота царги Axis PRO — 86, 120, 168 или 200.");
    if (!AXIS_LENGTHS.includes(k.len)) e.push(p + "длина Axis PRO — 300, 400, 450, 500 или 550.");
    if (![k.y0, k.y1, k.runnerY].every(Number.isFinite) || k.y1 - k.y0 < 60 || k.y0 < 0 || k.y1 > m.height) e.push(p + "фасад от 60 мм в пределах высоты модуля.");
    if (k.len > m.depth - 7) e.push(p + `ящик ${k.len} не входит в глубину корпуса ${m.depth}.`);
    if (k.backH !== undefined && (!Number.isFinite(k.backH) || k.backH < 60 || k.backH > 400)) e.push(p + "задняя стенка 60–400 мм.");
    for (let i = 0; i < j; i++) { const o = ks[i]; if (k.y0 < o.y1 - 0.01 && o.y0 < k.y1 - 0.01) e.push(p + `фасад пересекается с ящиком ${i + 1}.`); }
    const floor = axisFloor(m);
    if (AXIS_HEIGHTS.includes(k.h) && AXIS_LENGTHS.includes(k.len) && !axisAvailable(k)) e.push(p + `Axis PRO H-${k.h}, ${k.len} мм${k.color === "anthracite" ? ", антрацит" : ""} — нет модели в проектах Базиса цеха (есть: ${axisCombos(k.color).join(", ")}).`);
    if (m.width - 32 < 180) e.push(p + "Axis PRO — внутренняя ширина корпуса от 180 мм (держатели задней стенки по 53 от боковин).");
    if (k.runnerY - AXIS_RUNNER_DOWN < floor - 0.01) e.push(p + `направляющая на ${k.runnerY} уходит в дно корпуса (низ направляющей ${k.runnerY - AXIS_RUNNER_DOWN}, дно до ${floor}).`);
    if (axisTop(k) > axisCeiling(m) + 0.01) {
      const lower = AXIS_HEIGHTS.some((hh) => hh < k.h && !!axisBestLen(m, hh, k.color));
      e.push(p + `короб H-${k.h} упирается в царги корпуса: верх ${Math.round(axisTop(k) * 10) / 10}, царги с ${axisCeiling(m)}. ` + (lower ? "Возьмите царгу ниже." : `Царги ниже под глубину ${m.depth} в моделях Базиса нет — уменьшите число ящиков или увеличьте глубину.`));
    }
    const above = ks.filter((o) => o !== k && o.runnerY > k.runnerY).sort((a, b) => a.runnerY - b.runnerY)[0];
    if (above && axisTop(k) > above.runnerY - AXIS_RUNNER_DOWN + 0.01) e.push(p + `короб заходит на направляющую ящика выше.`);
  });
  return e;
}

/** Сочетания «H/длина», на которые есть модели (для подсказки). */
export function axisCombos(color?: AxisDrawer["color"]) { return AXIS_HEIGHTS.flatMap((h) => AXIS_LENGTHS.filter((len) => axisAvailable({ h, len, color })).map((len) => `${h}/${len}`)); }

export function parseKDrawers(x: unknown): KDrawer[] | undefined {
  if (!Array.isArray(x)) return undefined;
  return x.slice(0, 6).map((k0: Partial<AxisDrawer> | Partial<FirmaxDrawer> | Partial<VersaliteDrawer> | Partial<StartDrawer> | Partial<IndigoDrawer> | Partial<ModernDrawer>): KDrawer => {
    if (k0.system === "indigo") {
      const s = k0 as Partial<IndigoDrawer>;
      return { system: "indigo", y0: Number(s.y0), y1: Number(s.y1), runnerY: Number(s.runnerY), hc: Number(s.hc) === 90 ? 90 : 175, len: 500, ...(s.color === "white" ? { color: "white" as const } : {}), ...(s.backH === undefined ? {} : { backH: Number(s.backH) }) };
    }
    if (k0.system === "start-sc") {
      const s = k0 as Partial<StartDrawer>, sb = (["SB08", "SB19", "SB20"] as const).find((v) => v === s.sb) ?? "SB20";
      return { system: "start-sc", y0: Number(s.y0), y1: Number(s.y1), runnerY: Number(s.runnerY), len: Number(s.len) === 400 ? 400 : 500, sb,
        ...(s.rail ? { rail: true } : {}), ...(s.railDy === undefined ? {} : { railDy: Number(s.railDy) }), ...(Array.isArray(s.railYs) ? { railYs: s.railYs.slice(0, 4).map(Number) } : {}), ...(s.backH === undefined ? {} : { backH: Number(s.backH) }), ...(s.front ? { front: Number(s.front) } : {}), ...(s.inner ? { inner: true } : {}),
        ...(s.edge && (s.edge.bottom || s.edge.back) ? { edge: { ...(s.edge.bottom ? { bottom: true } : {}), ...(s.edge.back === "y" || s.edge.back === "all" ? { back: s.edge.back } : {}) } } : {}) };
    }
    if (k0.system === "firmax-ldsp" || k0.system === "versalite-h45" || k0.system === "modern-slide") {
      const b = (k0.box ?? {}) as Partial<FirmaxBox>, num = (v: unknown) => (v === undefined ? undefined : Number(v));
      const box: FirmaxBox = { y: Number(b.y), h: Number(b.h), len: Number(b.len) };
      for (const key of ["bottomUp", "gap", "front", "confBottom", "confUnder"] as const) { const v = num(b[key]); if (v !== undefined) box[key] = v; }
      if (k0.system === "versalite-h45") {
        if (Array.isArray(b.conf)) box.conf = b.conf.slice(0, 6).map(Number);
        return { system: "versalite-h45", y0: Number(k0.y0), y1: Number(k0.y1), runnerY: Number(k0.runnerY), len: Number((k0 as Partial<VersaliteDrawer>).len) as VersaliteLen, box };
      }
      if (Array.isArray(b.conf)) box.conf = b.conf.slice(0, 6).map(Number);
      if (b.screws) box.screws = true;
      if (b.rearHoles === false) box.rearHoles = false;
      if (b.faceScrews === true) box.faceScrews = true; else if (Array.isArray(b.faceScrews)) box.faceScrews = b.faceScrews.slice(0, 8).map((r) => [Number(r[0]), Number(r[1])] as [number, number]);
      if (Array.isArray(b.runs)) box.runs = b.runs.slice(0, 8).filter((r) => Array.isArray(r) && r.length === 3).map((r) => r.map(Number) as [number, number, number]);
      return { system: k0.system === "modern-slide" ? "modern-slide" : "firmax-ldsp", y0: Number(k0.y0), y1: Number(k0.y1), runnerY: Number(k0.runnerY), box } as FirmaxDrawer | ModernDrawer;
    }
    const k = k0 as Partial<AxisDrawer>;
    return { system: "axis-pro" as const, y0: Number(k.y0), y1: Number(k.y1), runnerY: Number(k.runnerY), h: Number(k.h) as AxisDrawer["h"], len: Number(k.len) as AxisDrawer["len"],
    ...(k.color === "anthracite" ? { color: "anthracite" as const } : {}), ...(k.backH === undefined ? {} : { backH: Number(k.backH) }), ...(k.faceScrews ? { faceScrews: true } : {}) };
  });
}
