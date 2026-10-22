import * as THREE from "three";
import {ovenModel} from './ovenGeometry';
import {microwaveModel,builtInFridgeModel} from './applianceGeometry';
import {tapModel,servicePipeModel} from './serviceGeometry';
import type { Part } from "./model";
import {premialSinkModel,layoutDrainModel} from './premialSinkGeometry';
import { allegroModel } from './premialGeometry';

// Процедурные 3D-модели фурнитуры, у которой нет сетки ни в Базисе, ни в библиотеке (n5-hardware3d, 09.10.2026).
// Профили (Gola, штанги, направляющие) строятся сечением, выдавленным на длину детали: длина любая, сечение не искажается.
// Точёные детали (эксцентрик, шток, шкант) — телом вращения по габариту детали. Деталь (размеры, позиция) не меняется:
// модель — дочерний объект невидимого бокса детали, центр модели = центр детали.
// Размеры сечений:
//  - Gola L/C — внешний контур = вырез Базиса (деталь), стенка 1,6 мм и губы 9 мм — ОЦЕНКА (чертежа профиля нет; Würth LAC:
//    горизонтальный L-профиль Gola — высота 56, ширина 27 мм, у нас вырез 58×27 по Базису);
//  - штанга круглая — труба Ø25 (имя детали «Труба Д25»), стенка 1 мм — оценка; овальная — эллипс по габариту детали (15×30);
//  - шариковая направляющая — GTV Versalite H45: высота 45 и толщина 12 — габарит детали студии (model.ts); металл 1,2 и губы 4 — оценка;
//  - скрытая (Firmax/Unihopper/DTC) — внешний габарит = деталь студии/Базиса (12×9, 20×12), листовой металл 1,5 — оценка;
//  - эксцентрик Ø15 (отв. Ø15×13), шток Ø7 с резьбой Ø5 на 13 мм в стойке (отв. Ø5×13 Базиса), шкант Ø8 с рифлением — по габариту детали.
export type ProcKind = "gola-L" | "gola-C" | "rod-round" | "rod-oval" | "slide-ball" | "slide-hidden" | "ecc-cam" | "ecc-pin" | "dowel" | "latch" | "flange" | "screw" | "hole";

type P = Pick<Part, "id" | "name" | "role" | "size"> & { model?: Part["model"]; material?: Part["material"] };

/** Какая процедурная модель у детали (undefined — рисуется как раньше). У деталей с моделью (Part.model) — никогда. */
export function procKind(p: P): ProcKind | undefined {
  if (p.model) return undefined;
  if (p.id.startsWith("gola:L:")) return "gola-L";
  if (p.id.startsWith("gola:C:")) return "gola-C";
  if (p.role === "rod") return /овал/i.test(p.name) ? "rod-oval" : "rod-round";
  if (p.id.includes(":slide:") && p.material === "metal") {
    const s = [...p.size].sort((a, b) => a - b);
    if (s[0] <= 0 || s[2] < 3 * s[1]) return undefined; // не профиль
    return s[1] >= 30 ? "slide-ball" : "slide-hidden";
  }
  if (p.id.startsWith("ecc:") && p.role === "fastener") return p.id.endsWith(":pin") ? "ecc-pin" : "ecc-cam";
  if (p.id.startsWith("dowel:") && p.role === "fastener") return "dowel";
  if (p.id.includes(":latch:") && p.role === "hinge") return "latch";
  if (p.role === "flange" && Math.min(...p.size) * 3 <= Math.max(...p.size)) return "flange";
  if ((p.id.includes(":screw:") || p.id.startsWith("kitchen-leg-screw:")) && Math.max(...p.size) <= 5) return /^Отверстие/i.test(p.name) ? "hole" : "screw";
  return undefined;
}

/** Диаметр и длина крепежа из названия («Саморез 3,5×16 (…)», «Шуруп 4x30», «Отверстие 5×12»); без чисел — 3,5×16. */
export function screwSpec(name: string): { d: number; L: number } {
  const m = name.match(/(\d+(?:[.,]\d+)?)\s*[×xх]\s*(\d+(?:[.,]\d+)?)/);
  return m ? { d: parseFloat(m[1].replace(",", ".")), L: parseFloat(m[2].replace(",", ".")) } : { d: 3.5, L: 16 };
}
type FaceHost = Pick<Part, "size" | "position" | "material"> & { rotY?: number; rotZ?: number };
/** Пласть доски, на которой лежит точка крепежа (саморез Базиса — точка без поворота): ось толщины и направление внутрь доски.
 *  Точка должна быть в пределах доски по двум другим осям и не дальше tol от её грани; из нескольких — ближайшая. */
export function faceAt(pt: [number, number, number], hosts: FaceHost[], tol = 1.5): { axis: 0 | 1 | 2; dir: 1 | -1 } | undefined {
  let best: { axis: 0 | 1 | 2; dir: 1 | -1 } | undefined, bd = Infinity;
  for (const q of hosts) {
    if ((q.material !== "board" && q.material !== "hdf") || q.rotY || q.rotZ) continue;
    const ax = q.size.indexOf(Math.min(...q.size)) as 0 | 1 | 2;
    if (![0, 1, 2].every((i) => i === ax || Math.abs(pt[i] - q.position[i]) <= q.size[i] / 2 + 0.01)) continue;
    for (const s of [-1, 1] as const) {
      const d = Math.abs(pt[ax] - (q.position[ax] + s * q.size[ax] / 2));
      if (d <= tol && d < bd) { bd = d; best = { axis: ax, dir: (-s) as 1 | -1 }; }
    }
  }
  return best;
}

/** Саморез/шуруп: полукруглая головка Ø2d с крестовым шлицем над пластью, стержень d на длину L в доску (dir — внутрь доски по axis).
 *  Отверстие (hole) — тёмный круг d на пласти. Начало координат — точка крепежа (центр детали). */
export function screwModel(spec: { d: number; L: number }, axis: 0 | 1 | 2, dir: 1 | -1, hole = false): THREE.Group {
  const { d, L } = spec, inner = new THREE.Group(), dark = plastic(0x1e2124);
  if (hole) inner.add(lathe([[0, -0.15], [d / 2, -0.15], [d / 2, 0.6], [0, 0.6]], dark, 20));
  else {
    const hr = d, hh = Math.max(1.2, d * 0.6), z = zinc(), prof: [number, number][] = [[0, -hh], [hr * 0.7, -hh], [hr * 0.93, -hh * 0.55], [hr, -0.15], [hr, 0], [d * 0.42, 0], [d * 0.42, Math.max(0.5, L - d)], [0.3, Math.max(1, L)], [0, Math.max(1, L)]];
    inner.add(lathe(prof, z, 24));
    for (const r of [0, Math.PI / 2]) { const sl = new THREE.Mesh(new THREE.BoxGeometry(hr * 1.1, 0.5, hr * 0.28), dark); sl.position.y = -hh + 0.15; sl.rotation.y = r; inner.add(sl); }
  }
  const g = new THREE.Group(); g.add(alongAxis(inner, axis, dir));
  return g;
}

// Металл без карты окружения при высоком metalness выглядит чёрным (см. Scene.tsx) — умеренный металл, светлый цвет.
const zinc = () => new THREE.MeshStandardMaterial({ color: 0xcfd4d8, metalness: 0.35, roughness: 0.4 });
const alu = (color = 0xc4c8cc) => new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.35 });
const chrome = () => new THREE.MeshStandardMaterial({ color: 0xedf0f2, metalness: 0.3, roughness: 0.22 });
const plastic = (color = 0x3c4045) => new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.6 });
const wood = () => new THREE.MeshStandardMaterial({ color: 0xd9b98a, metalness: 0, roughness: 0.8 });

const shape = (pts: [number, number][]) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
/** Сечение (u, v) выдавлено на длину L по оси Z, центр по длине — 0. */
function extrude(s: THREE.Shape, L: number, z0 = -L / 2) {
  const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false, curveSegments: 24 });
  g.translate(0, 0, z0);
  return g;
}
/** C-швеллер w×h, открытый в +u: стенка t, губы lip. */
function channel(w: number, h: number, t: number, lip: number, du = 0, dv = 0): THREE.Shape {
  const a = -w / 2 + du, b = w / 2 + du, lo = -h / 2 + dv, hi = h / 2 + dv;
  return shape([[a, lo], [b, lo], [b, lo + lip], [b - t, lo + lip], [b - t, lo + t], [a + t, lo + t], [a + t, hi - t], [b - t, hi - t], [b - t, hi - lip], [b, hi - lip], [b, hi], [a, hi]]);
}
const mirrorU = (s: THREE.Shape) => shape(s.getPoints().map((v) => [-v.x, v.y] as [number, number]).reverse());

/** Профиль Gola: сечение в плоскости (z — к фасаду, y — вверх), длина по X. L — верхний (открыт к фасаду и вверх), C — средний (открыт к фасаду). */
export function golaModel(kind: "L" | "C", length: number, h: number, d: number, color?: number): THREE.Group {
  const t = 1.6, lip = Math.min(9, h / 4), back = -d / 2, front = d / 2, lo = -h / 2, hi = h / 2;
  const pts: [number, number][] = kind === "L"
    ? [[back, lo], [front, lo], [front, lo + lip], [front - t, lo + lip], [front - t, lo + t], [back + t, lo + t], [back + t, hi - t], [back + lip, hi - t], [back + lip, hi], [back, hi]]
    : [[back, lo], [front, lo], [front, lo + lip], [front - t, lo + lip], [front - t, lo + t], [back + t, lo + t], [back + t, hi - t], [front - t, hi - t], [front - t, hi - lip], [front, hi - lip], [front, hi], [back, hi]];
  const g = new THREE.Group(), geo = extrude(shape(pts), length);
  geo.rotateY(-Math.PI / 2); // u → +z, длина → x
  g.add(new THREE.Mesh(geo, alu(color)));
  return g;
}

/** Штанга: труба по длинной оси детали; круглая — кольцо Ø по меньшему поперечному размеру, овальная — эллипс по габариту. */
export function rodModel(size: [number, number, number], oval: boolean): THREE.Group {
  const axis = size.indexOf(Math.max(...size)), L = size[axis];
  const [cu, cv] = axis === 0 ? [size[2], size[1]] : axis === 1 ? [size[0], size[2]] : [size[0], size[1]];
  const a = (oval ? cu : Math.min(cu, cv)) / 2, b = (oval ? cv : Math.min(cu, cv)) / 2, wall = 1;
  const s = new THREE.Shape(); s.absellipse(0, 0, a, b, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path(); hole.absellipse(0, 0, a - wall, b - wall, 0, Math.PI * 2, true, 0); s.holes.push(hole);
  const geo = extrude(s, L);
  if (axis === 0) geo.rotateY(-Math.PI / 2); // u → z, длина → x
  else if (axis === 1) geo.rotateX(Math.PI / 2); // v → z, длина → y
  const g = new THREE.Group(); g.add(new THREE.Mesh(geo, chrome()));
  return g;
}

/** Направляющая по длинной оси Z детали (сечение x × y). wallAt −1: стенка (крепление к корпусу) слева, +1 — справа. */
export function slideModel(kind: "ball" | "hidden", size: [number, number, number], wallAt: -1 | 1): THREE.Group {
  const [w, h, L] = size, g = new THREE.Group(), steel = zinc();
  const flip = (s: THREE.Shape) => (wallAt > 0 ? mirrorU(s) : s);
  if (kind === "ball") {
    // три звена телескопа: наружное (у корпуса), среднее, внутреннее (к ящику); переднее звено чуть короче — видны слои
    g.add(new THREE.Mesh(extrude(flip(channel(w, h, 1.2, 4)), L), steel));
    const mid = new THREE.Mesh(extrude(flip(mirrorU(channel(w - 4, h - 8, 1.2, 3, 0.6))), L - 4, -L / 2 + 2), steel);
    const run = new THREE.Mesh(extrude(flip(channel(Math.max(2, w - 8.6), h - 18, 1.2, 2.5, 1.3)), L - 10, -L / 2 + 10), steel);
    mid.userData.slide = "mid"; run.userData.slide = "run"; // выдвижение ящика: среднее звено — на половину хода, внутреннее — на весь
    g.add(mid, run);
    // пластиковый буфер доводчика у заднего торца
    const buf = new THREE.Mesh(new THREE.BoxGeometry(Math.max(1, w - 3), h * 0.45, 30), plastic(0x2f3337));
    buf.position.set(wallAt * -1.2, 0, -L / 2 + 16); g.add(buf);
  } else {
    const t = Math.min(1.5, w / 8, h / 6), a = -w / 2, b = w / 2, lo = -h / 2, hi = h / 2, gap = Math.max(0.3, t / 3);
    // неподвижная шина: полка снизу + стенка у боковины корпуса
    const fixed = shape([[a, lo], [b, lo], [b, lo + t], [a + t, lo + t], [a + t, hi - 2 * t], [a, hi - 2 * t]]);
    // подвижная шина под дном ящика: перевёрнутый швеллер
    const ma = a + t + gap, mlo = lo + t + gap;
    const moving = shape([[ma, hi], [b, hi], [b, mlo], [b - t, mlo], [b - t, hi - t], [ma + t, hi - t], [ma + t, mlo], [ma, mlo]]);
    const run = new THREE.Mesh(extrude(flip(moving), L - 6, -L / 2 + 6), steel);
    g.add(new THREE.Mesh(extrude(flip(fixed), L), steel), run);
    // замок-регулятор спереди (пластик) — у переднего торца подвижной шины, едет с ней
    const lock = new THREE.Mesh(new THREE.BoxGeometry(Math.max(1, w - 2 * t), Math.max(1, h - 2 * t), Math.min(40, L / 8)), plastic(0x4a4f55));
    lock.position.set(0, 0, L / 2 - Math.min(40, L / 8) / 2 - 2); g.add(lock);
    run.userData.slide = "run"; lock.userData.slide = "run";
  }
  return g;
}

/** Тело вращения вдоль Y по профилю (r, y). */
const lathe = (prof: [number, number][], mat: THREE.Material, seg = 28) => new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat);
/** Повернуть группу так, чтобы её ось Y легла по оси детали (0 — X, 1 — Y, 2 — Z); sign −1 — переворот. */
function alongAxis(g: THREE.Object3D, axis: number, sign: 1 | -1 = 1) {
  if (axis === 0) g.rotation.z = -sign * Math.PI / 2;
  else if (axis === 2) g.rotation.x = sign * Math.PI / 2;
  else if (sign < 0) g.rotation.x = Math.PI;
  return g;
}

/** Корпус эксцентрика Ø15×H: ось — короткая сторона детали или заданная (axisOverride); шлиц под отвёртку — на обоих торцах. */
export function eccCamModel(size: [number, number, number], axisOverride?: 0 | 1 | 2): THREE.Group {
  const sorted = [...size].sort((a, b) => a - b), axis = axisOverride ?? size.indexOf(sorted[0]), H = sorted[0], R = Math.min(sorted[1], sorted[2]) / 2;
  const inner = new THREE.Group(), z = zinc(), dark = plastic(0x2a2d31);
  inner.add(lathe([[0, -H / 2], [R - 0.6, -H / 2], [R, -H / 2 + 0.6], [R, H / 2 - 0.6], [R - 0.6, H / 2], [0, H / 2]], z));
  for (const s of [-1, 1]) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(R * 1.3, 0.8, 1.6), dark); slot.position.y = s * (H / 2 - 0.4); inner.add(slot);
    const slot2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, R * 0.7), dark); slot2.position.set(R * 0.2, s * (H / 2 - 0.4), 0); inner.add(slot2);
  }
  const g = new THREE.Group(); g.add(alongAxis(inner, axis));
  return g;
}

/** Шток эксцентрика: резьба Ø5 (13 мм) — в стойку, гладкий стержень Ø7, шейка и головка — к корпусу эксцентрика (headSign — направление на корпус по оси детали). */
export function eccPinModel(size: [number, number, number], headSign: 1 | -1): THREE.Group {
  const axis = size.indexOf(Math.max(...size)), L = size[axis], r = Math.min(...size.filter((_, i) => i !== axis)) / 2;
  const y0 = -L / 2, thread = Math.min(13, L * 0.35), prof: [number, number][] = [[0, y0], [r * 0.55, y0]];
  for (let y = y0 + 0.5; y < y0 + thread; y += 1) prof.push([r * 0.72, y], [r * 0.6, y + 0.5]);
  prof.push([r * 0.72, y0 + thread], [r, y0 + thread + 0.8], [r, L / 2 - 6], [r * 0.6, L / 2 - 5], [r * 0.6, L / 2 - 3.5], [r, L / 2 - 2.5], [r, L / 2 - 0.8], [r * 0.6, L / 2], [0, L / 2]);
  const inner = new THREE.Group(); inner.add(lathe(prof, zinc()));
  const g = new THREE.Group(); g.add(alongAxis(inner, axis, headSign));
  return g;
}

/** Шкант: дерево, фаски на концах и рифление по длинной стороне детали. */
export function dowelModel(size: [number, number, number]): THREE.Group {
  const axis = size.indexOf(Math.max(...size)), L = size[axis], r = Math.min(...size.filter((_, i) => i !== axis)) / 2, prof: [number, number][] = [[0, -L / 2], [r - 0.8, -L / 2], [r, -L / 2 + 0.8]];
  for (let y = -L / 2 + 3; y < L / 2 - 3; y += 3) prof.push([r, y - 0.6], [r - 0.35, y], [r, y + 0.6]);
  prof.push([r, L / 2 - 0.8], [r - 0.8, L / 2], [0, L / 2]);
  const inner = new THREE.Group(); inner.add(lathe(prof, wood(), 20));
  const g = new THREE.Group(); g.add(alongAxis(inner, axis));
  return g;
}

/** Толкатель push-to-open (накладной, в корпусе): корпус по габариту детали, шток с резиновым наконечником — к фасаду (+Z детали). */
export function latchModel(size: [number, number, number]): THREE.Group {
  const [w, h, L] = size, R = Math.min(w, h) / 2, inner = new THREE.Group();
  const body: [number, number][] = [[0, -L / 2], [R - 0.8, -L / 2], [R, -L / 2 + 0.8], [R, L / 2 - 12], [R * 0.75, L / 2 - 11], [R * 0.75, L / 2 - 10], [0, L / 2 - 10]];
  inner.add(lathe(body, plastic(0x55595d)));
  inner.add(lathe([[0, L / 2 - 10.2], [R * 0.45, L / 2 - 10.2], [R * 0.45, L / 2 - 3], [0, L / 2 - 3]], zinc(), 20));
  inner.add(lathe([[0, L / 2 - 3], [R * 0.55, L / 2 - 3], [R * 0.55, L / 2 - 0.8], [R * 0.4, L / 2], [0, L / 2]], plastic(0x26292c), 20));
  const g = new THREE.Group(); g.add(alongAxis(inner, 2));
  return g;
}

/** Фланец штанги: шайба по габариту детали (ось — тонкая сторона) у стойки и стакан под трубу Ø25 к середине секции; два шурупа.
 *  baseAt −1 — шайба на минимальной грани по оси (левая стойка), +1 — на максимальной. Стакан Ø31 и толщина шайбы 1,6 — оценка. */
export function flangeModel(size: [number, number, number], baseAt: -1 | 1): THREE.Group {
  const axis = size.indexOf(Math.min(...size)), T = size[axis], R = Math.min(...size.filter((_, i) => i !== axis)) / 2, b = 1.6, inner = new THREE.Group(), c = chrome();
  inner.add(lathe([[0, -T / 2], [R - 0.8, -T / 2], [R, -T / 2 + 0.8], [R, -T / 2 + b], [Math.min(15.5, R * 0.65), -T / 2 + b], [Math.min(15.5, R * 0.65), T / 2], [12.6, T / 2], [12.6, -T / 2 + b], [0, -T / 2 + b]], c, 36));
  for (const s of [-1, 1]) { const sc = lathe([[0, -T / 2 + b], [2.6, -T / 2 + b], [2.6, -T / 2 + b + 0.6], [0, -T / 2 + b + 0.9]], plastic(0x6b7076), 16); sc.position.x = s * (R - 5.5); inner.add(sc); }
  const g = new THREE.Group(); g.add(alongAxis(inner, axis, baseAt > 0 ? -1 : 1));
  return g;
}

/** Цилиндр-заглушка крепежа без модели: ось — по длинной стороне (винт, ножка), у диска — по короткой; радиус — по поперечным размерам.
 *  (Раньше ось всегда X: вертикальная ножка или конфирмат рисовались «шайбой».) */
export function fastenerAxis(size: [number, number, number]) {
  const order = [0, 1, 2].sort((a, b) => size[b] - size[a]), disk = Math.abs(size[order[0]] - size[order[1]]) <= 1 && size[order[2]] < size[order[0]] * 0.6;
  const axis = disk ? order[2] : order[0], rest = [0, 1, 2].filter((i) => i !== axis).map((i) => size[i]);
  return { axis, r: Math.min(...rest) / 2, h: size[axis] };
}
/** Габарит-заглушка крепежа, уже повёрнутая по оси крепежа (поворот — в геометрии, не в меше). У крепежа с сеткой Базиса
 *  (model.native) меш не поворачивается — сетка дочерняя и легла бы криво; поэтому раньше цилиндр стоял по Y всегда, и если сетка
 *  не загрузилась, горизонтальный конфирмат 50 мм в крыше/дне/полке торчал штырём на 17 мм над плитой (баг Макса по демо 20.10). */
export function fastenerGeometry(size: [number, number, number], seg = 20): THREE.BufferGeometry {
  const f = fastenerAxis(size), g = new THREE.CylinderGeometry(f.r, f.r, f.h, seg);
  if (f.axis === 0) g.rotateZ(Math.PI / 2); else if (f.axis === 2) g.rotateX(Math.PI / 2);
  return g;
}
/** Где и как сцена ставит сетку Базиса (model.native) внутри меша детали: начало координат сетки — в origin узла Базиса (или в центре
 *  детали), поворот quat [w, x, y, z], mirror — зеркало по X сетки. Смещение — от центра детали (меш стоит в её центре, сам не повёрнут).
 *  Одна функция для Scene.tsx и проверки tests/fastener-envelope.test.ts: тест считает габарит GLB той же матрицей, что и сцена. */
export function nativePlacement(model: { origin?: [number, number, number]; quat?: [number, number, number, number]; mirror?: boolean }, partPosition: [number, number, number]) {
  const [w, x, y, z] = model.quat ?? [1, 0, 0, 0], o = model.origin ?? partPosition;
  const offset = new THREE.Vector3(o[0] - partPosition[0], o[1] - partPosition[1], o[2] - partPosition[2]), quaternion = new THREE.Quaternion(x, y, z, w);
  return { offset, quaternion, mirror: !!model.mirror, matrix: new THREE.Matrix4().compose(offset, quaternion, new THREE.Vector3(1, 1, 1)).multiply(new THREE.Matrix4().makeScale(model.mirror ? -1 : 1, 1, 1)) };
}
/** Запасная модель петли, если сетка Базиса не загрузилась (сеть/кэш): в системе координат той же сетки (origin/quat детали),
 *  а не серая коробка габарита. Чашка ECHC (39d9d9c26d8c: фланец ±31,5 × −17,25..21, толщина 3 по Z) — чашка Ø35 и фланец;
 *  плечо с планкой (d7e1d3957ebe: X −12..70 от фасада вглубь, Y 0..23,7 от стойки, Z ±26,5) — планка на стойке и плечо к чашке. */
export function hingeFallbackModel(file: string): THREE.Group | undefined {
  const g = new THREE.Group(), steel = zinc(), dark = plastic(0x5a5f64);
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: THREE.Material) => { const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat); b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); g.add(b); };
  if (file.endsWith("39d9d9c26d8c.glb")) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(17.25, 17.25, 3, 32), steel); cup.rotation.x = Math.PI / 2; cup.position.set(0, 0, 1.5); g.add(cup);
    box(-31.5, 31.5, -6, 6, 0, 1.5, steel);
  } else if (file.endsWith("d7e1d3957ebe.glb")) {
    box(34, 70, 0, 3, -26.5, 26.5, dark); // планка на стойке
    box(-12, 66, 3, 17, -8, 8, steel); // плечо
  } else return undefined;
  g.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Модель детали по её виду; ctx — сторона корпуса (для направляющих) и направление на корпус эксцентрика (для штока). */
export function procModel(p: P & { look?: Part["look"] }, ctx: { left?: boolean; headSign?: 1 | -1; face?: { axis: 0 | 1 | 2; dir: 1 | -1 } } = {}): THREE.Group | undefined {
  // техника всегда закрыта (запрос Макса 22.10, K3): «Открыть створки» распахивает фасады мебели, дверцы духовки/СВЧ не трогает
  if(p.id==='layout-oven')return ovenModel(false);
  if(p.id==='layout-microwave')return microwaveModel(p.size);
  if(p.id==='layout-fridge')return builtInFridgeModel(p.size);
  if(p.id.startsWith('layout-tap:'))return tapModel();
  if(p.id.startsWith('layout-waste:'))return servicePipeModel(p.size,false);
  if(p.id.startsWith('layout-water:'))return servicePipeModel(p.size,true,p.id.endsWith(':1'));
  if (p.id.startsWith('premial-sink:')) return premialSinkModel();
  if (p.id.startsWith('layout-drain:')) return layoutDrainModel(p.size[1]);
  if (p.id.startsWith('premial-allegro:')) return allegroModel(p.size[0], /06050[13]$/.test(p.id));
  const k = procKind(p);
  if (!k) return undefined;
  if (k === "screw" || k === "hole") {
    // саморез без пласти рядом (точка Базиса в теле детали) — как раньше, точкой
    if (!ctx.face) return undefined;
    const g = screwModel(screwSpec(p.name), ctx.face.axis, ctx.face.dir, k === "hole");
    g.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = false; o.receiveShadow = true; } });
    return g;
  }
  const g = k === "gola-L" || k === "gola-C" ? golaModel(k === "gola-L" ? "L" : "C", p.size[0], p.size[1], p.size[2], p.look?.color)
    : k === "rod-round" || k === "rod-oval" ? rodModel(p.size, k === "rod-oval")
    : k === "slide-ball" || k === "slide-hidden" ? slideModel(k === "slide-ball" ? "ball" : "hidden", p.size, ctx.left === false ? 1 : -1)
    // бочонок в горизонтали (ecc:<полка/дно/крыша>:…) сверлится с пласти — ось по Y, хотя габарит детали студии [13,15,15] лежит осью по X
    // (model.ts: [eccBarrelH, D, D]; габарит не трогаем — регрессия деталей); в боковине (ecc:under, ecc:bottom-under) — ось X, как габарит;
    // в царге под дном (ecc:rail-under, k31: габарит [15,15,13] в вертикальной царге 16) — ось по короткой стороне (Z), а не Y:
    // по Y бочонок Ø15 выходил на 1 мм за заднюю плоскость корпуса (проверка tests/fastener-envelope.test.ts, 20.10)
    : k === "ecc-cam" ? eccCamModel(p.size, /:(under|bottom-under|rail-under):/.test(p.id) ? undefined : 1)
    : k === "ecc-pin" ? eccPinModel(p.size, ctx.headSign ?? 1)
    : k === "latch" ? latchModel(p.size)
    : k === "flange" ? flangeModel(p.size, ctx.left === false ? 1 : -1)
    : dowelModel(p.size);
  // тонкостенный профиль (Gola, направляющая) в собственной тени даёт полосы («shadow acne») — тень не отбрасывает, только принимает
  const thin = k.startsWith("gola") || k.startsWith("slide");
  g.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = !thin; o.receiveShadow = true; } });
  return g;
}
