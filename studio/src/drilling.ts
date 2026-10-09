// Присадка: отверстия под крепёж и фурнитуру — по шаблонам Базиса (FurnList.Holes в проектах цеха, сверено на кухнях «Пистос»).
// Отверстие: точка входа на грани панели, направление сверления (внутрь панели), диаметр, глубина; панель — деталь, в которую сверлим.
//   конфирмат 7×50: D8×(толщина) насквозь через первую панель от головки + D5×35 в торец второй;
//   полкодержатель: D5×12 в стойку, центр на 2,5 ниже пласти полки;
//   опора кухонная: 4 × D4×3 по квадрату 31×31 в нижнюю пласть дна;
//   петля накладная: чашка D35×13 в фасад (центр в 7,5 мм от внутренней плоскости стойки), планка — 2 × D3×3 в стойку (±16 от оси, 37 от фасада).
import { parts, type Module, type Part } from "./model";
import { qrot } from "./quat";
import { kitchenDrawerHoles } from "./kitchenDrawers";

export type Hole = { part: string; at: [number, number, number]; dir: [number, number, number]; d: number; depth: number; src: string };

const inside = (p: Part, q: number[]) => [0, 1, 2].every((i) => Math.abs(q[i] - p.position[i]) <= p.size[i] / 2 + 1e-6);
const isPanel = (p: Part) => p.material === "board" || p.material === "hdf";

export function holes(m: Module, ps: Part[] = parts(m)): Hole[] {
  const out: Hole[] = [], panels = ps.filter(isPanel);
  const host = (at: number[], dir: number[], probe = 0.5) => panels.find((p) => inside(p, [at[0] + dir[0] * probe, at[1] + dir[1] * probe, at[2] + dir[2] * probe]))?.id;
  const push = (src: string, at: [number, number, number], dir: [number, number, number], d: number, depth: number, probe = 0.5) => {
    const part = host(at, dir, probe);
    if (part) out.push({ part, at: at.map((v) => Math.round(v * 100) / 100) as [number, number, number], dir, d, depth, src });
  };
  for (const p of ps) {
    if (p.id.startsWith("fast:") && p.model?.origin && p.model.quat) {
      const h = p.model.origin, a = qrot(p.model.quat, [1, 0, 0]).map((v) => Math.round(v)) as [number, number, number];
      const first = host(h, a), t1 = first ? Math.min(...ps.find((q) => q.id === first)!.size) : 16;
      push(p.id, h, a, 8, t1);
      push(p.id, [h[0] + a[0] * t1, h[1] + a[1] * t1, h[2] + a[2] * t1], a, 5, p.id.startsWith("fast:kd:") ? 37 : t1 === 16 ? 35 : 40); // короб ящика Firmax в Базисе — D5×37
    } else if (p.id.startsWith("shp:") && p.model?.origin && p.model.quat) {
      const o = p.model.origin, into = qrot(p.model.quat, [1, 0, 0])[0] > 0 ? -1 : 1; // полкодержатель смотрит из стойки к полке
      // центр отверстия: под металлическим — 2,5 мм ниже пласти полки, под стеклянным MV05 — 5 мм
      push(p.id, [o[0], o[1] - (p.name.includes("стекл") ? 5 : 2.5), o[2]], [into, 0, 0], 5, 12);
    } else if (p.id.startsWith("ecc:under:") && !p.id.endsWith(":pin") && p.anchor) {
      // боковина на дне (кухни Базиса k16/k28/k31): точка — наружная пласть боковины × верх дна; шток D8×34 вверх в торец боковины
      // по её оси, бочонок D15×12 в наружную пласть в 34 мм над дном, D5×12 вниз в верхнюю пласть дна
      const [ox, y, z] = p.anchor, inward = p.id.includes(":left:") ? 1 : -1, cx = ox + inward * 8;
      push(p.id + ":pin", [cx, y, z], [0, 1, 0], 8, 34);
      push(p.id, [ox, y + 34, z], [inward, 0, 0], 15, 12);
      push(p.id + ":bottom", [cx, y, z], [0, -1, 0], 5, 12);
    } else if (p.id.startsWith("dowel:under:") && p.anchor) {
      // шкант 8×30 по оси боковины, стоящей на дне: D8×22 вверх в торец боковины, D8×12 вниз в верхнюю пласть дна
      const y = p.position[1] - 3;
      push(p.id, [p.position[0], y, p.position[2]], [0, 1, 0], 8, 22);
      push(p.id + ":bottom", [p.position[0], y, p.position[2]], [0, -1, 0], 8, 12);
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
    } else if (p.id.startsWith("lift:") && (p.model?.origin || p.anchor)) {
      // газлифт PD-G-N02 (Базис): фиксатор на фасад — 2×D4×1,8 (±12 по высоте), его саморезы — D3×4; фиксатор на боковину — 3×D4×2, саморезы — D3×3
      const o = (p.model?.origin ?? p.anchor)!, out_: [number, number, number] = [p.id.startsWith("lift:left:") ? -1 : 1, 0, 0];
      if (p.id.endsWith(":face")) for (const dy of [12, -12]) push(p.id, [o[0], o[1] + dy, o[2]], [0, 0, 1], 4, 1.8);
      else if (p.id.endsWith(":side")) for (const [dy, dz] of [[-5, 8.66], [10, 0], [-5, -8.66]]) push(p.id, [o[0], o[1] + dy, o[2] + dz], out_, 4, 2);
      else if (p.id.includes(":screw:f")) push(p.id, o, [0, 0, 1], 3, 4, 2); // точка самореза Базиса — 1,5 мм за плоскостью фасада (в фиксаторе)
      else if (p.id.includes(":screw:s")) push(p.id, o, out_, 3, 3);
    } else if (p.id.includes(":hingeplate:") && p.model?.native && p.model.origin && p.size[0] > p.size[1]) {
      // подъёмный фасад: планка на нижней плоскости крыши (две наколки D3×3 вверх), чашка Ø35×13 в 7,5 мм под крышей
      const [x, y, back] = p.model.origin;
      for (const dx of [16, -16]) push(p.id, [x + dx, y, back - 37], [0, 1, 0], 3, 3);
      push(p.id.replace(":hingeplate:", ":hingecup:"), [x, y - 7.5, back], [0, 0, 1], 35, 13);
    } else if (p.id.includes(":hingeplate:") && p.model?.native && p.model.origin) {
      const [sx, y, back] = p.model.origin, inward = p.position[0] > sx ? 1 : -1; // плечо — внутрь корпуса от стойки
      for (const dy of [16, -16]) push(p.id, [sx, y + dy, back - 37], [-inward, 0, 0], 3, 3);
      push(p.id.replace(":hingeplate:", ":hingecup:"), [sx + inward * 7.5, y, back], [0, 0, 1], 35, 13);
    }
  }
  kitchenDrawerHoles(m, ps, push);
  return out;
}
