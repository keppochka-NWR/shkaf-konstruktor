// Распознавание ящиков кухонь Базиса (base-drawers): ручная посадка из проекта, которая расходится с правилами студии.
// Отдельный файл, чтобы не конфликтовать с соседями по fromEtalon.ts. Только для ящиков, распознанных fromEtalon (m.kdrawers).
// Прогон по всем 34 кухням (09.10.2026):
//  - Axis PRO, саморезы 3×3 держателя задней стенки: по правилу (все точки) — 56 держателей из 80; только крайние (средняя
//    без самореза, накол D5×1 есть) — k15 m04 и все модули k18 (24 держателя, 2 кухни);
//  - Axis PRO, кромка дна: без кромки (правило) — 27 доньев / 13 модулей; по кругу — 14 (k18, k30); только задний торец — 11 (k05, k29);
//    перед и зад — 1 (k25 m11).
import type { Module } from "../../src/model";
import { isAxis, isFirmax, axisRailY, REAR_SCREWS, FIRMAX, type AxisEdgeSide } from "../../src/kitchenDrawers";

/** Длины, на которые есть сетки релинга Базиса (kitchenDrawers M.railing). */
const M_RAIL_LENS: number[] = [450, 500, 550];
import type { RefModule } from "./compare";

type Edge = { side: string; thick: number };
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Firmax: конфирматы снизу через дно (confUnder — точки Базиса от внутренней грани левой боковины ящика; есть в k03 m05,
 *  k30 m12–m17, k31 — 7 модулей из 18 с Firmax) и саморезы 3×3 направляющей не по правилу (screwDz; k31 — 20 и 244 вместо 37 и 261,
 *  6 ящиков из 40). Возвращает заметки. */
export function firmaxAsBazis(ref: RefModule, m: Module): string[] {
  const notes: string[] = [];
  if (!m.kitchen || !m.kdrawers?.some(isFirmax)) return notes;
  const W = ref.size[0], conf = ref.hardware.filter((h) => /онфирмат/.test(h.name));
  m.kdrawers = m.kdrawers.map((k, j) => {
    if (!isFirmax(k)) return k;
    const side = ref.panels.find((p) => /^Боковина ящика лев/i.test(p.name) && p.box[0] < W / 2 && Math.abs(p.box[1] - k.box.y) < 0.6);
    if (!side) return k;
    const [x0, y0, z0, x1, , z1] = side.box, box = { ...k.box };
    const bot = ref.panels.find((p) => /^Дно ящика/i.test(p.name) && p.box[0] >= x1 - 0.5 && p.box[0] < x1 + 30 && p.box[1] >= y0 - 0.5 && p.box[2] >= z0 - 0.5 && p.box[5] <= z1 + 0.5);
    if (bot) {
      const xs = [...new Set(conf.filter((h) => Math.abs(h.pos[1] - bot.box[1]) < 0.3 && h.pos[0] > x1 && h.pos[0] < bot.box[3] && h.pos[2] > z0 && h.pos[2] < z1).map((h) => r1(h.pos[0] - x1)))].sort((a, b) => a - b);
      // ширина дна между боковинами ящика — при ней сняты точки (при смене ширины модуля точки держатся за свою боковину)
      if (xs.length) { box.confUnder = xs; box.confUnderW = r1(bot.box[3] - x1); notes.push(`ящик ${j + 1}: конфирматы снизу через дно ${xs.join(", ")} — как в Базисе`); }
    }
    // глубина D5 конфирматов боковин в заднюю стенку короба (FurnList.Holes): 37 во всех проектах, кроме k31 (42)
    const bi = ref.panels.findIndex((p) => /^Задн/i.test(p.name) && /ящика/i.test(p.name) && p.box[0] >= x1 - 0.5 && p.box[0] < x1 + 30 && p.box[1] >= y0 - 0.5 && p.box[2] < z0 + 1);
    const ds = ((ref as unknown as { holes?: { panel?: number; d: number; depth: number; face: string }[] }).holes ?? []).filter((h) => h.panel === bi && h.d === 5 && /x/.test(h.face)).map((h) => h.depth);
    if (bi >= 0 && ds.length && ds.every((v) => v === ds[0]) && ds[0] !== 37) { box.confDepth = ds[0]; notes.push(`ящик ${j + 1}: конфирматы короба D5×${ds[0]} — как в Базисе`); }
    // саморезы направляющей — на внутренней грани боковины корпуса (боковина ящика − зазор), у низа короба
    const xin = x0 - (k.box.gap ?? FIRMAX.gap);
    const dz = [...new Set(ref.hardware.filter((h) => h.name === "3x3" && Math.abs(h.pos[0] - xin) < 0.6 && h.pos[1] > y0 - 0.5 && h.pos[1] < y0 + 40).map((h) => r1(z1 - h.pos[2])))].sort((a, b) => a - b);
    const rule = box.len >= 440 ? [37, 261] : [37, 165];
    if (box.screws && dz.length === 2 && dz.join() !== rule.join()) { box.screwDz = dz; notes.push(`ящик ${j + 1}: саморезы направляющей ${dz.join(", ")} от фронта короба — как в Базисе`); }
    return { ...k, box };
  });
  return notes;
}

/** Ставит у ящиков Axis PRO rearScrews и edge.bottom, если в проекте Базиса не по правилу. Возвращает заметки. */
export function axisAsBazis(ref: RefModule, m: Module): string[] {
  const notes: string[] = [];
  if (!m.kitchen || !m.kdrawers?.length) return notes;
  const W = ref.size[0];
  const runs = ref.hardware.filter((h) => h.category === "направляющая" && /Axis PRO Направляющая/.test(h.name) && h.pos[0] < W / 2);
  m.kdrawers = m.kdrawers.map((k, j) => {
    if (!isAxis(k)) return k;
    const r = runs.find((h) => Math.abs(h.pos[1] - k.runnerY) < 0.1);
    if (!r) return k;
    const [x, y] = r.pos, out = { ...k };
    // держатель задней стенки левый: x + 53, y + 11 (точка студии); саморезы «3x3» — в той же точке x/z, по высоте свои
    const holder = ref.hardware.find((h) => /Axis PRO Держатель ЗС/.test(h.name) && Math.abs(h.pos[0] - x - 53) < 1 && Math.abs(h.pos[1] - y - 11) < 1);
    if (holder) {
      const dys = ref.hardware.filter((h) => h.name === "3x3" && Math.abs(h.pos[0] - holder.pos[0]) < 1.5 && Math.abs(h.pos[2] - holder.pos[2]) < 1.5)
        .map((h) => r1(h.pos[1] - holder.pos[1])).filter((dy) => dy > -40 && dy < 200);
      const rule = REAR_SCREWS[k.h] ?? [];
      // свои саморезы — только подмножество точек правила (накол D5×1 у всех точек правила есть всегда)
      if (dys.length && dys.length < rule.length && dys.every((dy) => rule.includes(dy))) { out.rearScrews = [...dys].sort((a, b) => a - b); notes.push(`ящик ${j + 1}: саморезы держателя задней стенки ${out.rearScrews.join(", ")} — как в Базисе`); }
    }
    // релинг Axis PRO: у фасада над левой направляющей, на верхе задней стенки минус 10,5 (axisRailY)
    const rail = ref.hardware.find((h) => /Axis PRO Релинг/.test(h.name) && Math.abs(h.pos[0] - x - 15.5) < 1 && Math.abs(h.pos[2] - r.pos[2]) < 1 && Math.abs(h.pos[1] - y - axisRailY(k)) < 0.6);
    if (rail && M_RAIL_LENS.includes(k.len)) { out.rail = true; notes.push(`ящик ${j + 1}: релинг Axis PRO — как в Базисе`); }
    // дно ящика: по высоте runnerY − 22, кромка — как в проекте
    const bot = ref.panels.find((p) => /Дно выдв/.test(p.name) && Math.abs(p.box[1] - (y - 22)) < 0.6);
    const ed = ((bot as unknown as { edges?: Edge[] } | undefined)?.edges ?? []).filter((e) => e.thick > 0).map((e) => e.side as AxisEdgeSide);
    if (ed.length) {
      const all = ["+x", "-x", "+z", "-z"].every((s) => ed.includes(s as AxisEdgeSide));
      out.edge = { bottom: all ? true : ed.filter((s) => ["+x", "-x", "+z", "-z"].includes(s)) };
      notes.push(`ящик ${j + 1}: кромка дна ${all ? "по кругу" : ed.join("")} — как в Базисе`);
    }
    return out;
  });
  return notes;
}
