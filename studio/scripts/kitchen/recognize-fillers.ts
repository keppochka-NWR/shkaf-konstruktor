// Распознавание доборных планок и фальшпанелей Базиса (пакет 2 развития калькулятора, backlog F_FILLER_STRIP / F_FILLER_FLAT).
// Каждое правило читает сам проект Базиса: поле ставится, только если так в этом проекте. Срабатывание — прогон по 16 модулям
// категории F_FILLER_STRIP (15.10.2026): планки ЛДСП 24–70 мм снаружи боковины в плоскостях, параллельных фасадам (одна у лица
// корпуса: k15 m01, k18 m01, k20 m07, k17 m10; две-три по глубине: k25 m01/m09, k26 m07, k28 m18, k32 m11), перед ними — планка из
// фасадного материала в плоскости фасадов (40–75 мм, иногда без планок ЛДСП: k22 m09, k25 m19, k29 m07); крепёж — конфирматы из
// боковины в торец передней планки (k15 m01: 5, k18 m01: 3, k28 m18: 3) или без крепежа в проекте (k25, k20). Габарит модуля в
// Базисе шире корпуса на планку — у студии корпус остаётся шириной между боковинами, планки стоят снаружи (как wallFiller у шкафов).
import type { RefModule, RefPanel } from "./compare";
import type { KitchenSideStrip } from "../../src/kitchen";

const r1 = (v: number) => Math.round(v * 10) / 10;
type EP = RefPanel & { edges?: { side: string; thick: number }[] };
const board = (p: RefPanel) => p.kind === "ldsp" || p.kind === "mdf";

export type SideStripFound = { strip: KitchenSideStrip; /** номера панелей Базиса, занятых планками (не фасады, не «не распознано») */ panels: number[] };

/** Доборная планка сбоку модуля Базиса (F_FILLER_STRIP). Снаружи крайней боковины — только узкие (≤ 80 мм) вертикальные панели
 *  в плоскостях фасадов: планки ЛДСП 16 за плоскостью фасадов и не дальше лица корпуса, планка из фасадного материала / ЛДСП в
 *  плоскости фасадов. Любая другая деталь снаружи боковины (стойка-перегородка k11 m04, второй корпус) — не этот случай. */
export function sideStripOf(ref: RefModule): SideStripFound | undefined {
  const sides = ref.panels.filter((p) => p.axis === "x" && board(p) && p.box[4] - p.box[1] > 200).sort((a, b) => a.box[0] - b.box[0]);
  if (sides.length < 2) return undefined;
  const L = sides[0], R = sides[sides.length - 1];
  const zF = Math.max(L.box[5], R.box[5]), zB = Math.min(L.box[2], R.box[2]);
  const horiz = ref.panels.filter((p) => p.axis === "y" && board(p));
  const y0 = horiz.length ? Math.min(...horiz.map((p) => p.box[1])) : Math.min(L.box[1], R.box[1]); // низ дна — отсчёт высот (пакет 0: от кромки детали)
  for (const side of ["left", "right"] as const) {
    const edge = side === "left" ? L.box[0] : R.box[3];
    const beyond = (p: RefPanel) => (side === "left" ? p.box[0] < edge - 1 : p.box[3] > edge + 1);
    const fully = (p: RefPanel) => (side === "left" ? p.box[3] <= edge + 0.6 : p.box[0] >= edge - 0.6);
    const cand = ref.panels.filter((p) => p.kind !== "hdf" && beyond(p));
    if (!cand.length) continue;
    // всё, что выходит за боковину, — узкие вертикали в плоскостях фасадов; иначе (стойка, полка, второй корпус) — не планка
    if (!cand.every((p) => p.axis === "z" && p.box[3] - p.box[0] <= 80 && p.box[4] - p.box[1] > 100)) return undefined;
    const planksP = cand.filter((p) => p.kind === "ldsp" && p.box[5] <= zF + 0.5 && p.box[2] < zF - 1 && fully(p));
    const faceP = cand.filter((p) => p.box[2] >= zF - 1);
    if (faceP.length > 1 || planksP.length + faceP.length !== cand.length) return undefined;
    const outer = side === "left" ? Math.min(...cand.map((p) => p.box[0])) : Math.max(...cand.map((p) => p.box[3]));
    const ext = r1(Math.abs(outer - edge));
    if (ext < 20 || ext > 80) return undefined;
    const planks = planksP.sort((a, b) => b.box[2] - a.box[2]).map((p) => {
      const ed = ((p as EP).edges ?? []).filter((e) => e.thick > 0);
      return { z: r1(p.box[2] - zB), w: r1(p.box[3] - p.box[0]), y0: r1(p.box[1] - y0), y1: r1(p.box[4] - y0), ...(ed.length ? { edges: [...new Set(ed.map((e) => e.side))].sort(), edgeT: ed[0].thick } : {}) };
    });
    const fp = faceP[0];
    const facade = fp ? { w: r1(fp.box[3] - fp.box[0]), inset: r1(side === "left" ? fp.box[0] - outer : outer - fp.box[3]), y0: r1(fp.box[1] - y0), y1: r1(fp.box[4] - y0), t: r1(fp.thick), air: r1(fp.box[2] - zF), ...(fp.kind === "ldsp" ? { ldsp: true as const } : {}) } : undefined;
    // конфирматы из боковины в торец передней планки: головка на внутренней пласти боковины, ось — середина толщины планки
    const front = planks[0], sideP = side === "left" ? L : R, inner = side === "left" ? L.box[3] : R.box[0];
    const conf = front ? ref.hardware.filter((h) => h.category === "конфирмат" && Math.abs(h.pos[0] - inner) < 0.6 && Math.abs(h.pos[2] - (zB + front.z + 8)) < 0.6 && h.pos[1] >= sideP.box[1] - 0.5)
      .map((h) => r1(h.pos[1] - (y0 + front.y0))).sort((a, b) => a - b) : [];
    // глубина D5 в торце планки — по отверстиям проекта (k28 m18: 42; остальные 35, как у корпуса — тогда поле не пишем)
    const dep = conf.length && planksP.length ? (ref.holes ?? []).find((h) => h.panel === planksP[0].i && h.d === 5)?.depth : undefined;
    const base = ref.holes?.find((h) => h.d === 5 && h.panel !== planksP[0]?.i && h.depth >= 30)?.depth;
    return { strip: { side, ext, planks, ...(facade ? { facade } : {}), ...(conf.length ? { conf } : {}), ...(dep !== undefined && dep !== base ? { confDepth: r1(dep) } : {}) }, panels: cand.map((p) => p.i) };
  }
  return undefined;
}

/** Копия эталона со сдвигом по x: корпус модуля с планкой слева начинается не с 0 — распознаватель считает от наружной пласти боковины. */
export function shiftRefX(ref: RefModule, dx: number): RefModule {
  if (!dx) return ref;
  return {
    ...ref,
    size: [r1(ref.size[0] + dx), ref.size[1], ref.size[2]],
    panels: ref.panels.map((p) => ({ ...p, box: [p.box[0] + dx, p.box[1], p.box[2], p.box[3] + dx, p.box[4], p.box[5]] })),
    hardware: ref.hardware.map((h) => ({ ...h, pos: [h.pos[0] + dx, h.pos[1], h.pos[2]] })),
    ...(ref.holes ? { holes: ref.holes.map((h) => ({ ...h, at: [h.at[0] + dx, h.at[1], h.at[2]] })) } : {}),
  };
}
