// Верх ящиков вровень с рядом соседней секции (Макс 01.11, ответ на вопрос: «да, автоматически»). Ящики вровень с дверями (Section.drawersToRow):
// верх стопки встаёт на ближайший стык рядов соседней секции — верхний край фасада на верх нижнего ряда соседа, своя дверь над ящиками — на низ
// следующего ряда (зазор как у дверей). Флаг ставит только галочка «вровень», поэтому старые проекты не меняются, пока её не коснулись.
// Сосед поменял ряды — keepDrawersOnRows (один коммит с его правкой, один шаг отмены). Не встаёт ни на один стык — ящики остаются как есть,
// в панели короткая заметка (drawerRowInfo); модель с новой ошибкой проверки не принимается. Высоту ящика задали вручную — привязка снимается.
import { rescaleDoorRows } from "./doorRows";
import { boxes, doorBands, drawerCapTop, drawerConfig, drawerOffsets, drawersFillRoof, drawersFlush, fb, hasDrawerCap, nicheDrawers, RULES, validate, withEvenFaces, type Module, type Section } from "./model";
import type { DrawerConfig } from "./hardware";

const SNAP = 0.3; // округление фасадов (по 0,1…0,5 мм) не считаем сдвигом стыка
const MAX_BOX = 300;

/** Стыки рядов соседних секций: верх нижнего из двух соседних рядов, мм от низа модуля. Только настоящие стыки: над проёмом (doorNiche) ряд продолжается не сразу. */
export function neighbourRowSeams(m: Module, s: Section): number[] {
  if (!m.doors) return [];
  const i = m.sections.findIndex((x) => x.id === s.id), out = new Set<number>();
  for (const j of [i - 1, i + 1]) {
    const n = m.sections[j];
    if (!n || n.doorSplit === undefined) continue;
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

/** Верх полки над ящиками = стык: своя дверь начинается через зазор, как следующий ряд соседа. Ящики — поровну; короб не выше 300, выше — фасадом. */
function stackUpTo(m: Module, s: Section, seam: number): Pick<Section, "drawerConfigs" | "drawerGap"> | null {
  const b = boxes(m).find((x) => x.id === s.id)!, n = s.drawers, stack = seam - b.bottom - RULES.panel, step = RULES.drawerStep;
  const pitch = Math.floor((stack / n) * 2) / 2, last = stack - (n - 1) * pitch;
  if (pitch - step < 68) return null;
  const plain = Array.from({ length: n }, (_, j) => { const { facadeH: _f, y: _y, ...c } = drawerConfig(m, s, j); void _f; void _y; return c; });
  if (last - step <= MAX_BOX) {
    const cs: DrawerConfig[] = plain.map((c, j) => ({ ...c, height: (j < n - 1 ? pitch : last) - step, y: j * pitch }));
    const even = withEvenFaces(m, { ...s, drawerConfigs: cs }, cs);
    return { drawerConfigs: even, drawerGap: s.drawerGap };
  }
  const gap = s.drawerGap ?? fb(m); // шаг по фасаду: тот же зазор, что у дверей (без поля шаг считался бы с зазором вкладного ящика)
  return { drawerConfigs: plain.map((c, j) => ({ ...c, height: MAX_BOX, y: j * pitch, facadeH: (j < n - 1 ? pitch : last) - gap })), drawerGap: gap };
}

const onSeam = (m: Module, s: Section, seams: number[]) => seams.some((a) => Math.abs(drawerCapTop(m, s) - a) <= SNAP);

/** Поставить ящики секции на ближайший стык соседа, где модель остаётся верной; true — ящики сдвинулись. Не встали — ящики как были. */
export function alignDrawersToRow(m: Module, s: Section): boolean {
  if (!applicable(m, s)) return false;
  const seams = neighbourRowSeams(m, s);
  if (!seams.length || onSeam(m, s, seams)) return false;
  const top = drawerCapTop(m, s), base = new Set(validate(m)), idx = m.sections.indexOf(s);
  const whole = doorBands(m, { ...s, doorSplit: undefined, doorRows: undefined })[0], was = whole[1] - whole[0];
  for (const seam of [...seams].sort((a, c) => Math.abs(a - top) - Math.abs(c - top))) {
    const t = structuredClone(m), st = t.sections[idx], next = stackUpTo(t, st, seam);
    if (!next) continue;
    st.drawerConfigs = next.drawerConfigs;
    if (next.drawerGap !== undefined) st.drawerGap = next.drawerGap;
    rescaleDoorRows(t, st, was); // свои ряды над ящиками — в той же пропорции на новую высоту двери
    if (Math.abs(drawerCapTop(t, st) - seam) > SNAP || validate(t).some((e) => !base.has(e))) continue;
    s.drawerConfigs = st.drawerConfigs;
    if (st.drawerGap !== undefined) s.drawerGap = st.drawerGap;
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
  if (!seams.length) return { none: "У соседних секций фасады не разделены на ряды — ящики оставлены как есть." };
  const hit = seams.find((a) => Math.abs(drawerCapTop(m, s) - a) <= SNAP);
  return hit !== undefined ? { seam: hit } : { none: "Ни на один ряд соседней секции ящики не встают по размерам — оставлены как есть." };
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
    for (let pass = 0; pass < 2; pass++) for (const s of n.sections) { // два прохода: секция с рядами над ящиками сама бывает соседом другой
      if (!s.drawersToRow) continue;
      const w = was?.sections.find((x) => x.id === s.id), own = next.modules[i].module.sections.find((x) => x.id === s.id)!;
      if (pass === 0 && w?.drawersToRow && w.drawers === own.drawers && stackShape(w) !== stackShape(own)) { delete s.drawersToRow; changed = true; continue; }
      if (alignDrawersToRow(n, s)) changed = true;
    }
    if (changed) { if (modules === next.modules) modules = [...next.modules]; modules[i] = { ...a, module: n }; }
  });
  return modules === next.modules ? next : { ...next, modules };
}
