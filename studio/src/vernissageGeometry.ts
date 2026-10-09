import * as THREE from 'three';

/** Геометрия фасада МДФ с фрезеровкой (Вернисаж): строится заново под каждый габарит, без масштабирования.
 *  Фасад в плоскости XY, толщина по Z, лицевая сторона +Z, центр в нуле — как у детали Part размера [w, h, t].
 *  Описание рисунка — дерево контуров: у каждого контура свой профиль (путь в координатах «смещение от контура, высота z»),
 *  профиль протягивается вдоль контура (смещённые копии контура со стыками «на ус»), площадки между контурами — плоские крышки.
 *  Так рамка сохраняет ширину, филёнка растягивается, фаски/пазы идут по контуру, а углы не плывут. */
export type P = [number, number];
/** Путь профиля: точки [смещение, z] от внешней стороны контура к внутренней (смещение убывает), материал — ниже пути. */
export type Feature = { c: P[]; path: P[]; kids?: Feature[]; through?: boolean };
export type Rails = { dir: 'v' | 'h'; grooves: [number, number][]; depth: number; ch: number };
export type FacadeLayout = {
  w: number; h: number; t: number;
  root: Feature;
  rails?: Rails;
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
export function rectContour(x0: number, y0: number, x1: number, y1: number, r = 0, seg = 6): P[] {
  r = Math.max(0, Math.min(r, (x1 - x0) / 2 - 0.01, (y1 - y0) / 2 - 0.01));
  if (r < 0.05) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const out: P[] = [];
  const corner = (cx: number, cy: number, a0: number) => { for (let k = 0; k <= seg; k++) { const a = a0 + (k / seg) * Math.PI / 2; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  corner(x1 - r, y0 + r, -Math.PI / 2); corner(x1 - r, y1 - r, 0); corner(x0 + r, y1 - r, Math.PI / 2); corner(x0 + r, y0 + r, Math.PI);
  return out;
}
/** Проём с аркой по верху: rise — подъём арки, shoulder — «плечики» (горизонтальные полочки у начала арки). CCW. */
export function archContour(x0: number, y0: number, x1: number, y1: number, rise: number, shoulder = 0, seg = 28): P[] {
  rise = Math.max(0, Math.min(rise, (y1 - y0) * 0.6));
  if (rise < 1) return rectContour(x0, y0, x1, y1);
  const s = Math.max(0, Math.min(shoulder, (x1 - x0) / 4)), xa = x0 + s, xb = x1 - s, yb = y1 - rise, c = (xb - xa) / 2, xm = (xa + xb) / 2;
  const R = (c * c + rise * rise) / (2 * rise), cy = y1 - R, a1 = Math.atan2(yb - cy, xb - xm), a2 = Math.atan2(yb - cy, xa - xm);
  const out: P[] = [[x0, y0], [x1, y0], [x1, yb]];
  if (s > 0.5) out.push([xb, yb]);
  for (let k = 1; k < seg; k++) { const a = a1 + (a2 - a1) * (k / seg); out.push([xm + R * Math.cos(a), cy + R * Math.sin(a)]); }
  if (s > 0.5) out.push([xa, yb]);
  out.push([x0, yb]);
  return out;
}
export function signedArea(c: P[]): number { let a = 0; for (let i = 0; i < c.length; i++) { const [x0, y0] = c[i], [x1, y1] = c[(i + 1) % c.length]; a += x0 * y1 - x1 * y0; } return a / 2; }
/** Смещение замкнутого контура (CCW): o > 0 — наружу, o < 0 — внутрь; углы — на ус (как у профиля рамки). */
export function offsetContour(c: P[], o: number): P[] {
  if (Math.abs(o) < 1e-9) return c.map(p => [p[0], p[1]] as P);
  const n = c.length, out: P[] = [];
  const nrm = (a: P, b: P): P => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dy / l, -dx / l]; };
  for (let i = 0; i < n; i++) {
    const p = c[i], n1 = nrm(c[(i - 1 + n) % n], p), n2 = nrm(p, c[(i + 1) % n]), k = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    if (k < 1e-6) { out.push([p[0] + o * n1[0], p[1] + o * n1[1]]); continue; }
    out.push([p[0] + o * (n1[0] + n2[0]) / k, p[1] + o * (n1[1] + n2[1]) / k]);
  }
  return out;
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
    const o = outer.map(([x, y]) => new THREE.Vector2(x, y)), hs = holes.map(h => h.map(([x, y]) => new THREE.Vector2(x, y)));
    const faces = THREE.ShapeUtils.triangulateShape(o, hs), all = [...o, ...hs.flat()], w: V3 = [0, 0, up ? 1 : -1];
    for (const [i, j, k] of faces) this.tri([all[i].x, all[i].y, z], [all[j].x, all[j].y, z], [all[k].x, all[k].y, z], w);
  }
  /** Протяжка профиля между двумя точками пути вдоль контура (CCW). */
  sweep(c: P[], a: P, b: P) {
    const A = offsetContour(c, a[0]), B = offsetContour(c, b[0]), to = b[0] - a[0], tz = b[1] - a[1], n = c.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, dx = c[j][0] - c[i][0], dy = c[j][1] - c[i][1], l = Math.hypot(dx, dy) || 1;
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
  // сечение: CCW в координатах (u, z)
  const sec: P[] = [[-U / 2, -t / 2], [U / 2, -t / 2], [U / 2, zf]];
  const gs = [...r.grooves].sort((a, b) => b[0] - a[0]);
  for (const [g0, g1] of gs) { const ch = Math.min(r.ch, (g1 - g0) / 2 - 0.2); sec.push([g1, zf], [g1 - ch, zf - r.depth], [g0 + ch, zf - r.depth], [g0, zf]); }
  sec.push([-U / 2, zf]);
  const s0 = -S / 2, s1 = S / 2;
  for (let i = 0; i < sec.length; i++) {
    const a = sec[i], b = sec[(i + 1) % sec.length], du = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(du, dz); if (l < 1e-9) continue;
    mb.quad(map(a[0], s0, a[1]), map(b[0], s0, b[1]), map(b[0], s1, b[1]), map(a[0], s1, a[1]), wantMap(dz / l, -du / l));
  }
  const tri = THREE.ShapeUtils.triangulateShape(sec.map(([u, z]) => new THREE.Vector2(u, z)), []);
  for (const s of [s0, s1]) for (const [i, j, k] of tri) mb.tri(map(sec[i][0], s, sec[i][1]), map(sec[j][0], s, sec[j][1]), map(sec[k][0], s, sec[k][1]), wantMap(0, 0, s > 0 ? 1 : -1));
}

/** Сетка фасада по раскладке. grainAxis детали: 1 — плёнка/текстура вдоль высоты (как boardGeometry), 0 — вдоль ширины.
 *  UV пластей и профиля — проекция на плоскость фасада по габариту, поэтому плёнка не плывёт при смене размера. */
export function facadeGeometry(L: FacadeLayout, grainAxis: 0 | 1 | 2 = 1): THREE.BufferGeometry {
  const mb = new MeshBuilder(), { w, h, t } = L;
  mb.material(0);
  if (L.rails) emitRails(mb, L);
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
  for (let i = 0; i < mb.pos.length / 3; i++) {
    const x = mb.pos[i * 3] / w + 0.5, y = mb.pos[i * 3 + 1] / h + 0.5;
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
  kind: 'smooth' | 'groove' | 'frame' | 'relief';
  /** Радиус скругления наружной кромки. */
  edgeR: number;
  /** groove: отступ оси паза от кромки; frame: ширина рамки (от кромки до филёнки). */
  inset?: number;
  top?: 'rect' | 'arch' | 'shoulders';
  /** Радиус углов контура паза/проёма. */
  cornerR?: number;
  groove?: { w: number; d: number };
  /** Профиль рамки к филёнке: ширина и глубина филёнки от лица; step — прямой уступ «шейкер». */
  profile?: { w: number; d: number; step?: boolean };
  /** Выпуклая филёнка: ширина скоса и подъём площадки над дном. */
  raised?: { w: number; h: number };
  /** Второй контур (паз) внутри филёнки или поля — отступ от первого контура. */
  second?: number;
  /** Пазы внутри филёнки/поля: направление, шаг, ширина, зона. */
  slots?: { dir: 'v' | 'h'; pitch: number; w: number; d: number; zone: 'all' | 'bottom' | 'ends' | 'side' };
  /** Рельеф по всему полотну. */
  relief?: { dir: 'v' | 'h' | 'diamond'; pitch: number; w: number; d: number };
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
function openingContour(x0: number, y0: number, x1: number, y1: number, s: MillShape): P[] {
  const W = x1 - x0, H = y1 - y0;
  // узкий проём (бутылочница, ящик): арка вырождается в мелкие сегменты — рисуем прямоугольный контур (правило студии, уточнить по тех. PDF)
  if ((s.top === 'arch' || s.top === 'shoulders') && W >= 80) {
    const rise = Math.min((s.archRise ?? 0.18) * W, H * 0.35), sh = s.top === 'shoulders' ? (s.shoulder ?? 18) : 0;
    const seg = Math.max(8, Math.min(28, Math.round((W - 2 * sh) / 8)));
    return archContour(x0, y0, x1, y1, rise, sh, seg);
  }
  return rectContour(x0, y0, x1, y1, s.cornerR ?? 0);
}

/** Раскладка рисунка под габарит w×h×t. Рамка постоянной ширины; если филёнка не помещается (меньше GRILLE.minPanel),
 *  фасад остаётся с наружным профилем и без рисунка — с пометкой в notes. */
export function layoutFacade(w: number, h: number, t: number, s: MillShape, open: Opening = 'solid'): FacadeLayout {
  const zf = t / 2, r = Math.max(0, Math.min(s.edgeR, t / 3, w / 4, h / 4)), notes: string[] = [];
  const edgePath: P[] = [[0, -t / 2], [0, zf - r]];
  if (r > 0.05) for (let k = 1; k <= 4; k++) { const a = (k / 4) * Math.PI / 2; edgePath.push([-r + r * Math.cos(a), zf - r + r * Math.sin(a)]); }
  const root: Feature = { c: rectContour(-w / 2, -h / 2, w / 2, h / 2), path: edgePath, kids: [] };
  const L: FacadeLayout = { w, h, t, root, bars: [], frame: null, opening: null, panelZ: null, notes };
  if (s.kind === 'relief' && s.relief && s.relief.dir !== 'diamond') {
    const rv = s.relief, U = rv.dir === 'v' ? w : h, n = Math.max(1, Math.floor(U / rv.pitch)), start = -((n - 1) * rv.pitch) / 2, gw = Math.min(rv.w, rv.pitch - 2);
    // шаг постоянный, число пазов — по габариту; крайние пазы не ближе половины шага к кромке
    const grooves: [number, number][] = [];
    for (let i = 0; i < n; i++) { const c = start + i * rv.pitch; if (c - gw / 2 > -U / 2 + 3 && c + gw / 2 < U / 2 - 3) grooves.push([c - gw / 2, c + gw / 2]); }
    L.rails = { dir: rv.dir === 'h' ? 'h' : 'v', grooves, depth: Math.min(rv.d, t / 3), ch: Math.min(1.5, gw / 4) };
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
  const c1 = openingContour(x0, y0, x1, y1, s), pd = Math.min(pr.d, t - 8), zp = zf - pd;
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

/** Превью рисунка для панели выбора — наша схема по той же раскладке (не фото производителя). */
export function previewSvg(L: FacadeLayout, px = 120): string {
  const k = px / Math.max(L.w, L.h), W = L.w * k, H = L.h * k;
  const pt = ([x, y]: P) => `${((x + L.w / 2) * k).toFixed(1)},${((L.h / 2 - y) * k).toFixed(1)}`;
  const poly = (c: P[], cls: string) => `<polygon class="${cls}" points="${c.map(pt).join(' ')}"/>`;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${(W + 4).toFixed(1)} ${(H + 4).toFixed(1)}" width="${(W + 4).toFixed(0)}" height="${(H + 4).toFixed(0)}">`;
  s += `<style>.o{fill:#eeeae2;stroke:#6b665c;stroke-width:1}.g{fill:none;stroke:#8a8478;stroke-width:.8}.p{fill:#e2ddd2;stroke:#8a8478;stroke-width:.7}.gl{fill:#cfe0e6;stroke:#6b8a94;stroke-width:.7}.b{fill:#e2ddd2;stroke:#8a8478;stroke-width:.5}.r{fill:#d8d2c6;stroke:none}</style>`;
  s += poly(L.root.c, 'o');
  if (L.rails) for (const [a, b] of L.rails.grooves) { const r: [P, P, P, P] = L.rails.dir === 'v' ? [[a, -L.h / 2], [b, -L.h / 2], [b, L.h / 2], [a, L.h / 2]] : [[-L.w / 2, a], [L.w / 2, a], [L.w / 2, b], [-L.w / 2, b]]; s += poly(r, 'r'); }
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
