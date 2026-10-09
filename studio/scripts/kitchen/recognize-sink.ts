// Распознавание особенностей моек Базиса (архетип base-sink). Общие для всех нижних правила — в recognize-common.ts.
import type { RefModule } from "./compare";

/** Угловая мойка с фальшпанелью: фасад крепится на «Петля под фальшпанель», часть ширины закрыта фальшем ЛДСП/фасадным
 *  материалом в плоскости фасадов (иногда Г-образным, с планками поперёк). 9 из 24 моек базы (k01, k05, k06, k10, k15, k19,
 *  k22, k25, k28). Это не «ряды фасадов», а отдельный тип корпуса — пока не поддержан, помечаем честно. */
export function cornerFillerSink(ref: Pick<RefModule, "hardware">): boolean {
  return falsePanelHinges(ref).length > 0;
}
/** Петли «под фальшпанель» проекта Базиса — признак угловой мойки (cornerFillerSink) и точки двери у фальша (faceFillerFlat). */
export const falsePanelHinges = (ref: Pick<RefModule, "hardware">) => ref.hardware.filter((h) => /под фальшпанель/i.test(h.name));

type Pb = { p: RefModule["panels"][number]; b: { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number } };
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Плоский фальш угловой мойки (n4-base): у края модуля в плоскости фасадов — одна панель ЛДСП корпуса на всю высоту корпуса
 *  (от низа дна до верха боковин), рядом может быть планка из фасадного материала; остальное — двери, дверь у фальша висит на
 *  «Петля под фальшпанель» у своей кромки. Г-образный фальш (планки поперёк в плоскости фасадов: k05 m05, k19 m01) — не этот случай.
 *  Возвращает ширины и панели фальша (их не считаем фасадами). */
export function faceFillerFlat(ref: RefModule, P: Pb[], left: Pb, right: Pb, sideZ1: number, bottomY0: number, top: number):
  { side: "left" | "right"; width: number; strip?: number; stripFull?: true; panels: Pb[] } | undefined {
  const ffh = falsePanelHinges(ref);
  if (!ffh.length) return undefined;
  const front = P.filter(({ p, b }) => p.kind !== "hdf" && b.z0 >= sideZ1 - 1);
  if (front.some(({ p }) => p.axis !== "z")) return undefined; // планки поперёк — Г-образный фальш
  const bodyMat = new Set([left.p.mat, right.p.mat]);
  const isBody = ({ p }: Pb) => p.kind === "ldsp" && bodyMat.has(p.mat);
  const full = ({ b }: Pb) => Math.abs(b.y0 - bottomY0) < 1 && Math.abs(b.y1 - top) < 1;
  const L = front.filter((f) => isBody(f) && full(f) && Math.abs(f.b.x0 - left.b.x0) < 0.6);
  const R = front.filter((f) => isBody(f) && full(f) && Math.abs(f.b.x1 - right.b.x1) < 0.6);
  if (L.length + R.length !== 1) return undefined;
  const side = L.length ? "left" : "right", fp = (L[0] ?? R[0]);
  // планка из фасада вплотную к фальшу (k25 m02: 59 мм, фасадный материал 19)
  const strip = front.find((f) => f !== fp && !isBody(f) && f.b.x1 - f.b.x0 < 200 && (side === "left" ? Math.abs(f.b.x0 - fp.b.x1) < 0.6 : Math.abs(f.b.x1 - fp.b.x0) < 0.6));
  const edge = side === "left" ? (strip ?? fp).b.x1 : (strip ?? fp).b.x0;
  const doors = front.filter((f) => f !== fp && f !== strip);
  if (!doors.length || doors.some(isBody)) return undefined;
  // дверь у фальша и её петли «под фальшпанель» — у её кромки со стороны фальша
  const near = doors.sort((a, c) => side === "left" ? a.b.x0 - c.b.x0 : c.b.x1 - a.b.x1)[0], ex = side === "left" ? near.b.x0 : near.b.x1;
  if (Math.abs(ex - edge) > 5 || !ffh.every((h) => Math.abs(h.pos[0] - ex) < 0.6)) return undefined;
  const width = r1(side === "left" ? fp.b.x1 - left.b.x0 : right.b.x1 - fp.b.x0);
  // планка по высоте фальша (k28 m17: 100..830), а не фасадов (k25 m02: 101,5..860,5)
  const stripFull = !!strip && Math.abs(strip.b.y0 - fp.b.y0) < 0.6 && Math.abs(strip.b.y1 - fp.b.y1) < 0.6;
  return { side, width, ...(strip ? { strip: r1(strip.b.x1 - strip.b.x0) } : {}), ...(stripFull ? { stripFull: true as const } : {}), panels: strip ? [fp, strip] : [fp] };
}
