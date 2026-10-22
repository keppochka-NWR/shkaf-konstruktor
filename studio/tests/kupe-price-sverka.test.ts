// Критик релиза 22.10 (Q05 / CALC03): «студия 33 547 ₽, калькулятор купе 55 922 ₽» для 1500×2600, 2 двери, Стандарт, зеркало серебро.
// Сверка показала: 33 547 — студия БЕЗ доводчиков (флажок в свёрнутой «Комплектации» не был включён), а остальная разница — прайс:
// студия = калькулятор купе v2.10 (прайс −20%), web/calc в репозитории — старая копия v2.5 (прайс 29.04 без −20%).
// Тест фиксирует: доводчики считаются (N × цена за дверь) и цена доводчика видна рядом с флажком.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { kupeLines, kupeTotal, DEFAULT_KUPE } from "../src/kupe";
import { KUPE_SOFT_CLOSE } from "../src/kupeData";
import { createKupeModule } from "../src/ModulePalette";
import { initialModule, validate } from "../src/model";

test("купе 1500×2600×2 зеркало: без доводчиков 33 547, с доводчиками +2 × цена доводчика", () => {
  const m = createKupeModule(1500, 2600, initialModule());
  m.kupe = { ...DEFAULT_KUPE, system: "Стандарт (Аристо)", color: "Серебро матовое", fills: ["Зеркало Серебро 4мм"] };
  assert.deepEqual(validate(m), []);
  assert.equal(kupeTotal(kupeLines(m)), 33547, "как на снимке критика Q05 — без доводчиков");
  m.kupe = { ...m.kupe, softClose: true };
  const soft = kupeLines(m).find((l) => l.id === "kupe-soft");
  assert.ok(soft, "строка доводчиков есть");
  assert.equal(soft!.quantity, 2);
  assert.equal(soft!.unitPrice, KUPE_SOFT_CLOSE);
  assert.equal(kupeTotal(kupeLines(m)), 33547 + 2 * KUPE_SOFT_CLOSE);
});

test("купе: у флажка «Доводчики» видна цена за дверь", () => {
  const src = readFileSync(new URL("../src/KupePanel.tsx", import.meta.url), "utf8");
  assert.match(src, /Доводчики <small className="kupe-soft-price" data-testid="kupe-soft-price">\+\{KUPE_SOFT_CLOSE\.toLocaleString\("ru-RU"\)\} ₽ за дверь<\/small>/);
});
