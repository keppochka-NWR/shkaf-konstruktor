// Боковины разной глубины (пакет 4, backlog F_ASYM_SIDES): одна боковина во всю глубину модуля, вторая короче сзади (обход стояка,
// примыкание угла). Статистика по базе (34 кухни): боковина короче сзади на 45–290 мм у 12 модулей; у 4 из них (k03 m03, k07 m01,
// k24 m01, k28 m16) всё между боковинами стоит от задней кромки короткой, ХДФ набивной на короткой боковине и дне и заходит в паз
// длинной (на 4–7 мм) — это и есть правило kitchen.sideRecess. Остальные (ХДФ в пазу короткой — k31 m02, ХДФ на части ширины — k15 m07,
// без ХДФ — k09 m06, k14 m01, k15 m05, k27 m09, k27 m14, k30 m05) — пока не поддержаны, распознаватель их не трогает.
// Распознавание: эталон приводится к «внутреннему» корпусу (глубина − back, сдвиг к лицу, длинная боковина обрезана по короткой, ХДФ —
// накладной с тем же зазором, что у короткой боковины), его разбирает обычный moduleFromEtalon, затем поле sideRecess и глубина модуля.
import type { RefModule, RefPanel } from "./compare";

const r1 = (v: number) => Math.round(v * 10) / 10;
type Cut = RefPanel & { cuts?: { kind: string; box?: number[] }[] };
export type SideRecessRef = { side: "left" | "right"; back: number; into: number };

/** Боковины разной глубины с набивным ХДФ на короткой и в пазу длинной (kitchen.sideRecess); иначе null. */
export function sideRecessOf(ref: RefModule): SideRecessRef | null {
  const W = ref.size[0];
  const sides = ref.panels.filter((p) => p.axis === "x" && (p.kind === "ldsp" || p.kind === "mdf") && p.box[4] - p.box[1] > 200).sort((a, c) => a.box[0] - c.box[0]);
  if (sides.length !== 2) return null;
  const [L, R] = sides;
  if (L.box[0] > 0.6 || R.box[3] < W - 0.6) return null;
  // одна высота (низ — до толщины дна: дно под одной боковиной, m_ONESIDE, k03 m03), один перед; разная глубина сзади (от 20 мм)
  if (Math.abs(L.box[1] - R.box[1]) > 16.6 || Math.abs(L.box[4] - R.box[4]) > 0.6 || Math.abs(L.box[5] - R.box[5]) > 0.6) return null;
  const dz = r1(L.box[2] - R.box[2]);
  if (Math.abs(dz) < 20 || Math.min(L.box[2], R.box[2]) > 0.6) return null;
  const side: "left" | "right" = dz > 0 ? "left" : "right", short = side === "left" ? L : R, long = side === "left" ? R : L, back = r1(short.box[2]);
  // ХДФ — один, накладной на тыльный торец короткой боковины, по ширине — до паза длинной
  const hdf = ref.panels.filter((p) => p.kind === "hdf");
  if (hdf.length !== 1 || hdf[0].axis !== "z" || Math.abs(hdf[0].box[5] - back) > 0.6) return null;
  const h = hdf[0].box, into = r1(side === "left" ? h[3] - long.box[0] : long.box[3] - h[0]);
  if (into <= 0 || into > 8 || !(long as Cut).cuts?.some((c) => c.kind === "groove")) return null;
  return { side, back, into };
}

/** «Внутренний» эталон: корпус глубиной depth − back у лица — всё сдвинуто на back к задней кромке, длинная боковина обрезана по
 *  короткой (без паза под ХДФ), ХДФ — накладной с зазором короткой боковины. Отверстия и фурнитура — как есть, со сдвигом. */
export function sideRecessInner(ref: RefModule, s: SideRecessRef): RefModule {
  const W = ref.size[0], dz = -s.back;
  const sides = ref.panels.filter((p) => p.axis === "x" && (p.kind === "ldsp" || p.kind === "mdf") && p.box[4] - p.box[1] > 200).sort((a, c) => a.box[0] - c.box[0]);
  const long = s.side === "left" ? sides[1] : sides[0];
  return {
    ...ref,
    size: [ref.size[0], ref.size[1], r1(ref.size[2] - s.back)],
    panels: (ref.panels as Cut[]).map((p) => {
      const b: typeof p.box = [p.box[0], p.box[1], p.box[2] + dz, p.box[3], p.box[4], p.box[5] + dz];
      const cuts = p.cuts?.filter((c) => p !== long || c.kind !== "groove").map((c) => (Array.isArray(c.box) ? { ...c, box: [c.box[0], c.box[1], c.box[2] + dz, c.box[3], c.box[4], c.box[5] + dz] } : c));
      const q = { ...p, ...(cuts ? { cuts } : {}) };
      if (p === long) return { ...q, box: [b[0], b[1], Math.max(0, b[2]), b[3], b[4], b[5]] };
      if (p.kind === "hdf") return { ...q, box: s.side === "left" ? [b[0], b[1], b[2], W - b[0], b[4], b[5]] : [W - b[3], b[1], b[2], b[3], b[4], b[5]] };
      return { ...q, box: b };
    }),
    hardware: ref.hardware.map((h) => ({ ...h, pos: [h.pos[0], h.pos[1], h.pos[2] + dz] as typeof h.pos })),
    ...(ref.holes ? { holes: ref.holes.map((h) => ({ ...h, at: [h.at[0], h.at[1], h.at[2] + dz] as typeof h.at })) } : {}),
  };
}
