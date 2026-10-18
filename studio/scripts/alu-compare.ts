// Сверка цен рамочных алюминиевых фасадов: студия (alu.ts → смета) против калькулятора фасадов ALU.
// npx tsx scripts/alu-compare.ts — печатает таблицу 5 эталонных случаев (эталон калькулятора — tests/alu-calc.test.ts).
// ВАЖНО: совпадает цена ФАСАДА (профиль + наполнение + уплотнитель). Полная цена вместе с петлями у студии и калькулятора РАЗНАЯ:
//  - число петель: калькулятор — 2 до 1200 мм высоты, 3 выше; студия — правило цеха hingeCount (2 до 900, 3 до 1600, 4 до 2000,
//    5 выше, +1 при ширине больше 450), как у всех распашных фасадов шкафов (решение Макса: шкафы не трогать);
//  - цена петли: калькулятор — 220 × 2 = 440 ₽ за GTV стандарт; студия — строка фурнитуры GTV с доводчиком по своему прайсу
//    и общей наценке (решение: петли и фурнитура — отдельными строками сметы, не внутри цены фасада).
// Поэтому «фасад + петли» в студии не равен итогу калькулятора (например, 446×1996: 12 134,50 + 4 петли студии против 13 455).
// Случай 4 («Мору (Флутис)») есть только в незакоммиченной правке групп наполнений калькулятора (см. ALU_CALC_SOURCE в aluData.ts).
import { aluFacadePrice, ALU_FILLS } from "../src/alu";
import { hingeCount, HINGE_BRANDS } from "../src/hardware";
import { MARKUP_DEFAULT } from "../src/pricing";
export const ALU_CASES = [
  { profile: "F1-09", w: 396, h: 716, fill: "Стекло прозрачное 4мм", calc: 5859, calcNoHinge: 4978.99, calcHinges: 2 },
  { profile: "F1-17", w: 446, h: 1996, fill: "Стекло сатин матовый 4мм", calc: 13455, calcNoHinge: 12134.5, calcHinges: 3 },
  { profile: "F1-19", w: 596, h: 2396, fill: "Зеркало Серебро 4мм", calc: 27478, calcNoHinge: 26158.37, calcHinges: 3 },
  { profile: "F1-17", w: 296, h: 916, fill: "Мору (Флутис)", calc: 8097, calcNoHinge: 7217.14, calcHinges: 2 },
  { profile: "F1-19", w: 896, h: 356, fill: "Лакобель 9005 — чёрный", calc: 11431, calcNoHinge: 10550.97, calcHinges: 2 },
] as const;
if (process.argv[1]?.endsWith("alu-compare.ts")) {
  const hinge = HINGE_BRANDS.gtv.soft.price * MARKUP_DEFAULT;
  console.log("профиль | размер | наполнение | калькулятор без петель | студия без петель | петли калькулятор | петли студия (шт × ₽)");
  for (const c of ALU_CASES) {
    const f = ALU_FILLS.find((x) => x.label === c.fill)!, s = aluFacadePrice({ profile: c.profile, color: "silver", insert: f.id }, c.w, c.h);
    const n = hingeCount(c.h, c.w);
    console.log(`${c.profile} | ${c.w}×${c.h} | ${c.fill} | ${c.calcNoHinge} | ${Math.round(s.total * 100) / 100} | ${c.calcHinges} × 440 = ${c.calcHinges * 440} | ${n} × ${hinge.toFixed(1)} = ${Math.round(n * hinge)}`);
    console.log(`   с петлями: калькулятор ${c.calc}, студия ${Math.round(s.total + n * hinge)} — ${Math.round(s.total + n * hinge) === c.calc ? "совпадает" : "РАЗНАЯ: другое число и цена петель (см. шапку)"}`);
  }
}
