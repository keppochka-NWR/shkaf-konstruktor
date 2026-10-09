// Крепёж стяжки на ребре навесного/антресоли по проекту Базиса (n4-wall).
// Статистика по навесным и антресолям: у 26 стяжек высотой до 130 мм крепёж разный по проектам — k03: 2 конфирмата через
// каждую боковину (34 и 66 от низа) и 2 через крышу (51–60 от концов); k04: по одному через боковину (50) и 2 через крышу (56–65);
// k20: по одному через боковину и один через крышу по центру; k15 m08, k19 m02: без конфирматов. Общего правила нет —
// точки берутся из проекта (как jointZ у дна и крыши).
import type { RefHardware } from "./compare";

type B = { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number };
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Конфирматы стяжки b: через боковины (точки на наружной пласти боковины в пределах стяжки) и через крышу/дно
 *  (точки на наружной пласти горизонтали над/под стяжкой, в пределах её ширины). side — мм от низа стяжки (по одной стороне;
 *  у обеих сторон одинаково, иначе undefined), top — мм от левого конца. */
export function railConf(hw: RefHardware[], b: B, xL: number, xR: number, hz?: B): { side: number[]; top: number[] } | undefined {
  const cf = hw.filter((h) => (h.category === "конфирмат") && h.pos[2] >= b.z0 - 0.5 && h.pos[2] <= b.z1 + 0.5);
  const inY = (y: number) => y >= b.y0 - 0.5 && y <= b.y1 + 0.5;
  const L = cf.filter((h) => Math.abs(h.pos[0] - xL) < 0.6 && inY(h.pos[1])).map((h) => r1(h.pos[1] - b.y0)).sort((a, c) => a - c);
  const R = cf.filter((h) => Math.abs(h.pos[0] - xR) < 0.6 && inY(h.pos[1])).map((h) => r1(h.pos[1] - b.y0)).sort((a, c) => a - c);
  if (L.length !== R.length || L.some((v, i) => Math.abs(v - R[i]) > 0.6)) return undefined;
  let top: number[] = [];
  if (hz) {
    const yo = hz.y0 >= b.y1 - 0.5 ? hz.y1 : hz.y0; // наружная пласть крыши (над стяжкой) или дна (под ней)
    top = cf.filter((h) => Math.abs(h.pos[1] - yo) < 0.6 && h.pos[0] > b.x0 + 0.5 && h.pos[0] < b.x1 - 0.5).map((h) => r1(h.pos[0] - b.x0)).sort((a, c) => a - c);
  }
  return { side: L, top };
}

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
