// Заказ 7176141 — офис, 1 этаж (дизайн-проект: планировка «Мебель» лист 6, развёртки 16–32, визуализация).
// Запуск: npx tsx scripts/order-7176141.ts → public/local-projects/7176141-*.json (комнаты, личные — в публикацию не идут),
// D:\AI-cache\dizain-1etazh\items\*.json (по одному типу изделия, N штук — цена за штуку) и prices.json (сводка).
// Размеры — по плану (см) и развёрткам (высоты): столы 75, шкафы со стеклом 205 (низ 85 + стекло 120), гардеробы 230, стеллажи 200.
// Декоры подобраны по визуализации: кабинет 1 — «Слэйт» (светлый тёплый серый, как на рендере; «Клауд» темнее), кабинет 2 — «Дуб Вотан»/«Белый», охрана — «Графит» + «Дуб Вотан»,
// мастерская и склад — «Графит», столы мастерской — «Серый 7810». Экраны настольные в студии не строятся — в сводке отдельно.
import { writeFileSync, mkdirSync } from "node:fs";
import { initialModule, section, type Module, type Section } from "../src/model";
import { parseProject, projectErrors, applyAutoFillers, type Project, type PlacedModule } from "../src/project";
import { estimate } from "../src/pricing";

const OUT = "D:/AI-cache/dizain-1etazh";
mkdirSync(`${OUT}/items`, { recursive: true });
mkdirSync("public/local-projects", { recursive: true });
let n = 0;
const nid = () => "m" + (++n);
type Sec = Partial<Section>;
function mod(name: string, w: number, h: number, d: number, decor: string, facade: string, patch: Partial<Module>, secs: Sec[]): Module {
  const m = initialModule();
  // autoFillersOff: отдельностоящая офисная мебель — фальши к стенам не нужны (иначе автофальш наезжает на соседний корпус)
  Object.assign(m, { name, width: w, height: h, depth: d, decor, facadeDecor: facade, plinthHeight: 60, hingeBrand: "gtv", doors: true, autoFillersOff: true }, patch);
  m.sections = secs.map((s) => ({ ...section(), ...s }));
  return m;
}
const place = (module: Module, x: number, z: number, y = 0, rotation = 0): PlacedModule => ({ id: nid(), x, z, y, rotation, module: structuredClone(module) });

// ---------- изделия ----------
const desk = (name: string, w: number, d: number, decor: string, h = 750) =>
  mod(name, w, h, d, decor, decor, { doors: false, plinthHeight: 0, backType: "none", desk: { sides: "both", apron: 100 } }, [{}]);
// Тумба-приставка к столу (на плане «110» пунктиром под столешницей, на развёртках — низкий корпус ~65 см с дверями)
const tumbaPr = (decor: string, facade: string) => mod("Тумба-приставка 1100×450×650", 1100, 650, 450, decor, facade, { plinthHeight: 0, feet: { height: 30 } }, [{ doorLeaves: 2, shelves: [0.5] }]);
// Подкатная тумба 3 ящика (по визуализации у каждого рабочего места)
const pedestal = (decor: string) => mod("Тумба подкатная 3 ящика 400×500×600", 400, 600, 500, decor, decor, { doors: false, plinthHeight: 0, feet: { height: 20 } }, [{ drawers: 3, drawerCap: false }]);
// Шкаф со стеклом: низ 850 на 2 двери ЛДСП + верх 1200 рамочные двери со стеклом (F1-09 серебро, стекло прозрачное 4 мм)
const glassLow = (w: number, decor: string, facade: string) => mod(`Шкаф ${w}×450 · низ 850`, w, 850, 450, decor, facade, {}, [{ doorLeaves: 2, shelves: [0.5] }]);
const glassTop = (w: number, decor: string) => mod(`Шкаф ${w}×450 · верх со стеклом 1200`, w, 1200, 450, decor, decor, { plinthHeight: 0, alu: { profile: "F1-09", color: "silver", insert: "glass-clear" } }, [{ doorLeaves: 2, shelves: [0.34, 0.67] }]);
const wardrobe = (w: number, decor: string, h = 2300) => mod(`Шкаф-гардероб ${w}×450×${h}`, w, h, 450, decor, decor, {}, [{ doorLeaves: 2, shelves: [0.86], pullouts: 1 }]);
const food = (w: number, d: number, h: number, decor: string, facade: string) => mod(`Пищевой блок ${w}×${d}×${h}`, w, h, d, decor, facade, {}, [{ doorLeaves: 2, shelves: [0.5] }]);
const penal = (decor: string, facade: string) => mod("Пенал 500×450×2050", 500, 2050, 450, decor, facade, {}, [{ doorLeaves: 1, shelves: [0.2, 0.4, 0.6, 0.8] }]);
const rack = (w: number, decor: string, h = 2000, d = 450) => {
  const cols = w > 1200 ? 3 : 2;
  return mod(`Стеллаж открытый ${w}×${d}×${h}`, w, h, d, decor, decor, { doors: false }, Array.from({ length: cols }, () => ({ shelves: [0.25, 0.5, 0.75], fixed: [0, 1, 2] })));
};
const hangShelf = mod("Полка навесная открытая 400×250×1000", 400, 1000, 250, "Дуб Вотан", "Дуб Вотан", { doors: false, plinthHeight: 0, hanging: true }, [{ shelves: [0.33, 0.66] }]);

// Охрана: стол 1760×700 + тумба 3 ящика (по визуализации), шкаф-комбинация 1800×400×2050 из трёх колонн
const guardDesk = desk("Стол охранника 1760×700", 1760, 700, "Дуб Вотан");
const guardPed = mod("Тумба 3 ящика 400×600×700 (под стол охраны)", 400, 700, 600, "Дуб Вотан", "Дуб Вотан", { doors: false, plinthHeight: 0, feet: { height: 20 } }, [{ drawers: 3, drawerCap: false }]);
const G = "Графит";
const comboA = mod("Шкаф-комбинация · колонна 530 (дверь + 2 ящика)", 530, 2050, 400, G, G, {}, [{ doorLeaves: 1, externalDrawers: true, drawers: 2, shelves: [0.55, 0.75] }]);
const comboBlow = mod("Шкаф-комбинация · колонна 720 низ (2 двери)", 720, 850, 400, G, G, {}, [{ doorLeaves: 2, shelves: [0.5] }]);
const comboBtop = mod("Шкаф-комбинация · колонна 720 верх (открытые полки)", 720, 1200, 400, "Дуб Вотан", G, { doors: false, plinthHeight: 0 }, [{ shelves: [0.25, 0.5, 0.75] }]);
const comboClow = mod("Шкаф-комбинация · колонна 530 низ (дверь)", 530, 850, 400, G, G, {}, [{ doorLeaves: 1, shelves: [0.5] }]);
const comboCniche = mod("Шкаф-комбинация · колонна 530 ниша под СВЧ", 530, 400, 400, G, G, { doors: false, plinthHeight: 0 }, [{}]);
const comboCtop = mod("Шкаф-комбинация · колонна 530 верх (дверь)", 530, 800, 400, G, G, { plinthHeight: 0 }, [{ doorLeaves: 1, shelves: [0.5] }]);

// ---------- типы изделий для сметы: id, позиция, комната, количество, сборка (модули одного изделия) ----------
type Item = { id: string; title: string; room: string; qty: number; parts: { m: Module; dx: number; dz: number; y?: number; rot?: number }[]; w: number; d: number; note?: string };
const one = (m: Module): Item["parts"] => [{ m, dx: 0, dz: 0 }];
const K1 = "Слэйт", V = "Дуб Вотан", W = "Белый";
const items: Item[] = [
  { id: "k1-desk1600", title: "Стол 1600×700×750 на опорах-боковинах", room: "Кабинет 1 (специалисты)", qty: 12, parts: one(desk("Стол 1600×700", 1600, 700, K1)), w: 1600, d: 700 },
  { id: "k1-desk1400", title: "Стол 1400×700×750 на опорах-боковинах", room: "Кабинет 1 (специалисты)", qty: 5, parts: one(desk("Стол 1400×700", 1400, 700, K1)), w: 1400, d: 700 },
  { id: "k1-tumba", title: "Тумба-приставка 1100×450×650, 2 двери", room: "Кабинет 1 (специалисты)", qty: 11, parts: one(tumbaPr(K1, K1)), w: 1100, d: 450, note: "на развёртке двери купе — в студии распашные" },
  { id: "k1-ped", title: "Тумба подкатная 3 ящика 400×500×600", room: "Кабинет 1 (специалисты)", qty: 17, parts: one(pedestal(K1)), w: 400, d: 500, note: "по визуализации, на плане не обозначена; колёса не заложены" },
  { id: "k1-glass900", title: "Шкаф 900×450×2050, верх стекло в рамке", room: "Кабинет 1 (специалисты)", qty: 4, parts: [{ m: glassLow(900, K1, K1), dx: 0, dz: 0 }, { m: glassTop(900, K1), dx: 0, dz: 0, y: 850 }], w: 900, d: 450 },
  { id: "k1-wardrobe", title: "Шкаф-гардероб 2000×450×2300, 4 двери (2 корпуса)", room: "Кабинет 1 (специалисты)", qty: 1, parts: [{ m: wardrobe(1000, K1), dx: 0, dz: 0 }, { m: wardrobe(1000, K1), dx: 1000, dz: 0 }], w: 2000, d: 450 },
  { id: "k1-food", title: "Пищевой блок 1000×550×850, 2 двери", room: "Кабинет 1 (специалисты)", qty: 1, parts: one(food(1000, 550, 850, K1, K1)), w: 1000, d: 550 },
  { id: "k2-desk", title: "Стол руководителя 1600×700×750", room: "Кабинет 2 (начальник, зам.)", qty: 2, parts: one(desk("Стол руководителя 1600×700", 1600, 700, V)), w: 1600, d: 700 },
  { id: "k2-tumba", title: "Тумба-приставка 1100×450×650, 2 двери", room: "Кабинет 2 (начальник, зам.)", qty: 2, parts: one(tumbaPr(V, W)), w: 1100, d: 450 },
  { id: "k2-glass1200", title: "Шкаф 1200×450×2050, верх стекло в рамке", room: "Кабинет 2 (начальник, зам.)", qty: 1, parts: [{ m: glassLow(1200, V, W), dx: 0, dz: 0 }, { m: glassTop(1200, V), dx: 0, dz: 0, y: 850 }], w: 1200, d: 450 },
  { id: "k2-penal", title: "Пенал 500×450×2050, 1 дверь", room: "Кабинет 2 (начальник, зам.)", qty: 1, parts: one(penal(V, W)), w: 500, d: 450 },
  { id: "k2-food", title: "Пищевой блок 1200×450×750, 2 двери", room: "Кабинет 2 (начальник, зам.)", qty: 1, parts: one(food(1200, 450, 750, V, W)), w: 1200, d: 450 },
  { id: "oh-desk", title: "Стол охранника 1760×700 + тумба 3 ящика", room: "Охрана", qty: 1, parts: [{ m: guardDesk, dx: 0, dz: 0 }, { m: guardPed, dx: 1760 - 420, dz: 80 }], w: 1760, d: 700 },
  { id: "oh-shelf", title: "Полка навесная открытая 400×250×1000", room: "Охрана", qty: 1, parts: [{ m: hangShelf, dx: 0, dz: 0, y: 1000 }], w: 400, d: 250 },
  { id: "oh-combo", title: "Шкаф-комбинация 1800×400×2050 (ящики, полки, ниша СВЧ)", room: "Охрана", qty: 1,
    parts: [{ m: comboA, dx: 0, dz: 0 }, { m: comboBlow, dx: 530, dz: 0 }, { m: comboBtop, dx: 530, dz: 0, y: 850 }, { m: comboClow, dx: 1250, dz: 0 }, { m: comboCniche, dx: 1250, dz: 0, y: 850 }, { m: comboCtop, dx: 1250, dz: 0, y: 1250 }], w: 1780, d: 400 },
  { id: "ms-bench385", title: "Стол-верстак рабочего стенда 3850×700×750 (2 столешницы)", room: "Мастерская", qty: 1, parts: [{ m: desk("Стол стенда 1925×700", 1925, 700, "Серый 7810"), dx: 0, dz: 0 }, { m: desk("Стол стенда 1925×700", 1925, 700, "Серый 7810"), dx: 1925, dz: 0 }], w: 3850, d: 700, note: "панель стенда с приборами — оборудование, не корпусная мебель" },
  { id: "ms-bench262", title: "Стол-верстак рабочего стенда 2620×700×750 (2 столешницы)", room: "Мастерская", qty: 1, parts: [{ m: desk("Стол стенда 1310×700", 1310, 700, "Серый 7810"), dx: 0, dz: 0 }, { m: desk("Стол стенда 1310×700", 1310, 700, "Серый 7810"), dx: 1310, dz: 0 }], w: 2620, d: 700 },
  { id: "ms-rack", title: "Стеллаж открытый 1000×450×2000, ячейки 2×4", room: "Мастерская", qty: 1, parts: one(rack(1000, G)), w: 1000, d: 450 },
  { id: "ms-wardrobe", title: "Шкаф-гардероб 1000×450×2300, 2 двери", room: "Мастерская", qty: 1, parts: one(wardrobe(1000, G)), w: 1000, d: 450 },
  { id: "sk-rack1000", title: "Стеллаж открытый 1000×450×2000", room: "Склад мастерской", qty: 5, parts: one(rack(1000, G)), w: 1000, d: 450 },
  { id: "sk-rack870", title: "Стеллаж открытый 870×450×2000", room: "Склад мастерской", qty: 1, parts: one(rack(870, G)), w: 870, d: 450 },
  { id: "sk-rack920", title: "Стеллаж открытый 920×450×2000", room: "Склад мастерской", qty: 1, parts: one(rack(920, G)), w: 920, d: 450 },
  { id: "sk-rack1030", title: "Стеллаж открытый 1030×450×2000", room: "Склад мастерской", qty: 1, parts: one(rack(1030, G)), w: 1030, d: 450 },
  { id: "sk-rack1330", title: "Стеллаж открытый 1330×450×2000 (2 корпуса по 665)", room: "Склад мастерской", qty: 1, parts: [0, 665].map((dx) => ({ m: mod("Стеллаж открытый 665×450×2000", 665, 2000, 450, G, G, { doors: false }, [{ shelves: [0.25, 0.5, 0.75], fixed: [0, 1, 2] }]), dx, dz: 0 })), w: 1330, d: 450, note: "модуль студии до 1300 мм — два корпуса" },
];

const calc = { markup: 2.2, overrides: {}, model: "sheet" as const, sheetPrice: 23000 };
function save(p: Project, file: string) {
  const parsed = applyAutoFillers(parseProject(JSON.parse(JSON.stringify(p))));
  writeFileSync(file, JSON.stringify(parsed, null, 1));
  return parsed;
}
const price = (p: Project) => {
  const e = estimate(p);
  const markup = e.byMarkup ?? e.byMarkupKnown;
  return { sheets: e.ldspSheets, bySheet: e.bySheet, byMarkup: markup, client: Math.max(e.bySheet, markup), missing: e.missing.map((l) => l.label), split: e.split };
};

// ---------- цена за штуку: N копий изделия в одном проекте (листы общие), итог / N; плюс снимок одного изделия ----------
const summary: any[] = [], groups: Project[] = [];
for (const it of items) {
  const gap = 300, mods: PlacedModule[] = [], cols = Math.min(it.qty, Math.floor(19000 / (it.w + gap))), rowsN = Math.ceil(it.qty / cols);
  for (let k = 0; k < it.qty; k++) for (const p of it.parts) mods.push(place(p.m, 300 + (k % cols) * (it.w + gap) + p.dx, 300 + Math.floor(k / cols) * (it.d + 900) + p.dz, p.y ?? 0, p.rot ?? 0));
  const group: Project = { version: 3, room: { width: 600 + cols * (it.w + gap), depth: rowsN * (it.d + 900) + 600, height: 2800, openings: [] }, modules: mods, calculation: calc };
  const g = save(group, `${OUT}/items/${it.id}-x${it.qty}.json`);
  groups.push(g);
  const errs = projectErrors(g);
  const pr = price(g);
  const single: Project = { version: 3, measurement: { number: "7176141", date: "2026-10-27", notes: `${it.room}: ${it.title}, ${it.qty} шт.` },
    room: { width: it.w + 1200, depth: it.d + 1500, height: 2600, openings: [] },
    modules: it.parts.map((p) => place(p.m, 600 + p.dx, 600 + p.dz, p.y ?? 0, p.rot ?? 0)), calculation: calc };
  const s = save(single, `public/local-projects/7176141-${it.id}.json`);
  const ps = price(s);
  // доля для распределения итога: себестоимость × коэффициент на партии до 10 шт (листы почти не округляются) — штучные позиции не дороже соседних
  const nA = Math.max(it.qty, Math.min(10, Math.floor(40 / it.parts.length))), colsA = Math.min(nA, Math.floor(19000 / (it.w + gap))), modsA: PlacedModule[] = [];
  for (let k = 0; k < nA; k++) for (const p of it.parts) modsA.push(place(p.m, 300 + (k % colsA) * (it.w + gap) + p.dx, 300 + Math.floor(k / colsA) * (it.d + 900) + p.dz, p.y ?? 0, p.rot ?? 0));
  const pa = price(applyAutoFillers(parseProject(JSON.parse(JSON.stringify({ version: 3, room: { width: 600 + colsA * (it.w + gap), depth: Math.ceil(nA / colsA) * (it.d + 900) + 600, height: 2800, openings: [] }, modules: modsA, calculation: calc })))));
  const allocUnit = pa.byMarkup / nA;
  summary.push({ ...it, parts: undefined, unit: Math.round(pr.client / it.qty / 100) * 100, total: pr.client, sheets: pr.sheets, bySheet: pr.bySheet, byMarkup: pr.byMarkup,
    singleClient: ps.client, singleSheets: ps.sheets, allocUnit, missing: pr.missing, errors: errs });
  console.log(`${it.id.padEnd(14)} ×${String(it.qty).padStart(2)}  листов ${pr.sheets}  по листу ${pr.bySheet}  по коэф ${pr.byMarkup}  → за шт ${Math.round(pr.client / it.qty)}  ${errs.length ? "ОШИБКИ: " + errs.join(" | ") : ""}${pr.missing.length ? " без цены: " + pr.missing.join("; ") : ""}`);
}

// ---------- комнаты: расстановка по листу 6 условная (группы, стены, проходы), без пересечений; не больше 40 корпусов в проекте ----------
// Повороты: 0 — фасадом к +z (задняя стена z=0); 90/270 — корпус вдоль z (занимает x..x+глубина, z..z+ширина); 180 — фасадом к задней стене.
const rooms: { key: string; title: string; room: Project["room"]; mods: PlacedModule[] }[] = [];
const room = (key: string, title: string, width: number, depth: number) => { const r = { key, title, room: { width, depth, height: 3400, openings: [] }, mods: [] as PlacedModule[] }; rooms.push(r); return r.mods; };
const at = (m: Module, x: number, z: number, rot = 0, y = 0) => place(m, x, z, y, rot);
const I = Object.fromEntries(items.map((it) => [it.id, it.parts]));
const d16 = I["k1-desk1600"][0].m, d14 = I["k1-desk1400"][0].m, tp = I["k1-tumba"][0].m, pd = I["k1-ped"][0].m;
// Г-образное место: стол 1600 вдоль стены, приставка 1100 торцом к правому краю стола, подкатная тумба под левым краем
const lPlace = (x: number, z: number) => [at(d16, x, z), at(tp, x + 1603, z, 90), at(pd, x + 100, z + 150)];
const glass = (parts: Item["parts"], x: number, z: number, rot = 0) => parts.map((p) => at(p.m, x, z, rot, p.y ?? 0));
// Кабинет 1: 12160 × 7300; два проекта — левая половина (группы A, B, C, D) и правая (F, G, H)
const k1a = room("k1a", "Кабинет 1 — левая половина (группы A–D)", 12160, 7300);
for (const [x, z] of [[100, 800], [2300, 800], [4500, 800], [100, 2900], [2300, 2900], [4500, 2900], [100, 5000]]) k1a.push(...lPlace(x, z));
k1a.push(at(d16, 2300, 5000), at(pd, 2400, 5150));                                        // D — прямой стол
k1a.push(...glass(I["k1-glass900"], 300, 3), ...glass(I["k1-glass900"], 3300, 3));
k1a.push(at(I["k1-food"][0].m, 4300, 7300 - 553, 180));
const k1b = room("k1b", "Кабинет 1 — правая половина (группы F–H)", 12160, 7300);
for (const [x, z] of [[6400, 800], [8600, 800], [6400, 2900], [8600, 2900]]) k1b.push(...lPlace(x, z));
for (const z of [800, 2500]) k1b.push(at(d14, 10850, z, 90), at(pd, 11000, z + 100));     // G — столы 1400 торцом к окну
for (const x of [6400, 7900, 9400]) k1b.push(at(d14, x, 5200), at(pd, x + 100, 5350));     // H — 3 стола 1400
k1b.push(...glass(I["k1-glass900"], 6600, 3), ...glass(I["k1-glass900"], 9600, 3));
k1b.push(...I["k1-wardrobe"].map((p) => at(p.m, 12160 - 453, 3800 + p.dx * 1.002, 270)));
// Кабинет 2: 2770 × 6900
const k2 = room("k2", "Кабинет 2", 2770, 6900);
for (const z of [1500, 3300]) k2.push(at(I["k2-desk"][0].m, 200, z), at(I["k2-tumba"][0].m, 1803, z, 90));
k2.push(at(I["k2-food"][0].m, 0, 3));
k2.push(...glass(I["k2-glass1200"], 3, 4700, 90), at(I["k2-penal"][0].m, 3, 5902, 90));
// Охрана: 1800 × 2480
const oh = room("oh", "Охрана", 1800, 2480);
oh.push(...I["oh-desk"].map((p) => at(p.m, 20 + p.dx, p.dz)));
oh.push(at(I["oh-shelf"][0].m, 300, 3, 0, 1100));
oh.push(...I["oh-combo"].map((p) => at(p.m, 6 + 1780 - p.dx - p.m.width, 2480 - 403, 180, p.y ?? 0)));
// Мастерская: 6350 × 2640
const ms = room("ms", "Мастерская", 6350, 2640);
ms.push(...I["ms-bench385"].map((p) => at(p.m, 2400 + p.dx, 0)));
ms.push(...I["ms-bench262"].map((p) => at(p.m, 0, p.dx, 90)));
ms.push(at(I["ms-rack"][0].m, 3200, 2640 - 453, 180), at(I["ms-wardrobe"][0].m, 5250, 2640 - 453, 180));
// Склад мастерской: 3030 × 3680, стеллажи по периметру
const sk = room("sk", "Склад мастерской", 3030, 3680);
const r1000 = I["sk-rack1000"][0].m;
sk.push(at(r1000, 0, 3), at(r1000, 1000, 3), at(I["sk-rack1030"][0].m, 2000, 3));
sk.push(at(r1000, 3, 458, 90), at(I["sk-rack870"][0].m, 3, 1460, 90), ...I["sk-rack1330"].map((p) => at(p.m, 3, 2333 + p.dx * 1.003, 90)));
sk.push(at(I["sk-rack920"][0].m, 3030 - 453, 458, 270), at(r1000, 3030 - 453, 1380, 270));
sk.push(at(r1000, 500, 3680 - 453, 180));

const roomSummary: any[] = [];
for (const r of rooms) {
  const p: Project = { version: 3, measurement: { number: "7176141", date: "2026-10-27", notes: `${r.title}. Дизайн-проект 1 этажа, лист 6 «Мебель»; расстановка условная.` }, room: r.room, modules: r.mods, calculation: calc };
  try {
    const s = save(p, `public/local-projects/7176141-${r.key}.json`), pr = price(s);
    roomSummary.push({ key: r.key, title: r.title, modules: r.mods.length, ...pr });
    console.log(`КОМНАТА ${r.title}: корпусов ${r.mods.length}, листов ${pr.sheets}, по листу ${pr.bySheet}, по коэф ${pr.byMarkup} → ${pr.client}`);
  } catch (e) {
    const errs = [(e as Error).message, ...projectErrors(JSON.parse(JSON.stringify(p)))];
    writeFileSync(`${OUT}/${r.key}-raw.json`, JSON.stringify(p));
    console.log(`КОМНАТА ${r.title}: ОШИБКИ (${errs.length}): ${errs.slice(0, 6).join(" | ") || (e as Error).message}`);
  }
}

// ---------- весь заказ = сумма смет комнат (раскрой и проект студии — до 40 корпусов) и доля каждой позиции ----------
// Цена позиции = её себестоимость × коэффициент (без округления листов) × K, где K приводит сумму позиций к итогу заказа
// (по каждой комнате больший из «по листу» и «по коэффициенту»). Так мелкие позиции не тянут на себя целый лист.
const sumOf = (k: "sheets" | "bySheet" | "byMarkup" | "client") => roomSummary.reduce((s, r) => s + r[k], 0);
const order = { sheets: sumOf("sheets"), bySheet: sumOf("bySheet"), byMarkup: sumOf("byMarkup"), client: sumOf("client") };
const sumMarkup = summary.reduce((s, x) => s + x.allocUnit * x.qty, 0), K = order.client / sumMarkup;
for (const x of summary) { x.unit = Math.round(x.allocUnit * K / 100) * 100; x.total = x.unit * x.qty; }
console.log(`ВЕСЬ ЗАКАЗ (${roomSummary.length} из ${rooms.length} комнат): листов ${order.sheets}, по листу ${order.bySheet}, по коэф ${order.byMarkup} → ${order.client}; K=${K.toFixed(3)}; сумма позиций ${summary.reduce((s, x) => s + x.total, 0)}`);
writeFileSync(`${OUT}/prices.json`, JSON.stringify({ items: summary, rooms: roomSummary, order: { ...order, K } }, null, 1));

