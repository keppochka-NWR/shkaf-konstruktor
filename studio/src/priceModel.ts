import type { Project } from "./project";
import { MARKUP_DEFAULT } from "./pricing";
/** «Модель цены» проекта (менеджер, вкладка «Стоимость»): по коэффициенту, за лист, по большей из двух (calculation.maxModel,
 *  решение Макса 26.10.2026). Интеграция 26.10: одно поле maxModel; priceMax ветки o-7427796 читается при загрузке как maxModel (project.ts). */
export function withPriceModel(p: Project, v: string, sheetPrice: number): Project {
  const c = { ...(p.calculation ?? { markup: MARKUP_DEFAULT, overrides: {} }) };
  if (v !== "markup" && c.sheetPrice === undefined && sheetPrice > 0) c.sheetPrice = sheetPrice;
  if (v === "max") c.maxModel = true;
  else { delete c.maxModel; if (v === "sheet") c.model = "sheet"; else delete c.model; }
  return { ...p, calculation: c };
}
