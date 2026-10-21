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
  { side: "left" | "right"; width: number; strip?: number; stripFull?: true; conf?: { bottom?: number[]; side?: number[]; back?: [number, number][] }; confDepth?: number; facadeMat?: true; inset?: number; panels: Pb[] } | undefined {
  const ffh = falsePanelHinges(ref);
  if (!ffh.length) return undefined;
  const front = P.filter(({ p, b }) => p.kind !== "hdf" && b.z0 >= sideZ1 - 1);
  if (front.some(({ p }) => p.axis !== "z")) return undefined; // планки поперёк — Г-образный фальш
  const bodyMat = new Set([left.p.mat, right.p.mat]);
  const isBody = ({ p }: Pb) => p.kind === "ldsp" && bodyMat.has(p.mat);
  const full = ({ b }: Pb) => Math.abs(b.y0 - bottomY0) < 1 && Math.abs(b.y1 - top) < 1;
  const L = front.filter((f) => isBody(f) && full(f) && Math.abs(f.b.x0 - left.b.x0) < 0.6);
  const R = front.filter((f) => isBody(f) && full(f) && Math.abs(f.b.x1 - right.b.x1) < 0.6);
  if (L.length + R.length !== 1) return faceFillerFacade(ref, front, left, right, isBody, bottomY0);
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
  const conf = fillerConf(ref, fp, side === "left" ? left : right, side, bottomY0);
  return { side, width, ...(strip ? { strip: r1(strip.b.x1 - strip.b.x0) } : {}), ...(stripFull ? { stripFull: true as const } : {}), ...(conf ? { conf } : {}), panels: strip ? [fp, strip] : [fp] };
}

/** Плоская фальшпанель углового стыка из фасадного материала (F_FILLER_FLAT, пакет 2): у навесных, антресолей, пеналов и нижних
 *  (k06 m11, k22 m08, k19 m02, k31 m11, k15 m10) панель фасадного материала (или ЛДСП корпуса по высоте ряда дверей) у края модуля
 *  в плоскости фасадов, той же высоты, что двери ряда; дверь у фальша — на «Петля под фальшпанель» у своей кромки (зазор до фальша
 *  1,5–3 мм, как между фасадами). Отступ фальша от края модуля — inset (k06 m11: 0, k22 m08: 2 = faceGap). */
function faceFillerFacade(ref: RefModule, front: Pb[], left: Pb, right: Pb, isBody: (f: Pb) => boolean, bottomY0?: number) {
  const ffh = falsePanelHinges(ref), hx = ffh[0].pos[0];
  if (!ffh.every((h) => Math.abs(h.pos[0] - hx) < 0.6)) return undefined;
  // дверь, на которой висят петли под фальшпанель (host петли Базиса), — не фальш: у прямого глухого угла (k02 m01) дверь слева
  // с петлями на своей правой кромке, и прежняя проверка принимала её за фальш левой стороны и бросала поиск
  const hosts = new Set(ffh.map((h) => h.host).filter((v): v is number => typeof v === "number"));
  for (const side of ["left", "right"] as const) {
    const fp = front.find((f) => !hosts.has(f.p.i) && (side === "left" ? Math.abs(f.b.x0 - left.b.x0) <= 5 && Math.abs(hx - f.b.x1) <= 5 && hx > f.b.x1 - 0.5 : Math.abs(f.b.x1 - right.b.x1) <= 5 && Math.abs(hx - f.b.x0) <= 5 && hx < f.b.x0 + 0.5));
    if (!fp) continue;
    const doors = front.filter((f) => f !== fp);
    const near = doors.find((f) => Math.abs((side === "left" ? f.b.x0 : f.b.x1) - hx) < 0.6);
    // двери того же ряда (та же высота), не ЛДСП корпуса; фальш — по высоте дверей
    if (!near || doors.some(isBody) || doors.some((f) => Math.abs(f.b.y0 - near.b.y0) > 0.6 || Math.abs(f.b.y1 - near.b.y1) > 0.6)) return undefined;
    if (Math.abs(fp.b.y0 - near.b.y0) > 0.6 || Math.abs(fp.b.y1 - near.b.y1) > 0.6) return undefined;
    const inset = r1(side === "left" ? fp.b.x0 - left.b.x0 : right.b.x1 - fp.b.x1);
    const fc = bottomY0 === undefined ? undefined : facadeFillerConf(ref, fp, side === "left" ? left : right, side, bottomY0);
    // fc === null — на фальше крепёж, которого правило не знает: не угадываем, фальш без крепежа (как было до k02 m01)
    return { side, width: r1(fp.b.x1 - fp.b.x0), facadeMat: true as const, ...(inset ? { inset } : {}), ...(fc ? { conf: fc.conf, ...(fc.depth ? { confDepth: fc.depth } : {}) } : {}), panels: [fp] };
  }
  return undefined;
}

/** Крепёж фальша из фасадного материала (прямой глухой угол k02 m01): с лица фальша — в передний торец дна (bottom: x от края модуля
 *  со стороны фальша) и боковины со стороны фальша (side: y от низа дна, выше середины — от верха со знаком минус); с тыла фальша наружу — стяжка с соседним модулем, который
 *  встаёт торцом к фальшу (back: [x от края, y от низа дна]; у Базиса оба отверстия записаны на самом фальше). depth — D5 этих
 *  конфирматов, если она не 35. Нет конфирматов — undefined; есть, но не по правилу — null. */
export function facadeFillerConf(ref: RefModule, fp: Pb, sidePanel: Pb, side: "left" | "right", bottomY0: number, t = 16):
  { conf: { bottom?: number[]; side?: number[]; back?: [number, number][] }; depth?: number } | null | undefined {
  const all = ref.hardware.map((h, i) => ({ h, i })).filter(({ h }) => (h.category === "конфирмат" || /^Евровинт/.test(h.name)) && h.host === fp.p.i);
  if (!all.length) return undefined;
  const sx = (sidePanel.b.x0 + sidePanel.b.x1) / 2, edge = side === "left" ? sidePanel.b.x0 : sidePanel.b.x1;
  const bottom: number[] = [], sd: number[] = [], back: [number, number][] = [];
  for (const { h } of all) {
    // пакет 0: выше середины корпуса — от верха (отрицательное: y = верх + v), чтобы крепёж шёл за высотой модуля
    const fromEdge = r1(Math.abs(h.pos[0] - edge)), top = sidePanel.b.y1, y = h.pos[1] > (bottomY0 + top) / 2 ? r1(h.pos[1] - top) : r1(h.pos[1] - bottomY0);
    if (Math.abs(h.pos[2] - fp.b.z1) < 0.6) {
      if (Math.abs(h.pos[0] - sx) < 0.6 && h.pos[1] > bottomY0 + t) sd.push(y);
      else if (Math.abs(h.pos[1] - (bottomY0 + t / 2)) < 0.6) bottom.push(fromEdge);
      else return null;
    } else if (Math.abs(h.pos[2] - fp.b.z0) < 0.6) back.push([fromEdge, y]);
    else return null;
  }
  const srcs = new Set(all.map(({ i }) => i)), d5 = (ref.holes ?? []).filter((h) => h.d === 5 && typeof h.src === "number" && srcs.has(h.src)).map((h) => r1(h.depth));
  const depth = d5.length && d5.every((v) => v === d5[0]) && d5[0] !== 35 ? d5[0] : undefined;
  return { conf: { ...(bottom.length ? { bottom: bottom.sort((a, c) => a - c) } : {}), ...(sd.length ? { side: sd.sort((a, c) => a - c) } : {}), ...(back.length ? { back: back.sort((a, c) => a[0] - c[0] || a[1] - c[1]) } : {}) }, ...(depth ? { depth } : {}) };
}

/** Конфирматы через фальш (головка на лицевой пласти фальша): в передний торец дна (по середине толщины дна) и в передний торец
 *  боковины со стороны фальша (по середине её толщины). k01 m03: два в дно (58 от краёв фальша) и три в боковину (80 / 368 / 64 от верха).
 *  Любой другой конфирмат на фальше — не распознан, крепёж фальша не ставим (как было). */
export function fillerConf(ref: Pick<RefModule, "hardware">, fp: Pb, sidePanel: Pb, side: "left" | "right", bottomY0: number, t = 16): { bottom?: number[]; side?: number[] } | undefined {
  const cs = ref.hardware.filter((h) => (h.category === "конфирмат" || /^Евровинт/.test(h.name)) && Math.abs(h.pos[2] - fp.b.z1) < 0.6 && h.pos[0] >= fp.b.x0 - 0.5 && h.pos[0] <= fp.b.x1 + 0.5);
  if (!cs.length) return undefined;
  const sx = (sidePanel.b.x0 + sidePanel.b.x1) / 2, edge = side === "left" ? sidePanel.b.x0 : sidePanel.b.x1;
  const bottom: number[] = [], sd: number[] = [];
  for (const h of cs) {
    if (Math.abs(h.pos[0] - sx) < 0.6 && h.pos[1] > bottomY0 + t) sd.push(r1(h.pos[1] - fp.b.y0));
    else if (Math.abs(h.pos[1] - (bottomY0 + t / 2)) < 0.6) bottom.push(r1(Math.abs(h.pos[0] - edge)));
    else return undefined;
  }
  return { ...(bottom.length ? { bottom: bottom.sort((a, c) => a - c) } : {}), ...(sd.length ? { side: sd.sort((a, c) => a - c) } : {}) };
}
