import type { Project } from "./project";
/** «Цена по большей модели» из панели стоимости (заказ 7427796): включить — priceMax и цена листа (если её нет — текущая сметы); выключить — убрать. */
export function withPriceMax(p: Project, on: boolean, sheetPrice?: number): Project {
  const c = { ...(p.calculation ?? { markup: 2.2, overrides: {} }) };
  if (on) { c.priceMax = true; if (c.sheetPrice === undefined && sheetPrice !== undefined) c.sheetPrice = sheetPrice; } else delete c.priceMax;
  return { ...p, calculation: c };
}
