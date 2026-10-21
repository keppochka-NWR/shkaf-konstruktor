// Тройка снимков «эталон Базиса (рендер панелей) | студия | наложение» для нижнего углового (shop-kcorner, 21.10.2026).
// npx tsx scripts/kitchen/corner-trio.ts <outDir>
// Эталон — панели и фурнитура из tests/fixtures/kitchen-ref (габариты деталей Базиса), студия — генератор kitchenBaseCorner.
// Вид спереди (X–Y) и сверху (X–Z), одна точка отсчёта — минимальный угол габарита панелей (как в compare.ts).
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { initialModule, parts, type Module } from "../../src/model";
import { k02Corner, k27Corner } from "./cornerEtalons";
import { compareModule, honestPass, type RefModule } from "./compare";

const [out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const ref = (n: string) => JSON.parse(readFileSync(new URL(`../../tests/fixtures/kitchen-ref/${n}.json`, import.meta.url), "utf8")) as RefModule;
type B = { b: number[]; facade: boolean; name: string; hw?: boolean };

function refBoxes(r: RefModule): B[] {
  const ps = r.panels.filter((p) => ["ldsp", "hdf", "mdf", "glass", "other"].includes(p.kind));
  return [...ps.map((p) => ({ b: p.box, facade: p.kind === "mdf" && p.axis === "z", name: p.name })),
    ...r.hardware.map((h) => ({ b: [h.pos[0] - 4, h.pos[1] - 4, h.pos[2] - 4, h.pos[0] + 4, h.pos[1] + 4, h.pos[2] + 4], facade: false, name: h.category, hw: true }))];
}
function studioBoxes(m: Module): B[] {
  return parts(m).filter((p) => p.material !== "metal" || p.role === "fastener" || p.role === "hinge" || p.id.startsWith("leg:")).map((p) => {
    const hw = p.material === "metal";
    const o = hw ? (p.model?.origin ?? p.anchor ?? p.position) : null;
    const b = o ? [o[0] - 4, o[1] - 4, o[2] - 4, o[0] + 4, o[1] + 4, o[2] + 4] : [0, 1, 2].map((i) => p.position[i] - p.size[i] / 2).concat([0, 1, 2].map((i) => p.position[i] + p.size[i] / 2));
    return { b, facade: p.role === "door" || p.id.endsWith(":facade"), name: p.name, hw };
  });
}
const norm = (xs: B[]) => { const o = [0, 1, 2].map((i) => Math.min(...xs.filter((x) => !x.hw).map((x) => x.b[i]))); return xs.map((x) => ({ ...x, b: x.b.map((v, i) => v - o[i % 3]) })); };

function view(xs: B[], W: number, H: number, D: number, s: number, color: (x: B) => string, op = 1) {
  const front = xs.filter((x) => !x.hw).sort((a, c) => a.b[2] - c.b[2]).map((x) => `<rect x="${x.b[0] * s}" y="${(H - x.b[4]) * s}" width="${(x.b[3] - x.b[0]) * s}" height="${(x.b[4] - x.b[1]) * s}" fill="${color(x)}" fill-opacity="${x.facade ? 0.35 * op : 0.55 * op}" stroke="${color(x)}" stroke-width="1"/>`).join("");
  const top = xs.filter((x) => !x.hw).sort((a, c) => a.b[1] - c.b[1]).map((x) => `<rect x="${x.b[0] * s}" y="${(H + 40 + x.b[2]) * s}" width="${(x.b[3] - x.b[0]) * s}" height="${(x.b[5] - x.b[2]) * s}" fill="${color(x)}" fill-opacity="${0.4 * op}" stroke="${color(x)}" stroke-width="1"/>`).join("");
  const hw = xs.filter((x) => x.hw).map((x) => `<circle cx="${(x.b[0] + 4) * s}" cy="${(H - x.b[1] - 4) * s}" r="3" fill="${color(x)}"/><circle cx="${(x.b[0] + 4) * s}" cy="${(H + 40 + x.b[2] + 4) * s}" r="3" fill="${color(x)}"/>`).join("");
  return front + top + hw + `<text x="0" y="${H * s + 14}" font-size="11" fill="#666">спереди ↑ · сверху ↓ (зад — вверху)</text>`;
}
async function trio(name: string, r: RefModule, m: Module, page: import("playwright").Page) {
  const A = norm(refBoxes(r)), B2 = norm(studioBoxes(m)), c = compareModule(r, m);
  const W = Math.max(...A.map((x) => x.b[3])), H = Math.max(...A.map((x) => x.b[4])), D = Math.max(...A.map((x) => x.b[5]));
  const s = 420 / Math.max(W, H + D + 40), cw = W * s + 40, ch = (H + D + 40) * s + 110;
  const refC = (x: B) => (x.hw ? "#c0392b" : x.facade ? "#2e86de" : "#7f6a4d"), stC = (x: B) => (x.hw ? "#16a085" : x.facade ? "#2e86de" : "#555");
  const ok = honestPass(c, [], []), bad = c.pairs.filter((p) => p.delta > 0.5).length, hwBad = c.hardware.filter((h) => h.ref !== h.studio || (h.maxPosDelta ?? 0) > 2);
  const sum = `${ok ? "PASS" : "FAIL"} · панелей ${c.pairs.length} в допуске ${c.pairs.length - bad}, нет ${c.missing.length}, лишних ${c.extra.length} · фурнитура ${hwBad.length ? hwBad.map((h) => `${h.category} ${h.ref}/${h.studio}`).join(", ") : "совпала"} · отверстия ${c.holes ? `${c.holes.matched}/${c.holes.ref} (+${c.holes.extra.length})` : "—"}${c.contours?.length ? " · контуры: " + c.contours.length : ""}`;
  const col = (i: number, title: string, body: string) => `<g transform="translate(${15 + i * cw},78)"><text x="0" y="-12" font-size="14" font-weight="600">${title}</text>${body}</g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${3 * cw + 20}" height="${ch + 40}" font-family="Segoe UI, Arial"><rect width="100%" height="100%" fill="#fff"/>
    <text x="15" y="20" font-size="15" font-weight="700">${name}: ${r.name} ${r.size.map(Math.round).join("×")}</text><text x="15" y="40" font-size="13">${sum}</text>
    ${col(0, "Эталон Базиса (панели)", view(A, W, H, D, s, refC))}${col(1, "Студия (генератор)", view(B2, W, H, D, s, stC))}
    ${col(2, "Наложение: Базис коричневый / студия серый", view(A, W, H, D, s, refC, 0.8) + view(B2, W, H, D, s, () => "#222", 0.5))}</svg>`;
  await page.setContent(svg); await page.setViewportSize({ width: Math.ceil(3 * cw + 20), height: Math.ceil(ch + 40) });
  await page.screenshot({ path: `${out}/trio-${name}.png` });
  console.log(name, sum);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
try {
  // те же модули, что в tests/kitchen-corner.test.ts (scripts/kitchen/cornerEtalons.ts)
  await trio("k02-m01", ref("k02-m01"), k02Corner(), page);
  await trio("k27-m09", ref("k27-m09"), k27Corner(), page);
} finally { await browser.close(); }
