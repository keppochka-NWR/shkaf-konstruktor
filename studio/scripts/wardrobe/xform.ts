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
