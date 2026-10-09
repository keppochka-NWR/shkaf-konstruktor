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
