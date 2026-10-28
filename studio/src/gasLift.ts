// Подбор газлифта Premial АДАЖИО для откидного вверх фасада по весу фасада (решение Макса 26.10.2026: «усилие газлифта — по весу
// фасада»). Вес — weight.ts (площадь × толщина × плотность + зеркало; ручка — если известна масса, сейчас 0).
// Ряд усилий АДАЖИО (premial-furniture.ru, «Лифт газовый АДАЖИО стандартный 50N-120N»): 50, 60, 80, 100, 120 N; ПРЕМИУМ — 60N и 80N
// (allpremial.ru, карточки 62617/62618/59951 — 347,2 ₽). Стандартный 50–120N — 122,5 ₽ (белый) по цене сайта (решение Макса 27.10.2026,
// карточки — pricing.ts ADAGIO_STD_URL). Правило Premial: фасад шире 600 мм — 2 газлифта.
// Таблицы/формулы подбора на сайтах Premial НЕТ (проверено 26.10.2026) — усилие по моменту фасада в горизонтали:
//   F = m · g · (H / 2) / (n · плечо), плечо газлифта ≈ 80 мм (LIFT_ARM_M — допущение, уточнить по схеме установки Premial),
//   берётся ближайшее большее усилие ряда. Пример: фасад 796×500 ЛДСП 16 = 4,5 кг, 2 газлифта → 69 N → 80N.
import type { Module, Part } from "./model";
import { facadeWeight } from "./weight";

export const ADAGIO_FORCES = [50, 60, 80, 100, 120] as const;
/** Усилия серии АДАЖИО ПРЕМИУМ (ADAGIO_RETAIL в pricing.ts); остальные — стандартная серия (ADAGIO_STD_RETAIL), обе по цене сайта. */
export const ADAGIO_PREMIUM_FORCES = [60, 80] as const;
/** Плечо газлифта относительно оси петель в горизонтали фасада, м (допущение для подбора). */
export const LIFT_ARM_M = 0.08;
export const LIFT_WIDE_FACADE_MM = 600;

export type LiftChoice = {
  /** вес фасада, кг */
  weight: number;
  /** газлифтов на фасад */
  count: number;
  /** требуемое усилие на один газлифт, N */
  required: number;
  /** выбранное усилие из ряда, N; null — тяжелее 120N (нужен другой подъёмник) */
  force: number | null;
  /** серия ПРЕМИУМ 60/80N (иначе стандартная 100/120N) */
  premium: boolean;
};

/** Подбор газлифта АДАЖИО для откидного фасада (деталь-дверь с петлями сверху). */
export function adagioChoice(door: Part, m?: Module): LiftChoice {
  const weight = facadeWeight(door, m);
  const count = door.size[0] > LIFT_WIDE_FACADE_MM ? 2 : 1; // ширина фасада
  const height = door.size[1] / 1000; // высота фасада (по вертикали в закрытом положении)
  const required = Math.round((weight * 9.81 * (height / 2)) / (count * LIFT_ARM_M));
  const premium = ADAGIO_PREMIUM_FORCES.find((f) => f >= required);
  const force = premium ?? ADAGIO_FORCES.find((f) => f >= required) ?? null;
  return { weight, count, required, force, premium: premium !== undefined };
}
