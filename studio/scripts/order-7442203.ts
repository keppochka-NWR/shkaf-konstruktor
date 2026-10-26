// Заказ 7442203 — угловой Г-образный шкаф без дна и задника и пенал в нишу, согласованный конструктив (эскизы дизайнера, версия 2620).
// Собран функциями студии (initialModule/section + поля модуля), без импорта. Запуск: npx tsx scripts/order-7442203.ts [--decor=… --facade=…]
// → public/local-projects/order-7442203.json (личный проект, в публикацию не идёт) + смета в консоль (JSON при --json).
// Клиентских данных здесь нет и быть не должно: только номер заказа и размеры.
// Замер (фото): угол 1386 по задней стене × 1070 по боковой, потолок 2638–2643; ниша пенала 431–434 × 344–346 × 2638–2639.
import { writeFileSync, mkdirSync } from "node:fs";
import { initialModule, section, parts, validate, type Module, type Section } from "../src/model";
import { partCollisions } from "../src/collisions";
import { parseProject, projectErrors, applyAutoFillers, type Project, type PlacedModule } from "../src/project";
import { estimate } from "../src/pricing";
import type { DrawerConfig } from "../src/hardware";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
export const DECOR = arg("decor", "Бамбук"), FACADE = arg("facade", "Тэффи");
let n = 0;
const nid = () => "o" + (++n);
const sec = (s: Partial<Section>): Section => ({ ...section(), ...s });
function mod(name: string, w: number, h: number, d: number, patch: Partial<Module>, sections: Partial<Section>[]): Module {
  const m = initialModule();
  Object.assign(m, { name, width: w, height: h, depth: d, decor: DECOR, facadeDecor: FACADE, doors: true }, patch);
  m.sections = sections.map(sec);
  return m;
}
const place = (module: Module, x: number, z: number, y = 0, rotation: PlacedModule["rotation"] = 0): PlacedModule => ({ id: nid(), x, z, y, rotation, module });
/** Доля высоты проёма для центра полки, заданного от пола (низ проёма — innerBottom, верх — innerTop). */
const at = (center: number, bottom: number, top: number) => Math.round((center - bottom) / (top - bottom) * 10000) / 10000;

// ---------- Изделие 1: угловой шкаф. Нижние корпуса 2000 без дна и задника на цоколе 60 (царга спереди), стяжки сзади сверху/снизу 100;
// антресоли 620 push-to-open без задника; итог 2620 (потолок 2638 — зазор 18).
const H = 2000, ANT = 620, D_L = 582 /* 600 с фасадом: 582 + 2 + 16 */, D_R = 362 /* 380 с фасадом */;
const IB = 60, IT = H - 16; // проём нижнего корпуса: от цоколя (дна нет) до крыши
const lower: Partial<Module> = { backType: "none", bottomType: "none", plinthHeight: 60, handleId: "edge600b",
  rails: [{ place: "rear-top", height: 100 }, { place: "rear-bottom", height: 100 }] };
const antresol: Partial<Module> = { backType: "none", plinthHeight: 0, doorOpen: "push", rails: [{ place: "rear-top", height: 100 }] };
const antShelf = at(604 - 330 - 8, 16, 604); // верхний отсек антресоли 330 в свету, нижний 242
const hidden = (y: number, height: number, length: number, extra: Partial<DrawerConfig> = {}): DrawerConfig =>
  ({ slide: "gtv0fpo", operation: "soft-close", brand: "dtc", height, length, y, ...extra });
const handleAt = 850; // центр торцевой ручки 600 от пола (по эскизу ≈550–1150)
// Левый модуль: внизу 250 свободно, выкатная обувница (полка на скрытых направляющих), 2 ящика 200 за дверью (открытие за верх фасада),
// полка над ящиками (обязательная), штанга. Подсветка в левой стойке по датчику движения.
// Нижней задней стяжки в левом модуле нет: в зоне ящиков у стойки петель — фальш 32 (склейка) до задней кромки, стяжка в неё упирается;
// низ держат цоколь спереди, фальш на конфирматах и обязательная полка над ящиками.
const left = mod("Угловой шкаф · левый", 482 /* 500 по эскизу − ФП 16+5 к стене слева (регламент цеха) */, H, D_L, { ...lower, rails: [{ place: "rear-top", height: 100 }], hingeSide: "left", lightSensor: true }, [{
  rod: true, drawers: 3, drawerGrip: true, standLights: ["left"], handleFloor: [handleAt],
  drawerConfigs: [hidden(250 - IB, 60, 500, { tray: true, handle: false }), hidden(480 - IB, 160, 500), hidden(680 - IB, 160, 500)],
}]);
// Центральный модуль: полка 480 (жёсткая), штанга, петли 155–165°, подсветка в левой стойке по датчику движения.
const center = mod("Угловой шкаф · центр", 500, H, D_L, { ...lower, hingeSide: "left", wideHinges: true, lightSensor: true }, [{
  rod: true, rodAt: at(IT - 70, IB, IT) /* штанга в 70 под крышей, над полкой 480 */, shelves: [at(472, IB, IT)], fixed: [0], standLights: ["left"], handleFloor: [handleAt],
}]);
// Правое крыло вдоль боковой стены (глубина 380 с фасадом): полки 360 · 260 · 260 · 220 · 220 · 280 · 280 снизу, 2 жёсткие.
const rightShelves = [368, 644, 920, 1156, 1392, 1688].map((c) => at(c, IB, IT));
const W_R = 1070 - 584; // крыло от линии корпусов задней части (584) до конца боковой стены 1070
const right = mod("Угловой шкаф · правое крыло", W_R, H, D_R, { ...lower, hingeSide: "right" }, [{ shelves: rightShelves, fixed: [2, 4], handleFloor: [handleAt] }]);
const antL = mod("Антресоль · левая", left.width, ANT, D_L, antresol, [{ shelves: [antShelf], fixed: [0] }]);
const antC = mod("Антресоль · центр", 500, ANT, D_L, antresol, [{ shelves: [antShelf], fixed: [0] }]);
const antR = mod("Антресоль · правое крыло", W_R, ANT, D_R, { ...antresol, hingeSide: "right" }, [{ shelves: [antShelf], fixed: [0] }]);
const X0 = 21; // ФП 16 + 5 мм к стене слева
const XR = 1386 - D_R; // крыло: задняя грань у правой стены
export const CORNER_IDS: string[] = [];
const corner: PlacedModule[] = [
  place(left, X0, 0), place(center, X0 + left.width, 0),
  place(right, XR, 584, 0, 270),
  place(antL, X0, 0, H), place(antC, X0 + left.width, 0, H),
  place(antR, XR, 584, H, 270),
];
corner.forEach((a) => CORNER_IDS.push(a.id));

// ---------- Изделие 2: пенал 430 × 2620 × 340 в нишу, без дна, задник ЛДСП в цвет корпуса, двери влево (петли у выступа стены).
// Фасады снизу вверх: дверь 650, 2 ящика 200 (накладные, в проёме между дверями), открытая ниша 220, дверь 1350.
const PH = 2620, PD = 322 /* 340 с фасадом */, PIB = 60, PIT = PH - 16;
const pencil = mod("Пенал в нишу", 430, PH, PD, { backType: "board", bottomType: "none", plinthHeight: 60, hingeSide: "left", handleId: "edge600b", drawerHandleId: "edge350b" }, [{
  doorSplit: 619 /* низ двери 30 (цоколь 60) → верх 648 */, doorNiche: 624 /* верхняя дверь от 1272 */, handleFloor: [null, null, 1590] /* верхняя дверь: ручка в нижней части (эскиз ≈1290–1890) */,
  doorHandles: ["edge500b", null, null, null] /* нижняя дверь 618: ручка 600 не проходит (не длиннее фасада − 40) — торцевая 500 */,
  drawers: 2, drawerConfigs: [hidden(650 - PIB - 1, 140, 270, { facadeH: 198 }), hidden(850 - PIB + 1, 140, 270, { facadeH: 198 })],
  // полки за нижней дверью 250 · 200 (полку под ящиками студия не ставит ближе 80 мм к ящикам — ящики на боковинах), над нишей — жёсткая,
  // за верхней дверью 4 отсека и верхний отсек 330 в свету; жёсткие — над нишей, средняя и верхняя (жёсткость пенала без дна)
  shelves: [258, 458, 1264, 1514, 1765, 2016, 2266].map((c) => at(c, PIB, PIT)), fixed: [2, 4, 6],
}]);
const P_Z = 1501; // ниша на левой стене плана: проём 432 между наличником двери (z < 1500) и выступом стены 345 (z > 1932)
export const PENCIL_IDS: string[] = [];
const pencilPlaced = place(pencil, 0, P_Z, 0, 90);
PENCIL_IDS.push(pencilPlaced.id);

export const project: Project = {
  version: 3,
  measurement: { number: "7442203", date: "2026-10-22", notes: "Согласованный конструктив (эскизы 2620). Угол 1386 × 1070, потолок 2638–2643; ниша пенала 431–434 × 344–346 × 2638–2639. План схематичный: взаимное расположение угла и ниши по фото не определено." },
  room: {
    width: 1386, depth: 2400, height: 2638, openings: [],
    obstacles: [
      { id: "wall-return", name: "Выступ стены у ниши пенала 345", type: "column", x: 0, y: 0, z: 1932, width: 345, depth: 100, height: 2638 },
      { id: "door-casing", name: "Наличник двери у ниши", type: "column", x: 0, y: 0, z: 1440, width: 20, depth: 60, height: 2100 },
    ],
  },
  modules: [...corner, pencilPlaced],
  calculation: { markup: 2.2, overrides: {}, model: "markup" },
};

export function build(): Project { return applyAutoFillers(parseProject(JSON.parse(JSON.stringify(project)))); }
if (process.argv[1]?.endsWith("order-7442203.ts")) {
  const parsed = build();
  const errors = projectErrors(parsed);
  if (!process.argv.includes("--no-write")) { mkdirSync("public/local-projects", { recursive: true }); writeFileSync("public/local-projects/order-7442203.json", JSON.stringify(parsed, null, 1)); }
  const sub = (ids: string[]): Project => ({ ...parsed, modules: parsed.modules.filter((a) => ids.includes(a.id)) });
  const sum = (p: Project) => { const e = estimate(p); return { client: e.byMarkup, material: e.split.material, hardware: e.split.hardware, retail: e.retailExtras, cost: e.knownCost, sheets: e.ldspSheets, bySheet: e.bySheet, pending: e.lines.filter((l) => l.pending).map((l) => `${l.label} × ${l.quantity}`), missing: e.missing.map((l) => l.label) }; };
  const collisions = parsed.modules.flatMap((a) => partCollisions(parts(a.module), a.module).map((c) => a.module.name + ": " + c.names.join(" × ")));
  const validation = parsed.modules.flatMap((a) => validate(a.module).map((e) => a.module.name + ": " + e));
  const out = { decor: DECOR, facade: FACADE, errors, validation, collisions,corner: sum(sub(CORNER_IDS)), pencil: sum(sub(PENCIL_IDS)), total: sum(parsed),
    fillers: parsed.modules.map((a) => `${a.module.name}: ${a.module.cornerFiller ? "угол " + a.module.cornerFiller + "/" + a.module.cornerKind : ""}${a.module.wallFiller ? " стена " + Object.keys(a.module.wallFiller).join(",") : ""} x=${a.x} z=${a.z}`) };
  const outFile = arg("out", "");
  if (outFile) writeFileSync(outFile, JSON.stringify(out, null, 1));
  if (process.argv.includes("--json")) console.log(JSON.stringify(out));
  else if (outFile) console.log("ошибки:", errors.length, "валидация:", validation.length, "пересечения:", collisions.length, collisions.join(" | "), "· итог", out.total.client, "· шкаф", out.corner.client, "· пенал", out.pencil.client);
  else { console.log(JSON.stringify(out, null, 1)); if (process.argv.includes("--lines")) for (const l of estimate(parsed).lines) console.log(`  ${l.id} | ${l.label} · ${l.quantity} ${l.unit} × ${l.unitPrice ?? "?"}${l.retail ? " (розница)" : ""}${l.pending ? " (после финального расчёта)" : ""}`); }
  if (process.argv.includes("--parts")) for (const a of parsed.modules) for (const p of parts(a.module)) if (p.role !== "fastener") console.log(a.module.name, "|", p.id.replace(/^[0-9a-f-]{36}/, "s"), p.name, p.size.map(Math.round).join("x"), p.position.map(Math.round).join(","));
}
