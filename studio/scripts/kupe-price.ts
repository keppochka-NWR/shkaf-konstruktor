// Цена дверей купе по формуле калькулятора купе: npx tsx scripts/kupe-price.ts <ширина> <высота> <дверей> [система] [наполнение...]
// Без наполнения печатает варианты «зеркало» и первое ЛДСП, каждое без доводчиков и с ними.
import { kupeLines, kupeErrors, DEFAULT_KUPE } from "../src/kupe";
import { createKupeModule } from "../src/ModulePalette";
import { initialModule } from "../src/model";
import { KUPE_FILLS } from "../src/kupeData";

const [w, h, n, system = "Стандарт (Аристо)", ...fillArgs] = process.argv.slice(2);
const total = (m: ReturnType<typeof createKupeModule>) => Math.round(kupeLines(m).reduce((s, l) => s + l.quantity * l.unitPrice, 0));
const ldsp = KUPE_FILLS.filter((f) => /лдсп/i.test(f.g));
const fills = fillArgs.length ? fillArgs : ["Зеркало Серебро 4мм", ldsp[0]?.n ?? "Белый"];
for (const fill of fills) {
  for (const softClose of [false, true]) {
    const m = createKupeModule(Number(w), Number(h), initialModule());
    m.kupe = { ...DEFAULT_KUPE, system, doors: Number(n), fills: [fill], softClose, sections: 1 };
    const e = kupeErrors(m);
    console.log(`${system} · ${n} двери ${w}x${h} · ${fill} · доводчики ${softClose ? "да" : "нет"}: ${total(m).toLocaleString("ru-RU")} ₽${e.length ? "  ⚠ " + e.join("; ") : ""}`);
  }
}
