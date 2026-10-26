// Заказ 7437584, часть «а»: изделие 1 (шкаф в прихожую справа от двери, глубина 300) и изделие 3 (шкаф слева от входной двери
// 1600 × 2590 × 400). ТЗ переписано с эскизов дизайнера; данные клиента в репозиторий не пишутся — только номер заказа.
// Запуск: npx tsx scripts/order-7437584a.ts [путь.json] → проект (по умолчанию public/local-projects/order-7437584-a.json — личный,
// в публикацию не идёт) + смета по изделиям в консоль. Всё собрано функциями студии (initialModule/section, addUpperModule-правила,
// freePanel, setDoorHinge), без «импорта как есть».
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { initialModule, section, type Module, type Section } from "../src/model";
import { parseProject, projectErrors, applyAutoFillers, type Project, type PlacedModule } from "../src/project";
import { estimate, MARKUP_DEFAULT } from "../src/pricing";
import { freePanel } from "../src/freePanels";
import { setDoorHinge } from "../src/facadeEditing";
import { roomWarnings, collisionWarnings } from "../src/roomWarnings";

export const ORDER = "7437584";
const DECOR = "Клауд"; // ЛДСП Lamarty Cloud — корпус и фасады
let n = 0;
const nid = (p: string) => `${p}-${++n}`;
function mod(name: string, w: number, h: number, d: number, patch: Partial<Module>, sections: Partial<Section>[]): Module {
  const m = initialModule();
  Object.assign(m, { name, width: w, height: h, depth: d, decor: DECOR, facadeDecor: DECOR, hingeBrand: "gtv" }, patch);
  m.sections = sections.map((s) => ({ ...section(), shelves: [], drawers: 0, rod: false, ...s }));
  return m;
}
const place = (tag: string, module: Module, x: number, y = 0, z = 3 /* набивной задник ХДФ 3 мм за корпусом */): PlacedModule => ({ id: nid(tag), x, z, y, rotation: 0, module });
/** Доля высоты проёма для полки по чистому просвету под ней (clear — от верха дна до низа полки). */
const shelfAt = (m: Module, clear: number) => {
  const t = 16, inner = m.height - (m.plinthHeight ?? 0) - 2 * t;
  return (clear + t / 2) / inner; // как поле панели «Полка N» (центр полки от дна проёма, мм)
};

// ─── Помещение (условное): обе изделия у одной стены по сторонам входной двери, от боковых стен с отступом (без автофальшей) ───
const X3 = 200, DOOR_W = 1000, X1 = X3 + 1600 + DOOR_W; // изделие 3 слева от двери, изделие 1 справа
const ROOM_W = X1 + 1800 + 200, ROOM_H = 2700;

// ─── Изделие 1 · глубина 300 (вкл. фасады 16 + 2 воздуха → корпус 282) ───
const D1 = 282;
// Подвесной модуль с ящиком 800 × 200, низ на 750 от пола, push.
const drawerBox = mod("И1 · подвесной ящик", 800, 200, D1, { doors: false, plinthHeight: 0, hanging: true, backType: "nailed" },
  [{ drawers: 1, drawerConfigs: [{ slide: "gtv0fpo", brand: "dtc", operation: "push", height: 100 /* ниже навесов в углах корпуса 200 */, length: 250, handle: false }] }]);
// Скамья 1000 × 450: две открытые секции 500 + 500, без цоколя (дно на полу), посадочное 32 мм.
const bench = mod("И1 · скамья", 1000, 450, 300, { doors: false, plinthHeight: 0, backType: "nailed", seatTop: true }, [{}, {}]);
// Антресоль 1800 × 590: отсеки 800 / 500 / 500, карниз 90 в плоскости фасадов, фасады 500: 800 — откидной вверх, 500 + 500 — push.
// Предел ширины корпуса студии 1300 → два навесных корпуса 800 + 1000 (вопрос Максу: нужна ли антресоль 1800 одним корпусом).
const antPatch1: Partial<Module> = { doors: true, doorOpen: "push", plinthHeight: 0, hanging: true, topStrip: 90, backType: "nailed", facadeSketchH: 500 /* по эскизу (решение 26.10) */ };
// жёсткая полка у верхней кромки откидного фасада — под петли (без неё у карниза петлям не за что держаться)
const ant1a = mod("И1 · антресоль 800 (откидная)", 800, 590, D1, antPatch1, [{ doorLeaves: 1, shelves: [468 / 558], fixed: [0] }]);
const ant1b = mod("И1 · антресоль 1000", 1000, 590, D1, antPatch1, [{ doorLeaves: 1 }, { doorLeaves: 1 }]);
// Щит 1000 × 1550 над скамьёй до низа антресоли — свободная панель ЛДСП 16, кромка 2.
const shield = freePanel({ name: "И1 · щит над скамьёй", width: 1000, height: 1550, thickness: 16, plane: "xy", edge: 2, decor: DECOR });
Object.assign(shield, { id: nid("i1"), x: X1 + 800, y: 450, z: 0 });

// ─── Изделие 3 · 1600 × 2590 × 400 (корпус 384), три модуля 533 ───
const D3 = 384, W3 = [533, 533, 534], LOW = 2000, PL = 80;
const lowPatch: Partial<Module> = { doors: true, plinthHeight: PL, backType: "nailed", facadeSketchH: 1996 /* эскиз: 2000 от пола до низа антресоли, зазоры 2 + 2, фасад закрывает цоколь */, handleId: "hexa1200b" /* торцевая HEXA L-1200 чёрный мат (ответ Макса 26.10: торцевые — HEXA L) */ };
const left = mod("И3 · левый", W3[0], LOW, D3, lowPatch, [{ doorLeaves: 1, pullouts: 1 }]);
left.sections[0].shelves = [shelfAt(left, 500)]; left.sections[0].fixed = [0];
const mid = mod("И3 · центр", W3[1], LOW, D3, lowPatch, [{ doorLeaves: 1, pullouts: 1, drawerGrip: true }]);
{ // снизу отсек 300, полка съёмная, отсек 200, ящики 200 + 200 (скрытый монтаж, доводчик, за верх фасада), над ними полка, отсек под штангу
  const s = mid.sections[0];
  s.shelves = [shelfAt(mid, 300)];
  const y0 = 300 + 16 + 200; // низ фасада первого ящика от верха дна
  s.drawers = 2;
  s.drawerConfigs = [0, 1].map((k) => ({ slide: "gtv0fpo" as const, brand: "unihopper" as const, operation: "soft-close" as const, height: 140 /* RULES.drawerH — как даёт панель («Добавить: Ящики») */, length: 300, handle: false, y: y0 + k * 200 }));
}
const right = mod("И3 · правый", W3[2], LOW, D3, lowPatch, [{ doorLeaves: 1, pullouts: 1 }]);
right.sections[0].shelves = [shelfAt(right, 1500)]; right.sections[0].fixed = [0];
const antPatch: Partial<Module> = { doors: true, doorOpen: "push", plinthHeight: 0, topStrip: 90, backType: "nailed", facadeSketchH: 500 /* по эскизу */ };
const ant3 = (name: string, w: number, shelf: boolean) => {
  const a = mod(name, w, 590, D3, antPatch, [{ doorLeaves: 1 }]);
  if (shelf) a.sections[0].shelves = [0.5];
  return a;
};

const project: Project = {
  version: 3,
  measurement: { number: ORDER, date: "2026-10-26", notes: "Изделия 1 и 3 по эскизам дизайнера (ТЗ.md заказа). Помещение условное: размеры стен не заданы." },
  // решение Макса 26.10: цена клиенту — по большей из двух моделей (коэффициент / лист); ветка o-7441182, коммит ef9811a
  calculation: { markup: MARKUP_DEFAULT, overrides: {}, maxModel: true },
  room: {
    width: ROOM_W, depth: 2400, height: ROOM_H,
    // входная дверь между изделиями не рисуется: в квартирах она открывается наружу, зона открывания мешала бы только для вида
  },
  modules: [
    // изделие 3
    place("i3", left, X3, 0), place("i3", mid, X3 + W3[0], 0), place("i3", right, X3 + W3[0] + W3[1], 0),
    place("i3", ant3("И3 · антресоль левая", W3[0], false), X3, LOW), place("i3", ant3("И3 · антресоль центр", W3[1], false), X3 + W3[0], LOW),
    place("i3", ant3("И3 · антресоль правая", W3[2], true), X3 + W3[0] + W3[1], LOW),
    // изделие 1
    place("i1", drawerBox, X1, 750), place("i1", bench, X1 + 800, 0), shield, place("i1", ant1a, X1, 2000), place("i1", ant1b, X1 + 800, 2000),
  ],
};
// откидной вверх фасад 800 антресоли изделия 1 (петли сверху, газлифты) — функция студии, как ПКМ «Петли сверху»
const a1 = project.modules.find((p) => p.module === ant1a)!;
setDoorHinge(a1.module, `${a1.module.sections[0].id}:door:0`, "top", "adagio");

export function build(): Project { return applyAutoFillers(parseProject(JSON.parse(JSON.stringify(project)))); }
export const productOf = (p: PlacedModule) => (p.id.startsWith("i1") ? 1 : 3);

if (/order-7437584a\.ts$/.test(process.argv[1] ?? "")) {
  const parsed = build();
  const out = process.argv[2] ?? "public/local-projects/order-7437584-a.json";
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(parsed, null, 1));
  console.log("Ошибки проекта:", projectErrors(parsed).join(" | ") || "нет");
  const warns = [...roomWarnings(parsed), ...collisionWarnings(parsed)];
  console.log("Замечания расстановки:", warns.length ? "\n  " + warns.map((w) => (w as { text?: string; message?: string }).text ?? (w as { message?: string }).message ?? JSON.stringify(w)).join("\n  ") : "нет");
  const fmt = (v: number | null) => (v === null ? "—" : v.toLocaleString("ru-RU"));
  for (const k of [1, 3, 0]) {
    const sub: Project = k ? { ...parsed, modules: parsed.modules.filter((m) => productOf(m) === k) } : parsed;
    const e = estimate(sub);
    console.log(`\n=== ${k ? "Изделие " + k : "ИТОГО"}: клиенту ${fmt(e.retail)} ₽ (листов ЛДСП ${e.ldspSheets}) · материалы ${fmt(e.split.material)} · фурнитура ${fmt(e.split.hardware)} · без цены ${e.missing.length} · после финального расчёта ${e.pending.length}`);
    if (k) for (const l of e.lines) console.log(`  ${l.id} | ${l.label} · ${l.quantity} ${l.unit} × ${l.unitPrice ?? "?"}${l.retail ? " (розница)" : ""}${l.pending ? " (после финального расчёта)" : ""}`);
  }
}
