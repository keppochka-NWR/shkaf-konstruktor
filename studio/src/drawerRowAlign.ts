// Верх ящиков вровень с рядом соседней секции (Макс 01.11, ответ на вопрос: «да, автоматически»). Ящики вровень с дверями (Section.drawersToRow):
// верх стопки встаёт на ближайший стык рядов соседней секции — верхний край фасада на верх нижнего ряда соседа, своя дверь над ящиками — на низ
// следующего ряда (зазор как у дверей). Флаг ставит только галочка «вровень», поэтому старые проекты не меняются, пока её не коснулись.
// Сосед поменял ряды — keepDrawersOnRows (один коммит с его правкой, один шаг отмены). Не встаёт ни на один стык — ящики остаются как есть,
// в панели короткая заметка (drawerRowInfo); модель с новой ошибкой проверки не принимается. Высоту ящика задали вручную — привязка снимается.
import { rescaleDoorRows } from "./doorRows";
import { boxes, doorBands, drawerCapTop, drawerConfig, drawerOffsets, drawersFillRoof, drawersFlush, fb, hasDrawerCap, nicheDrawers, RULES, validate, withEvenFaces, type Module, type Section } from "./model";
import type { DrawerConfig } from "./hardware";

const SNAP = 0.3; // округление фасадов (по 0,1…0,5 мм) не считаем сдвигом стыка
const MAX_BOX = 300; // короб ящика, как в distributeDrawers

/** Стыки соседних секций, мм от низа модуля: верх нижнего из двух соседних рядов (над проёмом doorNiche ряд продолжается не сразу) и верх ящиков соседа вровень —
 *  над ними у соседа тоже стык (критик 01.11: без этого секция прыгала на следующий ряд соседа). Сосед сам привязан к ряду: его ряды ходят за его ящиками, поэтому
 *  из них берётся только верх ящиков, а автоматическая правка (auto) не смотрит на него вовсе — две привязанные секции не гоняют друг друга. */
export function neighbourRowSeams(m: Module, s: Section, auto = false): number[] {
  if (!m.doors) return [];
  const i = m.sections.findIndex((x) => x.id === s.id), out = new Set<number>();
  for (const j of [i - 1, i + 1]) {
    const n = m.sections[j];
    if (!n) continue;
    const tied = !!n.drawersToRow && applicable(m, n);
    if (auto && tied) continue;
    if (applicable(m, n)) out.add(Math.round(drawerCapTop(m, n) * 10) / 10);
    if (tied || n.doorSplit === undefined) continue;
    const bs = doorBands(m, n), g = n.doorGap ?? fb(m);
    for (let k = 0; k < bs.length - 1; k++) if (Number.isFinite(bs[k][1]) && bs[k + 1][0] - bs[k][1] <= g + 0.5) out.add(Math.round(bs[k][1] * 10) / 10);
  }
  return [...out].sort((a, b) => a - b);
}

/** Привязка возможна: ящики вровень стопкой от дна, над ними дверь. Кухня и модули со своими правилами — без неё. */
function applicable(m: Module, s: Section): boolean {
  if (m.kitchen || m.raw || m.kupe || m.corner || m.casework || m.desk || m.sectionLayout || !(s.drawers > 0) || !drawersFlush(m, s) || nicheDrawers(m, s)) return false;
  const b = boxes(m).find((x) => x.id === s.id);
  if (!b || (!hasDrawerCap(m, s, b) && drawersFillRoof(m, s, b))) return false; // до крыши — двери над ящиками нет
  if (Math.abs(Math.min(...drawerOffsets(s))) > 0.01) return false;
  return !Array.from({ length: s.drawers }, (_, j) => drawerConfig(m, s, j)).some((c) => c.mesh || c.tray || c.noFacade);
}

/** Верх полки над ящиками = стык: своя дверь начинается через зазор, как следующий ряд соседа. Ящики — поровну. Предел — правило короба 68…300 (то же, что у поля
 *  «От дна до верха полки над ящиками»): критик 01.11, фасад 857 мм вместо 177 — выше короба ящик не растягиваем, ящики остаются как есть, в панели заметка. */
function stackUpTo(m: Module, s: Section, seam: number): DrawerConfig[] | null {
  const b = boxes(m).find((x) => x.id === s.id)!, n = s.drawers, stack = seam - b.bottom - RULES.panel, step = RULES.drawerStep;
  const pitch = Math.floor((stack / n) * 2) / 2, last = stack - (n - 1) * pitch;
  if (pitch - step < 68 || last - step > MAX_BOX) return null;
  const plain = Array.from({ length: n }, (_, j) => { const { facadeH: _f, y: _y, ...c } = drawerConfig(m, s, j); void _f; void _y; return c; });
  const cs: DrawerConfig[] = plain.map((c, j) => ({ ...c, height: (j < n - 1 ? pitch : last) - step, y: j * pitch }));
  return withEvenFaces(m, { ...s, drawerConfigs: cs }, cs);
}

const onSeam = (m: Module, s: Section, seams: number[]) => seams.some((a) => Math.abs(drawerCapTop(m, s) - a) <= SNAP);

/** Поставить ящики секции на ближайший стык соседа, где модель остаётся верной; true — ящики сдвинулись. Не встали — ящики как были. */
export function alignDrawersToRow(m: Module, s: Section, auto = false): boolean {
  if (!applicable(m, s) || onSeam(m, s, neighbourRowSeams(m, s))) return false;
  const seams = neighbourRowSeams(m, s, auto);
  if (!seams.length) return false;
  const top = drawerCapTop(m, s), base = new Set(validate(m)), idx = m.sections.indexOf(s);
  const whole = doorBands(m, { ...s, doorSplit: undefined, doorRows: undefined })[0], was = whole[1] - whole[0];
  for (const seam of [...seams].sort((a, c) => Math.abs(a - top) - Math.abs(c - top))) {
    const t = structuredClone(m), st = t.sections[idx], next = stackUpTo(t, st, seam);
    if (!next) continue;
    st.drawerConfigs = next;
    rescaleDoorRows(t, st, was); // свои ряды над ящиками — в той же пропорции на новую высоту двери
    if (Math.abs(drawerCapTop(t, st) - seam) > SNAP || validate(t).some((e) => !base.has(e))) continue;
    s.drawerConfigs = st.drawerConfigs;
    if (st.doorSplit !== undefined) s.doorSplit = st.doorSplit;
    if (st.doorRows) s.doorRows = st.doorRows;
    return true;
  }
  return false;
}

/** Галочка «Верх ящиков по ряду соседней секции» под галочкой «вровень». Снята — ящики остаются, где стоят. */
export function setDrawersToRow(m: Module, sid: string, on: boolean): void {
  const s = m.sections.find((x) => x.id === sid);
  if (!s) throw Error("Выберите секцию.");
  if (!on) { delete s.drawersToRow; return; }
  s.drawersToRow = true;
  alignDrawersToRow(m, s);
}

/** Для заметки в панели. null — привязка к этой секции не относится (одна секция, ящики до крыши, между рядами). */
export function drawerRowInfo(m: Module, s: Section): { seam: number } | { none: string } | null {
  if (m.sections.length < 2 || !applicable(m, s)) return null;
  const seams = neighbourRowSeams(m, s);
  if (!seams.length) return { none: "У соседних секций нет рядов и ящиков вровень — ящики оставлены как есть." };
  const hit = seams.find((a) => Math.abs(drawerCapTop(m, s) - a) <= SNAP);
  return hit !== undefined ? { seam: hit } : { none: "До ряда соседней секции ящикам не дотянуться: короб вышел бы выше 300 мм или ниже 68 мм — оставлены как есть." };
}

const stackShape = (s: Section) => JSON.stringify(Array.from({ length: s.drawers }, (_, j) => { const c = s.drawerConfigs?.[j]; return [c?.height, c?.y, c?.facadeH]; }));

/** Перед записью правки в историю (App.commitProject): соседа перестроили — ящики идут за его рядом в том же шаге отмены. Высоту самих ящиков
 *  поменяли вручную (то же число ящиков) — привязка снимается: иначе ручная правка тут же бы откатывалась. */
export function keepDrawersOnRows<P extends { modules: { id: string; module: Module }[] }>(prev: P, next: P): P {
  let modules = next.modules;
  next.modules.forEach((a, i) => {
    if (!a.module.sections.some((s) => s.drawersToRow)) return;
    const was = prev.modules.find((x) => x.id === a.id)?.module, n = structuredClone(a.module);
    let changed = false;
    for (const s of n.sections) { // один проход: секции идут только за соседом без привязки (auto), поэтому друг друга не гоняют
      if (!s.drawersToRow) continue;
      const w = was?.sections.find((x) => x.id === s.id), own = next.modules[i].module.sections.find((x) => x.id === s.id)!;
      if (w?.drawersToRow && w.drawers === own.drawers && stackShape(w) !== stackShape(own)) { delete s.drawersToRow; changed = true; continue; }
      if (alignDrawersToRow(n, s, true)) changed = true;
    }
    if (changed) { if (modules === next.modules) modules = [...next.modules]; modules[i] = { ...a, module: n }; }
  });
  return modules === next.modules ? next : { ...next, modules };
}
