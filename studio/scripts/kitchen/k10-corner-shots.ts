// Снимки угла k10 (w-lwing, 23.10.2026, вопрос Макса «дай скрин того, о чём говоришь»): эталон Базиса k10 — m13 «НМ 3 мойка» 950
// (угловой с глухой частью) и m14 «НМ 4» (ящики крыла, поворот 270) — рендер панелей эталона в мировых координатах Базиса, как
// тройки corner-trio; рядом — как это строит студия по замеру тестера кухонь (нижний угловой 950 глубиной 642 + ящик 855×395 на Z 645)
// и, для сравнения, угловой студии с корпусом 578 (как корпус Базиса). Вид спереди (X–Y, из комнаты) и сверху (X–Z, стена вверху).
//   npx tsx scripts/kitchen/k10-corner-shots.ts <папка>
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { initialModule, parts, type Module } from "../../src/model";
import { kitchenBaseCorner } from "../../src/kitchenCorner";
import { kitchenTemplate } from "../../src/kitchenProject";
import { bounds, localToRoom, modulesOverlap, type PlacedModule } from "../../src/project";

const [out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const etalon = JSON.parse(readFileSync("C:/Users/My PC/Desktop/Claude Project/Кухни/etalon/k10.json", "utf8"));
type Box = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; kind: "facade" | "ldsp" | "hdf" | "drawer" | "filler" | "hw"; name: string; mod: string };

/** Панели эталона в мире Базиса: yaw 0 — x = ox + lx, z = oz + lz; yaw 270 — x = ox − lz, z = oz + lx (k10 m14: 3217…3612 × 645…1500). */
function etalonBoxes(key: string): Box[] {
  const m = etalon.modules.find((x: { key: string }) => x.key === key), [ox, oy, oz] = m.world.origin, yaw = m.world.yaw;
  return m.panels.map((p: { box: number[]; kind: string; role?: string; name: string; thick: number }) => {
    const [a, b, c, d, e, f] = p.box;
    const xs = yaw === 270 ? [ox - f, ox - c] : [ox + a, ox + d], zs = yaw === 270 ? [oz + a, oz + d] : [oz + c, oz + f];
    const kind = p.kind === "other" ? "facade" : p.kind === "hdf" ? "hdf" : /ящик/i.test(p.name) ? "drawer" : "ldsp";
    return { x0: xs[0], x1: xs[1], y0: oy + b, y1: oy + e, z0: zs[0], z1: zs[1], kind, name: p.name, mod: key } as Box;
  });
}
/** Детали студии в координатах комнаты (localToRoom), фальш углового — отдельным цветом. */
function studioBoxes(a: PlacedModule, mod: string): Box[] {
  return parts(a.module).filter((p) => p.material !== "metal" && p.role !== "fastener" && p.role !== "light").map((p) => {
    const [px, py, pz] = p.position, [sx, sy, sz] = p.size, q = [localToRoom(a, px - sx / 2, pz - sz / 2), localToRoom(a, px + sx / 2, pz + sz / 2)];
    const kind = p.id.startsWith("face-filler") ? "filler" : p.role === "door" || p.id.endsWith(":facade") ? "facade" : p.material === "hdf" ? "hdf" : p.role === "drawer" || p.id.includes(":drawer") || p.id.startsWith("kdr") ? "drawer" : "ldsp";
    return { x0: Math.min(q[0].x, q[1].x), x1: Math.max(q[0].x, q[1].x), y0: (a.y ?? 0) + py - sy / 2, y1: (a.y ?? 0) + py + sy / 2, z0: Math.min(q[0].z, q[1].z), z1: Math.max(q[0].z, q[1].z), kind, name: p.name, mod } as Box;
  });
}
const COLOR: Record<Box["kind"], string> = { facade: "#2e86de", ldsp: "#a0845c", hdf: "#d9cfb8", drawer: "#9aa3ad", filler: "#e67e22", hw: "#c0392b" };
const V = { x0: 2560, x1: 3680, z0: -20, z1: 1560, y1: 860 }, S = 0.42;
function view(bs: Box[], hit: { x0: number; x1: number; z0: number; z1: number } | null, notes: { x: number; z?: number; y?: number; t: string; c?: string }[]) {
  const X = (x: number) => (x - V.x0) * S, top = (V.y1 + 70) * S, Zy = (z: number) => top + (z - V.z0) * S, Yy = (y: number) => (V.y1 - y) * S;
  const wingMods = new Set(["m14", "d"]), front = bs.filter((b) => !wingMods.has(b.mod)), wing = bs.filter((b) => wingMods.has(b.mod));
  const wx0 = Math.min(...wing.map((b) => b.x0)), wx1 = Math.max(...wing.map((b) => b.x1)), wy0 = Math.min(...wing.map((b) => b.y0)), wy1 = Math.max(...wing.map((b) => b.y1));
  const ghost = wing.length ? `<rect x="${X(wx0)}" y="${Yy(wy1)}" width="${(wx1 - wx0) * S}" height="${(wy1 - wy0) * S}" fill="none" stroke="#555" stroke-width="1.5" stroke-dasharray="6 4"/><text x="${X(wx0) + 4}" y="${Yy(wy1) + 14}" font-size="11" fill="#555">ящик крыла (контур)</text>` : "";
  const fr = front.sort((a, b) => a.z1 - b.z1).map((b) => `<rect x="${X(b.x0)}" y="${Yy(b.y1)}" width="${(b.x1 - b.x0) * S}" height="${(b.y1 - b.y0) * S}" fill="${COLOR[b.kind]}" fill-opacity="${b.kind === "facade" || b.kind === "filler" ? 0.45 : 0.3}" stroke="${COLOR[b.kind]}" stroke-width="0.8"/>`).join("");
  const tp = [...bs].sort((a, b) => a.y1 - b.y1).map((b) => `<rect x="${X(b.x0)}" y="${Zy(b.z0)}" width="${Math.max(0.8, (b.x1 - b.x0) * S)}" height="${Math.max(0.8, (b.z1 - b.z0) * S)}" fill="${COLOR[b.kind]}" fill-opacity="${b.kind === "facade" || b.kind === "filler" ? 0.6 : 0.35}" stroke="${COLOR[b.kind]}" stroke-width="0.8"/>`).join("");
  const wall = `<line x1="0" y1="${Zy(0)}" x2="${X(V.x1)}" y2="${Zy(0)}" stroke="#333" stroke-width="3"/><text x="4" y="${Zy(0) - 4}" font-size="11" fill="#333">задняя стена</text>`;
  const h = hit ? `<rect x="${X(hit.x0)}" y="${Zy(hit.z0)}" width="${(hit.x1 - hit.x0) * S}" height="${Math.max(3, (hit.z1 - hit.z0) * S)}" fill="#e74c3c" fill-opacity="0.85" stroke="#c0392b" stroke-width="1.5"/>` : "";
  const ns = notes.map((n) => `<text x="${X(n.x)}" y="${n.z !== undefined ? Zy(n.z) : Yy(n.y!)}" font-size="12" font-weight="600" fill="${n.c ?? "#111"}">${n.t}</text>`).join("");
  return `<text x="0" y="12" font-size="12" fill="#555">спереди (из комнаты)</text>${fr}${ghost}<text x="0" y="${top - 8}" font-size="12" fill="#555">сверху (стена вверху)</text>${wall}${tp}${h}${ns}`;
}

// эталон
const noDrawers = (bs: Box[]) => bs.filter((b) => b.kind !== "drawer");
const E = noDrawers([...etalonBoxes("m13"), ...etalonBoxes("m14")]);
// студия по замеру тестера: «Нижний угловой» 950, глубина 642 (так ввёл тестер — габарит Базиса с глухой частью), ящик 855×395 на Z 645
const corner = (depth: number): PlacedModule => ({ id: "c", x: 2620, y: 0, z: 3, rotation: 0, module: kitchenBaseCorner(initialModule(), { width: 950, depth, side: "right" }) });
const drawer = (): PlacedModule => { const m: Module = { ...kitchenTemplate("base-drawers", 855, initialModule()), depth: 395 }; const a: PlacedModule = { id: "d", x: 0, y: 0, z: 0, rotation: 270, module: m }; const b = bounds(a); a.x += 3217 - b.x; a.z += 645 - b.z; return a; };
const c642 = corner(642), c578 = corner(578), d = drawer();
const hitOf = (c: PlacedModule) => { if (!modulesOverlap(c, d)) return null; const f = studioBoxes(c, "c").filter((b) => b.kind === "filler" || b.kind === "facade"), db = bounds(d); const o = f.map((b) => ({ x0: Math.max(b.x0, db.x), x1: Math.min(b.x1, db.x + db.w), z0: Math.max(b.z0, db.z), z1: Math.min(b.z1, db.z + db.d) })).filter((q) => q.x1 > q.x0 && q.z1 > q.z0); return o.length ? { x0: Math.min(...o.map((q) => q.x0)), x1: Math.max(...o.map((q) => q.x1)), z0: Math.min(...o.map((q) => q.z0)), z1: Math.max(...o.map((q) => q.z1)) } : { x0: db.x, x1: bounds(c).x + bounds(c).w, z0: db.z, z1: bounds(c).z + bounds(c).d }; };
const S1 = noDrawers([...studioBoxes(c642, "c"), ...studioBoxes(d, "d")]), S2 = noDrawers([...studioBoxes(c578, "c"), ...studioBoxes(d, "d")]);
const cols = [
  { title: "Эталон Базиса k10: m13 «НМ 3 мойка» 950 + m14 «НМ 4»", body: view(E, null, [
    { x: 2625, z: 700, t: "корпус мойки 578 + фасады 578…597", c: "#7f6a4d" },
    { x: 3240, z: 560, t: "глухая часть: ЛДСП 4×16 до 642", c: "#7f6a4d" },
    { x: 3020, z: 760, t: "планка 64 + возврат из фасада 19", c: "#2e86de" },
    { x: 3250, z: 1100, t: "m14 вплотную: Z 645, фасад x 3217", c: "#555" },
    { x: 2625, y: 60, t: "2 двери 273 + планка 64; глухая часть без фасада", c: "#1b4f8a" }]) },
  { title: "Студия (как ввёл тестер): угловой 950×642 + ящик на Z 645", body: view(S1, hitOf(c642), [
    { x: 2625, z: 700, t: "корпус 642 + фальш из фасада 642…660 на глухой части", c: "#e67e22" },
    { x: 3240, z: 1100, t: "ящик на 645 входит в фальш/фасад углового", c: "#c0392b" },
    { x: 3240, z: 1130, t: modulesOverlap(c642, d) ? "→ «пересекается», не встаёт" : "пересечения нет", c: "#c0392b" },
    { x: 2625, y: 60, t: "дверь 438 + фальш из фасада 510,5 (плоский)", c: "#a04000" }]) },
  { title: "Для сравнения: студия, корпус углового 578", body: view(S2, hitOf(c578), [
    { x: 2625, z: 700, t: "фальш в плоскости фасадов 578…596", c: "#e67e22" },
    { x: 3240, z: 1100, t: modulesOverlap(c578, d) ? "пересекается" : "ящик на 645 встаёт (нет пересечения)", c: modulesOverlap(c578, d) ? "#c0392b" : "#1e8449" },
    { x: 3240, z: 1130, t: "но нет набора ЛДСП и возврата из фасада", c: "#555" }]) },
];
const W = (V.x1 - V.x0) * S + 30, H = (V.y1 + 70 + V.z1 - V.z0) * S + 40;
const legend = Object.entries({ "фасад / планка из фасада": COLOR.facade, "ЛДСП корпуса": COLOR.ldsp, "фальш углового студии": COLOR.filler, "ящики": COLOR.drawer, "пересечение": "#e74c3c" }).map(([t, c], i) => `<rect x="${15 + i * 210}" y="44" width="14" height="14" fill="${c}" fill-opacity="0.7"/><text x="${35 + i * 210}" y="56" font-size="12">${t}</text>`).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols.length * W + 20}" height="${H + 100}" font-family="Segoe UI, Arial"><rect width="100%" height="100%" fill="#fff"/>
<text x="15" y="24" font-size="16" font-weight="700">k10, угол: нижний угловой + ящик второго крыла (m14) — эталон Базиса и студия. Мм, мир Базиса (X слева направо, Z от задней стены).</text>${legend}
${cols.map((c, i) => `<g transform="translate(${15 + i * W},92)"><text x="0" y="-8" font-size="13" font-weight="700">${c.title}</text>${c.body}</g>`).join("")}</svg>`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  await page.setViewportSize({ width: Math.ceil(cols.length * W + 20), height: Math.ceil(H + 100) });
  await page.setContent(svg); await page.screenshot({ path: `${out}/k10-угол-эталон-студия.png` });
  // крупно — по одной колонке
  for (const [i, n] of [[0, "эталон"], [1, "студия-642"], [2, "студия-578"]] as const) {
    await page.setViewportSize({ width: Math.ceil(W + 30), height: Math.ceil(H + 100) });
    await page.setContent(`<svg xmlns="http://www.w3.org/2000/svg" width="${W + 30}" height="${H + 100}" font-family="Segoe UI, Arial"><rect width="100%" height="100%" fill="#fff"/>${legend.replace(/x="(\d+)"/g, (_, v) => `x="${Number(v) * 0.6}"`)}<g transform="translate(15,92)"><text x="0" y="-8" font-size="13" font-weight="700">${cols[i].title}</text>${cols[i].body}</g></svg>`);
    await page.screenshot({ path: `${out}/k10-угол-${n}.png` });
  }
  console.log("пересечение студии (642):", modulesOverlap(c642, d), "· (578):", modulesOverlap(c578, d));
} finally { await browser.close(); }
