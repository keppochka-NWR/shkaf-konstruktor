// Постоянные id деталей наполнения (решение Макса 29.10.2026: «вырез должен держаться даже при редактировании» — при ЛЮБОЙ правке,
// а не только через окно «Вырезы»). Id детали в раскрое/сцене (`<секция>:shelf:2`, `<секция>:drawer:1:facade`) — порядковый и не
// меняется (раскрой, присадка, смета, бирки — как были). Вырез ссылается на деталь постоянной ссылкой Cutout.ref:
//  • полка — `<секция>:shelf@<id>[:glue]`, ящик — `<секция>:drawer@<id>:<деталь>`; id полки/ящика — Section.shelfIds / drawerIds
//    (параллельно shelves / номерам ящиков). Id рождаются с деталью, идут с ней при сдвиге, смене размеров, перестановке и переносе в
//    другую секцию, у копии (дублировать, вставить наполнение) — новые, при удалении уходят вместе с деталью;
//  • боковины, крыша, дно, задник, цоколь, перегородки (`<секция>:divider`), двери (`<секция>:door:<створка>`), горизонтали
//    проёмов — id по роли, он и так не меняется при добавлении/удалении секций и смене размеров: ref не нужен, ссылка — host.
// Cutout.host остаётся и для ref-вырезов — это id детали на момент последнего сохранения (кэш): по нему файл понимает и прежняя
// версия студии. Деталь выреза берётся по ref (cutHost), host только обновляется.
// Формат: вырез с ref — версия 2; без ref и с порядковым host — версия 1 (файлы до 29.10), при загрузке переводится в версию 2
// (id полок/ящиков секции по номеру: h0, h1… / d0, d1… — детерминированно). Id заводятся лениво — у секций, на полках/ящиках
// которых есть вырез; остальные секции и файлы без вырезов не меняются ни на байт.
import type { Module, Section } from "./model";
import type { Cutout } from "./shapes";

type FillKind = "shelf" | "drawer";
/** Новый id полки/ящика: 8 шестнадцатеричных знаков (не пересекается с h0/d0… из перевода старых файлов). */
const freshId = (): string => crypto.randomUUID().replace(/-/g, "").slice(0, 8);
const REF = /^([^:@]+):(shelf|drawer)@([^:]+)(:.*)?$/;
const POS = /^([^:@]+):(shelf|drawer):(\d+)(:.*)?$/;
const count = (s: Section, k: FillKind) => (k === "shelf" ? s.shelves.length : s.drawers);
const idsOf = (s: Section, k: FillKind) => (k === "shelf" ? s.shelfIds : s.drawerIds);
function put(s: Section, k: FillKind, ids: string[] | undefined) {
  const key = k === "shelf" ? "shelfIds" : "drawerIds";
  if (ids) s[key] = ids; else delete s[key];
}
/** Список id под число деталей: лишние сверху уходят, новым сверху — новые id; повторы заменяются. */
export function fitIds(ids: string[], n: number): string[] {
  const seen = new Set<string>(), out: string[] = [];
  for (let j = 0; j < n; j++) { let v = ids[j]; if (typeof v !== "string" || !v || seen.has(v)) v = freshId(); seen.add(v); out.push(v); }
  return out;
}
/** Id полок (ящиков) секции: есть — подогнанные под число деталей; нет — по номеру (h0, h1… / d0, d1…). Секция меняется на месте. */
export function ensureIds(s: Section, k: FillKind): string[] {
  const have = idsOf(s, k), n = count(s, k);
  const ids = have ? (have.length === n ? have : fitIds(have, n)) : Array.from({ length: n }, (_, j) => (k === "shelf" ? "h" : "d") + j);
  put(s, k, ids);
  return ids;
}
/** Деталь, на которой вырез сейчас: по постоянной ссылке ref (номер полки/ящика — по его id) или host. undefined — носителя нет. */
export function cutHost(m: Module, c: Pick<Cutout, "host" | "ref">): string | undefined {
  if (!c.ref) return c.host;
  const x = REF.exec(c.ref);
  if (!x) return c.ref;
  const k = x[2] as FillKind, s = m.sections.find((q) => q.id === x[1]), j = s ? idsOf(s, k)?.indexOf(x[3]) ?? -1 : -1;
  return s && j >= 0 && j < count(s, k) ? `${x[1]}:${k}:${j}${x[4] ?? ""}` : undefined;
}
/** Постоянная ссылка на деталь pid: полка/ящик — по id (id секции заводятся, если их не было); иначе undefined (ссылка — сам pid). */
function refFor(m: Module, pid: string): string | undefined {
  const x = POS.exec(pid);
  if (!x) return undefined;
  const k = x[2] as FillKind, s = m.sections.find((q) => q.id === x[1]), j = Number(x[3]);
  if (!s || j >= count(s, k)) return undefined;
  return `${x[1]}:${k}@${ensureIds(s, k)[j]}${x[4] ?? ""}`;
}
/** Вырезы модуля — на постоянные ссылки: порядковый host полки/ящика без ref получает ref; host у ref-вырезов — по ref.
 *  Модуль меняется на месте (id полок/ящиков секции заводятся по номеру). Носителя нет — вырез как есть (его снимает settle). */
export function bindCutouts(m: Module): void {
  if (!m.cutouts?.length) return;
  m.cutouts = m.cutouts.map((c) => {
    if (c.ref) { const h = cutHost(m, c); return h && h !== c.host ? { ...c, host: h } : c; }
    const ref = refFor(m, c.host);
    return ref ? { ...c, ref } : c;
  });
}
/** Id в файле: только строки, под число деталей, без повторов (parseModule). */
export function parseIds(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : "")) : undefined;
}

/** Id полок после правки, которая их не знала (поменяла shelves напрямую): по высоте — полка на той же высоте та же (вставили,
 *  удалили, переставили — остальные на месте); остальные — по порядку снизу (сдвинули, расставили поровну); лишним — новые id. */
function matchByValue(oldV: number[], oldIds: string[], newV: number[]): string[] {
  const out: (string | undefined)[] = newV.map(() => undefined), used = new Set<number>();
  newV.forEach((v, j) => {
    const i = oldV[j] === v && !used.has(j) ? j : oldV.findIndex((w, k) => !used.has(k) && Math.abs(w - v) < 1e-9);
    if (i >= 0) { out[j] = oldIds[i]; used.add(i); }
  });
  const free = oldIds.map((_, i) => i).filter((i) => !used.has(i));
  let q = 0;
  return out.map((v) => v ?? (q < free.length ? oldIds[free[q++]] : freshId()));
}
const same = (a: readonly unknown[] | undefined, b: readonly unknown[] | undefined) => !!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]);
const valid = (ids: string[] | undefined, n: number) => !!ids && ids.length === n && new Set(ids).size === n && ids.every((x) => typeof x === "string" && !!x);
/** Id наполнения после правки prev → next (сохранение проекта, App.commitProject): правки, знающие id (operations.ts), id уже
 *  сдвинули — они остаются; правки «в обход» (поменяли shelves/число ящиков, а id — нет) — id по высоте полки (matchByValue), ящики —
 *  по номеру (лишние сверху уходят). Модуль next меняется на месте. */
export function syncIds(prev: Module | undefined, next: Module): void {
  for (const s of next.sections) {
    const o = prev?.sections.find((x) => x.id === s.id);
    const po = o && valid(o.shelfIds, o.shelves.length) ? o.shelfIds! : undefined;
    if (s.shelfIds || po) {
      if (valid(s.shelfIds, s.shelves.length) && !(po && same(s.shelfIds, po))) { /* правка знала id */ }
      else if (po) s.shelfIds = matchByValue(o!.shelves, po, s.shelves);
      else s.shelfIds = fitIds(s.shelfIds!, s.shelves.length);
    }
    const pd = o && valid(o.drawerIds, o.drawers) ? o.drawerIds! : undefined;
    if ((s.drawerIds || pd) && !valid(s.drawerIds, s.drawers)) s.drawerIds = fitIds(s.drawerIds ?? pd!, s.drawers);
  }
}

// ── правки наполнения, знающие id (operations.ts, partialDivider.ts, drawerModes.ts) ──
/** Вставить полку на высоте f (доля проёма): полки по возрастанию, у новой — новый id. Возвращает её номер. */
export function insertShelf(s: Section, f: number): number {
  const ids = s.shelfIds;
  if (!ids) { s.shelves.push(f); s.shelves.sort((a, b) => a - b); return s.shelves.indexOf(f); }
  const pairs = s.shelves.map((v, j) => [v, ids[j] ?? freshId()] as const).concat([[f, freshId()] as const]).sort((a, b) => a[0] - b[0]);
  s.shelves = pairs.map((p) => p[0]); s.shelfIds = pairs.map((p) => p[1]);
  return s.shelves.indexOf(f);
}
/** Убрать полку / ящик j: id уходит вместе с деталью. */
export function dropId(s: Section, k: FillKind, j: number): void {
  const ids = idsOf(s, k);
  if (ids) put(s, k, ids.filter((_, i) => i !== j));
}
/** Ящиков стало n (добавили/сняли сверху): id лишних уходят, новым — новые. */
export function fitDrawerIds(s: Section): void {
  if (s.drawerIds) s.drawerIds = fitIds(s.drawerIds, s.drawers);
}
/** Наполнение секции заменено (вставка наполнения, очистка): все id новые — вырезы на прежних деталях не переезжают на новые. */
export function renewIds(s: Section): void {
  if (s.shelfIds) s.shelfIds = s.shelves.map(() => freshId());
  if (s.drawerIds) s.drawerIds = Array.from({ length: s.drawers }, () => freshId());
}
/** Ссылки вырезов при смене id секций (копия корпуса — rekeySections): `<старая>:…` → `<новая>:…`, `layout:<старый>` → `layout:<новый>`. */
export function rekeyCutouts(m: Module, map: Map<string, string>): void {
  if (!m.cutouts?.length) return;
  const re = (v: string) => { const i = v.indexOf(":"), head = i < 0 ? v : v.slice(0, i), tail = i < 0 ? "" : v.slice(i);
    if (map.has(head)) return map.get(head)! + tail;
    if (head === "layout") { const t = v.slice(7), n = map.get(t); return n ? "layout:" + n : v; }
    return v; };
  m.cutouts = m.cutouts.map((c) => ({ ...c, host: re(c.host), ...(c.ref ? { ref: re(c.ref) } : {}) }));
}
