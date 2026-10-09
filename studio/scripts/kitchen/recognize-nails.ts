// Гвозди набивного ХДФ по проекту Базиса (n4-wall).
// Статистика по всей базе: «Гвоздь» (категория «прочее», сетка 281de529218b) — 400 шт. в 19 модулях k01, k03, k07, k24.
// У 11 навесных и антресолей с прямым корпусом (k01 m07/m09/m11/m13/m14, k03 m06/m07/m08/m09/m11/m12) раскладка одна:
//   нижний и верхний ряды — в 7,5 от края ХДФ, по ширине от 23 до W−23, round(W/125) гвоздей;
//   левый и правый ряды — в 7,5 от края, по высоте от 8 до H−8, round(H/125) гвоздей; точка — на тыльной пласти ХДФ.
// Угловые (k01 m06, k03 m10, k07 m09), нижние и дно-ХДФ (k01 m01/m02/m04/m05, k24 m02) раскладываются иначе — для них правило
// не применяется: студия гвозди не ставит (как и раньше), сверка честно показывает «прочее N/0».
import { nailRows, type KitchenSpec } from "../../src/kitchen";
import type { RefModule } from "./compare";

type Q = [number, number, number, number];
type Box = { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number };

/** Гвозди ХДФ модуля Базиса, если раскладка совпадает с правилом точно (±0,6 мм), иначе undefined. */
export function recognizeNails(ref: RefModule, back: Box): NonNullable<KitchenSpec["nails"]> | undefined {
  const ns = ref.hardware.filter((h) => h.name === "Гвоздь");
  if (!ns.length) return undefined;
  const W = back.x1 - back.x0, H = back.y1 - back.y0, r = nailRows(W, H);
  const exp: { side: "bottom" | "top" | "left" | "right"; p: [number, number] }[] = [
    ...r.bottom.map((x) => ({ side: "bottom" as const, p: [x, 7.5] as [number, number] })),
    ...r.top.map((x) => ({ side: "top" as const, p: [x, H - 7.5] as [number, number] })),
    ...r.left.map((y) => ({ side: "left" as const, p: [7.5, y] as [number, number] })),
    ...r.right.map((y) => ({ side: "right" as const, p: [W - 7.5, y] as [number, number] })),
  ];
  if (exp.length !== ns.length) return undefined;
  const q: Partial<Record<"bottom" | "top" | "left" | "right", Q>> = {};
  const used = new Set<number>();
  for (const e of exp) {
    const j = ns.findIndex((h, i) => !used.has(i) && Math.abs(h.pos[0] - back.x0 - e.p[0]) < 0.6 && Math.abs(h.pos[1] - back.y0 - e.p[1]) < 0.6 && Math.abs(h.pos[2] - back.z0) < 0.6);
    if (j < 0) return undefined;
    used.add(j);
    q[e.side] ??= (ns[j].quat ?? [1, 0, 0, 0]) as Q;
  }
  const mesh = ns[0].mesh;
  return { ...(mesh && ns.every((h) => h.mesh === mesh) ? { mesh } : {}), q: { bottom: q.bottom!, top: q.top!, left: q.left!, right: q.right! } };
}
