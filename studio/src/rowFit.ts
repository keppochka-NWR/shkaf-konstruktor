// Новый шкаф не помещается в ряд у стены (критик релиза 22.10, m1): комната 2400, первый шкаф 1200 у левой стены (с фальшем 21 мм),
// второй 1200 молча вставал ПЕРЕД первым — справа свободно 1179, а у правой стены ему тоже нужна фальшпанель 16 + 5 мм.
// Вместо молчаливой расстановки — понятное сообщение и варианты: сузить под фальш, сузить без фальша у стены, поставить отдельно.
import { RULES, needsWallFiller, type Module } from "./model";
import { appendModule, applyAutoFillers, bounds, projectErrors, type Project } from "./project";

/** Нехватка места в ряду: free — свободно справа от ряда до стены (мм), filler — фальш у стены (16 + 5),
 *  withFiller — ширина, которая встанет в ряд с фальшем, withoutFiller — без фальша у стены (null — вариант не подходит). */
export type RowShortage = { width: number; free: number; filler: number; withFiller: number | null; withoutFiller: number | null };

const inRow = (p: Project, placed: Project, rowZ: { lo: number; hi: number }, right: number) => {
  const a = placed.modules.at(-1)!, b = bounds(a);
  return b.z < rowZ.hi - 0.1 && b.z + b.d > rowZ.lo + 0.1 && b.x >= right - 0.5 && !projectErrors(applyAutoFillers(placed)).length && placed.modules.length === p.modules.length + 1;
};

/** Встанет ли новый корпус справа от ряда шкафов у стены; null — встанет (или правило не про него: кухня, купе, угловой, стол,
 *  первый корпус, повёрнутый ряд). Варианты проверены той же расстановкой, что «Добавить в комнату». */
export function rowShortage(p: Project, source: Module): RowShortage | null {
  if (source.kitchen || source.worktop || source.kupe || source.kupeZone || source.corner || source.desk || source.raw) return null;
  const f = applyAutoFillers(p);
  const row = f.modules.filter((a) => (a.y ?? 0) === 0 && !(a.rotation ?? 0) && !a.module.kitchen && !a.module.worktop);
  if (!row.length) return null;
  const bb = row.map(bounds), right = Math.max(...bb.map((b) => b.x + b.w)), last = bb.find((b) => b.x + b.w === right)!;
  const rowZ = { lo: last.z, hi: last.z + last.d };
  const tryAdd = (m: Module) => { try { const n = appendModule(p, m); return inRow(p, n, rowZ, right) ? n : null; } catch { return null; } };
  if (tryAdd(source)) return null;
  // свободно справа от ряда до стены (или до объекта/корпуса в полосе ряда)
  let end = p.room.width;
  const band = (b: ReturnType<typeof bounds>) => b.z < rowZ.hi - 0.1 && b.z + b.d > rowZ.lo + 0.1 && b.y < source.height - 0.1;
  for (const b of [...f.modules.map(bounds), ...(p.room.obstacles ?? []).map((o) => ({ x: o.x, y: o.y, z: o.z, w: o.width, h: o.height, d: o.depth }))]) if (band(b) && b.x >= right - 0.5 && b.x < end) end = b.x;
  const free = Math.round(end - right);
  const filler = end === p.room.width && needsWallFiller(source) ? RULES.panel + RULES.wallFillerEdgeGap : 0;
  // места хватает, но не встал — другая причина (высота, объект замера): как раньше
  if (free >= source.width + filler || free < 100) return null;
  const fits = (w: number, off: boolean) => w >= 100 && !!tryAdd({ ...source, width: w, ...(off ? { autoFillersOff: true } : {}) });
  const withFiller = fits(free - filler, false) ? free - filler : null;
  const withoutFiller = filler && fits(free, true) ? free : null;
  return { width: source.width, free, filler, withFiller, withoutFiller };
}

/** Текст сообщения: «Пустой шкаф» 1200 мм в ряд не встаёт: справа свободно 1179 из 1200 мм, у стены нужна фальшпанель 21 мм (16 + 5). */
export function rowShortageText(name: string, s: RowShortage): string {
  const wall = s.filler ? `, у стены нужна фальшпанель ${s.filler} мм (${RULES.panel} + ${RULES.wallFillerEdgeGap})` : "";
  const ways = [s.withFiller !== null ? `сузить до ${s.withFiller} мм${s.filler ? " (с фальшпанелью)" : ""}` : "", s.withoutFiller !== null ? `${s.withoutFiller} мм без фальшпанели у стены` : ""].filter(Boolean);
  return `«${name}» ${s.width} мм в ряд не встаёт: справа свободно ${s.free} из ${s.width} мм${wall}.` + (ways.length ? ` Можно ${ways.join(" или ")}.` : "") + " Или поставить отдельно — встанет перед шкафами.";
}
