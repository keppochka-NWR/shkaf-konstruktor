// Крепёж стяжки навесного/антресоли по проекту Базиса (n4-wall).
// Конфирматы стяжки на ребре (через боковины и через крышу/дно) — общее правило recognize-common.ts railConf → rails[].confY/topConf
// (статистика по навесным и антресолям: k03 — 2 через каждую боковину, 34 и 66 от низа, и 2 через крышу в 51–60 от концов; k04 — по
// одному через боковину и 2 через крышу; k20 — по одному и один через крышу по центру; k15 m08, k19 m02 — без конфирматов).
// Здесь — стяжка на дне на эксцентриках и шкантах снизу.
import type { RefHardware } from "./compare";

type B = { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number };
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Стяжка на дне на эксцентриках и шкантах снизу (Базис k04 m08, k31 m07/m09/m11): эксцентрик — точка «пласть стяжки × верх дна»,
 *  шкант — «низ дна × ось стяжки». Нет эксцентриков — undefined (правило студии). */
export function railUnder(hw: RefHardware[], b: B, bottom: B): { ecc: number[]; dowel: number[]; face: "front" | "back" } | undefined {
  const inX = (x: number) => x > b.x0 + 0.5 && x < b.x1 - 0.5, zc = (b.z0 + b.z1) / 2;
  const ecc = hw.filter((h) => h.category === "эксцентрик" && inX(h.pos[0]) && Math.abs(h.pos[1] - bottom.y1) < 0.6 && (Math.abs(h.pos[2] - b.z0) < 0.6 || Math.abs(h.pos[2] - b.z1) < 0.6));
  if (!ecc.length) return undefined;
  const faces = new Set(ecc.map((h) => (Math.abs(h.pos[2] - b.z1) < 0.6 ? "front" : "back")));
  if (faces.size !== 1) return undefined;
  const dowel = hw.filter((h) => h.category === "шкант" && inX(h.pos[0]) && Math.abs(h.pos[1] - bottom.y0) < 0.6 && Math.abs(h.pos[2] - zc) < 0.6);
  return { ecc: ecc.map((h) => r1(h.pos[0] - b.x0)).sort((a, c) => a - c), dowel: dowel.map((h) => r1(h.pos[0] - b.x0)).sort((a, c) => a - c), face: [...faces][0] as "front" | "back" };
}
