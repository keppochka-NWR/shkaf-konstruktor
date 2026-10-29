// Устойчивая привязка вырезов (критик 29.10, блокер 2). Вырез (Module.cutouts) указывает на деталь по id, а у полок, ящиков,
// дверей секции id порядковый (`<секция>:shelf:2`, `<секция>:drawer:1:facade`, `<секция>:door:0`): вставили полку ниже — номер
// «верхней» полки сменился, и вырез молча переезжал на другую полку. Привязка держится при каждом изменении проекта: вырез идёт за
// своей деталью по месту (та же семья деталей — то же положение и размер), а не за номером. Удалили носитель — вырез снимается с
// сообщением. Ящики (круг 2): по номеру ящика в секции, удаление ящика перенумеровывает вырезы сама операция (remapDrawerCutouts);
// удалили секцию — вырезы на её деталях снимаются (dropCutoutsOnRemovedParts), как у удалённой полки. Формат файла и id деталей прежние, поэтому старые проекты (привязка по номеру на момент сохранения) читаются без миграции:
// номер в файле верен для того состояния, от которого начинается правка.
import { shapeBaseParts, type Module, type Part } from "./model";
import type { Cutout } from "./shapes";

/** Семья детали: id с порядковыми номерами, заменёнными на «#» (`s1:shelf:#`, `s1:drawer:#:facade`). Без номеров — id не порядковый. */
export const cutFamily = (id: string) => id.replace(/:(\d+)(?=:|$)/g, ":#");
const near = (a: Part, b: Part) => [0, 1, 2].every((i) => Math.abs(a.position[i] - b.position[i]) < 0.6 && Math.abs(a.size[i] - b.size[i]) < 0.6);
const safeParts = (m: Module): Part[] | null => { try { return shapeBaseParts(m); } catch { return null; } };

/** Деталь ящика секции: `<секция>:drawer:<номер>:<деталь>`. Номер ящика — его место в настройках секции (drawerConfigs), а не по
 *  высоте: ящики при правках пересчитываются поровну (комод, стопка от дна) и все сдвигаются, поэтому «по месту» их не узнать
 *  (круг 2 критика 29.10). Номер меняется только у удаления ящика (removePart — remapDrawerCutouts); «+/−» и вставка добавляют и
 *  снимают ящики сверху — номера нижних те же. */
const DRAWER_HOST = /^(.*):drawer:(\d+):(.+)$/;
const cutName = (c: Cutout) => (c.label ? `«${c.label}»` : c.shape === "round" ? `Ø${c.w}` : `${c.w}×${c.h}`);
const removedNote = (c: Cutout, old: Part) => `Вырез ${cutName(c)} снят: деталь «${old.name.replace(/ · .*$/, "")}» (${Math.round(old.position[1])} мм от низа корпуса) удалена. Задайте вырез заново в окне «Вырезы».`;
const drawersOf = (m: Module, sid: string) => m.sections.find((s) => s.id === sid)?.drawers ?? 0;

/** Удалили ящик `removed` секции `sid` (removePart): вырезы на его деталях снимаются, на ящиках выше — идут за своим ящиком
 *  (номер на 1 меньше). Сообщение о снятом вырезе — rebindCutouts (по prev → next). Модуль меняется на месте. */
export function remapDrawerCutouts(m: Module, sid: string, removed: number): void {
  if (!m.cutouts?.length) return;
  const out: Cutout[] = [];
  for (const c of m.cutouts) {
    const x = DRAWER_HOST.exec(c.host);
    if (!x || x[1] !== sid) { out.push(c); continue; }
    const k = Number(x[2]);
    if (k === removed) continue;
    out.push(k > removed ? { ...c, host: `${sid}:drawer:${k - 1}:${x[3]}` } : c);
  }
  if (out.length) m.cutouts = out; else delete m.cutouts;
}
/** «Вставить наполнение секции» (круг 3 критика 29.10): полки, ящики, штанги секции заменены копией — вырезы на деталях наполнения
 *  секции снимаются (сообщение — rebindCutouts), а не остаются молча на новой детали с тем же номером. Модуль next меняется на месте. */
export function dropCutoutsOnFilling(prev: Module, next: Module, sid: string): void {
  if (!next.cutouts?.length) return;
  const before = safeParts(prev);
  if (!before) return;
  const filling = new Set(before.filter((p) => p.sectionId === sid && p.role !== "body" && p.role !== "door" && p.role !== "hinge" && p.role !== "handle").map((p) => p.id));
  const keep = next.cutouts.filter((c) => !filling.has(c.host));
  if (keep.length === next.cutouts.length) return;
  if (keep.length) next.cutouts = keep; else delete next.cutouts;
}
/** Вырезы на деталях, которых после правки нет (удалили секцию — её полки и перегородка): снимаются, как у удалённой полки
 *  (сообщение — rebindCutouts). Модуль next меняется на месте. */
export function dropCutoutsOnRemovedParts(prev: Module, next: Module): void {
  if (!next.cutouts?.length) return;
  const before = safeParts(prev), after = safeParts(next);
  if (!before || !after) return;
  const had = new Set(before.map((p) => p.id)), has = new Set(after.map((p) => p.id));
  const keep = next.cutouts.filter((c) => !(had.has(c.host) && !has.has(c.host)));
  if (keep.length === next.cutouts.length) return;
  if (keep.length) next.cutouts = keep; else delete next.cutouts;
}

/** Перепривязать вырезы модуля после правки prev → next. Возвращает модуль (тот же объект, если ничего не менялось) и сообщения
 *  менеджеру: вырез снят (деталь удалена) или оставлен на детали с тем же номером после перестановки всех деталей семьи. */
export function rebindCutouts(prev: Module, next: Module): { module: Module; notes: string[] } {
  const cuts = next.cutouts ?? [];
  if (!prev.cutouts?.length) return { module: next, notes: [] };
  const before = safeParts(prev), after = safeParts(next);
  if (!before || !after) return { module: next, notes: [] };
  const notes: string[] = [], out: Cutout[] = [];
  let changed = false;
  // вырез снят самой правкой (удалили ящик — removePart, секцию — removeSection): сообщение. Окно «Вырезы» снимает вырез, не трогая
  // детали, — без сообщения.
  const ids = new Set(cuts.map((c) => c.id));
  for (const c of prev.cutouts) {
    if (ids.has(c.id)) continue;
    const old = before.find((p) => p.id === c.host), x = DRAWER_HOST.exec(c.host);
    // наполнение секции заменили («Вставить наполнение секции», круг 3) — деталь с тем же номером уже другая
    const refilled = !!old && old.role !== "body" && JSON.stringify(prev.sections.find((s) => s.id === old.sectionId)) !== JSON.stringify(next.sections.find((s) => s.id === old.sectionId));
    if (old && (!after.some((p) => p.id === c.host) || (x && drawersOf(next, x[1]) < drawersOf(prev, x[1])) || refilled)) notes.push(removedNote(c, old));
  }
  for (const c of cuts) {
    const old = before.find((p) => p.id === c.host), fam = cutFamily(c.host);
    // новый вырез (в prev его нет) или деталь не порядковая (боковина, крыша, перегородка секции) — привязка не меняется
    if (!old || fam === c.host || !prev.cutouts.some((x) => x.id === c.id && x.host === c.host)) { out.push(c); continue; }
    const same = after.find((p) => p.id === c.host);
    // ящик — по номеру (DRAWER_HOST): ящик на месте — вырез на нём, ящика с этим номером нет (сняли «−» сверху) — вырез снят
    if (DRAWER_HOST.test(c.host)) { if (same) out.push(c); else { changed = true; notes.push(removedNote(c, old)); } continue; }
    if (same && near(same, old)) { out.push(c); continue; }
    const match = after.find((p) => cutFamily(p.id) === fam && near(p, old));
    if (match) { out.push({ ...c, host: match.id }); changed = true; continue; }
    const famBefore = before.filter((p) => cutFamily(p.id) === fam), famAfter = after.filter((p) => cutFamily(p.id) === fam);
    // остальные детали семьи остались на местах, а носителя нет — его удалили: вырез снимается (а не переезжает на соседнюю)
    const othersKept = famBefore.some((p) => p.id !== old.id && famAfter.some((q) => near(p, q)));
    const what = cutName(c);
    const name = `«${old.name.replace(/ · .*$/, "")}»`;
    if (same && (famBefore.length === famAfter.length || !othersKept)) {
      // деталь сдвинули/изменили (число деталей то же) — вырез идёт с ней; переставили все детали семьи — остаётся на том же номере
      out.push(c);
      if (famBefore.length !== famAfter.length) notes.push(`Вырез ${what}: детали переставлены заново — вырез остался на ${name} (была на ${Math.round(old.position[1])} мм, теперь ${Math.round(same.position[1])} мм от низа корпуса); проверьте его место.`);
      continue;
    }
    changed = true;
    notes.push(removedNote(c, old));
  }
  if (!changed) return { module: next, notes };
  const module: Module = { ...next, cutouts: out };
  if (!out.length) delete module.cutouts;
  return { module, notes };
}
