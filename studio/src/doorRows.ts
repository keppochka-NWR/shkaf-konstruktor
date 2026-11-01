// Ряды распашных фасадов секции (Макс 01.11: «всё ещё нельзя дробить фасады на 3 и более»): было только у кухни, теперь у обычных шкафов.
// Только правки модели — те же для панели справа и меню правой кнопки; геометрию строит parts() (doorBands), петли — по высоте каждого ряда.
import { doorBands, doorCount, doorRowCount, doorRowsBlock, drawerCapTop,externalDrawerBoundary, facadeBottom, facadeTop, fb, RULES, type Module, type Section } from "./model";

/** Рядов фасадов в секции: 5 — предел модели (нижний, 3 средних, верхний); у шкафа каждый ряд — от doorRowMinH (200), у кухни панель даёт до 4, как было. */
export const MAX_DOOR_ROWS = 5;
const sectionOf = (m: Module, sid: string) => { const s = m.sections.find((x) => x.id === sid); if (!s) throw Error("Выберите секцию."); return s; };
const half = (v: number) => Math.round(v * 2) / 2;
/** Настройки по номеру створки (row*2+col), которые держат фасады рядов сверх оставшихся. */
const LEAF_KEYS = ["doorHandles", "handleFloor", "handlePos", "hingeAngles"] as const;

/** Высота нижнего ряда при включении «Разделить фасады по высоте» — половина высоты фасадов секции (галочка панели и меню). */
export function defaultDoorSplit(m: Module, s: Section) {
  // ящики в накладку (правка 29.10): дверь начинается над ящиками — от низа двери (externalDrawerBoundary), как в parts()
  const ext = externalDrawerBoundary(m, s);
  return Math.round((facadeTop(m) - (ext && Number.isFinite(ext.doorBottom) ? Math.max(facadeBottom(m), ext.doorBottom) : s.externalDrawers && s.drawers ? drawerCapTop(m, s) + (s.doorGap ?? RULES.faceGap) : facadeBottom(m))) / 2);
}

/** Высота равного фасада при n рядах: от низа двери (над ящиками вровень) до верха фасадов, минус зазоры. С проёмом между рядами (ящики в нём
 *  стоят по своей высоте) нижний ряд не трогаем — поровну делятся ряды над проёмом. */
function equalFace(m: Module, s: Section, n: number) {
  const whole = doorBands(m, { ...s, doorSplit: undefined, doorRows: undefined })[0], g = s.doorGap ?? fb(m);
  if (s.doorNiche !== undefined && s.doorSplit !== undefined) return (whole[1] - (whole[0] + s.doorSplit - g / 2 + s.doorNiche) - Math.max(0, n - 2) * g) / (n - 1);
  return (whole[1] - whole[0] - g - Math.max(0, n - 2) * g) / n;
}
/** Сколько рядов встаёт в секцию при равных фасадах (у шкафа каждый ряд от doorRowMinH). */
export function maxDoorRows(m: Module, s: Section): number {
  const min = m.kitchen ? 200 : RULES.doorRowMinH;
  for (let n = MAX_DOOR_ROWS; n > 2; n--) if (equalFace(m, s, n) >= min) return n;
  return 2;
}

function trimLeaves(s: Section, rows: number) {
  for (const k of [...LEAF_KEYS, "doorHinges", "doorLifts"] as const) { const a = s[k] as unknown[] | undefined; if (a && a.length > 2 * rows) { const t = a.slice(0, 2 * rows); if (t.some((v) => v !== null && v !== undefined)) (s[k] as unknown[]) = t; else delete s[k]; } }
}

/** Галочка «Разделить фасады по высоте» (панель и меню): снять — одна дверь на секцию и чистые настройки рядов; иначе модель не проходила
 *  проверку (doorRows и doorNiche без doorSplit) и галочка «не снималась». */
export function setDoorSplit(m: Module, sid: string, on: boolean): void {
  const s = sectionOf(m, sid), why = doorRowsBlock(m);
  if (why) throw Error(why);
  if (on) { s.doorSplit = defaultDoorSplit(m, s); delete s.removedDoors; return; }
  delete s.doorSplit; delete s.doorNiche; delete s.doorRows; delete s.hingeYMid; delete s.hingeYMidFor; delete s.removedDoors;
  trimLeaves(s, 1); // петли и ручка нижнего ряда — той же двери: она и остаётся
}

/** «Рядов фасадов» секции. Шкаф: равные фасады на всю высоту двери (остаток — верхнему), снятые двери и петли/подъёмники створок — заново,
 *  ручки — у тех рядов, что остались. Кухня — как было: средний ряд 400, нижний не меняется. */
export function setDoorRowCount(m: Module, sid: string, n: number): void {
  const s = sectionOf(m, sid), why = doorRowsBlock(m);
  if (why) throw Error(why);
  if (!Number.isInteger(n) || n < 1 || n > MAX_DOOR_ROWS) throw Error(`Рядов фасадов: от 1 до ${MAX_DOOR_ROWS}.`);
  if (n === 1) { setDoorSplit(m, sid, false); return; }
  if (m.kitchen) {
    const mid = n - 2, r = [...(s.doorRows ?? [])].slice(0, mid);
    while (r.length < mid) r.push(400);
    if (r.length) s.doorRows = r; else delete s.doorRows;
    delete s.removedDoors; delete s.doorHinges; delete s.doorLifts;
    if (s.hingeYMid) { const hm = s.hingeYMid.slice(0, mid), hf = (s.hingeYMidFor ?? []).slice(0, mid); if (hm.length) { s.hingeYMid = hm; s.hingeYMidFor = hf; } else { delete s.hingeYMid; delete s.hingeYMidFor; } }
    if (s.hingeless) { const hl = s.hingeless.filter((k) => k < 2 * n); if (hl.length) s.hingeless = hl; else delete s.hingeless; }
    return;
  }
  const g = s.doorGap ?? fb(m), face = Math.floor(equalFace(m, s, n) * 2) / 2;
  if (face < RULES.doorRowMinH) throw Error(`${n} ${n < 5 ? "ряда" : "рядов"} не встанет: фасад выйдет ${Math.round(face)} мм, а ряд ниже ${RULES.doorRowMinH} мм не делаем. В этой секции — не больше ${maxDoorRows(m, s)} рядов.`);
  if (s.doorNiche === undefined || s.doorSplit === undefined) s.doorSplit = half(face + g / 2);
  if (n > 2) s.doorRows = Array.from({ length: n - 2 }, () => face); else delete s.doorRows;
  delete s.removedDoors; delete s.doorHinges; delete s.doorLifts; delete s.hingeY; delete s.hingeYFor;
  trimLeaves(s, n);
}

/** Высоты всех рядов как детали (снизу вверх): панель показывает верхний ряд — он считается остатком. */
export function doorRowHeights(m: Module, s: Section): number[] {
  return doorBands(m, s).map(([a, b]) => Math.round((b - a) * 10) / 10);
}

/** Подпись кнопки двери в панели: дверь по счёту среди дверей секции (раньше считались и фасады ящиков), при рядах — номер ряда снизу. */
export function doorPickLabel(m: Module, s: Section, doorId: string): string {
  const k = Number(doorId.split(":door:")[1]), row = Math.floor(k / 2), count = doorCount(m, s), n = row * count + (k % 2) + 1;
  return "Дверь " + n + (doorRowCount(m, s) > 1 ? ` · ряд ${row + 1}` : "");
}

/** Смена высоты корпуса (критик 01.11): раньше весь прирост и вся убыль шли верхнему ряду — 5 рядов не проходили 2400→2000, а при росте верхний вырастал втрое.
 *  Равные ряды остаются равными; заданные вручную стоят, верхний берёт разницу, пока он не ниже doorRowMinH, — иначе тоже в пропорции. Только секции со средними рядами
 *  и шкафы: у 2 рядов и кухни разрез как был. */
export function fitDoorRowsAfterResize(m: Module, before: Module): void {
  if (m.kitchen || m.height === before.height) return;
  for (const s of m.sections) {
    const w = before.sections.find((x) => x.id === s.id);
    if (!w?.doorRows?.length || !s.doorRows?.length || s.doorNiche !== undefined) continue;
    const hs = doorBands(before, w).map(([a, b]) => b - a), wb = doorBands(before, { ...w, doorSplit: undefined, doorRows: undefined })[0];
    const equal = Math.max(...hs) - Math.min(...hs) <= 3, up = doorBands(m, s).at(-1)!;
    if (equal || up[1] - up[0] < RULES.doorRowMinH) rescaleDoorRows(m, s, wb[1] - wb[0]);
  }
}

/** После смены низа двери (ящики вровень / за дверью): ряды секции — в той же пропорции на новую высоту, иначе верхний ряд съедало до ошибки. */
export function rescaleDoorRows(m: Module, s: Section, was: number): void {
  if (s.doorSplit === undefined || s.doorNiche !== undefined) return;
  const whole = doorBands(m, { ...s, doorSplit: undefined, doorRows: undefined })[0], now = whole[1] - whole[0];
  if (!Number.isFinite(now) || !(was > 0) || !(now > 0) || Math.abs(now - was) < 0.5) return;
  const r = now / was;
  s.doorSplit = half(s.doorSplit * r);
  if (s.doorRows) s.doorRows = s.doorRows.map((h) => half(h * r));
}
