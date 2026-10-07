// Заказ 7358873-З Кофанов — шкаф-перегородка на 2 стороны между комнатой и прихожей, собран в студии по замеру 06.10.2026,
// ТЗ замерщика и проекту Леманы 02.10 (Яндекс-диск заказа, папка «Продажа»). Запуск: npx tsx scripts/order-7358873.ts
// → public/local-projects/7358873-kofanov.json (личный проект, в публикацию не идёт) + смета в консоль.
// Помещение: проём комната↔прихожая 2043 от стены до колонны, колонна 173×164, балка над проёмом низом 2222–2230 (659 от потолка),
// потолок 2900 у стены и 2889 у колонны, плинтус 50.
// ТЗ: каркас, кромка, задняя стенка, фасады — ЛДСП «Слэйт»; цоколь; петли с доводчиком; антресоль push; ящики — скрытые с доводчиком,
// открывание за фасад; купе 3 полотна (2 Слэйт, 1 зеркало), ручка-профиль узкий.
import { writeFileSync, mkdirSync } from "node:fs";
import { initialModule, section, type Module } from "../src/model";
import { parseProject, projectErrors, applyAutoFillers, type Project, type PlacedModule } from "../src/project";
import { estimate } from "../src/pricing";
import { DEFAULT_KUPE } from "../src/kupe";

let n = 0;
const nid = () => "k" + (++n);
const DECOR = "Слэйт";
function mod(name: string, w: number, h: number, d: number, patch: Partial<Module>, sections: Partial<ReturnType<typeof section>>[]): Module {
  const m = initialModule();
  Object.assign(m, { name, width: w, height: h, depth: d, decor: DECOR, facadeDecor: DECOR, plinthHeight: 60, hingeBrand: "gtv" }, patch);
  m.sections = sections.map((s) => ({ ...section(), ...s }));
  return m;
}
const place = (module: Module, x: number, z: number, y = 0, rotation: PlacedModule["rotation"] = 0): PlacedModule => ({ id: nid(), x, z, y, rotation, module });
// Наполнение — точные высоты из модели Базиса «проект корректировка 02.10» (мировые координаты деталей, world.py в папке заказа):
// высота полки задаётся по её центру от пола, ящик — по низу фасада. Порядок корпусов отзеркален: Базис рисует в левой системе координат.
const IN_BOTTOM = 76, IN_H = 2184 - 76; // дно корпуса на цоколе 60, крыша 2184
const at = (centerFromFloor: number) => Math.round((centerFromFloor - IN_BOTTOM) / IN_H * 10000) / 10000;
// ящик: низ фасада от пола, высота фасада и короба; зазор фасада 3 за дверью и 2 в открытом корпусе
const drawerAt = (facadeBottom: number, facadeH: number, box: number, gap: number) =>
  ({ slide: "gtv0fpo" as const, operation: "soft-close" as const, brand: "dtc" as const, height: box, facadeH, length: 350, handle: false, y: facadeBottom - gap / 2 - IN_BOTTOM });

const Z_BACK = 600, Z_FRONT = 1003, Z_KUPE = 1453, /* задник ХДФ обратных корпусов — 3 мм */ FRONT_W = 2043, H = 2200, ANT_H = 659; /* потолок у колонны 2889: 2889 − 30 (регламент) − 2200 */
const front = (name: string, x: number, w: number, s: Partial<ReturnType<typeof section>>) =>
  place(mod(name, w, H, 450, { doors: false, backType: "board" }, [s]), x, Z_FRONT);
const back = (name: string, x: number, w: number, s: Partial<ReturnType<typeof section>>) =>
  place(mod(name, w, H, 400, { doors: true, backType: "nailed", handleId: "lm87685022" /* ТЗ: торцевая, хром мат. */ }, [{ doorLeaves: 1, ...s }]), x, Z_BACK, 0, 180);
const kupe = mod("Двери купе", FRONT_W, H, 100, { doors: false, plinthHeight: 0, sections: [] }, [{}]);
kupe.kupe = { ...DEFAULT_KUPE, system: "Стандарт I (Аристо)", color: "Серебро матовое", doors: 3, fills: ["Слэйт", "Слэйт", "Зеркало Серебро 4мм"], sections: 0, softClose: false };
// Комната (b3d: корпуса 739, здесь до колонны 2043 → по 681). Полка 1908 и тремпель под ней — во всех трёх.
const fw = 681;
// Прихожая (b3d: 561·561·561·562 = 2245, антресоли 561 · 1122 · 562): ящики фасадами 405/604/804 × 193, короб 166; над ящиками жёсткая полка 1008.
const hallDrawers = { drawers: 3, drawerConfigs: [drawerAt(405, 193, 156, 3), drawerAt(604, 193, 156, 3), drawerAt(804, 193, 156, 3)] /* короб 156: регламент студии — 40 мм над коробом (в b3d 166 при шаге 200) */, shelves: [at(1394), at(1794)], fixed: [0, 1] }; // полку над ящиками (1008 в b3d) студия ставит сама
const hallPullout = { shelves: [at(401), at(691)], fixed: [0, 1], pullouts: 1 };
const ANT_SHELF = Math.round((2545 - 2216) / (2884 - 2216) * 10000) / 10000; // полка антресоли на той же доле высоты, что в b3d
const project: Project = {
  version: 3,
  measurement: { number: "7358873", date: "2026-10-06", notes: "Замер Кондырев А.С. Проём 2043 × 2222–2230, колонна 173×164, балка 262, потолок 2900/2889, плинтус 50." },
  room: {
    width: 3000, depth: 2400, height: 2889 /* минимум по замеру: 2900 у стены, 2889 у колонны */, openings: [],
    obstacles: [
      { id: "beam", name: "Балка над проёмом", type: "beam", x: 0, y: 2222, z: 1553 - 262, width: 2216, depth: 262, height: 667 },
      { id: "column", name: "Колонна 173×164", type: "column", x: FRONT_W, y: 0, z: 1553 - 164, width: 173, depth: 164, height: 2222 },
    ],
  },
  modules: [
    // Комната — слева направо от стены к колонне (зеркально b3d): ящик · полки · тремпель с нижней полкой.
    front("Комната · ящик", 0, fw, { shelves: [at(1908)], fixed: [0], /* полка над ящиком (639 в b3d) — обязательная, ставит студия */ pullouts: 1, drawers: 1, drawerMount: "inset", drawerConfigs: [drawerAt(480, 146, 116, 2)] }),
    front("Комната · полки", fw, fw, { shelves: [at(1908), at(288), at(508), at(727)], fixed: [0, 1, 2, 3], pullouts: 1 }),
    front("Комната · тремпель", 2 * fw, FRONT_W - 2 * fw, { shelves: [at(1908), at(448)], fixed: [0, 1], pullouts: 1 }),
    place(kupe, 0, Z_KUPE),
    // Прихожая — 4 корпуса за колонной на полную ширину 2245.
    // Регламент цеха: у стены фальшпанель «торцом» 16 + 5 мм (21) к распашным дверям; общая ширина как в b3d — 2245.
    back("Прихожая · ящики", 21, 556, hallDrawers),
    back("Прихожая · тремпель", 577, 556, hallPullout),
    back("Прихожая · тремпель", 1133, 556, hallPullout),
    back("Прихожая · ящики", 1689, 556, hallDrawers),
    // Антресоли над прихожей, push-to-open: 561 · 1122 (две двери) · 562.
    place(mod("Антресоль", 556, ANT_H, 400, { doors: true, doorOpen: "push", plinthHeight: 0, backType: "nailed" }, [{ shelves: [ANT_SHELF], fixed: [0], doorLeaves: 1 }]), 21, Z_BACK, H, 180),
    place(mod("Антресоль", 1112, ANT_H, 400, { doors: true, doorOpen: "push", plinthHeight: 0, backType: "nailed" }, [{ shelves: [ANT_SHELF], fixed: [0], doorLeaves: 2 }]), 577, Z_BACK, H, 180),
    place(mod("Антресоль", 556, ANT_H, 400, { doors: true, doorOpen: "push", plinthHeight: 0, backType: "nailed" }, [{ shelves: [ANT_SHELF], fixed: [0], doorLeaves: 1 }]), 1689, Z_BACK, H, 180),
  ],
  calculation: { markup: 2.2, overrides: {}, model: "sheet", sheetPrice: 23000 },
};

// Фальшпанели к стенам ставит студия при каждом изменении — применяем сразу, чтобы проект был в том же виде, что после любой правки.
const parsed = applyAutoFillers(parseProject(JSON.parse(JSON.stringify(project))));
const errors = projectErrors(parsed);
mkdirSync("public/local-projects", { recursive: true });
writeFileSync("public/local-projects/7358873-kofanov.json", JSON.stringify(parsed, null, 1));
console.log("Ошибки проекта:", errors.length ? errors.join(" | ") : "нет");
const e = estimate(parsed);
console.log(`Листов ЛДСП: ${e.ldspSheets}; по листу ${e.sheetPrice}: ${e.bySheet.toLocaleString("ru-RU")} ₽; по коэффициенту ${e.markup}: ${e.byMarkup?.toLocaleString("ru-RU") ?? "не завершена"} ₽`);
console.log(`Материалы ${e.split.material.toLocaleString("ru-RU")} ₽ · фурнитура ${e.split.hardware.toLocaleString("ru-RU")} ₽ · розница (купе) ${e.retailExtras.toLocaleString("ru-RU")} ₽ · себестоимость ${e.knownCost.toLocaleString("ru-RU")} ₽`);
console.log("Без цены:", e.missing.map((l) => l.label).join("; ") || "нет");
for (const l of e.lines) console.log(`  ${l.label} · ${l.quantity} ${l.unit} × ${l.unitPrice ?? "?"}${l.retail ? " (розница)" : ""}`);
