// Распознавание ящиков кухонь Базиса (base-drawers): ручная посадка из проекта, которая расходится с правилами студии.
// Отдельный файл, чтобы не конфликтовать с соседями по fromEtalon.ts. Только для ящиков, распознанных fromEtalon (m.kdrawers).
// Прогон по всем 34 кухням (09.10.2026):
//  - Axis PRO, саморезы 3×3 держателя задней стенки: по правилу (все точки) — 56 держателей из 80; только крайние (средняя
//    без самореза, накол D5×1 есть) — k15 m04 и все модули k18 (24 держателя, 2 кухни);
//  - Axis PRO, кромка дна: без кромки (правило) — 27 доньев / 13 модулей; по кругу — 14 (k18, k30); только задний торец — 11 (k05, k29);
//    перед и зад — 1 (k25 m11).
import type { Module } from "../../src/model";
import { isAxis, REAR_SCREWS, type AxisEdgeSide } from "../../src/kitchenDrawers";
import type { RefModule } from "./compare";

type Edge = { side: string; thick: number };
const r1 = (v: number) => Math.round(v * 10) / 10;

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
