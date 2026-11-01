// Тяга окна/двери мышью (запрос Макса 31.10.2026 «добавить перетягивание окна и двери через мышку»): вдоль своей стены — в 3D, на видах
// и на «Плане»; окно на видах спереди/сбоку — ещё и по высоте подоконника. Шаг 10 мм; привязка к углам комнаты, к краям других проёмов
// той же стены (вплотную и вровень), подоконник — к подоконнику и верху других окон. Набор с клавиатуры «600;900» + Enter — отступ от
// угла (как подпись «от угла») и от пола. Чистая логика без three/React — tests/opening-drag.test.ts. Одна правка — одна отмена.
import { edgeLength, roomOutline } from "./roomOutline";
import { itemEdge, onEdge } from "./roomShape";
import type { Opening, Project, Room } from "./project";

export const OPENING_SNAP = { step: 10, tol: 40 } as const;
const r1 = (v: number) => Math.round(v * 10) / 10;
type R = Pick<Room, "width" | "depth" | "height" | "outline" | "openings">;
/** Место проёма на стене: номер стены контура (прямоугольник — 0 задняя, 1 правая, 2 передняя, 3 левая), отступ s от начала стены по
 *  обходу, длина стены. */
export function openingSpot(room: R, o: Opening) { const e = itemEdge(room, o); return { edge: e.edge, s: e.offset, len: edgeLength(roomOutline(room), e.edge) }; }
/** Отступ s вдоль стены → собственный отступ проёма (подпись «от угла»): прямоугольник — по старым правилам (передняя и левая — от
 *  другого конца), контур — по стене контура. */
export function ownOffset(room: R, o: Opening, s: number): number {
  if (room.outline) return r1(s);
  return o.wall === "front" || o.wall === "left" ? r1(openingSpot(room, o).len - s - o.width) : r1(s);
}
export const edgeOffset = (room: R, o: Opening, own: number): number => ownOffset(room, o, own); // преобразование симметрично
/** Привязка тяги: s — желаемый отступ вдоль стены, sill — подоконник (vertical — тянется ли высота). free — без привязок (шаг 10). */
export function snapOpening(room: R, id: string, s: number, sill: number, o2: { vertical: boolean; free?: boolean }): { s: number; sill: number; what: string[] } {
  const o = (room.openings ?? []).find((x) => x.id === id);
  if (!o) return { s, sill, what: [] };
  const spot = openingSpot(room, o), L = spot.len, w = o.width, what: string[] = [];
  const clampS = (v: number) => Math.max(0, Math.min(L - w, v));
  const others = (room.openings ?? []).flatMap((x, i) => { if (x.id === id) return []; const q = openingSpot(room, x); return q.edge === spot.edge ? [{ x, i, s0: q.s, s1: q.s + x.width }] : []; });
  let ns = clampS(Math.round(s / OPENING_SNAP.step) * OPENING_SNAP.step);
  if (!o2.free) {
    const c: [number, string][] = [[0, "угол"], [L - w, "угол"], ...others.flatMap((q) => { const n = `${q.x.type === "door" ? "дверь" : "окно"} ${q.i + 1}`; return [[q.s1, n], [q.s0 - w, n], [q.s0, n + " вровень"], [q.s1 - w, n + " вровень"]] as [number, string][]; })];
    let best = OPENING_SNAP.tol + 1;
    for (const [v, label] of c) { const d = Math.abs(v - s); if (v >= -0.01 && v <= L - w + 0.01 && d < best) { best = d; ns = clampS(v); what.splice(0, what.length, label); } }
  }
  let nsill = o.sill;
  if (o2.vertical && o.type === "window") {
    const H = room.height - o.height, clampY = (v: number) => Math.max(0, Math.min(H, v));
    nsill = clampY(Math.round(sill / OPENING_SNAP.step) * OPENING_SNAP.step);
    if (!o2.free) {
      let best = OPENING_SNAP.tol + 1, hit = "";
      for (const [k, x] of (room.openings ?? []).entries()) {
        if (x.id === id || x.type !== "window") continue;
        for (const [v, label] of [[x.sill, `подоконник окна ${k + 1}`], [x.sill + x.height - o.height, `верх окна ${k + 1}`]] as [number, string][]) { const d = Math.abs(v - sill); if (v >= 0 && v <= H && d < best) { best = d; nsill = v; hit = label; } }
      }
      if (hit) what.push(hit);
    }
  }
  return { s: r1(ns), sill: r1(nsill), what };
}
/** Место в пределах стены и потолка (критик 31.10: набор «от угла;от пола» — сразу в пределах, видно на экране): s — 0…длина стены −
 *  ширина, подоконник — 0…высота комнаты − высота проёма (у двери не меняется). */
export function clampOpening(room: R, id: string, s: number, sill: number): { s: number; sill: number } {
  const o = (room.openings ?? []).find((x) => x.id === id);
  if (!o) return { s, sill };
  const L = openingSpot(room, o).len;
  return { s: r1(Math.max(0, Math.min(L - o.width, s))), sill: o.type === "window" ? r1(Math.max(0, Math.min(room.height - o.height, sill))) : o.sill };
}
/** Проём на месте (s, sill) пересекается с другим проёмом той же стены — текст для красной плашки; null — свободно. */
export function openingOverlap(room: R, id: string, s: number, sill: number): string | null {
  const o = (room.openings ?? []).find((x) => x.id === id);
  if (!o) return null;
  const e = openingSpot(room, o).edge;
  for (const [i, x] of (room.openings ?? []).entries()) {
    if (x.id === id) continue;
    const q = openingSpot(room, x);
    if (q.edge === e && s < q.s + x.width - 0.1 && s + o.width > q.s + 0.1 && sill < x.sill + x.height - 0.1 && sill + o.height > x.sill + 0.1) return `пересекается с ${x.type === "door" ? "дверью" : "окном"} ${i + 1}`;
  }
  return null;
}
/** Проём тянется, только если его стена лицом к камере (n — нормаль стены внутрь, dir — взгляд камеры). Окно ближней стены и окно боковой,
 *  видное с ребра, щелчок не перехватывают (критик 31.10: порог −0.2); сверху (взгляд вертикальный) — любая стена. */
export const openingFacesCamera = (n: { x: number; z: number }, dir: { x: number; y: number; z: number }) => n.x * dir.x + n.z * dir.z < -0.2 || Math.abs(dir.y) > 0.9;
/** Набор «отступ;от пола» (подпись «от угла» и «от пола»); одно число — только отступ. null — не число. */
export function parseOpeningTyped(t: string): { offset: number; sill?: number } | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(?:;\s*(\d+(?:[.,]\d+)?)\s*)?$/.exec(t);
  if (!m) return null;
  return { offset: Number(m[1].replace(",", ".")), ...(m[2] ? { sill: Number(m[2].replace(",", ".")) } : {}) };
}
/** Проём на новом месте (s — вдоль стены от её начала, sill — подоконник) одной правкой. Проверка — общая (projectErrors при сохранении). */
export function placeOpening(p: Project, id: string, at: { s: number; sill: number }): Project {
  const o = (p.room.openings ?? []).find((x) => x.id === id);
  if (!o) throw Error("Проём не найден.");
  const spot = openingSpot(p.room, o);
  const next: Opening = p.room.outline ? { ...onEdge(p.room.outline, o, spot.edge, at.s), sill: at.sill } : { ...o, offset: ownOffset(p.room, o, at.s), sill: at.sill };
  return { ...p, room: { ...p.room, openings: (p.room.openings ?? []).map((x) => (x.id === id ? next : x)) } };
}
