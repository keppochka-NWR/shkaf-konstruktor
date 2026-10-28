// Подсветка рабочей зоны под навесными кухонными модулями: LED-профиль снизу дна навесного у передней кромки, светит на столешницу.
// Флаг модуля — m.kitchen.underLight (только навесной, role 'wall'). Деталь — горизонталь, как подсветка в полках: по ширине проёма
// между боковинами минус 20 мм с краёв, 20 мм от передней кромки дна, под нижней пластью дна. Тон и тип — модуля (m.lightTone /
// m.lightType, как у прочей подсветки: lights.ts ledLook). Цена — горизонталь RULES.shelfLightRetailPerM (4000 ₽/пог.м клиенту, решение
// Макса 20.10.2026), своей строкой сметы «light-under» (pricing.ts); блок питания — отдельно флагом m.lightPsu (решения 26–27.10.2026).
import { RULES, type Module, type Part } from "./model";

/** id LED-детали подсветки под навесным (pricing.ts, lights.ts lightSummary). */
export const UNDER_LIGHT_ID = "kitchen-underlight";

/** Сечение профиля по типу подсветки модуля (как ledSize в model.ts): [ширина, толщина], мм. */
function underLedSize(m: Module): [number, number] {
  const type = m.lightType ?? "inset";
  return type === "surface" ? [RULES.lightSurfaceW, RULES.lightSurfaceT] : type === "tape" ? [RULES.lightTapeW, RULES.lightTapeT] : [RULES.lightProfileW, RULES.lightProfileT];
}

/** LED под дном навесного (в kitchenExtraParts, когда дно уже в списке деталей). Без дна — подсветки нет (некуда крепить). */
export function underLightParts(m: Module, out: Part[]) {
  if (!m.kitchen?.underLight || m.kitchen.role !== "wall") return;
  const bottom = out.find((p) => p.id === "bottom");
  if (!bottom) return;
  const t = RULES.panel, [lw, lt] = underLedSize(m), len = m.width - 2 * t - 40;
  if (len <= 0) return;
  const y0 = bottom.position[1] - bottom.size[1] / 2, front = bottom.position[2] + bottom.size[2] / 2;
  out.push({ id: UNDER_LIGHT_ID, name: "Подсветка LED рабочей зоны под навесным модулем", size: [len, lt, lw], position: [m.width / 2, y0 - lt / 2, front - 20 - lw / 2],
    length: len, width: lw, thickness: lt, role: "light", material: "metal", decor: "", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0] });
}

/** Включить/снять подсветку рабочей зоны у навесного модуля. */
export function setUnderLight(m: Module, on: boolean) {
  if (!m.kitchen || m.kitchen.role !== "wall") throw Error("Подсветка рабочей зоны — только у навесного кухонного модуля.");
  if (on) m.kitchen = { ...m.kitchen, underLight: true };
  else { const k = { ...m.kitchen }; delete k.underLight; m.kitchen = k; }
}
