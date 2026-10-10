import * as THREE from 'three';

/** Геометрия фасада МДФ с фрезеровкой (Вернисаж): строится заново под каждый габарит, без масштабирования.
 *  Фасад в плоскости XY, толщина по Z, лицевая сторона +Z, центр в нуле — как у детали Part размера [w, h, t].
 *  Описание рисунка — дерево контуров: у каждого контура свой профиль (путь в координатах «смещение от контура, высота z»),
 *  профиль протягивается вдоль контура (смещённые копии контура со стыками «на ус»), площадки между контурами — плоские крышки.
 *  Так рамка сохраняет ширину, филёнка растягивается, фаски/пазы идут по контуру, а углы не плывут. */
export type P = [number, number];
/** Путь профиля: точки [смещение, z] от внешней стороны контура к внутренней (смещение убывает), материал — ниже пути. */
export type Feature = { c: P[]; path: P[]; kids?: Feature[]; through?: boolean };
export type GrooveShape = 'trap' | 'round' | 'v' | 'convex';
/** Пазы по всему полотну: [от, до] поперёк реек; форма паза shape (trap — трапеция с фаской ch, round — полукруглый, v — V-образный,
 *  convex — выпуклая волна между впадинами); gd/gs — своя глубина и форма у каждого паза (модуль №84). */
export type Rails = { dir: 'v' | 'h'; grooves: [number, number][]; depth: number; ch: number; shape?: GrooveShape; gd?: number[]; gs?: GrooveShape[] };
export type FacadeLayout = {
  w: number; h: number; t: number;
  root: Feature;
  rails?: Rails;
  /** Сечение (y, z), CCW, протянутое по ширине фасада с плоскими торцами — фасад с интегрированной ручкой (выборка по верхнему краю). */
  section?: P[];
  /** Выборка ручки по верхнему краю: от y0 до y1 (= верхняя кромка), глубина от лица. */
  handle?: { y0: number; y1: number; depth: number };
  bars: { x0: number; y0: number; x1: number; y1: number; z0: number; z1: number }[];
  glass?: { c: P[]; z0: number; z1: number };
  /** Ширина рамки (от кромки до проёма филёнки), мм — постоянная при любом габарите; null — у фасада нет рамки. */
  frame: number | null;
  /** Габарит филёнки или проёма (по контуру), мм. */
  opening: { x0: number; y0: number; x1: number; y1: number } | null;
  /** Высота площадки филёнки (z), если есть. */
  panelZ: number | null;
  notes: string[];
};

/* ---------- контуры ---------- */
/** Параметрические контуры: точное смещение с тем же числом точек (дуги скругления не выворачиваются, когда смещение внутрь
 *  больше радиуса — радиус после смещения max(0, r − d), точки угла совпадают). Смещение остальных контуров — на ус (offsetContour). */
const OFFSET = new WeakMap<P[], (o: number) => P[]>();
function parametric(gen: (o: number) => P[]): P[] { const c = gen(0); OFFSET.set(c, gen); return c; }
export function rectContour(x0: number, y0: number, x1: number, y1: number, r = 0, seg = 6): P[] {
  r = Math.max(0, Math.min(r, (x1 - x0) / 2 - 0.01, (y1 - y0) / 2 - 0.01));
  // прямые углы: 4 точки; смещение внутрь больше половины стороны — честное упрощение: контур сходится в отрезок/точку, не выворачивается
  if (r < 0.05) return parametric((o) => { const [X0, X1] = span(x0 - o, x1 + o), [Y0, Y1] = span(y0 - o, y1 + o); return [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]]; });
  return parametric((o) => {
    const [X0, X1] = span(x0 - o, x1 + o), [Y0, Y1] = span(y0 - o, y1 + o), R = Math.max(0, Math.min(r + o, (X1 - X0) / 2 - 0.01, (Y1 - Y0) / 2 - 0.01)), out: P[] = [];
    const corner = (cx: number, cy: number, a0: number) => { for (let k = 0; k <= seg; k++) { const a = a0 + (k / seg) * Math.PI / 2; out.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); } };
    corner(X1 - R, Y0 + R, -Math.PI / 2); corner(X1 - R, Y1 - R, 0); corner(X0 + R, Y1 - R, Math.PI / 2); corner(X0 + R, Y0 + R, Math.PI);
    return out;
  });
}
/** Отрезок [a, b] после смещения: если концы разошлись наоборот (смещение внутрь больше половины) — сходится в середину. */
function span(a: number, b: number): [number, number] { if (b >= a) return [a, b]; const m = (a + b) / 2; return [m, m]; }
/** Проём с вогнутыми углами («фигурные углы» №59): из филёнки по углам вырезана четверть круга радиуса r с центром в углу проёма. CCW.
 *  Смещение внутрь — дуга того же центра радиуса r + d до пересечения со смещёнными сторонами; наружу — радиус r − d и стык «на ус».
 *  На угол — 2 + seg + 1 точек при любом смещении (на нулевом и внутренних смещениях крайние точки совпадают с концами дуги). */
export function concaveRectContour(x0: number, y0: number, x1: number, y1: number, r: number, seg = 8): P[] {
  // угол, направление прихода (u_in) и ухода (u_out) по контуру
  const corners: [P, P, P][] = [[[x1, y0], [1, 0], [0, 1]], [[x1, y1], [0, 1], [-1, 0]], [[x0, y1], [-1, 0], [0, -1]], [[x0, y0], [0, -1], [1, 0]]];
  return parametric((o) => {
    const d = -o, out: P[] = [];
    for (const [C, ui, uo] of corners) {
      const at = (a: number, b: number): P => [C[0] - a * ui[0] + b * uo[0], C[1] - a * ui[1] + b * uo[1]];
      if (d >= 0) {
        const R = r + d, q = Math.sqrt(R * R - d * d), t1 = Math.atan2(d, q), t2 = Math.atan2(q, d);
        out.push(at(q, d));
        for (let k = 0; k <= seg; k++) { const t = t1 + ((t2 - t1) * k) / seg; out.push(at(R * Math.cos(t), R * Math.sin(t))); }
        out.push(at(d, q));
      } else {
        const e = -d, R = Math.max(0, r - e);
        out.push(at(r - e, -e));
        for (let k = 0; k <= seg; k++) { const t = ((Math.PI / 2) * k) / seg; out.push(at(R * Math.cos(t), R * Math.sin(t))); }
        out.push(at(-e, r - e));
      }
    }
    return out;
  });
}
/** Проём с аркой по верху: rise — подъём арки, shoulder — «плечики» (горизонтальные полочки у начала арки). CCW.
 *  bottomRise/bottomShoulder — такая же арка внизу, выгнутая вниз (паспорта №20, 25, 62, 66: дуги сверху и снизу). */
export function archContour(x0: number, y0: number, x1: number, y1: number, rise: number, shoulder = 0, seg = 28, bottomRise = 0, bottomShoulder = 0): P[] {
  const H = y1 - y0;
  rise = Math.max(0, Math.min(rise, H * 0.6)); bottomRise = Math.max(0, Math.min(bottomRise, H * 0.6 - rise, H * 0.4));
  if (rise < 1 && bottomRise < 1) return rectContour(x0, y0, x1, y1);
  const out: P[] = [];
  // низ слева направо: дуга вниз от хорды y0 + bottomRise
  if (bottomRise >= 1) {
    const s = Math.max(0, Math.min(bottomShoulder, (x1 - x0) / 4)), xa = x0 + s, xb = x1 - s, yc = y0 + bottomRise, c = (xb - xa) / 2, xm = (xa + xb) / 2;
    const R = (c * c + bottomRise * bottomRise) / (2 * bottomRise), cy = y0 + R, a1 = Math.atan2(yc - cy, xa - xm), a2 = Math.atan2(yc - cy, xb - xm);
    out.push([x0, yc]);
    if (s > 0.5) out.push([xa, yc]);
    for (let k = 1; k < seg; k++) { const a = a1 + (a2 - a1) * (k / seg); out.push([xm + R * Math.cos(a), cy + R * Math.sin(a)]); }
    if (s > 0.5) out.push([xb, yc]);
    out.push([x1, yc]);
  } else out.push([x0, y0], [x1, y0]);
  if (rise < 1) { out.push([x1, y1], [x0, y1]); return out; }
  const s = Math.max(0, Math.min(shoulder, (x1 - x0) / 4)), xa = x0 + s, xb = x1 - s, yb = y1 - rise, c = (xb - xa) / 2, xm = (xa + xb) / 2;
  const R = (c * c + rise * rise) / (2 * rise), cy = y1 - R, a1 = Math.atan2(yb - cy, xb - xm), a2 = Math.atan2(yb - cy, xa - xm);
  out.push([x1, yb]);
  if (s > 0.5) out.push([xb, yb]);
  for (let k = 1; k < seg; k++) { const a = a1 + (a2 - a1) * (k / seg); out.push([xm + R * Math.cos(a), cy + R * Math.sin(a)]); }
  if (s > 0.5) out.push([xa, yb]);
  out.push([x0, yb]);
  return out;
}
export function signedArea(c: P[]): number { let a = 0; for (let i = 0; i < c.length; i++) { const [x0, y0] = c[i], [x1, y1] = c[(i + 1) % c.length]; a += x0 * y1 - x1 * y0; } return a / 2; }
/** Смещение замкнутого контура (CCW): o > 0 — наружу, o < 0 — внутрь; углы — на ус (как у профиля рамки). */
export function offsetContour(c: P[], o: number): P[] {
  const gen = OFFSET.get(c);
  if (gen) { const res = Math.abs(o) < 1e-9 ? c.map(p => [p[0], p[1]] as P) : gen(o); OFFSET.set(res, (o2) => gen(o + o2)); return res; }
  if (Math.abs(o) < 1e-9) return c.map(p => [p[0], p[1]] as P);
  const full = miterOffset(c, o);
  if (soundOffset(c, full)) return full;
  // Честное упрощение: на полном смещении контур вырождается (стороны сходятся, сегменты пересекаются) — берём наибольшее смещение
  // того же знака, при котором контур ещё правильный; рисунок у вырожденного места мельче заказанного, но сетка не выворачивается.
  let lo = 0, hi = 1;
  for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; if (soundOffset(c, miterOffset(c, o * mid))) lo = mid; else hi = mid; }
  return lo > 0 ? miterOffset(c, o * lo) : c.map(p => [p[0], p[1]] as P);
}
/** Смещение «на ус» с тем же числом точек. Сторона, которая после смещения сменила направление (сжалась «через ноль» — короткая
 *  сторона у вогнутого стыка, мелкий сегмент арки), стягивается в точку — середину своих концов; совпавшие точки дают вырожденные
 *  треугольники, они пропускаются. Повтор, пока ни одна сторона не вывернута. */
function miterOffset(c: P[], o: number): P[] {
  const n = c.length, out: P[] = [];
  const nrm = (a: P, b: P): P => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dy / l, -dx / l]; };
  for (let i = 0; i < n; i++) {
    const p = c[i], n1 = nrm(c[(i - 1 + n) % n], p), n2 = nrm(p, c[(i + 1) % n]), k = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    if (k < 1e-6) { out.push([p[0] + o * n1[0], p[1] + o * n1[1]]); continue; }
    out.push([p[0] + o * (n1[0] + n2[0]) / k, p[1] + o * (n1[1] + n2[1]) / k]);
  }
  for (let pass = 0; pass < n; pass++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, ox = c[j][0] - c[i][0], oy = c[j][1] - c[i][1], nx = out[j][0] - out[i][0], ny = out[j][1] - out[i][1];
      if (ox * nx + oy * ny < -1e-9 * (Math.hypot(ox, oy) + 1)) { const m: P = [(out[i][0] + out[j][0]) / 2, (out[i][1] + out[j][1]) / 2]; out[i] = m; out[j] = [m[0], m[1]]; changed = true; }
    }
    if (!changed) break;
  }
  return out;
}
/** Смещённый контур правильный: стороны не сменили направление, площадь того же знака, несмежные стороны не пересекаются. */
function soundOffset(c: P[], d: P[]): boolean {
  const n = c.length;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; if ((c[j][0] - c[i][0]) * (d[j][0] - d[i][0]) + (c[j][1] - c[i][1]) * (d[j][1] - d[i][1]) < -1e-9) return false; }
  if (signedArea(d) < -1e-9) return false;
  const cross = (a: P, b: P, p: P) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const live: number[] = []; for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (Math.hypot(d[j][0] - d[i][0], d[j][1] - d[i][1]) > 1e-7) live.push(i); }
  for (let x = 0; x < live.length; x++) for (let y = x + 1; y < live.length; y++) {
    const i = live[x], k = live[y]; if (y === x + 1 || (x === 0 && y === live.length - 1)) continue;
    const a = d[i], b = d[(i + 1) % n], p = d[k], q = d[(k + 1) % n];
    const d1 = cross(a, b, p), d2 = cross(a, b, q), d3 = cross(p, q, a), d4 = cross(p, q, b), e = 1e-9;
    if (((d1 > e && d2 < -e) || (d1 < -e && d2 > e)) && ((d3 > e && d4 < -e) || (d3 < -e && d4 > e))) return false;
  }
  return true;
}
function bbox(c: P[]) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of c) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1 }; }

/* ---------- сборка сетки ---------- */
type V3 = [number, number, number];
class MeshBuilder {
  pos: number[] = []; nor: number[] = []; groups: { start: number; count: number; mat: number }[] = []; private mat = 0; private start = 0;
  material(m: number) { if (m === this.mat) return; this.flush(); this.mat = m; }
  flush() { const n = this.pos.length / 3; if (n > this.start) this.groups.push({ start: this.start, count: n - this.start, mat: this.mat }); this.start = n; }
  /** Треугольник с обходом по желаемой нормали want (лицо наружу); вырожденные пропускаются. */
  tri(a: V3, b: V3, c: V3, want: V3) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz);
    if (l < 1e-7) return;
    nx /= l; ny /= l; nz /= l;
    if (nx * want[0] + ny * want[1] + nz * want[2] < 0) { [b, c] = [c, b]; nx = -nx; ny = -ny; nz = -nz; }
    for (const p of [a, b, c]) { this.pos.push(p[0], p[1], p[2]); this.nor.push(nx, ny, nz); }
  }
  quad(a: V3, b: V3, c: V3, d: V3, want: V3) { this.tri(a, b, c, want); this.tri(a, c, d, want); }
  /** Плоская крышка: контур с дырами на высоте z, нормаль ±Z. */
  cap(outer: P[], holes: P[][], z: number, up: boolean) {
    // совпадающие соседние точки (угол параметрического контура с нулевым радиусом) — убрать до триангуляции
    const uniq = (c: P[]) => c.filter((p, i) => { const q = c[(i + 1) % c.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6; });
    const o = uniq(outer).map(([x, y]) => new THREE.Vector2(x, y)), hs = holes.map(h => uniq(h).map(([x, y]) => new THREE.Vector2(x, y)));
    const faces = THREE.ShapeUtils.triangulateShape(o, hs), all = [...o, ...hs.flat()], w: V3 = [0, 0, up ? 1 : -1];
    for (const [i, j, k] of faces) this.tri([all[i].x, all[i].y, z], [all[j].x, all[j].y, z], [all[k].x, all[k].y, z], w);
  }
  /** Протяжка профиля между двумя точками пути вдоль контура (CCW). */
  sweep(c: P[], a: P, b: P) {
    const A = offsetContour(c, a[0]), B = offsetContour(c, b[0]), to = b[0] - a[0], tz = b[1] - a[1], n = c.length;
    for (let i = 0; i < n; i++) {
      // направление стороны — по самой длинной из трёх копий (у параметрического контура сторона может выродиться в точку)
      const j = (i + 1) % n, cand = [[c[j][0] - c[i][0], c[j][1] - c[i][1]], [A[j][0] - A[i][0], A[j][1] - A[i][1]], [B[j][0] - B[i][0], B[j][1] - B[i][1]]];
      const [dx, dy] = cand.reduce((m, v) => (Math.hypot(v[0], v[1]) > Math.hypot(m[0], m[1]) ? v : m)), l = Math.hypot(dx, dy) || 1;
      const want: V3 = [tz * dy / l, tz * -dx / l, -to];
      this.quad([A[i][0], A[i][1], a[1]], [A[j][0], A[j][1], a[1]], [B[j][0], B[j][1], b[1]], [B[i][0], B[i][1], b[1]], want);
    }
  }
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const q = (a: V3, b: V3, c: V3, d: V3, w: V3) => this.quad(a, b, c, d, w);
    q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]); q([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1]);
    q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]); q([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0]);
    q([x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [-1, 0, 0]); q([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]);
  }
}

function emitFeature(mb: MeshBuilder, f: Feature) {
  for (let i = 0; i + 1 < f.path.length; i++) mb.sweep(f.c, f.path[i], f.path[i + 1]);
  for (const k of f.kids ?? []) emitFeature(mb, k);
  if (f.through) return;
  const last = f.path[f.path.length - 1];
  mb.cap(offsetContour(f.c, last[0]), (f.kids ?? []).map(k => offsetContour(k.c, k.path[0][0])), last[1], true);
}
function throughHoles(f: Feature, out: P[][]) { for (const k of f.kids ?? []) { if (k.through) out.push(offsetContour(k.c, k.path[k.path.length - 1][0])); throughHoles(k, out); } }

/** Рельеф по всему полотну: поперечное сечение (пазы с фасками) протянуто вдоль реек; торцы — плоские. */
function emitRails(mb: MeshBuilder, L: FacadeLayout) {
  const { w, h, t } = L, r = L.rails!, v = r.dir === 'v', U = v ? w : h, S = v ? h : w, zf = t / 2;
  const map = (u: number, s: number, z: number): V3 => v ? [u, s, z] : [s, u, z];
  const wantMap = (nu: number, nz: number, ns = 0): V3 => v ? [nu, ns, nz] : [ns, nu, nz];
  // сечение: CCW в координатах (u, z); пазы справа налево, у каждого — своя форма и глубина
  // волна от самой кромки (№111): угол сечения — на дне волны, без выступа до лица и обратно
  const atEdge = (u: number) => r.grooves.some(([g0, g1]) => Math.abs(g0 - u) < 1e-6 || Math.abs(g1 - u) < 1e-6);
  const raw: P[] = [[-U / 2, -t / 2], [U / 2, -t / 2], ...(atEdge(U / 2) ? [] : [[U / 2, zf] as P])];
  const order = r.grooves.map((g, i) => i).sort((a, b) => r.grooves[b][0] - r.grooves[a][0]);
  for (const i of order) {
    const [g0, g1] = r.grooves[i], d = r.gd?.[i] ?? r.depth, shape = r.gs?.[i] ?? r.shape ?? 'trap', c = (g0 + g1) / 2, hw = (g1 - g0) / 2, n = 8;
    if (shape === 'v') raw.push([g1, zf], [c, zf - d], [g0, zf]);
    else if (shape === 'round') for (let k = 0; k <= n; k++) { const a = (Math.PI * k) / n; raw.push([c + hw * Math.cos(a), zf - d * Math.sin(a)]); }
    else if (shape === 'convex') for (let k = 0; k <= n; k++) { const a = (Math.PI * k) / n; raw.push([c + hw * Math.cos(a), zf - d + d * Math.sin(a)]); }
    else { const ch = Math.min(r.ch, hw - 0.2); raw.push([g1, zf], [g1 - ch, zf - d], [g0 + ch, zf - d], [g0, zf]); }
  }
  if (!atEdge(-U / 2)) raw.push([-U / 2, zf]);
  // совпавшие соседние точки (впадина на стыке выпуклых волн, паз у самой кромки) — одна точка
  const sec = raw.filter((p, i) => { const q = raw[(i + 1) % raw.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6; });
  const s0 = -S / 2, s1 = S / 2;
  for (let i = 0; i < sec.length; i++) {
    const a = sec[i], b = sec[(i + 1) % sec.length], du = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(du, dz); if (l < 1e-9) continue;
    mb.quad(map(a[0], s0, a[1]), map(b[0], s0, b[1]), map(b[0], s1, b[1]), map(a[0], s1, a[1]), wantMap(dz / l, -du / l));
  }
  const tri = THREE.ShapeUtils.triangulateShape(sec.map(([u, z]) => new THREE.Vector2(u, z)), []);
  for (const s of [s0, s1]) for (const [i, j, k] of tri) mb.tri(map(sec[i][0], s, sec[i][1]), map(sec[j][0], s, sec[j][1]), map(sec[k][0], s, sec[k][1]), wantMap(0, 0, s > 0 ? 1 : -1));
}

/** Сечение по высоте фасада (y, z), CCW, протянуто по ширине (x) с плоскими торцами — интегрированная ручка. */
function emitSection(mb: MeshBuilder, L: FacadeLayout) {
  const sec = L.section!, x0 = -L.w / 2, x1 = L.w / 2;
  for (let i = 0; i < sec.length; i++) {
    const a = sec[i], b = sec[(i + 1) % sec.length], du = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(du, dz); if (l < 1e-9) continue;
    mb.quad([x0, a[0], a[1]], [x0, b[0], b[1]], [x1, b[0], b[1]], [x1, a[0], a[1]], [0, dz / l, -du / l]);
  }
  const tri = THREE.ShapeUtils.triangulateShape(sec.map(([u, z]) => new THREE.Vector2(u, z)), []);
  for (const x of [x0, x1]) for (const [i, j, k] of tri) mb.tri([x, sec[i][0], sec[i][1]], [x, sec[j][0], sec[j][1]], [x, sec[k][0], sec[k][1]], [x > 0 ? 1 : -1, 0, 0]);
}

/** Сетка фасада по раскладке. grainAxis детали: 1 — плёнка/текстура вдоль высоты (как boardGeometry), 0 — вдоль ширины.
 *  UV пластей и профиля — проекция на плоскость фасада: по габариту (0..1) или, если задан tileMm, в образцах текстуры плёнки. */
export function facadeGeometry(L: FacadeLayout, grainAxis: 0 | 1 | 2 = 1, tileMm?: number): THREE.BufferGeometry {
  const mb = new MeshBuilder(), { w, h, t } = L;
  mb.material(0);
  if (L.rails) emitRails(mb, L);
  else if (L.section) emitSection(mb, L);
  else {
    emitFeature(mb, L.root);
    const holes: P[][] = []; throughHoles(L.root, holes);
    mb.cap(L.root.c, holes, -t / 2, false);
  }
  for (const b of L.bars) mb.box(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1);
  if (L.glass) {
    mb.material(1); const g = L.glass, c = g.c;
    mb.cap(c, [], g.z1, true); mb.cap(c, [], g.z0, false); mb.sweep(c, [0, g.z0], [0, g.z1]);
  }
  mb.flush();
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(mb.pos), uv = new Float32Array((mb.pos.length / 3) * 2);
  // tileMm — текстура плёнки (образец tileMm×tileMm мм, RepeatWrapping): UV в долях образца от угла фасада, масштаб не зависит от габарита
  const sx = tileMm ? tileMm : w, sy = tileMm ? tileMm : h, ox = tileMm ? w / 2 / tileMm : 0.5, oy = tileMm ? h / 2 / tileMm : 0.5;
  for (let i = 0; i < mb.pos.length / 3; i++) {
    const x = mb.pos[i * 3] / sx + ox, y = mb.pos[i * 3 + 1] / sy + oy;
    if (grainAxis === 0) { uv[i * 2] = y; uv[i * 2 + 1] = x; } else { uv[i * 2] = x; uv[i * 2 + 1] = y; }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(mb.nor), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  for (const g of mb.groups) geo.addGroup(g.start, g.count, g.mat);
  geo.computeBoundingBox();
  return geo;
}

/* ---------- раскладка рисунка ---------- */
export type MillShape = {
  /** profile — сечение лица по паспорту Вернисажа (profile.pts, мм от кромки и глубина); lattice — сетка V-пазов ромбом (№109, 110). */
  kind: 'smooth' | 'groove' | 'frame' | 'relief' | 'handle' | 'profile' | 'lattice';
  /** Сечение лица от кромки внутрь: [x — мм от кромки, глубина — мм от лица]; x не убывает. edge — сечение начинается у кромки
   *  (кант или скос у кромки ниже поля: №113, 114, W5), иначе — с плоской рамки шириной pts[0][0]. */
  face?: { pts: P[]; edge?: boolean };
  /** Проём витрины/решётки: отступ от кромки («ширина рамочного профиля» паспорта) и радиус угла проёма (R16). */
  glass?: { frame: number; r: number };
  /** Низ: дуга или плечики, как верх (паспорта №20, 25, 62, 66). */
  bottom?: 'rect' | 'arch' | 'shoulders';
  /** Нижняя полоса под пазы (№112): нижняя сторона контура поднята на bottomBand от низа фасада. */
  bottomBand?: number;
  /** Прямые пазы: вертикальные/горизонтальные на отступах от кромок (объединены, пересечения честные) или диагональные с шагом. */
  lines?: { w: number; d: number; v?: { from: 'left' | 'right'; at: number[] }[]; h?: { from: 'bottom' | 'top'; at: number[]; between?: boolean }[]; diag?: { pitch: number; angle: number } };
  /** Полоса-арка полукругом, открытая книзу: отступ от кромки, ширина полосы, глубина (№98–100). */
  archBand?: { outer: number; width: number; d: number };
  /** Сетка V-пазов: ромб cellW×cellH, глубина d, угол фрезы (V90, V120). */
  lattice?: { cellW: number; cellH: number; d: number; vAngle: number };
  /** Интегрированная ручка: выборка по верхнему краю — высота h от кромки вниз, глубина d от лица, фаска ch по кромке выборки. */
  handle?: { h: number; d: number; ch: number };
  /** Радиус скругления наружной кромки. */
  edgeR: number;
  /** groove: отступ оси паза от кромки; frame: ширина рамки (от кромки до филёнки). */
  inset?: number;
  top?: 'rect' | 'arch' | 'shoulders';
  /** Радиус углов контура паза/проёма. */
  cornerR?: number;
  /** Углы проёма: скругление (по умолчанию) или вогнутая четверть круга («фигурные углы»). */
  cornerKind?: 'round' | 'concave';
  groove?: { w: number; d: number };
  /** Профиль рамки к филёнке: ширина и глубина филёнки от лица; step — прямой уступ «шейкер». */
  profile?: { w: number; d: number; step?: boolean };
  /** Выпуклая филёнка: ширина скоса и подъём площадки над дном. */
  raised?: { w: number; h: number };
  /** Второй контур (паз) внутри филёнки или поля — отступ от первого контура. */
  second?: number;
  /** Пазы внутри филёнки/поля: направление, шаг, ширина, зона; shape — сечение паза (round — пальчиковая фреза, v; по умолчанию
   *  плоское дно с фаской); band — полоса bottomBand у низа фасада (№112), inArch — внутри полосы-арки (№100). */
  slots?: { dir: 'v' | 'h'; pitch: number; w: number; d: number; zone: 'all' | 'bottom' | 'ends' | 'side' | 'band'; shape?: 'round' | 'v'; inArch?: boolean };
  /** Рельеф по всему полотну: shape — сечение паза; module/grooves — повторяющийся модуль из пазов своей глубины (доля d) и формы;
   *  band — только полоса из count волн от левой кромки (№111). */
  relief?: { dir: 'v' | 'h' | 'diamond'; pitch: number; w: number; d: number; shape?: GrooveShape; module?: number; grooves?: [number, number, number, GrooveShape][]; band?: { from: 'left'; count: number } };
  /** Подъём арки — доля ширины проёма, не больше доли высоты (арка подстраивается под низкий ящик). */
  archRise?: number; shoulder?: number;
};
export type Opening = 'solid' | 'glass' | 'grille';
/** Решётка: ячейка ~cell мм, планка bar мм; стекло glassT мм с тыла. Правила растягивания — число ячеек по габариту проёма. */
export const GRILLE = { cell: 160, bar: 18, glassT: 4, minPanel: 30 } as const;

function slotKids(field: { x0: number; y0: number; x1: number; y1: number }, z: number, s: NonNullable<MillShape['slots']>): Feature[] {
  const out: Feature[] = [], m = 12, ch = Math.min(1.5, s.w / 4);
  const fx0 = field.x0 + m, fx1 = field.x1 - m, fy0 = field.y0 + m, fy1 = field.y1 - m;
  if (fx1 - fx0 < s.w * 2 || fy1 - fy0 < s.w * 2) return out;
  const path: P[] = [[0, z], [-ch, z - s.d]];
  if (s.dir === 'v') {
    const n = Math.max(1, Math.floor((fx1 - fx0 + s.pitch - s.w) / s.pitch)), span = (n - 1) * s.pitch, c = (fx0 + fx1) / 2;
    let y0 = fy0, y1 = fy1;
    if (s.zone === 'bottom') y1 = fy0 + Math.min(fy1 - fy0, Math.max(60, (fy1 - fy0) * 0.3));
    for (let i = 0; i < n; i++) { const x = c - span / 2 + i * s.pitch; out.push({ c: rectContour(x - s.w / 2, y0, x + s.w / 2, y1, s.w / 2 - 0.3, 4), path }); }
  } else {
    const H = fy1 - fy0, band = s.zone === 'ends' ? Math.min(H / 2 - 4, Math.max(40, H * 0.22)) : H;
    const bands: [number, number][] = s.zone === 'ends' ? [[fy0, fy0 + band], [fy1 - band, fy1]] : [[fy0, fy1]];
    for (const [b0, b1] of bands) {
      const n = Math.max(1, Math.floor((b1 - b0 + s.pitch - s.w) / s.pitch)), span = (n - 1) * s.pitch, c = (b0 + b1) / 2;
      for (let i = 0; i < n; i++) { const y = c - span / 2 + i * s.pitch; out.push({ c: rectContour(fx0, y - s.w / 2, fx1, y + s.w / 2, s.w / 2 - 0.3, 4), path }); }
    }
  }
  return out;
}
function grooveFeature(c: P[], z: number, g: { w: number; d: number }, kids: Feature[] = []): Feature {
  const ch = Math.min(1.2, g.w / 4);
  return { c, path: [[g.w / 2, z], [g.w / 2 - ch, z - g.d], [-g.w / 2 + ch, z - g.d], [-g.w / 2, z]], kids };
}
function openingContour(x0: number, y0: number, x1: number, y1: number, s: MillShape, minConcave = 7): P[] {
  const W = x1 - x0, H = y1 - y0;
  // вогнутые углы: радиус не больше 0,1 меньшей стороны проёма (иначе дуги соседних углов сойдутся на смещении филёнки);
  // меньше профиля рамки + 3 мм — углы прямые (узкий проём)
  if (s.cornerKind === 'concave' && s.cornerR) { const rc = Math.min(s.cornerR, 0.1 * Math.min(W, H)); return rc >= minConcave ? concaveRectContour(x0, y0, x1, y1, rc) : rectContour(x0, y0, x1, y1); }
  // узкий проём (бутылочница, ящик): арка вырождается в мелкие сегменты — рисуем прямоугольный контур (правило студии, уточнить по тех. PDF)
  const topA = s.top === 'arch' || s.top === 'shoulders', botA = s.bottom === 'arch' || s.bottom === 'shoulders';
  if ((topA || botA) && W >= 80) {
    // дуги сверху и снизу — каждая не выше четверти высоты проёма
    const lim = topA && botA ? 0.25 : 0.35, rise = (k: boolean) => k ? Math.min((s.archRise ?? 0.18) * W, H * lim) : 0;
    const sh = s.top === 'shoulders' ? (s.shoulder ?? 18) : 0, shB = s.bottom === 'shoulders' ? (s.shoulder ?? 18) : 0;
    const seg = Math.max(8, Math.min(28, Math.round((W - 2 * Math.max(sh, shB)) / 8)));
    return archContour(x0, y0, x1, y1, rise(topA), sh, seg, rise(botA), shB);
  }
  return rectContour(x0, y0, x1, y1, s.cornerR ?? 0);
}
/** Подъём дуг контура (сверху, снизу) — как в openingContour; для поля филёнки над/под дугой. */
function archRises(W: number, H: number, s: MillShape): [number, number] {
  const topA = s.top === 'arch' || s.top === 'shoulders', botA = s.bottom === 'arch' || s.bottom === 'shoulders';
  if (W < 80 || s.cornerKind === 'concave') return [0, 0];
  const lim = topA && botA ? 0.25 : 0.35, r = Math.min((s.archRise ?? 0.18) * W, H * lim);
  return [topA ? r : 0, botA ? r : 0];
}

/** Раскладка рисунка под габарит w×h×t. Рамка постоянной ширины; если филёнка не помещается (меньше GRILLE.minPanel),
 *  фасад остаётся с наружным профилем и без рисунка — с пометкой в notes. */
export function layoutFacade(w: number, h: number, t: number, s: MillShape, open: Opening = 'solid'): FacadeLayout {
  const zf = t / 2, r = Math.max(0, Math.min(s.edgeR, t / 3, w / 4, h / 4)), notes: string[] = [];
  const edgePath: P[] = [[0, -t / 2], [0, zf - r]];
  const rs = r > 3 ? 6 : 3;
  if (r > 0.05) for (let k = 1; k <= rs; k++) { const a = (k / rs) * Math.PI / 2; edgePath.push([-r + r * Math.cos(a), zf - r + r * Math.sin(a)]); }
  const root: Feature = { c: rectContour(-w / 2, -h / 2, w / 2, h / 2), path: edgePath, kids: [] };
  const L: FacadeLayout = { w, h, t, root, bars: [], frame: null, opening: null, panelZ: null, notes };
  if (s.kind === 'profile') return layoutProfile(L, s, open, r);
  if (s.kind === 'lattice' && s.lattice) return layoutLattice(L, s.lattice, r);
  if (s.kind === 'relief' && s.relief && s.relief.dir !== 'diamond') {
    const rv = s.relief, U = rv.dir === 'v' ? w : h, dmax = Math.min(rv.d, t / 3), grooves: [number, number][] = [], gd: number[] = [], gs: GrooveShape[] = [];
    let gw = Math.min(rv.w, rv.pitch - 2);
    if (rv.module && rv.grooves) {
      // модуль из пазов своей глубины и формы (№84), модулей — сколько помещается, по центру
      const n = Math.max(1, Math.floor((U - 6) / rv.module)), start = -(n * rv.module) / 2;
      for (let i = 0; i < n; i++) for (const [a, b, f, sh] of rv.grooves) { const g0 = start + i * rv.module + a, g1 = start + i * rv.module + b; if (g0 > -U / 2 + 1 && g1 < U / 2 - 1) { grooves.push([g0, g1]); gd.push(dmax * f); gs.push(sh); } }
    } else if (rv.band) {
      // полоса волн от левой (нижней) кромки (№111): волны вплотную, первая — от самой кромки
      for (let i = 0; i < rv.band.count; i++) { const g0 = -U / 2 + i * rv.pitch, g1 = g0 + rv.pitch; if (g1 > U / 2 - 3) break; grooves.push([g0, g1]); }
    } else {
      // шаг постоянный, число пазов — по габариту; крайние пазы не ближе 3 мм к кромке; выпуклые волны — вплотную друг к другу
      if (rv.shape === 'convex') gw = rv.pitch;
      const n = Math.max(1, Math.floor(U / rv.pitch)), start = -((n - 1) * rv.pitch) / 2;
      for (let i = 0; i < n; i++) { const c = start + i * rv.pitch; if (c - gw / 2 > -U / 2 + 3 && c + gw / 2 < U / 2 - 3) grooves.push([c - gw / 2, c + gw / 2]); }
    }
    L.rails = { dir: rv.dir === 'h' ? 'h' : 'v', grooves, depth: dmax, ch: rv.shape === 'trap' ? Math.min(dmax, gw / 4) : Math.min(1.5, gw / 4), ...(rv.shape ? { shape: rv.shape } : {}), ...(gd.length ? { gd, gs } : {}) };
    return L;
  }
  if (s.kind === 'relief' && s.relief?.dir === 'diamond') {
    const p = s.relief.pitch, a = p / 2 - s.relief.w / 2, m = 25, d = Math.min(s.relief.d, t / 3);
    const nx = Math.floor((w - 2 * m) / p), ny = Math.floor((h - 2 * m) / p);
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const cx = -((nx - 1) * p) / 2 + i * p, cy = -((ny - 1) * p) / 2 + j * p;
      root.kids!.push({ c: [[cx, cy - a], [cx + a, cy], [cx, cy + a], [cx - a, cy]], path: [[0, zf], [-Math.min(a * 0.6, d * 1.5), zf - d]] });
    }
    if (!nx || !ny) notes.push('Ромбы не помещаются в габарит — гладкое полотно');
    return L;
  }
  if (s.kind === 'smooth') return L;
  if (s.kind === 'handle') {
    // выборка по верхнему краю на всю ширину: высота не больше трети фасада, под выборкой остаётся не меньше 5 мм МДФ
    const hd = s.handle ?? { h: 25, d: 10, ch: 2 }, hh = Math.min(hd.h, h / 3), dd = Math.min(hd.d, t - 5), ch = Math.max(0.5, Math.min(hd.ch, hh / 3, dd / 3));
    if (hh < 8 || dd < 2) { notes.push('Выборка ручки не помещается в габарит — фасад гладкий'); return L; }
    const H2 = h / 2, T2 = t / 2;
    L.section = [[-H2, -T2], [H2, -T2], [H2, T2 - dd], [H2 - hh, T2 - dd], [H2 - hh, T2 - ch], [H2 - hh - ch, T2], [-H2, T2]];
    L.handle = { y0: H2 - hh, y1: H2, depth: dd };
    if (hh < hd.h - 1e-9) notes.push(`Выборка ручки уменьшена до ${Math.round(hh)} мм под высоту фасада`);
    return L;
  }
  const inset = s.inset ?? 50;
  if (s.kind === 'groove') {
    const g = s.groove ?? { w: 8, d: 3 }, x0 = -w / 2 + inset, y0 = -h / 2 + inset, x1 = w / 2 - inset, y1 = h / 2 - inset;
    if (x1 - x0 < GRILLE.minPanel || y1 - y0 < GRILLE.minPanel) { notes.push('Контур паза не помещается — фасад без рисунка'); return L; }
    const c1 = openingContour(x0, y0, x1, y1, s), field = bbox(offsetContour(c1, -g.w / 2)), kids: Feature[] = [];
    if ((s.top === 'arch' || s.top === 'shoulders') && x1 - x0 >= 80) field.y1 -=Math.min((s.archRise ?? 0.18) * (x1 - x0), (y1 - y0) * 0.35) + g.w;
    if (s.second && x1 - x0 > 2 * s.second + GRILLE.minPanel && y1 - y0 > 2 * s.second + GRILLE.minPanel) kids.push(grooveFeature(openingContour(x0 + s.second, y0 + s.second, x1 - s.second, y1 - s.second, s), zf, g));
    if (s.slots) kids.push(...slotKids(field, zf, s.slots));
    root.kids!.push(grooveFeature(c1, zf, g, kids));
    L.opening = { x0, y0, x1, y1 };
    return L;
  }
  // рамка с филёнкой
  const pr = s.profile ?? { w: 12, d: 5 }, F = inset, x0 = -w / 2 + F, y0 = -h / 2 + F, x1 = w / 2 - F, y1 = h / 2 - F;
  if (x1 - x0 < GRILLE.minPanel || y1 - y0 < GRILLE.minPanel) { notes.push(`Филёнка не помещается при рамке ${F} мм — фасад с наружным профилем, без рисунка`); return L; }
  const c1 = openingContour(x0, y0, x1, y1, s, pr.w + 3), pd = Math.min(pr.d, t - 8), zp = zf - pd;
  L.frame = F; L.opening = { x0, y0, x1, y1 };
  // профиль рамки: фаска 45° у лица, крутая выкружка, плавный выход на филёнку (условный, до тех. PDF)
  const path: P[] = pr.step ? [[1, zf], [0, zf - 1], [0, zp]] : [[pr.w, zf], [pr.w * 0.82, zf - pd * 0.2], [pr.w * 0.5, zf - pd * 0.62], [pr.w * 0.18, zf - pd * 0.92], [0, zp]];
  if (open !== 'solid') {
    path.push([0, -t / 2]);
    root.kids!.push({ c: c1, path, through: true });
    const gz0 = -t / 2 + 0.5, gz1 = gz0 + GRILLE.glassT;
    L.glass = { c: offsetContour(c1, -0.5), z0: gz0, z1: gz1 };
    if (open === 'grille') {
      const ow = x1 - x0, oh = y1 - y0, nv = Math.max(0, Math.round(ow / GRILLE.cell) - 1), nh = Math.max(0, Math.round(oh / GRILLE.cell) - 1), b = GRILLE.bar, bz0 = gz1, bz1 = zp - 1;
      for (let i = 1; i <= nv; i++) { const x = x0 + (ow * i) / (nv + 1); L.bars.push({ x0: x - b / 2, y0: y0 - 1, x1: x + b / 2, y1: y1 - (s.top && s.top !== 'rect' ? 0 : -1), z0: bz0, z1: bz1 }); }
      for (let j = 1; j <= nh; j++) { const y = y0 + (oh * j) / (nh + 1); L.bars.push({ x0: x0 - 1, y0: y - b / 2, x1: x1 + 1, y1: y + b / 2, z0: bz0, z1: bz1 }); }
      if (s.top && s.top !== 'rect') notes.push('Решётка под арку — планки до хорды арки (по тех. PDF уточнить)');
    }
    return L;
  }
  L.panelZ = zp;
  const kids: Feature[] = []; let fieldC = c1, fz = zp;
  if (s.raised) {
    const rw = Math.min(s.raised.w, (x1 - x0) / 2 - 10, (y1 - y0) / 2 - 10);
    if (rw > 3) { path.push([-rw, zp + Math.min(s.raised.h, pd - 0.5)]); fz = zp + Math.min(s.raised.h, pd - 0.5); fieldC = offsetContour(c1, -rw); L.panelZ = fz; }
  }
  const fb = bbox(fieldC);
  if ((s.top === 'arch' || s.top === 'shoulders') && x1 - x0 >= 80) fb.y1 -=Math.min((s.archRise ?? 0.18) * (x1 - x0), (y1 - y0) * 0.35);
  if (s.second) { const s2 = s.second; if (fb.x1 - fb.x0 > 2 * s2 + GRILLE.minPanel && fb.y1 - fb.y0 > 2 * s2 + GRILLE.minPanel) kids.push(grooveFeature(openingContour(fb.x0 + s2, fb.y0 + s2, fb.x1 - s2, fb.y1 - s2, s), fz, { w: 6, d: Math.min(2, pd) })); }
  if (s.slots) kids.push(...slotKids(fb, fz, { ...s.slots, d: Math.min(s.slots.d, fz + t / 2 - 6) }));
  root.kids!.push({ c: c1, path, kids });
  // площадка кидов отсчитывается от поля филёнки: путь кидов уже на высоте fz, крышка поля — offset(c1, last)
  return L;
}

/* ---------- раскладка по паспорту Вернисажа ---------- */
/** Путь паза от контура внутрь: round — пальчиковая фреза (полукруг), v — V-образный, иначе — плоское дно с фаской. */
function grooveDown(z: number, w: number, d: number, shape?: 'round' | 'v'): P[] {
  if (shape === 'round') return [[0, z], [-w * 0.12, z - d * 0.55], [-w * 0.3, z - d * 0.9], [-(w / 2 - 0.4), z - d]];
  if (shape === 'v') return [[0, z], [-(w / 2 - 0.3), z - d]];
  return [[0, z], [-Math.min(1.5, w / 4), z - d]];
}
/** Обратный путь: островок поднимается со дна паза к лицу (смещения наружу от контура островка, убывают к нулю). */
function grooveUp(down: P[]): P[] { return down.map(([o, z]) => [-o, z] as P).reverse(); }
/** Ряд пазов шагом pitch поперёк [x0, x1] (dir v) во всю длину [y0, y1] или наоборот (dir h); по центру поля. */
function slotRow(x0: number, y0: number, x1: number, y1: number, z: number, sp: { dir: 'v' | 'h'; pitch: number; w: number; d: number; shape?: 'round' | 'v' }): Feature[] {
  const out: Feature[] = [], path = grooveDown(z, sp.w, sp.d, sp.shape), v = sp.dir === 'v';
  const [a0, a1, b0, b1] = v ? [x0, x1, y0, y1] : [y0, y1, x0, x1];
  if (a1 - a0 < sp.w + 4 || b1 - b0 < sp.w * 2) return out;
  const n = Math.floor((a1 - a0 - sp.w) / sp.pitch) + 1, span = (n - 1) * sp.pitch, c = (a0 + a1) / 2;
  for (let i = 0; i < n; i++) { const m = c - span / 2 + i * sp.pitch; out.push({ c: v ? rectContour(m - sp.w / 2, b0, m + sp.w / 2, b1, sp.w / 2 - 0.3, 4) : rectContour(b0, m - sp.w / 2, b1, m + sp.w / 2, sp.w / 2 - 0.3, 4), path }); }
  return out;
}
/** Объединение прямоугольников (пазы-полосы с пересечениями): обход границы по сетке ячеек. Внешние контуры — CCW, дыры — CW. */
export function rectUnion(rs: { x0: number; y0: number; x1: number; y1: number }[]): P[][] {
  const xs = [...new Set(rs.flatMap((r) => [r.x0, r.x1]))].sort((a, b) => a - b), ys = [...new Set(rs.flatMap((r) => [r.y0, r.y1]))].sort((a, b) => a - b);
  const occ = (i: number, j: number) => i >= 0 && j >= 0 && i < xs.length - 1 && j < ys.length - 1 && rs.some((r) => { const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2; return cx > r.x0 && cx < r.x1 && cy > r.y0 && cy < r.y1; });
  const edges = new Map<string, [number, number][]>(), key = (i: number, j: number) => i + ',' + j;
  const addE = (a: [number, number], b: [number, number]) => { const k = key(...a); edges.set(k, [...(edges.get(k) ?? []), b]); };
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
    if (!occ(i, j)) continue;
    if (!occ(i, j - 1)) addE([i, j], [i + 1, j]);
    if (!occ(i + 1, j)) addE([i + 1, j], [i + 1, j + 1]);
    if (!occ(i, j + 1)) addE([i + 1, j + 1], [i, j + 1]);
    if (!occ(i - 1, j)) addE([i, j + 1], [i, j]);
  }
  const loops: P[][] = [];
  for (;;) {
    const start = [...edges.entries()].find(([, v]) => v.length);
    if (!start) break;
    const [si, sj] = start[0].split(',').map(Number), loop: [number, number][] = [[si, sj]];
    let cur: [number, number] = [si, sj];
    for (let guard = 0; guard < 100000; guard++) {
      const list = edges.get(key(...cur))!, next = list.shift()!;
      if (next[0] === si && next[1] === sj) break;
      loop.push(next); cur = next;
    }
    // убрать точки на прямой
    const pts = loop.map(([i, j]) => [xs[i], ys[j]] as P), n = pts.length;
    loops.push(pts.filter((p, k) => { const a = pts[(k - 1 + n) % n], b = pts[(k + 1) % n]; return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-9; }));
  }
  return loops;
}
function pointInPoly(p: P, c: P[]): boolean { let inside = false; for (let i = 0, j = c.length - 1; i < c.length; j = i++) { const [xi, yi] = c[i], [xj, yj] = c[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside; } return inside; }
/** Детерминированное «случайное» число 0..1 по индексам (разброс в доли мм против вырожденной триангуляции). */
function hash01(i: number, j: number): number { const s = Math.sin(i * 12.9898 + j * 78.233 + 0.5) * 43758.5453; return s - Math.floor(s); }
/** Без совпадающих (ближе 0,001 мм) и лежащих на одной прямой точек: такие точки дают нулевые треугольники в крышках. */
function simplifyPoly(c: P[]): P[] {
  let out = c.filter((p, i) => { const q = c[(i + 1) % c.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-3; });
  for (let pass = 0; pass < 3; pass++) {
    const n = out.length;
    out = out.filter((p, i) => { const a = out[(i - 1 + n) % n], b = out[(i + 1) % n], ux = p[0] - a[0], uy = p[1] - a[1], vx = b[0] - p[0], vy = b[1] - p[1]; return Math.abs(ux * vy - uy * vx) > 1e-6 * Math.hypot(ux, uy) * Math.hypot(vx, vy) + 1e-9; });
  }
  return out;
}
/** Отсечение выпуклого многоугольника прямоугольником (Сазерленд — Ходжмен). */
function clipRect(poly: P[], x0: number, y0: number, x1: number, y1: number): P[] {
  let out = poly;
  const edges: [(p: P) => number][] = [[(p) => p[0] - x0], [(p) => x1 - p[0]], [(p) => p[1] - y0], [(p) => y1 - p[1]]];
  for (const [f] of edges) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length], fa = f(a), fb = f(b);
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
    }
    if (out.length < 3) return [];
  }
  out = simplifyPoly(out);
  return out.length < 3 ? [] : out;
}
/** Прямые пазы (№6, 18, 88) в поле [x0, x1] × [y0, y1] на уровне z: полосы объединяются (пересечения — одним пазом, клетки между
 *  ними — островки на уровне лица); диагонали — отдельные пазы, отсечённые полем. */
function lineFeatures(F: { x0: number; y0: number; x1: number; y1: number }, E: { x0: number; y0: number; x1: number; y1: number }, z: number, ln: NonNullable<MillShape['lines']>): Feature[] {
  const w = ln.w, down = grooveDown(z, w, ln.d, 'round'), out: Feature[] = [];
  if (ln.diag) {
    const a = (ln.diag.angle * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx, L = Math.hypot(F.x1 - F.x0, F.y1 - F.y0);
    const cx = (F.x0 + F.x1) / 2, cy = (F.y0 + F.y1) / 2, n = Math.ceil(L / ln.diag.pitch);
    // паз — след фрезы: ось отсекается полем (с запасом на полуширину), концы — полукругом радиуса фрезы (у кромки паз
    // заканчивается в поле, а не уходит за кромку — упрощение; плоские срезы у края дают в крышке лица вырожденную триангуляцию)
    const hw = w / 2;
    for (let i = -n; i <= n; i++) {
      // концы — с разбросом в доли мм: крайние точки дыр на одной прямой ломают earcut
      const j = 0.5 + 0.4 * hash01(i, 3), X0 = F.x0 + hw + j, Y0 = F.y0 + hw + j, X1 = F.x1 - hw - j, Y1 = F.y1 - hw - j;
      const o = i * ln.diag.pitch, px = cx + nx * o, py = cy + ny * o;
      // Лиан — Барски: отрезок оси [-L, L] внутри прямоугольника
      let t0 = -L, t1 = L;
      for (const [p, q] of [[-dx, px - X0], [dx, X1 - px], [-dy, py - Y0], [dy, Y1 - py]] as [number, number][]) {
        if (Math.abs(p) < 1e-12) { if (q < 0) { t0 = 1; t1 = 0; } continue; }
        const r = q / p; if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
      }
      if (t1 - t0 < w * 2) continue;
      const ax = px + dx * t0, ay = py + dy * t0, bx = px + dx * t1, by = py + dy * t1, base = Math.atan2(dy, dx), c: P[] = [], seg = 6;
      for (let k = 0; k <= seg; k++) { const a = base - Math.PI / 2 + (Math.PI * k) / seg; c.push([bx + hw * Math.cos(a), by + hw * Math.sin(a)]); }
      for (let k = 0; k <= seg; k++) { const a = base + Math.PI / 2 + (Math.PI * k) / seg; c.push([ax + hw * Math.cos(a), ay + hw * Math.sin(a)]); }
      out.push({ c, path: down });
    }
    return out;
  }
  // отступы пазов — от кромок фасада E, полосы — в пределах поля F
  const rs: { x0: number; y0: number; x1: number; y1: number }[] = [], hw = w / 2;
  const vx = (ln.v ?? []).flatMap((g) => g.at.map((a) => (g.from === 'left' ? E.x0 + a : E.x1 - a))).filter((x) => x - hw > F.x0 && x + hw < F.x1);
  for (const x of vx) rs.push({ x0: x - hw, y0: F.y0, x1: x + hw, y1: F.y1 });
  for (const g of ln.h ?? []) for (const a of g.at) {
    const y = g.from === 'bottom' ? E.y0 + a : E.y1 - a;
    if (y - hw <= F.y0 || y + hw >= F.y1) continue;
    // between: горизонталь только между крайними вертикалями (№6 «шейкер»)
    const x0 = g.between && vx.length ? Math.min(...vx) : F.x0, x1 = g.between && vx.length ? Math.max(...vx) : F.x1;
    rs.push({ x0, y0: y - hw, x1, y1: y + hw });
  }
  if (!rs.length) return out;
  const loops = rectUnion(rs), outer = loops.filter((c) => signedArea(c) > 0), holes = loops.filter((c) => signedArea(c) < 0);
  // островки: стенка у каждого чуть круче (сотые доли мм) — их контуры на дне не на одной прямой с соседними (иначе earcut теряет треугольники)
  for (const c of outer) out.push({ c, path: down, kids: holes.filter((hh) => pointInPoly(hh[0], c)).map((hh, i) => ({ c: [...hh].reverse(), path: grooveUp(down).map(([o, z]) => [o * (1 - 0.011 * ((i % 7) + 1)), z] as P) })) });
  return out;
}
/** Полоса-арка полукругом, открытая книзу (№98–100): внешняя дуга в outer от кромок поля, полоса шириной width; у низкого фасада дуга
 *  садится на низ поля (радиус по высоте). Возвращает контур полосы (CCW) и прямоугольник поля внутри арки (под пазы №100). */
function archBandContour(F: { x0: number; y0: number; x1: number; y1: number }, outer: number, width: number, seg = 24): { c: P[]; inner: { x0: number; y0: number; x1: number; y1: number } | null } | null {
  const xo0 = F.x0 + outer, xo1 = F.x1 - outer, yo = F.y1 - outer, yb = F.y0;
  let Ro = (xo1 - xo0) / 2;
  if (Ro < 20 || yo - yb < 20) return null;
  Ro = Math.min(Ro, yo - yb);
  const cx = (F.x0 + F.x1) / 2, cy = yo - Ro, Ri = Ro - width, c: P[] = [];
  const arc = (R: number, a0: number, a1: number) => { for (let k = 0; k <= seg; k++) { const a = a0 + ((a1 - a0) * k) / seg; c.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); } };
  if (Ri < 8) {
    // узкая арка: полоса — весь полукруг (полудиск с ножками)
    c.push([cx - Ro, yb], [cx + Ro, yb]); if (cy > yb + 0.5) c.push([cx + Ro, cy]); arc(Ro, 0, Math.PI); c.pop(); c.push([cx - Ro, cy]);
    return { c: c.filter((p, i) => i === 0 || Math.hypot(p[0] - c[i - 1][0], p[1] - c[i - 1][1]) > 1e-6), inner: null };
  }
  c.push([cx - Ro, yb], [cx - Ri, yb]);
  if (cy > yb + 0.5) c.push([cx - Ri, cy]);
  arc(Ri, Math.PI, 0); c.pop(); c.push([cx + Ri, cy]);
  if (cy > yb + 0.5) c.push([cx + Ri, yb]);
  c.push([cx + Ro, yb]);
  if (cy > yb + 0.5) c.push([cx + Ro, cy]);
  arc(Ro, 0, Math.PI); c.pop(); c.push([cx - Ro, cy]);
  const uniq = c.filter((p, i) => { const q = c[(i + 1) % c.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6; });
  return { c: uniq, inner: cy - yb > 30 ? { x0: cx - Ri, y0: yb, x1: cx + Ri, y1: cy } : null };
}
function depthOn(pts: P[], x: number): number {
  if (!pts.length || x <= pts[0][0]) return pts[0]?.[1] ?? 0;
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, d0] = pts[i - 1], [x1, d1] = pts[i]; return x1 - x0 < 1e-9 ? d1 : d0 + ((d1 - d0) * (x - x0)) / (x1 - x0); }
  return pts[pts.length - 1][1];
}
/** Раскладка по паспорту: сечение лица profile.pts (мм от кромки, глубина) протягивается вдоль контура со стыками «на ус»; контур —
 *  прямоугольник, арки сверху/снизу или вогнутые углы в pts[0][0] от кромки. Мелкий фасад (ящик): все отступы рисунка уменьшаются в k раз,
 *  пока филёнка не меньше GRILLE.minPanel; при k < 0,35 — фасад гладкий с пометкой. Глубина — не глубже t − 6 мм.
 *  Витрина/решётка: сквозной проём в glass.frame от кромки с радиусом угла glass.r, профиль до проёма сохраняется. */
function layoutProfile(L: FacadeLayout, s: MillShape, open: Opening, r: number): FacadeLayout {
  const { w, h, t } = L, zf = t / 2, notes = L.notes, root = L.root, maxD = Math.max(0.5, t - 6);
  const raw = s.face?.pts ?? [], edge = !!s.face?.edge && raw.length > 0;
  const xEnd = raw.length ? raw[raw.length - 1][0] : 0, bandH = s.bottomBand ?? 0;
  const glassAt = open !== 'solid' && s.glass ? s.glass.frame : 0;
  const need = Math.max(2 * xEnd, 2 * glassAt) + GRILLE.minPanel, avail = Math.min(w, h - bandH);
  let k = 1;
  if ((raw.length || glassAt) && avail < need) {
    k = (avail - GRILLE.minPanel) / (need - GRILLE.minPanel);
    if (k < 0.35) { notes.push('Рисунок не помещается в габарит — фасад без фрезеровки'); return L; }
    notes.push(`Рисунок уменьшен под габарит: отступы × ${k.toFixed(2)}`);
  }
  if (raw.some(([, d]) => d > maxD + 1e-9)) notes.push(`Глубина ограничена ${Math.round(maxD * 10) / 10} мм: под фрезеровкой не меньше 6 мм МДФ`);
  const pts: P[] = raw.map(([x, d]) => [x * k, Math.min(d, maxD)]), bb = bandH * k;
  let host: Feature = root, x0 = 0, zp = zf, c0: P[] | null = null, used: MillShape = s;
  if (edge) {
    // сечение от кромки: кант/скос у кромки ниже поля — продолжение пути кромки
    const z0 = zf - pts[0][1], rr = Math.max(0, Math.min(r, (z0 + t / 2) / 3)), path: P[] = [[0, -t / 2], [0, z0 - rr]], rs = rr > 3 ? 6 : 3;
    if (rr > 0.05) for (let q = 1; q <= rs; q++) { const a = (q / rs) * Math.PI / 2; path.push([-rr + rr * Math.cos(a), z0 - rr + rr * Math.sin(a)]); }
    for (const [x, d] of pts) if (x > rr + 1e-6) path.push([-x, zf - d]);
    root.path = path; zp = zf - pts[pts.length - 1][1]; x0 = 0;
  } else if (pts.length) {
    x0 = pts[0][0];
    const X0 = -w / 2 + x0, X1 = w / 2 - x0, Y0 = -h / 2 + x0 + bb, Y1 = h / 2 - x0, depth = xEnd * k - x0;
    let shape: MillShape = s;
    // вогнутые углы (№59): дуги растут внутрь на ширину профиля — если на филёнке не помещаются, углы прямые
    // смещение вогнутой дуги внутрь честное до 2,41·r (дальше концы дуги меняются местами) — радиус не меньше depth / 2,4 + 1
    if (s.cornerKind === 'concave' && s.cornerR) {
      const rc = Math.max(s.cornerR, depth / 2.4 + 1), q = Math.sqrt(rc ** 2 + 2 * rc * depth);
      if (rc > 0.1 * Math.min(X1 - X0, Y1 - Y0) || Math.min(X1 - X0, Y1 - Y0) - 2 * depth < 2 * q + 10) { shape = { ...s, cornerKind: undefined, cornerR: 0 }; notes.push('Вогнутые углы не помещаются — углы прямые'); }
      else shape = { ...s, cornerR: rc };
    }
    // арки (дуги, плечики): контур должен честно смещаться внутрь на всю ширину профиля (до филёнки или проёма витрины); у низкого
    // фасада (ящик) дуги сходятся — тогда контур прямоугольный (у ящиков в паспортах рисунок тоже упрощён)
    const arched = (s.top && s.top !== 'rect') || (s.bottom && s.bottom !== 'rect');
    if (arched) {
      const deep = Math.max(depth, open !== 'solid' ? glassAt * k - x0 : 0), [rT, rB] = archRises(X1 - X0, Y1 - Y0, s);
      const test = bbox(offsetContour(openingContour(X0, Y0, X1, Y1, s, 0), -deep)), wantW = X1 - X0 - 2 * deep, wantH = Y1 - Y0 - 2 * deep;
      if (Math.abs(test.x1 - test.x0 - wantW) > 0.5 || Math.abs(test.y1 - test.y0 - wantH) > 0.5 || wantH - rT - rB < 20 || wantW < 2 * (s.shoulder ?? 18) + 40) { shape = { ...shape, top: 'rect', bottom: 'rect' }; notes.push('Арка не помещается под профиль — контур прямоугольный'); }
    }
    if (open !== 'solid' && shape.cornerKind === 'concave' && shape.cornerR) { const dg = glassAt * k - x0, q = Math.sqrt(shape.cornerR ** 2 + 2 * shape.cornerR * Math.max(0, dg)); if (dg > 2.4 * shape.cornerR || Math.min(X1 - X0, Y1 - Y0) - 2 * dg < 2 * q + 10) shape = { ...shape, cornerKind: undefined, cornerR: 0 }; }
    c0 = open !== 'solid' && glassAt * k > x0 + 0.5 ? openingContour(X0, Y0, X1, Y1, { ...shape, cornerR: shape.cornerKind === 'concave' ? shape.cornerR : (s.glass?.r ?? 0) + glassAt * k - x0 }, 0) : openingContour(X0, Y0, X1, Y1, shape, 0);
    zp = zf - pts[pts.length - 1][1];
    L.frame = x0; used = shape;
  }
  // витрина / решётка: сквозной проём в glassAt от кромки
  if (open !== 'solid') {
    const g = Math.max(glassAt * k, edge || !pts.length ? (pts.length ? xEnd * k + 1 : r + 8) : 0), zg = zf - depthOn(pts, g), R = s.glass?.r ?? 0;
    let cut: P[];
    if (c0 && g > x0 + 0.5) {
      // проём внутри профиля: путь профиля до проёма, дальше — вертикальный срез насквозь
      const path: P[] = pts.filter(([x]) => x < g - 1e-6).map(([x, d]) => [-(x - x0), zf - d]);
      path.push([-(g - x0), zg], [-(g - x0), -t / 2]);
      root.kids!.push({ c: c0, path, through: true });
      cut = offsetContour(c0, -(g - x0));
    } else {
      // проём ближе к кромке, чем профиль (профиль уходит в проём), без профиля (№15) или за сечением от кромки (W5, №113): срез с уровня поля
      cut = openingContour(-w / 2 + g, -h / 2 + g, w / 2 - g, h / 2 - g, { ...s, cornerKind: undefined, cornerR: R }, 0);
      root.kids!.push({ c: cut, path: [[0, edge ? zp : zf], [0, -t / 2]], through: true });
    }
    const gz0 = -t / 2 + 0.5, gz1 = gz0 + GRILLE.glassT, ob = bbox(cut);
    L.glass = { c: offsetContour(cut, -0.5), z0: gz0, z1: gz1 };
    L.opening = ob;
    if (open === 'grille') {
      const ow = ob.x1 - ob.x0, oh = ob.y1 - ob.y0, nv = Math.max(0, Math.round(ow / GRILLE.cell) - 1), nh = Math.max(0, Math.round(oh / GRILLE.cell) - 1), b = GRILLE.bar, bz1 = Math.min(zg, zf) - 1;
      for (let i = 1; i <= nv; i++) { const x = ob.x0 + (ow * i) / (nv + 1); L.bars.push({ x0: x - b / 2, y0: ob.y0 - 1, x1: x + b / 2, y1: ob.y1 + 1, z0: gz1, z1: bz1 }); }
      for (let j = 1; j <= nh; j++) { const y = ob.y0 + (oh * j) / (nh + 1); L.bars.push({ x0: ob.x0 - 1, y0: y - b / 2, x1: ob.x1 + 1, y1: y + b / 2, z0: gz1, z1: bz1 }); }
      if (s.top && s.top !== 'rect') notes.push('Решётка под арку — планки до хорды арки');
    }
    return L;
  }
  if (c0) { const f: Feature = { c: c0, path: pts.map(([x, d]) => [-(x - x0), zf - d] as P), kids: [] }; root.kids!.push(f); host = f; }
  L.panelZ = zp;
  // поле под декор: филёнка (внутри профиля) или лицо (без профиля) с отступом от кромки
  const m = r + 2, inner = c0 ? bbox(offsetContour(c0, -(xEnd * k - x0))) : edge ? { x0: -w / 2 + xEnd * k, y0: -h / 2 + xEnd * k, x1: w / 2 - xEnd * k, y1: h / 2 - xEnd * k } : { x0: -w / 2 + m, y0: -h / 2 + m, x1: w / 2 - m, y1: h / 2 - m };
  L.opening = c0 || edge ? inner : null;
  const [riseT, riseB] = c0 ? archRises(w - 2 * x0, h - 2 * x0 - bb, used) : [0, 0];
  const field = { x0: inner.x0 + 1.5, y0: inner.y0 + 1.5 + riseB, x1: inner.x1 - 1.5, y1: inner.y1 - 1.5 - riseT };
  const kids = host.kids!;
  if (s.lines) kids.push(...lineFeatures(field, { x0: -w / 2, y0: -h / 2, x1: w / 2, y1: h / 2 }, zp, s.lines));
  let archInner: { x0: number; y0: number; x1: number; y1: number } | null = null;
  if (s.archBand) {
    // внешняя дуга — в outer от кромок фасада, не за полем; полоса открыта книзу (низ — край поля)
    const ab = s.archBand, o = ab.outer * k, F = { x0: Math.max(-w / 2 + o, field.x0 + 1), y0: field.y0 + 1, x1: Math.min(w / 2 - o, field.x1 - 1), y1: Math.min(h / 2 - o, field.y1 - 1) };
    const band = archBandContour(F, 0, ab.width * k);
    if (band) { kids.push({ c: band.c, path: ab.width * k < 12 ? grooveDown(zp, ab.width * k, ab.d, 'round') : [[0, zp], [-Math.min(1.5, ab.d), zp - ab.d]] }); archInner = band.inner; }
    else notes.push('Арка не помещается — без арки');
  }
  if (s.slots) {
    const sp = s.slots;
    // полоса пазов у низа фасада (№112) — на лице под контуром, не в филёнке
    if (sp.zone === 'band') { if (bb > sp.w * 2) root.kids!.push(...slotRow(-w / 2 + m + 2, -h / 2 + m, w / 2 - m - 2, -h / 2 + bb - 2, zf, sp)); }
    else if (sp.inArch) { if (archInner) kids.push(...slotRow(archInner.x0 + 4, archInner.y0 + 2, archInner.x1 - 4, archInner.y1 - 2, zp, sp)); }
    else { const mg = 10; kids.push(...slotRow(field.x0 + mg, field.y0 + mg, field.x1 - mg, field.y1 - mg, zp, sp)); }
  }
  return L;
}
/** Сетка V-пазов ромбом (№109, 110): поле — карман глубиной d в 4 мм от кромки, ромбы-площадки поднимаются со дна к лицу стенками
 *  фрезы V (угол vAngle); на дне между соседними ромбами — 0,6 мм; ромбы у края поля отсечены. */
function layoutLattice(L: FacadeLayout, lt: NonNullable<MillShape['lattice']>, r: number): FacadeLayout {
  const { w, h, t } = L, zf = t / 2, d = Math.min(lt.d, t / 3), ch = d * Math.tan((lt.vAngle * Math.PI) / 360), gap = 0.8, e = Math.max(4, r + 2);
  const fx0 = -w / 2 + e, fy0 = -h / 2 + e, fx1 = w / 2 - e, fy1 = h / 2 - e;
  if (fx1 - fx0 < 3 * ch + 10 || fy1 - fy0 < 3 * ch + 10) { L.notes.push('Сетка ромбов не помещается — гладкое полотно'); return L; }
  const A = lt.cellW / 2, B = lt.cellH / 2, nrm = Math.hypot(A, B) / (A * B);
  // площадка на дне: ромб, уменьшенный на половину зазора; верх — ещё на ширину стенки фрезы
  const kb = 1 - (gap / 2) * nrm, fz = zf - d, kids: Feature[] = [];
  let seq = 0;
  // отсечённые ромбы — в 1,5 мм от стенки кармана (полоса дна у края поля; уже — триангуляция дна вырождается)
  const floor = { x0: fx0 + ch + 1.5, y0: fy0 + ch + 1.5, x1: fx1 - ch - 1.5, y1: fy1 - ch - 1.5 };
  for (let i = -Math.ceil(w / lt.cellW) - 1; i <= Math.ceil(w / lt.cellW) + 1; i++) for (let j = -Math.ceil(h / lt.cellH) - 1; j <= Math.ceil(h / lt.cellH) + 1; j++) for (const [ox, oy] of [[0, 0], [A, B]]) {
    // сотые доли мм вразнобой: у ромбов в одном ряду/столбце вершины на одной прямой — триангуляция дна (earcut) с такими дырами
    // теряет треугольники; сдвиг на глаз не виден
    const cx = i * lt.cellW + ox + (hash01(i, j + (ox ? 1000 : 0)) - 0.5) * 0.12, cy = j * lt.cellH + oy + (hash01(i + 500, j + (ox ? 1000 : 0)) - 0.5) * 0.12;
    const dm: P[] = [[cx, cy - B * kb], [cx + A * kb, cy], [cx, cy + B * kb], [cx - A * kb, cy]];
    // отсечка у края поля — тоже с разбросом в сотые доли мм (срезы соседних ромбов не на одной прямой)
    const ej = 0.01 + hash01(i + 77, j + (ox ? 2000 : 0)) * 0.45; seq++;
    const fl = clipRect(dm, floor.x0 + ej, floor.y0 + ej, floor.x1 - ej, floor.y1 - ej);
    if (fl.length < 3 || Math.abs(signedArea(fl)) < 30) continue;
    // площадка у края поля слишком мала — без неё (дно кармана); стенка фрезы — от дна (fl) вверх к лицу
    const top = offsetContour(fl, -ch), bt = bbox(top);
    if (Math.abs(signedArea(top)) < 8 || bt.x1 - bt.x0 < 2 || bt.y1 - bt.y0 < 2) continue;
    kids.push({ c: fl, path: [[0, fz], [-ch, zf]] });
  }
  L.root.kids!.push({ c: rectContour(fx0, fy0, fx1, fy1), path: [[0, zf], [-ch, fz]], kids });
  return L;
}

/** Превью рисунка для панели выбора — наша схема по той же раскладке (не фото производителя). */
export function previewSvg(L: FacadeLayout, px = 120): string {
  const k = px / Math.max(L.w, L.h), W = L.w * k, H = L.h * k;
  const pt = ([x, y]: P) => `${((x + L.w / 2) * k).toFixed(1)},${((L.h / 2 - y) * k).toFixed(1)}`;
  const poly = (c: P[], cls: string) => `<polygon class="${cls}" points="${c.map(pt).join(' ')}"/>`;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${(W + 4).toFixed(1)} ${(H + 4).toFixed(1)}" width="${(W + 4).toFixed(0)}" height="${(H + 4).toFixed(0)}">`;
  s += `<style>.o{fill:#eeeae2;stroke:#6b665c;stroke-width:1}.g{fill:none;stroke:#8a8478;stroke-width:.8}.p{fill:#e2ddd2;stroke:#8a8478;stroke-width:.7}.gl{fill:#cfe0e6;stroke:#6b8a94;stroke-width:.7}.b{fill:#e2ddd2;stroke:#8a8478;stroke-width:.5}.r{fill:#d8d2c6;stroke:none}</style>`;
  s += poly(L.root.c, 'o');
  if (L.rails) for (const [a, b] of L.rails.grooves) { const r: [P, P, P, P] = L.rails.dir === 'v' ? [[a, -L.h / 2], [b, -L.h / 2], [b, L.h / 2], [a, L.h / 2]] : [[-L.w / 2, a], [L.w / 2, a], [L.w / 2, b], [-L.w / 2, b]]; s += poly(r, 'r'); }
  if (L.handle) s += poly([[-L.w / 2, L.handle.y0], [L.w / 2, L.handle.y0], [L.w / 2, L.handle.y1], [-L.w / 2, L.handle.y1]], 'r');
  const walk = (f: Feature) => {
    for (const kd of f.kids ?? []) {
      const outer = offsetContour(kd.c, kd.path[0][0]), inner = offsetContour(kd.c, kd.path[kd.path.length - 1][0]);
      if (kd.through) { s += poly(outer, 'p'); s += poly(inner, 'gl'); }
      else { s += poly(outer, 'g'); s += poly(inner, kd.path[kd.path.length - 1][1] < kd.path[0][1] - 0.01 ? 'p' : 'g'); }
      walk(kd);
    }
  };
  walk(L.root);
  for (const b of L.bars) s += poly([[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]], 'b');
  return s + '</svg>';
}
