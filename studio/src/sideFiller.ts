// Фальшпанель сбоку модуля из кругового меню «Фальши › Фальшпанель слева/справа» (баг Макса 29.10.2026: «в круглом меню
// возможность есть, по факту не работает» — у модуля вплотную к соседу панель уходила в соседа, правка отклонялась
// «пересекается», ничего не добавлялось). Правило Макса (РЕШЕНИЯ.md 29.10): фальш ставится на сторону S модуля;
//  • с противоположной стороны O свободно — модуль СДВИГАЕТСЯ от фальша на его ширину, размер не меняется;
//  • с противоположной стороны вплотную модуль или стена — модуль, в который ставят фальш, УЖЕ на ширину фальша;
//  • свободно меньше, чем нужно, — сдвиг на сколько есть, остаток — сужение (наше решение, ДОСКА 29.10);
//  • край модуля со стороны S остаётся на месте (фальш встаёт «в модуль», как в примере Макса); исключение — у стены уже стоит
//    фальш торцом (16 + зазор): панель встаёт на его место, модуль не двигается.
// Ширина фальша вдоль ряда: панель 16; у стены 16 + зазор к стене (RULES.wallFillerEdgeGap) — как фальш торцом к стене
// (планка торцом на этой стороне заменяется панелью: applyAutoFillers её не ставит, если есть боковая панель).
// Сужение — в пределах модуля (минимум 100, кухня — свой минимум) и проверок модели; не входит — отказ с причиной.
// Модуль сверху вплотную той же ширины (антресоль) едет и сужается вместе с ним.
import { needsWallFiller, RULES, validate, type Module } from "./model";
import { applyAutoFillers, localToRoom, projectErrors, sideExtension, type PlacedModule, type Project } from "./project";
import { gaps, setWidthKeeping } from "./rowResize";
import { KITCHEN } from "./kitchen";
import { rawKitchen } from "./rawModule";

type Side = "left" | "right";
const r1 = (v: number) => Math.round(v * 10) / 10;
const sideName = (s: Side) => (s === "left" ? "слева" : "справа");

/** Можно ли ставить боковую фальшпанель этому объекту (шкафы студии и кухонные модули палитры). */
export function sideFillerApplies(m: Module) {
  return !m.raw && !m.bazis && !m.kupe && !m.worktop && !m.desk && !m.corner && !m.casework && !rawKitchen(m.raw) && !m.radius;
}

/** Размер новой боковой фальшпанели: шкаф на полу — до потолка (от 2400, как было в меню), кухонный и поднятый модуль — высотой модуля;
 *  глубина — корпус + фасад (18), лицо вровень с фасадами. */
export function newSidePanel(m: Module, y: number, roomHeight: number) {
  const height = m.kitchen || y > 0 ? m.height : Math.max(m.height, Math.min(2400, roomHeight - y));
  return { height, depth: m.depth + 18 };
}

/** Модуль(и) сверху вплотную той же ширины и поворота (антресоль над шкафом) — двигаются вместе с ним. */
function stackAbove(p: Project, a: PlacedModule): PlacedModule[] {
  const out: PlacedModule[] = [];
  let cur = a;
  for (;;) {
    const top = (cur.y ?? 0) + cur.module.height;
    const next = p.modules.find((x) => x.id !== a.id && !out.includes(x) && (x.rotation ?? 0) === (a.rotation ?? 0) && Math.abs((x.y ?? 0) - top) < 2 && Math.abs(x.x - cur.x) < 2 && Math.abs(x.z - cur.z) < 2 && Math.abs(x.module.width - cur.module.width) < 2 && !x.module.worktop);
    if (!next) return out;
    out.push(next); cur = next;
  }
}

function shiftAlong(a: PlacedModule, d: number): PlacedModule {
  const o = localToRoom(a, 0, 0), t = localToRoom(a, d, 0);
  return { ...a, x: r1(a.x + t.x - o.x), z: r1(a.z + t.z - o.z) };
}

export type SideFillerResult = { project: Project; note: string; shift: number; narrow: number };

/** Поставить (или снять) боковую фальшпанель модулю mid со стороны side по правилу «сдвиг или сужение». */
export function toggleSideFiller(p: Project, mid: string, side: Side): SideFillerResult {
  const base = applyAutoFillers(p), a = base.modules.find((x) => x.id === mid);
  if (!a) throw Error("Модуль не найден.");
  const m = a.module;
  if (!sideFillerApplies(m)) throw Error("Боковая фальшпанель ставится на шкафы и кухонные модули студии.");
  // снять: только панель; модуль остаётся, где стоит (вернуть размер и место — Ctrl+Z); у стены автофальш торцом вернётся сам
  if (m.sidePanels?.[side]) {
    const n = structuredClone(m), next = { ...n.sidePanels }; delete next[side];
    if (Object.keys(next).length) n.sidePanels = next; else delete n.sidePanels;
    return { project: { ...p, modules: p.modules.map((x) => (x.id === mid ? { ...x, module: n } : x)) }, note: "", shift: 0, narrow: 0 };
  }
  if (m.cornerFiller === side) throw Error(`${sideName(side).replace(/^./, (c) => c.toUpperCase())} у «${m.name}» уже стоит угловой фальш к соседу под 90° — вторая панель там не нужна.`);
  const other: Side = side === "left" ? "right" : "left";
  const g = gaps(base, mid);
  const panel = newSidePanel(m, a.y ?? 0, p.room.height);
  // край модуля со стороны фальша остаётся на месте (фальш встаёт «в модуль»); у стены — с зазором к стене, как фальш торцом
  const atWall = g[side].what === "стена" && g[side].gap <= RULES.wallSnap;
  const need = RULES.panel + (atWall ? RULES.wallFillerEdgeGap : 0);
  // место у боковины сейчас: то, что занимает нынешний фальш этой стороны (торцом к стене — его заменит панель), и зазор до стены
  const have = sideExtension(m, side) + (atWall ? g[side].gap : 0);
  const deficit = r1(Math.max(0, need - have));
  let shift = 0, narrow = 0;
  if (deficit > 0) {
    // свободно с другой стороны; у стены корпусу с фасадами там нужна ещё своя планка торцом (16 + зазор), если её пока нет
    let free = g[other].gap;
    if (g[other].what === "стена" && needsWallFiller(m) && !m.autoFillersOff && !m.wallFiller?.[other] && !m.sidePanels?.[other] && free < RULES.wallSnap + RULES.panel + RULES.wallFillerEdgeGap)
      free = Math.max(0, free - RULES.panel - RULES.wallFillerEdgeGap);
    shift = r1(Math.min(deficit, Math.max(0, free)));
    narrow = r1(deficit - shift);
  }
  const width = r1(m.width - narrow);
  const min = m.kitchen ? KITCHEN.minWidth : RULES.minW;
  const what = `Фальшпанель ${sideName(side)} у «${m.name}»`;
  if (narrow > 0 && width < min) throw Error(`${what} не встаёт: ${sideName(other)} нет места, модуль пришлось бы сузить до ${width} мм, а меньше ${min} мм модуль не бывает. Освободите место ${sideName(other)} или уберите соседа.`);
  const n: Module = { ...structuredClone(m), width, sidePanels: { ...m.sidePanels, [side]: panel } };
  if (n.wallFiller?.[side]) { const wf = { ...n.wallFiller }; delete wf[side]; if (Object.keys(wf).length) n.wallFiller = wf; else delete n.wallFiller; }
  if (narrow > 0) { const e = validate(n)[0]; if (e) throw Error(`${what} не встаёт: модуль пришлось бы сузить до ${width} мм — ${e}`); }
  // новая геометрия: сторона S уходит на deficit внутрь, сторона O — на shift наружу
  const keep: Side = side === "left" ? "right" : "left";
  // x — модуль на прежнем месте с прежней шириной; mod — новая модель (уже суженная)
  const move = (x: PlacedModule, mod: Module) => { const w = setWidthKeeping(x, mod.width, keep); return shiftAlong({ ...w, module: mod }, side === "left" ? shift : -shift); };
  const stack = deficit > 0 ? stackAbove(base, a) : [];
  const moved = new Map<string, PlacedModule>([[a.id, deficit > 0 ? move(a, n) : { ...a, module: n }]]);
  for (const s of stack) {
    const sm = { ...structuredClone(s.module), width: r1(s.module.width - narrow) };
    if (narrow > 0) { const e = validate(sm)[0]; if (e) throw Error(`${what} не встаёт: модуль сверху «${s.module.name}» пришлось бы сузить до ${sm.width} мм — ${e}`); }
    moved.set(s.id, move(s, sm));
  }
  const project = { ...p, modules: p.modules.map((x) => moved.get(x.id) ?? x) };
  const check = applyAutoFillers(project), e = projectErrors(check)[0];
  if (e) throw Error(`${what} не встаёт: ${e}`);
  const parts = [shift ? `модуль сдвинут ${other === "right" ? "вправо" : "влево"} на ${shift} мм` : "", narrow ? `модуль уже на ${narrow} мм: ${m.width} → ${width} мм` : ""].filter(Boolean);
  const note = parts.length ? `${what}: ${parts.join(", ")} (фальш ${need} мм${atWall ? ` у стены: ${RULES.panel} + ${RULES.wallFillerEdgeGap}` : ""}).` : "";
  return { project, note, shift, narrow };
}
