// Преобразования координат Базиса для импорта шкафов (как Кухни/scripts/dump.py и b3d-tools/drawings.py):
// мир = сборки (от корня) ∘ chain[0] ∘ chain[1] ∘ … ∘ chain[n-1] ∘ trans детали.
export type Trans = { x: number; y: number; z: number; q: [number, number, number, number] };
export type M3 = number[]; // 3×3 по строкам
export type Xf = { R: M3; t: [number, number, number] };
export type CPanel = { name: string; mat: string; thick: number; bbox?: number[]; trans: Trans; chain?: Trans[] };

export const qmat = ([w, x, y, z]: number[]): M3 => [
  1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
  2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
  2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
];
export const mul = (a: M3, b: M3): M3 => [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]));
export const app = (R: M3, p: number[]): [number, number, number] => [0, 1, 2].map((i) => R[i * 3] * p[0] + R[i * 3 + 1] * p[1] + R[i * 3 + 2] * p[2]) as [number, number, number];
export const xf = (t?: Trans): Xf => (t ? { R: qmat(t.q ?? [1, 0, 0, 0]), t: [t.x ?? 0, t.y ?? 0, t.z ?? 0] } : { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] });
export const compose = (a: Xf, b: Xf): Xf => { const tb = app(a.R, b.t); return { R: mul(a.R, b.R), t: [tb[0] + a.t[0], tb[1] + a.t[1], tb[2] + a.t[2]] }; };
/** сборка ∘ chain[0] ∘ … ∘ chain[n-1] (порядок как у drills и dump.py) */
export const chainXf = (parent: Xf, chain?: Trans[]): Xf => { let w = parent; for (const c of chain ?? []) w = compose(w, xf(c)); return w; };

/** мировой бокс панели: локальный прямоугольник контура (bbox) × толщина 0..thick, через сборки, chain панели и её trans */
export function panelBox(p: CPanel, parent: Xf): [number, number, number, number, number, number] | null {
  const b = p.bbox; if (!b || b.length !== 4 || !b.every(Number.isFinite)) return null;
  const w = compose(chainXf(parent, p.chain), xf(p.trans));
  const lo = Math.min(0, p.thick || 0), hi = Math.max(0, p.thick || 0);
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const x of [b[0], b[2]]) for (const y of [b[1], b[3]]) for (const z of [lo, hi]) {
    const q = app(w.R, [x, y, z]);
    for (let i = 0; i < 3; i++) { const v = q[i] + w.t[i]; mn[i] = Math.min(mn[i], v); mx[i] = Math.max(mx[i], v); }
  }
  return [mn[0], mn[1], mn[2], mx[0], mx[1], mx[2]];
}

/** Элемент контура Базиса (corpus json): отрезок или дуга (c — центр, dir ≠ 0 — против часовой, как в Кухни/scripts/etalon.py). */
export type CElem = { t: string; p1?: number[]; p2?: number[]; c?: number[]; dir?: number };
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function elemPoly(e: CElem, seg = 16): [number, number][] | null {
  if (!e.p1 || !e.p2) return null;
  const p1 = [e.p1[0], e.p1[1]] as [number, number], p2 = [e.p2[0], e.p2[1]] as [number, number];
  if (e.t === "line") return [p1, p2];
  if (e.t !== "arc" || !e.c) return null;
  const c = e.c, r = Math.hypot(p1[0] - c[0], p1[1] - c[1]);
  const a1 = Math.atan2(p1[1] - c[1], p1[0] - c[0]);
  let a2 = Math.atan2(p2[1] - c[1], p2[0] - c[0]);
  if (e.dir) while (a2 <= a1 + 1e-12) a2 += 2 * Math.PI; else while (a2 >= a1 - 1e-12) a2 -= 2 * Math.PI;
  const out: [number, number][] = [p1];
  for (let i = 1; i < seg; i++) { const a = a1 + ((a2 - a1) * i) / seg; out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
  out.push(p2);
  return out;
}
const area = (pts: number[][]) => pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
/** Внешняя петля контура Базиса (элементы идут не по порядку и бывают развёрнуты — собираем по концам, как etalon.py chain_loops).
 *  null — в контуре есть элементы неизвестного вида (kind17/kind20) или петля не замкнулась: тогда деталь рисуется габаритом. */
export function contourLoop(elems: CElem[] | undefined, seg = 16, tol = 0.05): [number, number][] | null {
  if (!Array.isArray(elems) || !elems.length) return null;
  const segs: [number, number][][] = [];
  for (const e of elems) { const p = elemPoly(e, seg); if (!p) return null; segs.push(p); }
  const unused = segs.map((_, i) => i), loops: [number, number][][] = [];
  while (unused.length) {
    const pts = [...segs[unused.shift()!]];
    for (;;) {
      const end = pts[pts.length - 1];
      if (pts.length > 2 && dist(end, pts[0]) < tol) break;
      let k = -1, rev = false;
      for (const j of unused) { if (dist(segs[j][0], end) < tol) { k = j; break; } if (dist(segs[j][segs[j].length - 1], end) < tol) { k = j; rev = true; break; } }
      if (k < 0) break;
      unused.splice(unused.indexOf(k), 1);
      const s = rev ? [...segs[k]].reverse() : segs[k];
      pts.push(...s.slice(1));
    }
    if (dist(pts[0], pts[pts.length - 1]) >= tol) return null;
    loops.push(pts.slice(0, -1));
  }
  const best = loops.filter((l) => l.length >= 3).sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)))[0];
  return best ?? null;
}
/** Прямоугольник ли контур (совпадает с bbox) — такой не храним, деталь рисуется габаритом. */
export function isRectLoop(pts: [number, number][], bbox: number[]): boolean {
  return pts.length === 4 && Math.abs(Math.abs(area(pts)) - Math.abs((bbox[2] - bbox[0]) * (bbox[3] - bbox[1]))) < 1;
}

/** Мировое преобразование панели (сборки ∘ chain ∘ trans). */
export const panelXf = (p: CPanel, parent: Xf): Xf => compose(chainXf(parent, p.chain), xf(p.trans));
/** Повёрнута ли деталь на угол, кратный 90° (матрица — перестановка осей со знаками). */
export const isAxisAligned = (R: M3, eps = 1e-4) => R.every((v) => Math.abs(v) < eps || Math.abs(Math.abs(v) - 1) < eps);

/** Поворот R (3×3) детали как в сцене студии: R = Ry(ry)·Rz(rz) (Euler XYZ при rotX = 0) с перестановкой и знаками локальных осей.
 *  Возвращает углы (градусы) и perm — какая локальная ось Базиса стала осью X/Y/Z детали студии; null — поворот так не выражается
 *  (ни одна ось детали не лежит горизонтально). */
export function ryRz(R: M3, eps = 1e-4): { ry: number; rz: number; perm: [number, number, number] } | null {
  const perms: [number, number, number][] = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  let best: { ry: number; rz: number; perm: [number, number, number] } | null = null;
  for (const pm of perms) for (let sg = 0; sg < 8; sg++) {
    const s = [sg & 1 ? -1 : 1, sg & 2 ? -1 : 1, sg & 4 ? -1 : 1];
    const M = [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => s[j] * R[i * 3 + pm[j]]));
    const det = M[0] * (M[4] * M[8] - M[5] * M[7]) - M[1] * (M[3] * M[8] - M[5] * M[6]) + M[2] * (M[3] * M[7] - M[4] * M[6]);
    if (det < 0 || Math.abs(M[5]) > eps) continue;
    const rz = Math.atan2(M[3], M[4]), ry = Math.atan2(M[2], M[8]);
    const cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    const E = [cy * cz, -cy * sz, sy, sz, cz, 0, -sy * cz, sy * sz, cy];
    if (E.some((v, i) => Math.abs(v - M[i]) > 1e-3)) continue;
    const c = { ry: (ry * 180) / Math.PI, rz: (rz * 180) / Math.PI, perm: pm };
    if (!best || Math.abs(c.ry) + Math.abs(c.rz) < Math.abs(best.ry) + Math.abs(best.rz) - 1e-6) best = c;
  }
  return best;
}

/** Повёрнутая не на 90° деталь — честный ориентированный короб: размеры по осям детали студии и углы rotY/rotZ; null — не выражается. */
export function panelObb(p: CPanel, parent: Xf): { size: [number, number, number]; ry: number; rz: number } | null {
  const b = p.bbox; if (!b || b.length !== 4) return null;
  const w = panelXf(p, parent), r = ryRz(w.R); if (!r) return null;
  const L = [Math.abs(b[2] - b[0]), Math.abs(b[3] - b[1]), Math.abs(p.thick || 0)];
  return { size: [L[r.perm[0]], L[r.perm[1]], L[r.perm[2]]], ry: r.ry, rz: r.rz };
}

/** Контур фигурной детали в плоскости модуля: точки (локальные x, y Базиса при z = 0) в мировые координаты, затем две оси плоскости —
 *  xz у горизонтальной (тонкая по Y), xy у тонкой по Z, yz у тонкой по X. Только для деталей, повёрнутых на 90°. */
export function planeContour(loop: [number, number][], w: Xf, box: number[]): { plane: "xz" | "xy" | "yz"; pts: [number, number][] } | null {
  if (!isAxisAligned(w.R)) return null;
  const size = [box[3] - box[0], box[4] - box[1], box[5] - box[2]], thin = size.indexOf(Math.min(...size));
  const plane = thin === 1 ? "xz" : thin === 2 ? "xy" : "yz", ax: Record<string, [number, number]> = { xz: [0, 2], xy: [0, 1], yz: [1, 2] }, [a, c] = ax[plane];
  const pts = loop.map(([x, y]) => { const q = app(w.R, [x, y, 0]); return [q[a] + w.t[a], q[c] + w.t[c]] as [number, number]; });
  return { plane, pts };
}

/** Мировой габарит повёрнутого локального бокса [x0,y0,z0,x1,y1,z1] (bbox сетки фурнитуры по позиции и кватерниону Базиса). */
export function rotatedAabb(local: number[], R: M3, t: number[]): [number, number, number, number, number, number] {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const x of [local[0], local[3]]) for (const y of [local[1], local[4]]) for (const z of [local[2], local[5]]) {
    const q = app(R, [x, y, z]);
    for (let i = 0; i < 3; i++) { const v = q[i] + t[i]; mn[i] = Math.min(mn[i], v); mx[i] = Math.max(mx[i], v); }
  }
  return [mn[0], mn[1], mn[2], mx[0], mx[1], mx[2]];
}
