// Ящики кухни по проектам Базиса цеха (база «Пистос», разбор 09.10.2026).
// Система Axis PRO (GTV): металлические царги H-86/120/168/200, дно и задняя стенка ЛДСП 16, направляющие скрытого монтажа
// на боковинах корпуса, держатели фасада и задней стенки, заглушки царг. Все смещения — от точки направляющей Базиса:
// внутренняя грань боковины (x), высота направляющей (y), передняя кромка корпуса (z). Сверено по 23 модулям с Axis PRO
// (k04–k30, 40 ящиков): смещения одинаковые у всех, разброс 0.
import type { Module, Part } from "./model";
import { qrot, type Quat } from "./quat";

export type KDrawerSystem = "axis-pro";
export type KDrawer = {
  system: KDrawerSystem;
  /** Фасад ящика: низ и верх от пола модуля (зазоры между фасадами — как в проекте). */
  y0: number; y1: number;
  /** Высота направляющей от пола модуля (точка Базиса: низ дна ящика + 22). */
  runnerY: number;
  /** Высота царги и длина ящика (направляющей). */
  h: 86 | 120 | 168 | 200; len: 300 | 400 | 450 | 500 | 550;
  color?: "white" | "anthracite";
  /** Высота задней стенки, если не по царге (с рейлингом выше). */
  backH?: number;
  /** Держатель фасада дополнительно на саморезах 3×3 (часть проектов Базиса: D3×3 в фасад в тех же точках). */
  faceScrews?: boolean;
};

export const AXIS_HEIGHTS = [86, 120, 168, 200] as const;
export const AXIS_LENGTHS = [300, 400, 450, 500, 550] as const;
/** Задняя стенка ЛДСП 16 по высоте царги (Базис). */
export const AXIS_BACK: Record<KDrawer["h"], number> = { 86: 84, 120: 116, 168: 167, 200: 199 };
/** Отверстия направляющей в боковине (от передней кромки): D5×2,1 под фиксаторы и D3×3 под саморезы. */
const RUNNER_D5: Record<KDrawer["len"], number[]> = { 300: [37, 69, 165, 197], 400: [37, 69, 229, 261], 450: [37, 69, 261, 293], 500: [37, 69, 261, 293], 550: [37, 69, 261, 293] };
const RUNNER_D3: Record<KDrawer["len"], number[]> = { 300: [37, 197], 400: [37, 261], 450: [37, 261], 500: [37, 261], 550: [37, 261] };
/** Саморезы держателя задней стенки (по высоте от его точки): D3×3 + накол D5×1. */
const REAR_SCREWS: Record<KDrawer["h"], number[]> = { 86: [0, 32], 120: [0, 32, 64], 168: [-13, 51, 115], 200: [19, 83, 147] };
/** Держатель фасада AB (H-86, H-120) — 2 самореза в фасад, CD (H-168, H-200) — 4; D3,5×4,5. */
const FRONT_SCREWS: Record<KDrawer["h"], number[]> = { 86: [0, 32], 120: [0, 32], 168: [0, 32, 96, 128], 200: [0, 32, 96, 128] };

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
};
/** Верх деталей ящика над направляющей (по сеткам): царга, держатель задней стенки, держатель фасада. */
const SIDE_TOP: Record<KDrawer["h"], number> = { 86: 3.5 + 59.5, 120: 3.5 + 91.5, 168: 3.5 + 142.5, 200: 3.5 + 174.5 };
const REAR_TOP: Record<KDrawer["h"], number> = { 86: 11 + 52, 120: 11 + 84, 168: 11 + 135, 200: 11 + 167 };
/** Направляющая — 44 мм ниже своей точки (сетка Axis PRO). */
export const AXIS_RUNNER_DOWN = 44;
/** Запасы раскладки (по базе: верх ящика не ближе 21,5 к верху фасада; до царг корпуса — 5). */
export const AXIS_FIT = { facadeTop: 21.5, ceiling: 5 };
/** Верх короба ящика от пола модуля: задняя стенка, царга, держатель — что выше. */
export function axisTop(k: KDrawer) { return k.runnerY + Math.max(-22 + (k.backH ?? AXIS_BACK[k.h]), SIDE_TOP[k.h], REAR_TOP[k.h]); }
/** Низ под царгами/крышей корпуса (нижний кухонный: царги 16 лёжа у верха; на ребре — их высота). */
export function axisCeiling(m: Module) {
  const top = (m.rails ?? []).filter((r) => r.place.endsWith("top") && r.at === undefined).map((r) => (r.lay === "flat" ? 16 : r.height));
  return m.height - Math.max(m.topType === "none" ? 0 : 16, ...top, 0);
}
/** Ящик входит: верх короба не ближе запасов к верху своего фасада и к царгам корпуса. */
export function axisFits(m: Module, k: KDrawer) { return axisTop(k) <= Math.min(k.y1 - AXIS_FIT.facadeTop, axisCeiling(m) - AXIS_FIT.ceiling) + 1e-6; }
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
export function axisLayout(m: Module, n: number, ratios?: number[]): KDrawer[] {
  const g = m.faceGap ?? 1.5, gap = m.faceGapBetween ?? 3, feet = m.feet?.height ?? m.plinthHeight ?? 0;
  const innerBottom = feet + 16, y0 = feet + g, y1 = m.height - g, avail = y1 - y0 - (n - 1) * gap;
  const base = ratios?.length === n ? ratios : n === 1 ? [1] : n === 2 ? [0.5, 0.5] : n === 3 ? [0.44, 0.28, 0.28] : Array.from({ length: n }, (_, i) => (i === 0 ? 1.5 : 1));
  const sum = base.reduce((s, v) => s + v, 0), len = ([...AXIS_LENGTHS].reverse().find((l) => l <= m.depth - 25) ?? 300) as KDrawer["len"];
  const hs = base.map((r) => Math.round((avail * r) / sum * 2) / 2);
  hs[n - 1] = Math.round((avail - hs.slice(0, -1).reduce((s, v) => s + v, 0)) * 10) / 10; // остаток — верхнему, сумма точно по корпусу
  let y = y0;
  return hs.map((fh, i) => {
    const runnerY = Math.round(Math.max(y + 59, innerBottom + 59) * 10) / 10, y1r = Math.round((y + fh) * 10) / 10;
    const pick = (hh: KDrawer["h"]): KDrawer => ({ system: "axis-pro", y0: Math.round(y * 10) / 10, y1: y1r, runnerY, h: hh, len });
    const k = [...AXIS_HEIGHTS].reverse().map(pick).find((c) => axisFits(m, c)) ?? pick(86);
    y += fh + gap;
    return k;
  });
}
/** Пересчитать ящики под новую высоту или глубину корпуса: число и доли фасадов сохраняются. */
export function refitKDrawers(m: Module): KDrawer[] | undefined {
  const ks = m.kdrawers; if (!ks?.length) return ks;
  const next = axisLayout(m, ks.length, ks.map((k) => k.y1 - k.y0));
  return next.map((k, i) => ({ ...k, ...(ks[i].color ? { color: ks[i].color } : {}), ...(ks[i].faceScrews ? { faceScrews: true } : {}) }));
}

export function axisLabel(k: KDrawer) { return `Axis PRO H-${k.h}, ${k.len} мм${k.color === "anthracite" ? ", антрацит" : ""}`; }

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
  m.kdrawers.forEach((k, j) => {
    const id = `kd:${j}`, col = k.color ?? "white", key = `${col}:${k.h}`, ry = k.runnerY;
    const sideIn = (s: 0 | 1) => (s ? xr : x0), dir = (s: 0 | 1) => (s ? -1 : 1);
    // фасад ящика (фасадный материал или ЛДСП — как у дверей модуля)
    const fw = m.width - 2 * faceGap, fh = k.y1 - k.y0;
    out.push({ id: `${id}:facade`, name: `Фасад ящика ${j + 1}`, size: [fw, fh, facadeT], position: [m.width / 2, (k.y0 + k.y1) / 2, F + faceAir + facadeT / 2], length: fh, width: fw, thickness: facadeT,
      role: "drawer", material: "board", decor: m.drawerFacadeDecor ?? m.facadeDecor, grain: "length", grainAxis: 1, edge: [2, 2, 2, 2] });
    // дно: между царгами (37,5 от боковин), от передней кромки на длину ящика − 24; задняя стенка — за дном, ширина на 12 меньше
    const bw = xr - x0 - 75, bd = k.len - 24;
    out.push({ id: `${id}:bottom`, name: `Дно ящика ${j + 1} (${axisLabel(k)})`, size: [bw, t, bd], position: [(x0 + xr) / 2, ry - 22 + t / 2, F - bd / 2], length: bw, width: bd, thickness: t,
      role: "drawer", material: "board", decor: m.decor, grain: "length", grainAxis: 0, edge: [0, 0, 0, 0] });
    const backH = k.backH ?? AXIS_BACK[k.h], kw = xr - x0 - 87;
    out.push({ id: `${id}:back`, name: `Задняя стенка ящика ${j + 1}`, size: [kw, backH, t], position: [(x0 + xr) / 2, ry - 22 + backH / 2, F - k.len + 8 + t / 2], length: kw, width: backH, thickness: t,
      role: "drawer", material: "board", decor: m.decor, grain: "length", grainAxis: 0, edge: [0, 0, 0, 0] });
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
function screw(id: string, at: [number, number, number]): Part {
  return { id, name: "Саморез 3×3 (крепление Axis PRO)", size: [3, 3, 3], position: at, length: 3, width: 3, thickness: 3, role: "drawer", material: "metal", decor: "", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0] };
}

/** Присадка ящиков Axis PRO (по FurnList.Holes Базиса). */
export function kitchenDrawerHoles(m: Module, ps: Part[], push: (src: string, at: [number, number, number], dir: [number, number, number], d: number, depth: number) => void) {
  if (!m.kdrawers?.length) return;
  m.kdrawers.forEach((k, j) => {
    const id = `kd:${j}`;
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
    if (k.system !== "axis-pro") e.push(p + "система ящиков — Axis PRO.");
    if (!AXIS_HEIGHTS.includes(k.h)) e.push(p + "высота царги Axis PRO — 86, 120, 168 или 200.");
    if (!AXIS_LENGTHS.includes(k.len)) e.push(p + "длина Axis PRO — 300, 400, 450, 500 или 550.");
    if (![k.y0, k.y1, k.runnerY].every(Number.isFinite) || k.y1 - k.y0 < 60 || k.y0 < 0 || k.y1 > m.height) e.push(p + "фасад от 60 мм в пределах высоты модуля.");
    if (k.len > m.depth - 7) e.push(p + `ящик ${k.len} не входит в глубину корпуса ${m.depth}.`);
    if (k.backH !== undefined && (!Number.isFinite(k.backH) || k.backH < 60 || k.backH > 400)) e.push(p + "задняя стенка 60–400 мм.");
    for (let i = 0; i < j; i++) { const o = ks[i]; if (k.y0 < o.y1 - 0.01 && o.y0 < k.y1 - 0.01) e.push(p + `фасад пересекается с ящиком ${i + 1}.`); }
    const floor = (m.feet?.height ?? m.plinthHeight ?? 0) + (m.bottomType === "none" ? 0 : 16);
    if (k.runnerY - AXIS_RUNNER_DOWN < floor - 0.01) e.push(p + `направляющая на ${k.runnerY} уходит в дно корпуса (низ направляющей ${k.runnerY - AXIS_RUNNER_DOWN}, дно до ${floor}).`);
    if (axisTop(k) > axisCeiling(m) + 0.01) e.push(p + `короб H-${k.h} упирается в царги корпуса: верх ${Math.round(axisTop(k) * 10) / 10}, царги с ${axisCeiling(m)}. Возьмите царгу ниже.`);
    const above = ks.filter((o) => o !== k && o.runnerY > k.runnerY).sort((a, b) => a.runnerY - b.runnerY)[0];
    if (above && axisTop(k) > above.runnerY - AXIS_RUNNER_DOWN + 0.01) e.push(p + `короб заходит на направляющую ящика выше.`);
  });
  return e;
}

export function parseKDrawers(x: unknown): KDrawer[] | undefined {
  if (!Array.isArray(x)) return undefined;
  return x.slice(0, 6).map((k: Partial<KDrawer>) => ({ system: "axis-pro" as const, y0: Number(k.y0), y1: Number(k.y1), runnerY: Number(k.runnerY), h: Number(k.h) as KDrawer["h"], len: Number(k.len) as KDrawer["len"],
    ...(k.color === "anthracite" ? { color: "anthracite" as const } : {}), ...(k.backH === undefined ? {} : { backH: Number(k.backH) }), ...(k.faceScrews ? { faceScrews: true } : {}) }));
}
