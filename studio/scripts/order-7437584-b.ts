// Заказ 7437584, изделия 2, 4, 5 — сборка функциями калькулятора (палитра + функции модели), как это делает менеджер мышью.
// Запуск: npx tsx scripts/order-7437584-b.ts [out.json]  → по умолчанию public/local-projects/order-7437584-b.json (личный проект, не git).
// Данные клиента здесь не записываются — только номер заказа.
// Изделие 2 — шкаф-купе 1660 × 2600 × 600 (двери внутри, корпус 500 + зона дверей 100), ЛДСП Клауд (материал не указан — допущение):
//   цоколь 100; антресоль 500 — жёсткая полка во всю ширину; левая секция 816 внутри — вешалка в два яруса на вертикальной трубе;
//   справа две колонки 390 внутри: 4 ящика по 200 (скрытые Unihopper с доводчиком, «зазор 30» — хват за верх фасада), над ящиками
//   полка-крышка и 3 полки (1-я и 3-я над ящиками съёмные, 2-я жёсткая); двери купе 2 полотна — ЛДСП Клауд (материал не указан — вопрос).
// Изделие 4 — ТВ-зона 2600 × 832 × 300, ЛДСП Тэффи: справа два комода 900 × 800 × 284 (цоколь 80, ящики 260 + 260 + 200 снизу вверх,
//   скрытые Unihopper с доводчиком, торцевая ручка на верхней кромке фасада), слева подвесной ящик 800 × 200 × 284 (push, DTC) под столешницей,
//   столешница ЛДСП 32 (16 + 16 склейкой) 2600 × 320 на всю длину.
// Изделие 5 — подвесной ящик 600 × 200 × 284, push, скрытые DTC, ЛДСП Тэффи (как ТВ-зона — допущение).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { initialModule, section, validate, parts, boxes, setRodTiers, drawerConfig, type Module } from "../src/model";
import { createKupeWardrobe, assembleModule, hangingDrawer } from "../src/paletteBuild";
import { setWorktopMaterial } from "../src/kitchen";
import { partCollisions } from "../src/collisions";
import { parseProject, projectErrors, applyAutoFillers, type Project, type PlacedModule } from "../src/project";
import { estimate } from "../src/pricing";
import { modulePrices } from "../src/itemPrices";
import { handleById } from "../src/handles";

export const CLOUD = "Клауд", TEFFY = "Тэффи";
// Ручка ящиков комода (ответ Макса 26.10): HEXA L-1200 чёрный мат как торцевая — если помещается; на фасаде 896 не помещается
// (validate: «Ручка 1200 мм длиннее фасада», длину ручки в студии задать нельзя) → HEXA 160 чёрный мат (hexa160b), как решил Макс.
export const EDGE_HANDLE = "hexa160b";
const look = (decor: string): Module => ({ ...initialModule(), decor, facadeDecor: decor });
const frac = (b: { bottom: number; top: number }, y: number) => Math.round(((y - b.bottom) / (b.top - b.bottom)) * 10000) / 10000;

/** Изделие 2: корпус шкафа-купе и двери купе (2 полотна). x, z — левый задний угол. */
// Раскладка — как у менеджера мышью (scripts/order-7437584-b-manager.ts): помещение 9000, купе палитра ставит на x 1690, z 33; ТВ-зона правее.
export function product2(x = 1690, z = 33): PlacedModule[] {
  const [bodyP, doorsP] = createKupeWardrobe(1660, 2600, 600, look(CLOUD), 2, "inside");
  const m = bodyP.module;
  m.name = "Изделие 2 · корпус шкафа-купе";
  m.plinthHeight = 100;
  m.sections = [section(), section(), section()];
  const inner = 1660 - 4 * 16; // 1596: 816 + 390 + 390
  [816, 390, 390].forEach((w, i) => (m.sections[i].weight = w / inner));
  const bb = boxes(m);
  const ANT = 2600 - 500 - 8; // центр полки антресоли: низ антресоли 2084, верх полки 2100 (антресоль 500 до верха)
  // левая: полка антресоли (жёсткая) и вешалка в два яруса на трубе
  const L = m.sections[0];
  L.shelves = [frac(bb[0], ANT)]; L.fixed = [0]; L.rod = true;
  setRodTiers(m, L, true);
  // правые колонки: 4 ящика по 200, над ними полка-крышка (ставит студия), 3 полки до антресоли (шаг 292), 1-я и 3-я съёмные
  for (const k of [1, 2]) {
    const s = m.sections[k], b = bb[k];
    s.drawers = 4; s.drawerGrip = true;
    s.drawerConfigs = Array.from({ length: 4 }, (_, j) => ({ ...drawerConfig(m, s, j), slide: "gtv0fpo" as const, operation: "soft-close" as const, brand: "unihopper" as const, height: 160, length: 450, y: j * 200 }));
    const cap = b.bottom + 800 + 8, step = (ANT - cap) / 4;
    s.shelves = [frac(b, ANT), frac(b, cap + step), frac(b, cap + 2 * step), frac(b, cap + 3 * step)];
    s.fixed = [0, 2];
  }
  const d = doorsP.module;
  d.name = "Изделие 2 · двери купе";
  d.kupe!.fills = [CLOUD, CLOUD];
  // корпус стоит x…x+1660, двери — между боковинами (как в палитре)
  return [{ ...bodyP, x, z }, { ...doorsP, x: x + 16, z: z + m.depth }];
}
/** Изделие 4: ТВ-зона — подвесной ящик слева, два комода 900 справа, столешница ЛДСП 32 на всю длину. */
export function product4(x = 3700, z = 33): PlacedModule[] {
  const out: PlacedModule[] = [];
  const hang = hangingDrawer(800, 200, 284, look(TEFFY)); hang.name = "Изделие 4 · подвесной ящик";
  out.push({ id: "p4-hang", x, y: 800 - 200, z, rotation: 0, module: hang });
  for (const k of [0, 1]) {
    const m = assembleModule("drawers", 900, 800, 284, look(TEFFY));
    m.name = "Изделие 4 · комод " + (k + 1); m.plinthHeight = 80;
    const s = m.sections[0], b = boxes(m)[0];
    // фасады снизу вверх 308 / 258 / 198 (ответ Макса 26.10: видимого цоколя нет, нижний фасад закрывает цоколь до 30 от пола; ТЗ 260+260+200):
    // шаги ящиков 244 + 260 + остаток до крыши, короба = шаг − 40
    const pitches = [244, 260, b.top - b.bottom - 504];
    let y = 0;
    s.drawers = 3;
    s.drawerConfigs = pitches.map((p, j) => { const c = { ...drawerConfig(m, s, j), slide: "gtv0fpo" as const, operation: "soft-close" as const, brand: "unihopper" as const, height: p - 40, length: 250, y }; y += p; return c; });
    s.drawerCap = false;
    m.drawerHandleId = EDGE_HANDLE; // как «Ручки ящиков» в панели: одна ручка на все ящики корпуса
    out.push({ id: "p4-kom" + k, x: x + 800 + k * 900, y: 0, z, rotation: 0, module: m });
  }
  const top = assembleModule("worktop", 2600, 32, 320, look(TEFFY));
  setWorktopMaterial(top, "ldsp", 32);
  top.name = "Изделие 4 · столешница";
  out.push({ id: "p4-top", x, y: 800, z, rotation: 0, module: top });
  return out;
}
/** Изделие 5: подвесной ящик 600 × 200 × 284 (низ на 900 от пола — высота в ТЗ не указана). */
export function product5(x = 7000, z = 33): PlacedModule[] {
  const m = hangingDrawer(600, 200, 284, look(TEFFY)); m.name = "Изделие 5 · подвесной ящик";
  return [{ id: "p5", x, y: 900, z, rotation: 0, module: m }];
}
export function orderProject(): Project {
  const p: Project = {
    version: 3,
    measurement: { number: "7437584", date: "2026-10-26", notes: "Изделия 2, 4, 5 по ТЗ (эскизы дизайнера). Изделия 1 и 3 — отдельный расчёт." },
    room: { width: 9000, depth: 3000, height: 2800, openings: [], obstacles: [] },
    modules: [...product2(), ...product4(), ...product5()],
    calculation: { markup: 2.2, overrides: {}, model: "sheet", sheetPrice: 23000 },
  } as Project;
  return applyAutoFillers(parseProject(JSON.parse(JSON.stringify(p))));
}
export const PRODUCTS: [string, RegExp][] = [["Изделие 2 · шкаф-купе", /^Изделие 2/], ["Изделие 4 · ТВ-зона", /^Изделие 4/], ["Изделие 5 · подвесной ящик", /^Изделие 5/]];

if (process.argv[1]?.endsWith("order-7437584-b.ts")) {
  const out = process.argv[2] ?? "public/local-projects/order-7437584-b.json";
  const p = orderProject();
  let bad = 0;
  for (const a of p.modules) {
    const v = validate(a.module), c = a.module.kupe || a.module.worktop ? [] : partCollisions(parts(a.module), a.module);
    if (v.length || c.length) bad++;
    console.log(`${a.module.name}: ${a.module.width}×${a.module.height}×${a.module.depth} @ x${a.x} y${a.y ?? 0} · ошибки: ${v.join(" | ") || "нет"} · пересечений ${c.length}${c.length ? " — " + c.slice(0, 3).map((x) => x.names.join(" × ")).join("; ") : ""}`);
  }
  const pe = projectErrors(p);
  console.log("Ошибки проекта:", pe.length ? pe.join(" | ") : "нет");
  console.log("Ручка ящиков комода:", handleById(EDGE_HANDLE).label);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(p, null, 1));
  const e = estimate(p);
  const total = e.byMarkup ?? e.bySheet;
  console.log(`Итог (коэффициент ${e.markup}): ${total?.toLocaleString("ru-RU")} ₽; листов ЛДСП ${e.ldspSheets}; материалы ${e.split.material.toLocaleString("ru-RU")} · фурнитура ${e.split.hardware.toLocaleString("ru-RU")} · розница ${e.retailExtras.toLocaleString("ru-RU")}`);
  const mp = modulePrices(p, total ?? null) ?? [];
  for (const [label, re] of PRODUCTS) {
    const sum = p.modules.reduce((s, a, i) => (re.test(a.module.name) ? s + (mp[i] ?? 0) : s), 0);
    const sub = { ...p, modules: p.modules.filter((a) => re.test(a.module.name)) } as Project, es = estimate(sub);
    console.log(`${label}: доля итога ${sum.toLocaleString("ru-RU")} ₽ · отдельно ${(es.byMarkup ?? es.bySheet)?.toLocaleString("ru-RU")} ₽ (листов ${es.ldspSheets})`);
  }
  console.log("Без цены / после финального расчёта:", e.missing.map((l) => l.label).join("; ") || "нет");
  console.log("Ключи estimate:", Object.keys(e).join(", "));
  process.exitCode = bad || pe.length ? 1 : 0;
}
