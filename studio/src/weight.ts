// Вес изделия по деталям parts() (решение Макса 26.10.2026: «вес изделия считать — основа для выбора навесов»).
// Плита, ЛХДФ, МДФ, стекло и зеркало: площадь × толщина × плотность. Фурнитура (петли, ручки, штанги, крепёж, направляющие):
// масса — если известна (сейчас в каталогах масс нет), иначе 0 с пометкой (hardwareNoMass — сколько таких деталей).
// Выбор навесов по весу — пока НЕ делается (нужны данные навесов); hangerLoad() даёт нагрузку на навес для будущего подбора.
import { parts, type Module, type Part } from "./model";
import { aluFill, aluInsertSize } from "./alu";

/** Плотность ЛДСП, кг/м³ — 700 (решение Макса 27.10.2026; лист Lamarty 16×2750×1830 по сайтам продавцов 56,4–57,2 кг ≈ 700 кг/м³).
 *  Запас под навесы — коэффициентом при подборе (hangerLoad). */
export const LDSP_DENSITY = 700;
/** ЛХДФ (задники) ~850 кг/м³. */
export const HDF_DENSITY = 850;
/** МДФ (фасады Вернисаж и другие фасадного материала) ~750 кг/м³. */
export const MDF_DENSITY = 750;
/** Стекло и зеркало ~2 500 кг/м³. */
export const GLASS_DENSITY = 2500;
/** Зеркало на фасаде-основе (Module.mirror): 4 мм поверх фасада ЛДСП. */
export const MIRROR_THICKNESS = 4;

export type WeightBreakdown = {
  /** итого, кг (с точностью до 0,1) */
  total: number;
  board: number; hdf: number; mdf: number; glass: number; mirror: number;
  /** деталей фурнитуры без известной массы (в итог не вошли — 0 кг) */
  hardwareNoMass: number;
};

const r1 = (v: number) => Math.round(v * 10) / 10;
/** Площадь пласти детали, м² (габарит; фигурные контуры — по габариту, в запас). */
export const partArea = (p: Pick<Part, "length" | "width">) => (p.length * p.width) / 1e6;
/** Масса одной листовой детали, кг (без зеркала): площадь × толщина × плотность по материалу. Фурнитура — null (массы нет). */
/** МДФ — фасады Вернисаж и фасады стороннего материала (Module.facadeMaterial «external»); двери купе и прочее — как ЛДСП. */
const isMdf = (p: Part, m?: Module) => !!p.vernissage || (!!p.external && m?.facadeMaterial === "external" && !m?.kupe);
export function partMass(p: Part, m?: Module): number | null {
  const vol = partArea(p) * (p.thickness / 1000);
  if (p.material === "board") return vol * (isMdf(p, m) ? MDF_DENSITY : LDSP_DENSITY);
  if (p.material === "hdf") return vol * HDF_DENSITY;
  if (p.material === "glass") return vol * GLASS_DENSITY;
  // рамочный фасад ALU: вставка стекла/зеркала (фасад минус припуск профиля) × толщина наполнения × 2500 (4 мм ≈ 10 кг/м²);
  // масса профиля в данных калькулятора и прайсе МВМ не указана — не учтена (критик 29.10)
  if (p.material === "alu" && m?.alu) { const s = aluInsertSize(m.alu, p.width, p.length), t = aluFill(m.alu.insert)?.thickness ?? 4; return (Math.max(0, s.w) * Math.max(0, s.h) / 1e6) * (t / 1000) * GLASS_DENSITY; }
  return null; // metal: массы в каталогах нет
}
/** Масса зеркала на фасаде (Part.mirror), кг. */
export const mirrorMass = (p: Part) => (p.mirror ? partArea(p) * (MIRROR_THICKNESS / 1000) * GLASS_DENSITY : 0);

/** Вес изделия (модуля) по деталям. */
export function moduleWeight(m: Module): WeightBreakdown {
  const w = { board: 0, hdf: 0, mdf: 0, glass: 0, mirror: 0, hardwareNoMass: 0 };
  for (const p of parts(m)) {
    const mass = partMass(p, m);
    if (mass === null) { w.hardwareNoMass++; continue; }
    if (p.material === "board") { if (isMdf(p, m)) w.mdf += mass; else w.board += mass; }
    else if (p.material === "hdf") w.hdf += mass;
    else if (p.material === "alu") w.glass += mass;
    else w.glass += mass;
    w.mirror += mirrorMass(p);
  }
  const total = w.board + w.hdf + w.mdf + w.glass + w.mirror;
  return { total: r1(total), board: r1(w.board), hdf: r1(w.hdf), mdf: r1(w.mdf), glass: r1(w.glass), mirror: r1(w.mirror), hardwareNoMass: w.hardwareNoMass };
}
/** Вес фасада (двери, откидного фасада) по детали, кг: пласть × толщина × плотность + зеркало (ручка — если масса известна: нет → 0). */
export function facadeWeight(p: Part, m?: Module): number {
  return r1((partMass(p, m) ?? 0) + mirrorMass(p));
}
/** Подпись веса для панели и КП: «48,3» (кг). */
export const weightText = (kg: number) => kg.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Нагрузка на навес подвесного модуля (на будущее — выбор навесов по весу, решение Макса 26.10.2026): вес × запас / число навесов.
 *  Навесы — детали kitchen-hanger:* (навесные шкафы и кухни; сейчас навесы ABS). Без навесов — null. Запас по умолчанию 1,5 —
 *  уточнить у Макса вместе с паспортными нагрузками навесов. */
export function hangerLoad(m: Module, reserve = 1.5): { weight: number; hangers: number; perHanger: number } | null {
  const hangers = parts(m).filter((p) => p.id.startsWith("kitchen-hanger:")).length;
  if (!hangers) return null;
  const weight = moduleWeight(m).total;
  return { weight, hangers, perHanger: r1((weight * reserve) / hangers) };
}
