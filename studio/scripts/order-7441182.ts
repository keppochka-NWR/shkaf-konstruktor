// Заказ 7441182 — прихожая по согласованному конструктиву (ТЗ переписано с эскиза дизайнера), собрана ФУНКЦИЯМИ студии.
// Запуск: npx tsx scripts/order-7441182.ts [outJson]
// → public/local-projects/order-7441182-ldsp.json и order-7441182-mirror.json (личные проекты, в git и публикацию не идут)
// + сводка estimate() по обоим вариантам в консоль и в outJson (для отчёта).
// Данные клиента не используются — только номер заказа.
// Конструктив строго по эскизу (решение Макса 26.10: эскиз главнее правил студии): тумба 500 × 500 (цоколь 80 утоплен, фасад 420
// от цоколя до верха посадочного места 32 — накладной, закрывает его торец) с полкой посередине; над сиденьем щит 16 «Марципан»
// до низа антресоли — ниша 1500 (левой боковины у ниши нет — над тумбой только щит и навесная антресоль); шкаф 430 × 2000 с дверью
// 1918 над цоколем и штангой; антресоли 500 и 430 × 450 на 2000 — общая высота 2450. Общая ширина 930: у левой стены тумба и антресоль
// «без фальша у стены» (флаг отклонения от регламента, setWallFillersOff). Корпус и фасады — «Каньон Ледяной», ручки торцевые FP527
// вертикально, петли без доводчика. Вариант 2 — фасад шкафа 430 зеркальный (зеркало на ЛДСП, открытие торцевой ручкой).
// Цена клиенту — «по большей модели» (calculation.maxModel): max(коэффициент 2,2; листы × 23 000 + зеркало вне листа).
import { writeFileSync, mkdirSync } from "node:fs";
import { initialModule, parts, validate, type Module } from "../src/model";
import { createModule } from "../src/paletteBuild";
import { parseProject, projectErrors, applyAutoFillers, setWallFillersOff, type Project, type PlacedModule } from "../src/project";
import { addUpperModule, setWallDistance } from "../src/operations";
import { estimate, MARKUP_DEFAULT, SHEET_PRICE_DEFAULT } from "../src/pricing";

const DECOR = "Каньон Ледяной", PANEL_DECOR = "МАРЦИПАН", HANDLE = "fp527-160";
const [outJson] = process.argv.slice(2);
const src = (): Module => ({ ...initialModule(), decor: DECOR, facadeDecor: DECOR, handleId: HANDLE });
/** Общие настройки ТЗ: торцевые ручки, петли без доводчика. */
const common = (m: Module): Module => { m.handleId = HANDLE; m.hingeSoft = false; return m; };

function build(mirror: boolean): Project {
  // палитра «Пустой шкаф» — как у менеджера; z 33 — как ставит студия у задней стены (зазор под плинтус)
  const tumba = common(createModule("empty", 500, 500, 510, src()));
  tumba.sections[0].shelves = [0.5];             // полка посередине: 210 / 210 по ТЗ (в свету 194 / 194)
  tumba.seatTop = true;                          // посадочное место 32 (две плиты 16 склейкой под одну кромку)
  tumba.plinthRecess = 50;                       // цоколь 80 утоплен, фасад над цоколем
  tumba.seatPanel = { height: 2000 - 500, decor: PANEL_DECOR }; // щит 16 над сиденьем — до низа антресоли (2000): ниша 1500
  const wardrobe = common(createModule("empty", 430, 2000, 510, src()));
  wardrobe.sections[0].shelves = []; wardrobe.sections[0].rod = true; // штанга под антресолью
  wardrobe.plinthRecess = 50;
  if (mirror) wardrobe.mirror = "mirror-silver"; // зеркало 4 мм на фасаде ЛДСП (функция ветки o-7427796)
  let p: Project = {
    version: 3,
    measurement: { number: "7441182", date: "2026-10-26", notes: "Прихожая по согласованному конструктиву (эскиз дизайнера). Два варианта: ЛДСП / зеркальный фасад шкафа 430." },
    room: { width: 3000, depth: 2000, height: 2600, openings: [] },
    modules: [{ id: "tumba", x: 0, y: 0, z: 33, rotation: 0, module: tumba } as PlacedModule],
    calculation: { markup: MARKUP_DEFAULT, overrides: {}, sheetPrice: SHEET_PRICE_DEFAULT, maxModel: true },
  };
  // тумба к левой стене: студия ставит фальш 100×16 + зазор 5 (x 21) — по эскизу без него, вплотную (флаг «Без фальша у стены»)
  p = setWallFillersOff(applyAutoFillers(p), "tumba", true);
  p = applyAutoFillers({ ...p, modules: [...p.modules, { id: "wardrobe", x: 500, y: 0, z: 33, rotation: 0, module: wardrobe } as PlacedModule] });  // антресоли — функцией «Антресоль сверху» (как кнопка панели), затем высота 450; над тумбой — поднять «От пола» на 2000
  p = addUpperModule(p, "wardrobe");
  let up = p.modules.at(-1)!; up.id = "ant-430"; up.module = common({ ...up.module, height: 450 });
  p = addUpperModule(p, "tumba");
  up = p.modules.at(-1)!; up.id = "ant-500"; up.module = common({ ...up.module, height: 450 });
  p = setWallDistance(p, "ant-500", "y", 2000);
  return applyAutoFillers(parseProject(JSON.parse(JSON.stringify(p))));
}

const summary: Record<string, unknown> = {};
mkdirSync("public/local-projects", { recursive: true });
for (const [key, mirror] of [["ldsp", false], ["mirror", true]] as const) {
  const p = build(mirror);
  const errs = projectErrors(p), modErrs = p.modules.flatMap((a) => validate(a.module).map((e) => a.module.name + ": " + e));
  writeFileSync(`public/local-projects/order-7441182-${key}.json`, JSON.stringify(p, null, 1));
  const e = estimate(p);
  const ps = p.modules.flatMap((a) => parts(a.module).map((q) => ({ m: a.module.name, ...q })));
  const boards = ps.filter((q) => q.material === "board" && q.role !== "hinge");
  console.log(`\n=== Вариант ${key === "ldsp" ? "1 · всё ЛДСП" : "2 · зеркальный фасад шкафа 430"} ===`);
  console.log("Ошибки проекта:", errs.length ? errs.join(" | ") : "нет", modErrs.length ? "· модули: " + modErrs.join(" | ") : "");
  for (const a of p.modules) console.log(`  ${a.module.name}: x ${a.x}, y ${a.y ?? 0}, z ${a.z}, ${a.module.width}×${a.module.height}×${a.module.depth}`);
  console.log(`Листов ЛДСП: ${e.ldspSheets}; цена клиенту ${e.retail} (модель ${e.model}: по листу ${e.bySheet}, по коэффициенту ${e.byMarkup})`);
  console.log(JSON.stringify({ retail: e.retail, model: e.model, sheetPrice: e.sheetPrice, bySheet: e.bySheet, byMarkup: e.byMarkup, split: e.split, retailExtras: e.retailExtras, knownCost: e.knownCost, missing: e.missing.map((l) => l.label), pending: e.pending.map((l) => l.label), notice: e.notice }));
  for (const l of e.lines) console.log(`  ${l.id} · ${l.label} · ${l.quantity} ${l.unit} × ${l.unitPrice ?? "?"}${l.retail ? " (розница)" : ""}`);
  console.log("Детали ЛДСП:");
  for (const q of boards) console.log(`  ${q.m} · ${q.name} · ${Math.round(q.length)}×${Math.round(q.width)}×${q.thickness} · ${q.decor}`);
  summary[key] = { errors: errs, moduleErrors: modErrs, estimate: e, parts: boards.map((q) => ({ m: q.m, id: q.id, name: q.name, l: Math.round(q.length), w: Math.round(q.width), t: q.thickness, decor: q.decor })),
    doors: ps.filter((q) => q.role === "door").map((q) => ({ m: q.m, name: q.name, h: q.size[1], w: q.size[0], y0: q.position[1] - q.size[1] / 2 })) };
}
if (outJson) writeFileSync(outJson, JSON.stringify(summary, null, 1));
