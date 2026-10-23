// Распознаватель шкафа Базиса (эталон Кухни/etalon-w/wNNN.json, scripts/etalon_wardrobe.py) → модуль шкафа студии.
// Только параметры существующих правил шкафов студии (model.ts): габарит, цоколь/ножки, задник, секции по перегородкам, полки
// (жёсткие — во всю ширину проёма, съёмные — с зазорами), штанга, ящики (число), распашные фасады, стол. Правила шкафов студии
// здесь НЕ меняются: чего текущие правила не умеют — в unsupported (это запись в backlog-wardrobes.md, а не правка правил).
import { initialModule, section, deskModule, rearClear, innerMinus, RULES, type Module, type Section } from "../../src/model";
import type { RefModule, RefPanel, RefHardware } from "../kitchen/compare";
import type { PlacedModule } from "../../src/project";

export type WRefPanel = RefPanel & { role?: string; edges?: { side: string | null; thick: number; len?: number | null }[] };
export type WRefModule = Omit<RefModule, "panels"> & { panels: WRefPanel[]; carcass?: number[]; level?: string };
export type WardrobeRecognition = { module: Module; unsupported: string[]; notes: string[] };

const r1 = (v: number) => Math.round(v * 10) / 10;
const T = RULES.panel;
const H = (p: WRefPanel) => p.box[4] - p.box[1], W = (p: WRefPanel) => p.box[3] - p.box[0], D = (p: WRefPanel) => p.box[5] - p.box[2];
const isRod = (h: RefHardware) => /труба|штанг/i.test(h.name);
const isDrawerHw = (h: RefHardware) => h.category === "направляющая" || h.category === "ящик-система";

/** Причины, по которым модуль Базиса заведомо не строится текущими правилами шкафов студии (категории backlog-wardrobes.md). */
function blockers(ref: WRefModule): string[] {
  const out: string[] = [];
  const ps = ref.panels;
  if (ref.archetype === "kupe") out.push("W_KUPE: купе (двери Аристо — отдельный объект kupe, распознавание не сделано)");
  if (ref.archetype === "part") out.push("W_PART: не корпус (1–2 детали, ящик или фасад отдельной сборкой без корпуса)");
  if (ps.some((p) => p.figure)) out.push("W_FIGURE: фигурная деталь (контур)");
  if (ps.some((p) => p.kind === "glass" || p.kind === "mirror")) out.push("W_GLASS: стекло/зеркало");
  const odd = ps.filter((p) => p.thick >= 10 && Math.round(p.thick) !== T && p.kind !== "hdf" && p.role !== "facade");
  if (odd.length) out.push(`W_THICK: корпус не 16 мм (${Math.round(odd[0].thick)})`);
  return out;
}

export function wardrobeFromEtalon(ref: WRefModule): WardrobeRecognition {
  const unsupported = blockers(ref), notes: string[] = [];
  const ps = ref.panels;
  const sides = ps.filter((p) => p.role === "side").sort((a, b) => a.box[0] - b.box[0]);
  const parts = ps.filter((p) => p.role === "partition").sort((a, b) => a.box[0] - b.box[0]);
  const bottom = ps.find((p) => p.role === "bottom"), top = ps.find((p) => p.role === "top");
  const facades = ps.filter((p) => p.role === "facade"), drawers = ps.filter((p) => p.role === "drawer");
  const backs = ps.filter((p) => p.role === "back"), plinths = ps.filter((p) => p.role === "plinth");
  const base = initialModule();
  if (ref.archetype === "desk") {
    const m = deskModule(base);
    const tp = ps.filter((p) => p.axis === "y").sort((a, b) => b.box[4] - a.box[4])[0];
    if (tp) { m.width = r1(W(tp)); m.depth = r1(D(tp)); m.height = r1(tp.box[4]); }
    unsupported.push("W_DESK: стол — распознавание опор/царги не сделано");
    return { module: { ...m, name: ref.name.slice(0, 60) }, unsupported, notes };
  }
  if (sides.length < 2) unsupported.push("W_NO_SIDES: нет пары крайних боковин");
  const x0 = sides.length ? sides[0].box[0] : Math.min(...ps.map((p) => p.box[0]));
  const x1 = sides.length ? sides[sides.length - 1].box[3] : Math.max(...ps.map((p) => p.box[3]));
  const y1 = sides.length ? Math.max(...sides.map((p) => p.box[4])) : Math.max(...ps.map((p) => p.box[4]));
  const z0 = sides.length ? Math.min(...sides.map((p) => p.box[2])) : 0, z1 = sides.length ? Math.max(...sides.map((p) => p.box[5])) : ref.size[2];
  const width = r1(x1 - x0), height = r1(y1), depth = r1(z1 - z0);
  // крыша между боковинами или на них
  if (top && W(top) > width - 2 * T + 1) unsupported.push("W_TOP_OVER: крыша на боковинах (студия — между)");
  if (!top) unsupported.push("W_NO_TOP: без крыши");
  if (!bottom) unsupported.push("W_NO_BOTTOM: без дна");
  if (bottom && W(bottom) > width - 2 * T + 1) unsupported.push("W_BOTTOM_UNDER: дно под боковинами (студия — между)");
  // цоколь / ножки: низ дна
  const legs = ref.hardware.filter((h) => h.category === "опора");
  const by0 = bottom ? r1(bottom.box[1]) : 0;
  const m: Module = { ...base, name: ref.name.slice(0, 60), width, height, depth, decor: "Белый", facadeDecor: "Белый", doors: facades.some((p) => p.axis === "z" && H(p) >= 300) };
  if (legs.length && by0 > 0) { m.feet = { height: by0 }; m.plinthHeight = 0; }
  else m.plinthHeight = by0;
  if (by0 > 0 && !legs.length && !plinths.length) unsupported.push("W_RAISED_BOTTOM: дно поднято, цоколя нет");
  if (plinths.length) {
    const inset = r1(z1 - Math.max(...plinths.map((p) => p.box[5])));
    if (Math.abs(inset - RULES.plinthInset) > 0.5) unsupported.push(`W_PLINTH_INSET: цоколь утоплен на ${inset} (студия ${RULES.plinthInset})`);
  }
  // задник
  const hdf = backs.filter((p) => p.kind === "hdf"), ldspBack = backs.filter((p) => p.kind !== "hdf");
  if (ldspBack.length) m.backType = "board";
  else if (!hdf.length) m.backType = "none";
  else if (hdf.some((p) => p.box[2] > z0 + 1)) { m.backType = "groove"; m.grooveInset = r1(Math.min(...hdf.map((p) => p.box[2])) - z0); }
  else m.backType = "nailed";
  if (hdf.length > 1 || ldspBack.length > 1) unsupported.push("W_BACK_PARTS: задник из нескольких частей");
  if (m.backType === "nailed" && hdf.length === 1) {
    // накладной ХДФ: отступ от наружных граней корпуса (поле модуля backGap; студия по умолчанию 2)
    const g = r1(Math.min(hdf[0].box[0] - x0, x1 - hdf[0].box[3])), gy = r1(Math.min(hdf[0].box[1] - (m.feet ? by0 : 0), height - hdf[0].box[4]));
    if (Math.abs(g - gy) <= 0.5 && g >= 0) m.backGap = g;
    else unsupported.push(`W_BACK_GAPS: отступы ХДФ по бокам ${g} и по высоте ${gy} разные`);
  }
  // конфирматы стыков горизонталей с боковинами: отступ от кромки (поле confirmatInset; студия 50)
  const conf = ref.hardware.filter((h) => /конфирмат|евровинт/i.test(h.name) && (Math.abs(h.pos[0] - x0) < 20 || Math.abs(h.pos[0] - x1) < 20));
  const insets = conf.map((h) => r1(Math.min(h.pos[2] - z0, z1 - h.pos[2]))).filter((v) => v > 0 && v < depth / 2);
  if (insets.length) {
    const cnt = new Map<number, number>(); for (const v of insets) cnt.set(v, (cnt.get(v) ?? 0) + 1);
    m.confirmatInset = [...cnt].sort((a, b) => b[1] - a[1])[0][0];
  }
  // фасады: толщина, «воздух» до корпуса, отступ от кромок и зазор между фасадами — поля модуля (не правила)
  const fz = facades.filter((p) => p.axis === "z" && H(p) >= 100);
  if (fz.length) {
    const ft = [...new Set(fz.map((p) => r1(p.thick)))];
    if (ft.length === 1) m.facadeT = ft[0]; else unsupported.push("W_FACADE_T: фасады разной толщины");
    if (fz.some((p) => p.kind !== "ldsp")) m.facadeMaterial = "external";
    if (Math.max(...fz.map((p) => p.box[5])) <= z1 + 0.5) {
      // вкладные фасады в проём (поле doorMount; зазоры у вкладных — по правилу студии)
      m.doorMount = "inset";
    } else {
      m.faceAir = r1(Math.min(...fz.map((p) => p.box[2])) - z1);
      m.faceGap = r1(Math.min(...fz.map((p) => Math.min(p.box[0] - x0, x1 - p.box[3]))));
    }
    const fy0 = Math.min(...fz.map((p) => p.box[1])), fy1 = Math.max(...fz.map((p) => p.box[4]));
    if (fy1 - fy0 < 0.9 * (height - by0)) unsupported.push("W_DOOR_PARTIAL: фасады закрывают не всю высоту (открытые ниши)");
    const xs = [...fz].sort((a, b) => a.box[0] - b.box[0]);
    const gaps = xs.slice(1).map((p, i) => r1(p.box[0] - xs[i].box[3])).filter((g) => g > 0 && g < 10);
    if (gaps.length) m.faceGapBetween = Math.min(...gaps);
  }
  // секции по перегородкам на всю высоту проёма
  const inner0 = bottom ? bottom.box[4] : by0, inner1 = top ? top.box[1] : height;
  // перегородки во всю высоту проёма и частичные (решение Макса 23.10.2026: Section.divider — между двумя горизонталями,
  // над/под ней полки во всю ширину двух секций; опоры-горизонтали студия строит сама — из полок секций их убираем)
  const full = parts.filter((p) => H(p) >= 0.9 * (inner1 - inner0)), partial = parts.filter((p) => !full.includes(p));
  const edges = [x0 + T, ...parts.flatMap((p) => [p.box[0], p.box[3]]), x1 - T];
  const span = (k: number) => { const p = partial.find((q) => Math.abs(q.box[0] - edges[2 * k - 1]) < 0.6); return p && { from: r1(p.box[1]), to: r1(p.box[4]) }; };
  const secs: Section[] = [], supports = new Set<WRefPanel>(), through = new Map<WRefPanel, number>();
  for (let k = 1; k < edges.length / 2; k++) {
    const sp = span(k);
    if (!sp) continue;
    if (span(k - 1) || span(k + 1)) unsupported.push("W_PART_HEIGHT: две частичные перегородки у одной секции");
    const px0 = edges[2 * k - 2], px1 = edges[2 * k + 1];
    const pair = ps.filter((p) => p.role === "shelf" && p.kind !== "hdf" && p.box[0] <= px0 + 2 && p.box[0] >= px0 - 2 && p.box[3] >= px1 - 2 && p.box[3] <= px1 + 2);
    const under = pair.find((p) => Math.abs(p.box[4] - sp.from) < 0.6), over = pair.find((p) => Math.abs(p.box[1] - sp.to) < 0.6);
    if ((sp.from > inner0 + 0.5 && !under) || (sp.to < inner1 - 0.5 && !over)) unsupported.push("W_PART_SUPPORT: частичная перегородка опирается не на сквозную горизонталь");
    if (under) supports.add(under);
    if (over) supports.add(over);
    for (const p of pair) if (!supports.has(p) && (p.box[4] <= sp.from + 0.5 || p.box[1] >= sp.to - 0.5)) through.set(p, k - 1);
  }
  for (let i = 0; i < edges.length; i += 2) {
    const sx0 = edges[i], sx1 = edges[i + 1], sw = sx1 - sx0, h = inner1 - inner0, k = i / 2;
    const s: Section = { ...section(), weight: Math.max(1, r1(sw)) };
    const sp = k > 0 ? span(k) : undefined;
    if (sp) s.divider = sp;
    const inSec = (p: WRefPanel) => p.box[0] >= sx0 - 2 && p.box[3] <= sx1 + 2;
    // сквозная полка пары — у левой секции (studio: throughShelf); жёсткая — по ширине пары
    const pw = (p: WRefPanel) => (through.has(p) ? edges[2 * through.get(p)! + 3] - edges[2 * through.get(p)!] : sw);
    const sh = ps.filter((p) => p.role === "shelf" && p.kind !== "hdf" && !supports.has(p) && (through.has(p) ? through.get(p) === k : inSec(p))).sort((a, b) => a.box[1] - b.box[1]);
    s.shelves = sh.map((p) => Math.round((((p.box[1] + p.box[4]) / 2 - inner0) / h) * 1e4) / 1e4);
    const fixed = sh.map((p, j) => (W(p) >= pw(p) - 0.5 ? j : -1)).filter((j) => j >= 0);
    if (fixed.length) s.fixed = fixed;
    // глубина полок: правило студии (решение Макса 23.10.2026) — жёсткие в размер корпуса, съёмные на 5 мм меньше; иначе поле shelfDepth
    // (одно на все полки секции, жёсткие и съёмные)
    const full = depth - rearClear(m) - innerMinus(m, "fixed"), byRule = (j: number) => (fixed.includes(j) ? full : full - RULES.shelfRemovableMinus);
    if (sh.some((p, j) => Math.abs(D(p) - byRule(j)) > 0.5)) {
      const deep = [...new Set(sh.map((p) => r1(D(p))))];
      if (deep.length === 1) s.shelfDepth = deep[0];
      else if (deep.length > 1) unsupported.push("W_SHELF_DEPTHS: полки секции разной глубины");
    }
    const rods = ref.hardware.filter((hw) => isRod(hw) && hw.pos[0] >= sx0 - 2 && hw.pos[0] <= sx1 + 2);
    if (rods.length) { s.rod = true; s.rodAt = Math.round(((rods[0].pos[1] - inner0) / h) * 1e4) / 1e4; }
    const drw = new Set(drawers.filter(inSec).map((p) => p.grp ?? "")).size;
    if (drw) { s.drawers = Math.min(5, drw); notes.push(`секция ${secs.length + 1}: ящиков ${drw}`); }
    const fac = facades.filter((p) => p.axis === "z" && H(p) >= 300 && p.box[0] < sx1 && p.box[3] > sx0);
    if (fac.length === 1 || fac.length === 2) s.doorLeaves = fac.length as 1 | 2;
    else if (fac.length > 2) unsupported.push(`W_DOOR_ROWS: ${fac.length} фасадов в секции (ряды/антресольные двери)`);
    secs.push(s);
  }
  if (secs.length) m.sections = secs;
  // ручек в проекте Базиса нет (ручки заказчика, push, профиль) — поле noHandles, как у кухонь Базиса
  if (!ref.hardware.some((h) => h.category === "ручка")) m.noHandles = true;
  // кромка видимых торцов корпуса (поле edgeBody: 2 | 1 | 0,8) — по переднему торцу боковин Базиса; 0,4–0,5 «в цвет» студия не задаёт (S_EDGE)
  const fe = sides.flatMap((p) => (p.edges ?? []).filter((e) => e.side === "+z").map((e) => e.thick));
  if (fe.length && fe.every((t) => t === fe[0]) && (fe[0] === 1 || fe[0] === 0.8 || fe[0] === 2)) m.edgeBody = fe[0] as 1 | 0.8 | 2;
  if (drawers.length) unsupported.push("W_DRAWERS: ящики (системы Versalite/Firmax/Quadro — перенос правил кухни не сделан)");
  if (ref.hardware.some(isDrawerHw) && !drawers.length) notes.push("направляющие без деталей ящика");
  if (facades.some((p) => p.axis !== "z")) unsupported.push("W_FACADE_SIDE: фасад/декор не во фронтальной плоскости");
  return { module: m, unsupported, notes };
}

/** Расстановка параметрического изделия в помещении (import.ts): модули уже поставлены place() кухонь (p_world = origin + Ry(yaw)·p_mod);
 *  габарит сцены — по занимаемым прямоугольникам (при повороте 90/270 по x — глубина, по z — ширина), сцена сдвигается так, чтобы
 *  до стен было по margin, пол — y = 0. Меняет x/y/z модулей; возвращает габарит сцены и размеры помещения. */
export function layoutWardrobe(placed: PlacedModule[], margin = 300): { size: number[]; room: { width: number; depth: number; height: number } } {
  const ext = placed.map((a) => {
    const rot = a.rotation === 90 || a.rotation === 270, y = a.y ?? 0;
    return [a.x, y, a.z, a.x + (rot ? a.module.depth : a.module.width), y + a.module.height, a.z + (rot ? a.module.width : a.module.depth)];
  });
  const g0 = [0, 1, 2].map((i) => Math.min(...ext.map((b) => b[i]))), g1 = [3, 4, 5].map((i) => Math.max(...ext.map((b) => b[i])));
  for (const pm of placed) { pm.x = r1(pm.x - g0[0] + margin); pm.y = r1((pm.y ?? 0) - g0[1]); pm.z = r1(pm.z - g0[2] + margin); }
  const size = [g1[0] - g0[0], g1[1] - g0[1], g1[2] - g0[2]];
  return { size, room: { width: Math.ceil(size[0] + 2 * margin), depth: Math.ceil(size[2] + 2 * margin), height: Math.max(2700, Math.ceil(size[1] + 100)) } };
}