// Крепёж корпуса, которого нет среди 3D-деталей крепежа (fastenerCounts считает только поставленные в модель конфирматы/эксцентрики
// стыков крыша/дно/полки/перегородки). Критик 28.10.2026: в смете шкафов студии не было крепежа цоколя, фальшпанелей к стене и сборки
// коробов ящиков, у углового шкафа — никакого крепежа. Счёт — по правилам репо (СТП цеха в WORKSHOP-RULES.md: «конфирматы по 2 на стык
// горизонтали с боковиной»; короб ящика — как у коробов Базиса, firmaxConf: стенка ниже 90 мм — 1 конфирмат на стык, выше — 2; дно
// снизу — по 2 на боковину) и решению Макса 26.10.2026: видимого снаружи крепежа быть не должно — где головка была бы снаружи
// изделия (торцы цоколя и передней планки через боковины), эксцентрики.
// Только шкафы студии: кухни и модули Базиса считают крепёж по проекту Базиса (студия ничего не добавляет сверх Базиса).
import { parts, type Module, type Part } from "./model";

export type HullFasteners = {
  /** конфирматы стыков корпуса, которых нет в 3D (угловой шкаф): головка на наружной пласти боковины, под заглушку — как у шкафов */
  confirmats: number;
  /** эксцентрики: цоколь и передняя планка к боковинам (торцом, снаружи не видно), стыки углового шкафа при fastening «eccentric» */
  eccentrics: number;
  /** конфирматы сборки коробов ящиков (головки на боковинах короба — внутри корпуса, без заглушек) */
  boxConfirmats: number;
  /** саморезы 4×30 изнутри корпуса через боковину в пласть фальшпанели к стене / боковой фальшпанели (плита к плите 16+16 —
   *  конфирмат 7×50 длиннее пакета); шаг ≤ 500 мм, не меньше 2 — допущение до подтверждения Максом */
  fillerScrews: number;
};
const NONE: HullFasteners = { confirmats: 0, eccentrics: 0, boxConfirmats: 0, fillerScrews: 0 };
/** Конфирматов на стык стенки короба с боковиной: как firmaxConf (kitchenDrawers.ts) — до 90 мм один, выше — два. */
export const boxJointConfirmats = (wallH: number) => (wallH < 90 ? 1 : 2);
/** Саморезов на фальшпанель длиной len: шаг ≤ 500 мм, не меньше 2. */
export const fillerScrewCount = (len: number) => Math.max(2, Math.ceil(len / 500) + 1);
/** Эксцентриков на торец цоколя/планки высотой h: до 150 мм — один, выше — два. */
const endEcc = (h: number) => (h < 150 ? 1 : 2);

function boxes(ps: Part[]): number {
  const byBox = new Map<string, Part[]>();
  for (const p of ps) {
    const m = /^(.*:drawer:\d+):(left|right|front|back|rear|bottom)$/.exec(p.id);
    if (!m || p.material !== "board") continue;
    byBox.set(m[1], [...(byBox.get(m[1]) ?? []), p]);
  }
  let n = 0;
  for (const box of byBox.values()) {
    const sides = box.filter((p) => /:(left|right)$/.test(p.id)), walls = box.filter((p) => /:(front|back|rear)$/.test(p.id));
    if (sides.length < 2) continue;
    // стенка короба: высота — меньший из размеров её лица (длина вдоль ширины короба, высота стенки)
    for (const w of walls) n += 2 * boxJointConfirmats(Math.min(w.size[0], w.size[1]));
    if (box.some((p) => p.id.endsWith(":bottom"))) n += 4;
  }
  return n;
}

export function hullFasteners(m: Module): HullFasteners {
  if (m.kitchen || m.raw || m.bazis || m.kupe || m.worktop) return NONE;
  const ps = parts(m), out: HullFasteners = { ...NONE, boxConfirmats: boxes(ps) };
  const ecc = m.fastening === "eccentric";
  if (m.corner) {
    // угловой шкаф (cornerWardrobe.ts): стыки горизонталей с боковинами — по 2 на стык, перегородки блоков — по 2 сверху и снизу
    const joint = (n: number) => { if (ecc) out.eccentrics += n; else out.confirmats += n; };
    for (const p of ps) {
      if (p.id === "bottom" || p.id === "top" || p.id === "middle-shelf" || p.id.endsWith(":drawer-cap")) joint(2 * 2);
      else if (p.id.endsWith(":divider")) joint(2 * 2);
      else if (p.id === "plinth" || p.id === "header") out.eccentrics += 2 * endEcc(Math.min(p.size[0], p.size[1]));
    }
    return out;
  }
  for (const p of ps) {
    // радиусный стеллаж (shapes.radiusParts): эксцентрики цоколя — деталями крепежа (торец к боковине и к заднику), здесь не считаем
    if (p.id === "plinth" && p.material === "board" && !m.radius) out.eccentrics += 2 * endEcc(p.size[1]);
    // фальш к стене, боковая фальшпанель (добор 32 — первая плита, вторая на клею), угловая фальш 100×16 торцом (не планка из фасада —
    // та на эксцентриках, fastenerCounts: cornerStrip → 4)
    else if (/^(wall-filler|side-panel):(left|right)$/.test(p.id) || (/^corner-filler:(left|right)$/.test(p.id) && p.size[2] > p.size[0]))
      out.fillerScrews += fillerScrewCount(Math.max(...p.size));
  }
  return out;
}
