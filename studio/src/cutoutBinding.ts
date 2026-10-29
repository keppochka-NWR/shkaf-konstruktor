// Вырез держится за свою деталь (критик 29.10, блокер 2; решение Макса 29.10 — при ЛЮБОЙ правке). Вырез ссылается на полку/ящик
// постоянным id (partIds.ts: Cutout.ref → Section.shelfIds / drawerIds), на остальные детали — id по роли (боковина, перегородка
// секции, дверь). Деталь выреза берётся по ссылке при каждом построении (shapes.ts cutHost), поэтому вставка/удаление/перестановка
// полок, ящиков, секций, отмена/повтор, файл, палитра, кухонные операции и прямые правки модели вырез не переносят.
// Здесь — то, что остаётся сохранению проекта (App.commitProject → keepProjectCutouts):
//  • правки «в обход» id (поменяли shelves или число ящиков напрямую) — id подтягиваются по высоте полки / номеру ящика (syncIds);
//  • носителя больше нет (удалили полку, ящик, секцию, дверь, заменили наполнение) — вырез снимается с сообщением;
//  • вырезы старого формата (host — номер полки/ящика) переводятся на постоянные ссылки (bindCutouts).
// Геометрической перепривязки «по месту» больше нет: id не меняется ни при сдвиге, ни при смене размеров.
import { shapeBaseParts, type Module, type Part } from "./model";
import type { Cutout } from "./shapes";
import type { Project } from "./project";
import { bindCutouts, cutHost, syncIds } from "./partIds";

/** Семья детали: id с порядковыми номерами, заменёнными на «#» (`s1:shelf:#`, `s1:drawer:#:facade`). Без номеров — id по роли. */
export const cutFamily = (id: string) => id.replace(/:(\d+)(?=:|$)/g, ":#");
const safeParts = (m: Module): Part[] | null => { try { return shapeBaseParts(m); } catch { return null; } };
const cutName = (c: Cutout) => (c.label ? `«${c.label}»` : c.shape === "round" ? `Ø${c.w}` : `${c.w}×${c.h}`);
const removedNote = (c: Cutout, old: Part) => `Вырез ${cutName(c)} снят: деталь «${old.name.replace(/ · .*$/, "")}» (${Math.round(old.position[1])} мм от низа корпуса) удалена. Задайте вырез заново в окне «Вырезы».`;
const lives = (m: Module, ps: Part[], c: Cutout) => { const h = cutHost(m, c); return !!h && ps.some((p) => p.id === h); };

/** После правки, убравшей детали (operations.ts): вырезы без носителя снимаются (сообщение — при сохранении, rebindCutouts),
 *  host ref-вырезов — по ref. Модуль меняется на месте. */
export function settleCutouts(m: Module): void {
  if (!m.cutouts?.length) return;
  bindCutouts(m);
  const ps = safeParts(m);
  if (!ps) return;
  const keep = m.cutouts!.filter((c) => lives(m, ps, c));
  if (keep.length) m.cutouts = keep; else delete m.cutouts;
}

/** Вырезы модуля после правки prev → next (сохранение проекта): id наполнения — после правок «в обход» (syncIds), старый формат — на
 *  постоянные ссылки, носителя нет — вырез снят с сообщением. Возвращает модуль (тот же объект, если ничего не менялось) и сообщения. */
export function rebindCutouts(prev: Module, next: Module): { module: Module; notes: string[] } {
  if (!prev.cutouts?.length && !next.cutouts?.length) return { module: next, notes: [] };
  const p = structuredClone(prev), n = structuredClone(next);
  bindCutouts(p);
  syncIds(p, n);
  // вырез без ref, не тронутый правкой (тот же id и host), — ссылка та же, что до правки; новый вырез — ссылка по детали сейчас
  for (const c of n.cutouts ?? []) if (!c.ref) { const o = p.cutouts?.find((x) => x.id === c.id && x.host === c.host); if (o?.ref) c.ref = o.ref; }
  bindCutouts(n);
  const before = safeParts(p) ?? [], after = safeParts(n);
  const notes: string[] = [];
  if (after) {
    const was = (c: Cutout) => { const o = p.cutouts?.find((x) => x.id === c.id), h = o && cutHost(p, o); return h ? before.find((q) => q.id === h) : undefined; };
    const keep: Cutout[] = [];
    // носителя нет: был до правки — вырез снят с сообщением; не было (вырез и так без детали) — остаётся, его покажет проверка
    for (const c of n.cutouts ?? []) { const old = lives(n, after, c) ? undefined : was(c); if (old) notes.push(removedNote(c, old)); else keep.push(c); }
    // вырез снят самой правкой (удалили ящик, секцию, заменили наполнение): сообщение; окно «Вырезы» снимает вырез с живой детали — без
    for (const o of p.cutouts ?? []) if (!n.cutouts?.some((c) => c.id === o.id) && !lives(n, after, o)) { const old = was(o); if (old) notes.push(removedNote(o, old)); }
    if (keep.length) n.cutouts = keep; else delete n.cutouts;
  }
  return { module: JSON.stringify(n) === JSON.stringify(next) ? next : n, notes };
}

/** Сохранение проекта (App.commitProject): вырезы каждого изменённого корпуса — rebindCutouts по корпусу с тем же id. */
export function keepProjectCutouts(prev: Project, next: Project): { project: Project; notes: string[] } {
  const notes: string[] = [];
  if (!next.modules.some((a) => a.module.cutouts?.length || prev.modules.find((x) => x.id === a.id)?.module.cutouts?.length)) return { project: next, notes };
  let changed = false;
  const modules = next.modules.map((a) => {
    const old = prev.modules.find((x) => x.id === a.id);
    if (!old || old.module === a.module || !(a.module.cutouts?.length || old.module.cutouts?.length)) return a;
    const r = rebindCutouts(old.module, a.module);
    notes.push(...r.notes);
    if (r.module === a.module) return a;
    changed = true;
    return { ...a, module: r.module };
  });
  return { project: changed ? { ...next, modules } : next, notes };
}
