// Реальные заказы цеха, собранные в студии по моделям Базиса (архивы «Заказы в работе» / «Заказы в производство», 06.09.2026).
// Запуск: npx tsx scripts/orders.ts → examples/orders/*.project.json (валидируются через parseProject).
import { writeFileSync, mkdirSync } from "node:fs";
import { initialModule, section, type Module } from "../src/model";
import { parseProject, applyAutoFillers, projectErrors, type Project, type PlacedModule } from "../src/project";
import { estimate } from "../src/pricing";

let counter = 0;
const id = () => "m" + (++counter);
function mod(name: string, w: number, h: number, d: number, decor: string, patch: Partial<Module>, sections: Partial<ReturnType<typeof section>>[]): Module {
  const m = initialModule();
  m.name = name; m.width = w; m.height = h; m.depth = d; m.decor = decor; m.facadeDecor = patch.facadeDecor ?? decor;
  m.sections = sections.map((s) => ({ ...section(), ...s }));
  Object.assign(m, patch);
  return m;
}
const place = (module: Module, x: number, z: number, y = 0, rotation: PlacedModule["rotation"] = 0): PlacedModule => ({ id: id(), x, z, y, rotation, module });
const room = (width: number, depth: number, height = 2700) => ({ width, depth, height, openings: [] });

export const orders: Record<string, { title: string; note: string; project: Project }> = {
  "1-korizhin": {
    title: "6990041 Корижин — пенал с антресолью и навесной шкаф",
    note: "Цемент Lamarty. Пенал 820×2140×450 на ножках M6 без дна, стяжки 150 сзади, 2 полки, 2 накладных фасада. Антресоль 458 с задней стяжкой. Навесной 852×1455×240: вкладные фасады push, задняя стенка ЛДСП, 3 полки, планка 60 под крышей.",
    project: {
      version: 3, room: room(3600, 3000), modules: [
        place(mod("Пенал", 820, 2140, 450, "Цемент", { feet: { height: 18 }, bottomType: "none", rails: [{ place: "rear-bottom", height: 150 }, { place: "rear-top", height: 150 }], backType: "none" }, [{ shelves: [0.36, 0.7] }]), 300, 3),
        place(mod("Антресоль", 820, 458, 450, "Цемент", { plinthHeight: 0, rails: [{ place: "rear-top", height: 150 }], backType: "none" }, [{ shelves: [] }]), 300, 3, 2140),
        place(mod("Навесной", 852, 1455, 240, "Цемент", { plinthHeight: 0, backType: "board", doorMount: "inset", doorOpen: "push", topStrip: 60 }, [{ shelves: [0.25, 0.5, 0.75] }]), 1500, 3, 1195),
      ],
    },
  },
  "2-baykov": {
    title: "7044133 Байков — открытая прихожая на ножках",
    note: "Белый Lamarty. Два каркаса 900 и 784 × 2058 × 500 на ножках M6 без дна, стяжки 200 сзади снизу и сверху, полка на 404; в первом — овальная штанга. Справа фальшпанель 2440×600 до потолка. Сверху две антресоли 372.",
    project: {
      version: 3, room: room(3000, 3000, 2500), modules: [
        place(mod("Каркас со штангой", 900, 2058, 500, "Белый", { feet: { height: 18 }, bottomType: "none", rails: [{ place: "rear-bottom", height: 200 }, { place: "rear-top", height: 200 }], doors: false, rodType: "oval", backType: "none" }, [{ shelves: [0.2], rod: true, rodAt: 0.95 }]), 300, 3),
        place(mod("Каркас с полками", 784, 2058, 500, "Белый", { feet: { height: 18 }, bottomType: "none", rails: [{ place: "rear-bottom", height: 200 }, { place: "rear-top", height: 200 }], doors: false, backType: "none", sidePanels: { right: { height: 2440, depth: 600 } } }, [{ shelves: [0.2, 0.4, 0.6, 0.8] }]), 1200, 3),
        place(mod("Антресоль 900", 900, 372, 500, "Белый", { plinthHeight: 0, doors: false, backType: "none" }, [{ shelves: [] }]), 300, 3, 2068),
        place(mod("Антресоль 784", 784, 372, 500, "Белый", { plinthHeight: 0, doors: false, backType: "none" }, [{ shelves: [] }]), 1200, 3, 2068),
      ],
    },
  },
  "3-semikletova": {
    title: "7110535 Семиклетова — гардеробная на регулируемых ножках",
    note: "Тэффи Lamarty. Каркасы 1000 и 1250 × 2014 × 500 на ножках 100: штанга овальная, второй с тремя ящиками; антресоли 300; у левой стены под 90° шкаф 481×1726×350 с дверью и антресоль на нём.",
    project: {
      version: 3, room: room(3600, 3200), modules: [
        place(mod("Штанга", 1000, 2014, 500, "Тэффи", { feet: { height: 100 }, rails: [{ place: "rear-bottom", height: 100 }], doors: false, rodType: "oval", backType: "none" }, [{ shelves: [0.2], rod: true, rodAt: 0.95 }]), 700, 3),
        place(mod("Ящики", 900, 2014, 500, "Тэффи", { feet: { height: 100 }, rails: [{ place: "rear-bottom", height: 100 }], doors: false, backType: "none" }, [{ shelves: [0.6, 0.8], drawers: 3, drawerConfigs: [{ slide: "ball", height: 142, length: 450 }, { slide: "ball", height: 142, length: 450 }, { slide: "ball", height: 142, length: 450 }] }]), 1707, 3),
        place(mod("Антресоль", 1000, 300, 500, "Тэффи", { plinthHeight: 0, doors: false, backType: "none", rails: [{ place: "rear-top", height: 100 }] }, [{ shelves: [] }]), 700, 3, 2040),
        place(mod("Антресоль", 900, 300, 500, "Тэффи", { plinthHeight: 0, doors: false, backType: "none", rails: [{ place: "rear-top", height: 100 }] }, [{ shelves: [] }]), 1707, 3, 2040),
        place(mod("Шкаф у стены", 481, 1726, 350, "Тэффи", { plinthHeight: 100, hingeSide: "right" }, [{ shelves: [0.5] }]), 3, 700, 0, 90),
        place(mod("Антресоль угловая", 481, 598, 350, "Тэффи", { plinthHeight: 0, doors: false, backType: "none" }, [{ shelves: [0.5] }]), 3, 700, 1726, 90),
      ],
    },
  },
  "4-osharina-su": {
    title: "03_06_26 Ошарина — тумба под раковину",
    note: "Афелия Lamarty. 812×845×475: две стойки на опорах M6, без дна и крыши, стяжки сзади снизу 180, спереди снизу 80 (съёмная), сзади сверху 100; два накладных фасада 390 push-to-open.",
    project: {
      version: 3, room: room(1800, 1800), modules: [
        place(mod("Тумба под раковину", 812, 845, 475, "Афелия D*", { feet: { height: 18 }, bottomType: "none", topType: "none", rails: [{ place: "rear-bottom", height: 180 }, { place: "front-bottom", height: 80 }, { place: "rear-top", height: 100 }], doorOpen: "push", backType: "none" }, [{ shelves: [] }]), 300, 3),
      ],
    },
  },
  "5-shain": {
    title: "6724055 Шаин — шкаф под скосом (без скошенных коробов)",
    note: "Дуб Сонома Lamarty, фасады Evogloss 18 (в каталоге нет — взят Белый). Тумба 708×960×489 на цоколе 80 с двумя секциями и фасадами; сверху пенал 426×1420×489 с двумя полками и дверью; рядом открытый стеллаж 282×1420×368. Скошенные короба под мансардный потолок студия не строит.",
    project: {
      version: 3, room: room(2600, 2600, 2500), modules: [
        place(mod("Тумба", 708, 960, 489, "Дуб Сонома", { plinthHeight: 80, facadeDecor: "Белый" }, [{ weight: 426, shelves: [0.5] }, { weight: 266, shelves: [0.5] }]), 300, 3),
        place(mod("Пенал", 426, 1420, 489, "Дуб Сонома", { plinthHeight: 0, facadeDecor: "Белый" }, [{ shelves: [0.33, 0.66] }]), 300, 3, 960),
        place(mod("Стеллаж", 282, 1420, 368, "Дуб Сонома", { plinthHeight: 0, doors: false }, [{ shelves: [0.25, 0.5, 0.75] }]), 726, 3, 960),
      ],
    },
  },
};

if (process.argv[1]?.endsWith("orders.ts")) {
  const dir = new URL("../examples/orders/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  for (const [key, o] of Object.entries(orders)) {
    const p = applyAutoFillers(o.project);
    const errors = projectErrors(p);
    if (errors.length) { console.log("✖", key, errors.join(" | ")); continue; }
    const parsed = parseProject(p);
    const e = estimate(parsed);
    writeFileSync(new URL(key + ".project.json", dir), JSON.stringify(parsed, null, 1), "utf8");
    console.log("✔", key, o.title, "| листов ЛДСП", e.ldspSheets, "| по коэф.", e.byMarkup, "| за лист", e.bySheet, "| без цены:", e.missing.map((l) => l.label).join(", ") || "нет");
  }
}
