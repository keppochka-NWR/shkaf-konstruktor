// Заказ 7358873-З Кофанов — шкаф-перегородка на 2 стороны между комнатой и прихожей, собран в студии по замеру 06.10.2026,
// ТЗ замерщика и проекту Леманы 02.10 (Яндекс-диск заказа, папка «Продажа»). Запуск: npx tsx scripts/order-7358873.ts
// → public/local-projects/7358873-kofanov.json (личный проект, в публикацию не идёт) + смета в консоль.
// Помещение: проём комната↔прихожая 2043 от стены до колонны, колонна 173×164, балка над проёмом низом 2222–2230 (659 от потолка),
// потолок 2900 у стены и 2889 у колонны, плинтус 50.
// ТЗ: каркас, кромка, задняя стенка, фасады — ЛДСП «Слэйт»; цоколь; петли с доводчиком; антресоль push; ящики — скрытые с доводчиком,
// открывание за фасад; купе 3 полотна (2 Слэйт, 1 зеркало), ручка-профиль узкий.
import { writeFileSync, mkdirSync } from "node:fs";
import { initialModule, section, type Module } from "../src/model";
import { parseProject, projectErrors, type Project, type PlacedModule } from "../src/project";
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
const drawer = (height: number) => ({ slide: "gtv0fpo" as const, operation: "soft-close" as const, brand: "dtc" as const, height, length: 350, handle: false });

// Плоскость раздела: задняя сторона (прихожая) z 600..1000, лицевая (комната) 1000..1450, купе 1450..1550.
const Z_BACK = 600, Z_FRONT = 1003, Z_KUPE = 1453, /* задник ХДФ обратных корпусов — 3 мм */ FRONT_W = 2043, BACK_W = 2215, H = 2200, ANT_H = 659; /* потолок у колонны 2889: 2889 − 30 (регламент) − 2200 */
const front = (name: string, x: number, w: number, s: Partial<ReturnType<typeof section>>) =>
  place(mod(name, w, H, 450, { doors: false, backType: "board" }, [s]), x, Z_FRONT);
const fw = Math.round(FRONT_W / 3);
const back = (name: string, x: number, w: number, s: Partial<ReturnType<typeof section>>) =>
  place(mod(name, w, H, 400, { doors: true, backType: "nailed", handleId: "lm87685022" /* ТЗ: торцевая, хром мат. */ }, [{ doorLeaves: 1, ...s }]), x, Z_BACK, 0, 180);
const bw = Math.round(BACK_W / 4);
const kupe = mod("Двери купе", FRONT_W, 2222, 100, { doors: false, plinthHeight: 0, sections: [] }, [{}]);
kupe.kupe = { ...DEFAULT_KUPE, system: "Стандарт I (Аристо)", color: "Серебро матовое", doors: 3, fills: ["Слэйт", "Слэйт", "Зеркало Серебро 4мм"], sections: 0, softClose: false };

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
    // Лицевая сторона (комната): 3 корпуса 450 между стеной и колонной, наверху полка и выдвижной тремпель.
    front("Комната · тремпель", 0, fw, { shelves: [0.86, 0.17], pullouts: 1 }),
    front("Комната · полки", fw, fw, { shelves: [0.86, 0.08, 0.17, 0.26], pullouts: 1 }),
    front("Комната · ящик", 2 * fw, FRONT_W - 2 * fw, { shelves: [0.86, 0.2], pullouts: 1, drawers: 1, drawerMount: "inset", drawerConfigs: [drawer(116)] }), // за купе фасад ящика вкладной (в b3d 708,8 = ширина проёма)
    place(kupe, 0, Z_KUPE),
    // Обратная сторона (прихожая): 4 корпуса 400 с распашными дверями, за колонной на полную ширину.
    back("Прихожая · ящики", 0, bw, { shelves: [0.45, 0.62, 0.78], drawers: 3, drawerConfigs: [drawer(166), drawer(166), drawer(166)] }),
    back("Прихожая · тремпель", bw, bw, { shelves: [0.12, 0.25], pullouts: 1 }),
    back("Прихожая · тремпель", 2 * bw, bw, { shelves: [0.12, 0.25], pullouts: 1 }),
    back("Прихожая · ящики", 3 * bw, BACK_W - 3 * bw, { shelves: [0.45, 0.62, 0.78], drawers: 3, drawerConfigs: [drawer(166), drawer(166), drawer(166)] }),
    // Антресоли над прихожей, push-to-open.
    ...[0, 1, 2, 3].map((i) => place(mod("Антресоль", i < 3 ? bw : BACK_W - 3 * bw, ANT_H, 400, { doors: true, doorOpen: "push", plinthHeight: 0, backType: "nailed" }, [{ shelves: [0.5], doorLeaves: 1 }]), i * bw, Z_BACK, H, 180)),
  ],
  calculation: { markup: 2.2, overrides: {}, model: "sheet", sheetPrice: 23000 },
};

const parsed = parseProject(JSON.parse(JSON.stringify(project)));
const errors = projectErrors(parsed);
mkdirSync("public/local-projects", { recursive: true });
writeFileSync("public/local-projects/7358873-kofanov.json", JSON.stringify(parsed, null, 1));
console.log("Ошибки проекта:", errors.length ? errors.join(" | ") : "нет");
const e = estimate(parsed);
console.log(`Листов ЛДСП: ${e.ldspSheets}; по листу ${e.sheetPrice}: ${e.bySheet.toLocaleString("ru-RU")} ₽; по коэффициенту ${e.markup}: ${e.byMarkup?.toLocaleString("ru-RU") ?? "не завершена"} ₽`);
console.log(`Материалы ${e.split.material.toLocaleString("ru-RU")} ₽ · фурнитура ${e.split.hardware.toLocaleString("ru-RU")} ₽ · розница (купе) ${e.retailExtras.toLocaleString("ru-RU")} ₽ · себестоимость ${e.knownCost.toLocaleString("ru-RU")} ₽`);
console.log("Без цены:", e.missing.map((l) => l.label).join("; ") || "нет");
for (const l of e.lines) console.log(`  ${l.label} · ${l.quantity} ${l.unit} × ${l.unitPrice ?? "?"}${l.retail ? " (розница)" : ""}`);
