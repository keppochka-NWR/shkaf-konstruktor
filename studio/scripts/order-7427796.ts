// Заказ 7427796 — прихожая 1334×2450×600 (согласованный конструктив, ТЗ с эскиза дизайнера). Собрана функциями студии.
// Запуск: npx tsx scripts/order-7427796.ts → public/local-projects/order-7427796-ldsp.json и -mirror.json (личные проекты, не в git) + смета.
// Два варианта: 1) дверь правого модуля ЛДСП; 2) та же дверь полностью зеркальная (зеркало 4 мм на основе ЛДСП 16).
// Состав: левый открытый модуль 702 (посадочное место 32 на 450, ящик Blum под ним, ниша 218 до пола, задник ЛДСП только над сиденьем),
// правый модуль 600 (дверь, полка, штанга, задник ХДФ, справа добор 32 в цвет корпуса до 2450), антресоли 450 = фасады + карниз 80
// (над нишей 2 фасада, у среднего петли 155–165°; над шкафом 1 фасад). Корпус Дуб Сонома, фасады и карниз Белый Кристалл, Blum.
import { writeFileSync, mkdirSync } from "node:fs";
import { initialModule, section, parts, type Module, type Section } from "../src/model";
import { parseProject, projectErrors, applyAutoFillers, type Project, type PlacedModule } from "../src/project";
import { partCollisions } from "../src/collisions";
import { estimate } from "../src/pricing";

const BODY = "Дуб Сонома", FACE = "Белый Кристалл", KNOB = "knob30b";
let n = 0;
const nid = () => "o" + (++n);
function mod(name: string, w: number, h: number, d: number, patch: Partial<Module>, s: Partial<Section>): Module {
  const m = initialModule();
  Object.assign(m, { name, width: w, height: h, depth: d, decor: BODY, facadeDecor: FACE, hingeBrand: "blum", handleId: KNOB }, patch);
  m.sections = [{ ...section(), shelves: [], ...s }];
  return m;
}
const place = (module: Module, x: number, y = 0): PlacedModule => ({ id: nid(), x, z: 3, y, rotation: 0, module });
const H = 2000, ANT = 450, X0 = 2000 - 1334, WL = 702, WR = 600;
// левый модуль без цоколя: дно на полу, проём 16…1984; сиденье — верх на 450 (центр верхней плиты 442), ящик 220…416 (вкладной фасад 196)
const at = (center: number, bottom: number, top: number) => Math.round((center - bottom) / (top - bottom) * 1e5) / 1e5;
export function build(mirror: boolean): Project {
  n = 0;
  const left = mod("Ниша с сиденьем", WL, H, 600, { doors: false, plinthHeight: 0, backType: "board", backFrom: 450 }, {
    shelves: [at(442, 16, H - 16)], fixed: [0], thickShelves: [0], drawerCap: false, drawers: 1, drawerMount: "inset",
    drawerConfigs: [{ slide: "gtv0fpo", operation: "soft-close", brand: "blum", height: 140, facadeH: 196, length: 550, handle: false, y: 218 - 16 }],
  });
  const right = mod("Шкаф с дверью", WR, H, 582, { doors: true, plinthHeight: 80, backType: "nailed", hingeSide: "right",
    sidePanels: { right: { height: 2450, depth: 600, thick: 32 } }, ...(mirror ? { mirror: "mirror-silver" } : {}) }, {
    shelves: [at(442, 96, H - 16)], rod: true, rodAt: at(H - 16 - 70, 96, H - 16), doorLeaves: 1, hingeSide: "right", hingeAngles: [90],
  });
  const antL = mod("Антресоль над нишей", WL, ANT, 582, { doors: true, plinthHeight: 0, backType: "nailed", topStrip: 80 }, { doorLeaves: 2, hingeAngles: [null, 165] });
  const antR = mod("Антресоль над шкафом", WR, ANT, 582, { doors: true, plinthHeight: 0, backType: "nailed", topStrip: 80, hingeSide: "right" }, { doorLeaves: 1, hingeSide: "right" });
  const p: Project = {
    version: 3,
    measurement: { number: "7427796", date: "2026-10-26", notes: "Согласованный конструктив дизайнера: 1334×2450×600, вариант " + (mirror ? "2 — зеркальная дверь" : "1 — дверь ЛДСП") + "." },
    room: { width: 2000, depth: 1800, height: 2700, openings: [] },
    modules: [place(left, X0), place(right, X0 + WL), place(antL, X0, H), place(antR, X0 + WL, H)],
    calculation: { markup: 2.2, overrides: {}, edgeGlue: "pur" },
  };
  return parseProject(JSON.parse(JSON.stringify(applyAutoFillers(parseProject(JSON.parse(JSON.stringify(p)))))));
}

if (process.argv[1]?.endsWith("order-7427796.ts")) {
  const out = process.argv[2] ?? "public/local-projects";
  mkdirSync(out, { recursive: true });
  for (const [key, mirror] of [["ldsp", false], ["mirror", true]] as const) {
    const p = build(mirror);
    const errors = projectErrors(p), coll = p.modules.flatMap((a) => partCollisions(parts(a.module), a.module).map((c) => a.module.name + ": " + c.a + " × " + c.b));
    writeFileSync(`${out}/order-7427796-${key}.json`, JSON.stringify(p, null, 1));
    const e = estimate(p);
    console.log(`== ${key}: ошибки ${errors.length ? errors.join(" | ") : "нет"}; пересечения ${coll.length}${coll.length ? " — " + coll.slice(0, 6).join("; ") : ""}`);
    console.log(`   листов ЛДСП ${e.ldspSheets}; по коэф. ${e.markup}: ${e.byMarkup ?? "—"} ₽ (известно ${e.byMarkupKnown}); по листу ${e.sheetPrice}: ${e.bySheet} ₽; retail ${e.retail}`);
    console.log(`   материалы ${e.split.material} · фурнитура ${e.split.hardware}; без цены: ${e.missing.map((l) => l.label).join("; ") || "нет"}; после финального расчёта: ${e.pending.map((l) => l.label).join("; ") || "нет"}`);
    if (process.argv.includes("--lines")) for (const l of e.lines) console.log(`     ${l.id} | ${l.label} · ${l.quantity} ${l.unit} × ${l.unitPrice ?? "?"}${l.retail ? " (розница)" : ""}${l.pending ? " (финальный расчёт)" : ""}`);
  }
}
