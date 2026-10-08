// Присадка: отверстия под крепёж и фурнитуру — по шаблонам Базиса (FurnList.Holes в проектах цеха, сверено на кухнях «Пистос»).
// Отверстие: точка входа на грани панели, направление сверления (внутрь панели), диаметр, глубина; панель — деталь, в которую сверлим.
//   конфирмат 7×50: D8×(толщина) насквозь через первую панель от головки + D5×35 в торец второй;
//   полкодержатель: D5×12 в стойку, центр на 2,5 ниже пласти полки;
//   опора кухонная: 4 × D4×3 по квадрату 31×31 в нижнюю пласть дна;
//   петля накладная: чашка D35×13 в фасад (центр в 7,5 мм от внутренней плоскости стойки), планка — 2 × D3×3 в стойку (±16 от оси, 37 от фасада).
import { parts, type Module, type Part } from "./model";
import { qrot } from "./quat";

export type Hole = { part: string; at: [number, number, number]; dir: [number, number, number]; d: number; depth: number; src: string };

const inside = (p: Part, q: number[]) => [0, 1, 2].every((i) => Math.abs(q[i] - p.position[i]) <= p.size[i] / 2 + 1e-6);
const isPanel = (p: Part) => p.material === "board" || p.material === "hdf";

export function holes(m: Module, ps: Part[] = parts(m)): Hole[] {
  const out: Hole[] = [], panels = ps.filter(isPanel);
  const host = (at: number[], dir: number[]) => panels.find((p) => inside(p, [at[0] + dir[0] * 0.5, at[1] + dir[1] * 0.5, at[2] + dir[2] * 0.5]))?.id;
  const push = (src: string, at: [number, number, number], dir: [number, number, number], d: number, depth: number) => {
    const part = host(at, dir);
    if (part) out.push({ part, at: at.map((v) => Math.round(v * 100) / 100) as [number, number, number], dir, d, depth, src });
  };
  for (const p of ps) {
    if (p.id.startsWith("fast:") && p.model?.origin && p.model.quat) {
      const h = p.model.origin, a = qrot(p.model.quat, [1, 0, 0]).map((v) => Math.round(v)) as [number, number, number];
      const first = host(h, a), t1 = first ? Math.min(...ps.find((q) => q.id === first)!.size) : 16;
      push(p.id, h, a, 8, t1);
      push(p.id, [h[0] + a[0] * t1, h[1] + a[1] * t1, h[2] + a[2] * t1], a, 5, t1 === 16 ? 35 : 40);
    } else if (p.id.startsWith("shp:") && p.model?.origin && p.model.quat) {
      const o = p.model.origin, into = qrot(p.model.quat, [1, 0, 0])[0] > 0 ? -1 : 1; // полкодержатель смотрит из стойки к полке
      // центр отверстия: под металлическим — 2,5 мм ниже пласти полки, под стеклянным MV05 — 5 мм
      push(p.id, [o[0], o[1] - (p.name.includes("стекл") ? 5 : 2.5), o[2]], [into, 0, 0], 5, 12);
    } else if (p.id.startsWith("ecc:") && !p.id.endsWith(":pin") && p.anchor) {
      // эксцентрик Ф15: D15×12 в пласть горизонтали в 34 мм от стойки, шток D8×34 в торец горизонтали, D5×12 в стойку
      const [ex, ey, ez] = p.anchor, inward = p.position[0] > ex ? 1 : -1, down = p.position[1] < ey ? -1 : 1;
      const hpY = ey + down * 8; // середина горизонтали 16
      push(p.id, [ex + inward * 34, ey, ez], [0, down, 0], 15, 12);
      push(p.id + ":pin", [ex, hpY, ez], [inward, 0, 0], 8, 34);
      push(p.id + ":side", [ex, hpY, ez], [-inward, 0, 0], 5, 12);
    } else if (p.id.startsWith("dowel:")) {
      // шкант 8×30: D8×22 в торец горизонтали, D8×12 в стойку
      const inward = p.id.includes(":left:") ? 1 : -1, ex = p.position[0] - inward * 3;
      push(p.id, [ex, p.position[1], p.position[2]], [inward, 0, 0], 8, 22);
      push(p.id + ":side", [ex, p.position[1], p.position[2]], [-inward, 0, 0], 8, 12);
    } else if (p.id.startsWith("leg:") && p.model?.origin) {
      const o = p.model.origin;
      for (const [dx, dz] of [[-15.5, -15.5], [15.5, -15.5], [-15.5, 15.5], [15.5, 15.5]]) push(p.id, [o[0] + dx, o[1], o[2] + dz], [0, 1, 0], 4, 3);
    } else if (p.id.startsWith("kitchen-hanger:") && p.model?.origin) {
      // навес ABS: две наколки D3×3 в боковину — на 15 мм ниже начала навеса (30 от верха), в 38 и 70 мм от задней кромки
      const o = p.model.origin, into: [number, number, number] = [o[0] < m.width / 2 ? -1 : 1, 0, 0];
      for (const dz of [18, 50]) push(p.id, [o[0], o[1] - 15, o[2] + dz], into, 3, 3);
    } else if (p.id.includes(":hingeplate:") && p.model?.native && p.model.origin) {
      const [sx, y, back] = p.model.origin, inward = p.position[0] > sx ? 1 : -1; // плечо — внутрь корпуса от стойки
      for (const dy of [16, -16]) push(p.id, [sx, y + dy, back - 37], [-inward, 0, 0], 3, 3);
      push(p.id.replace(":hingeplate:", ":hingecup:"), [sx + inward * 7.5, y, back], [0, 0, 1], 35, 13);
    }
  }
  return out;
}
