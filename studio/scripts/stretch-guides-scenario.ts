// Растяжение за угол и вспомогательные линии Q (решение Макса 29.10.2026) мышью и клавиатурой, как менеджер:
//   npx tsx scripts/stretch-guides-scenario.ts <url> <outDir>
// Помещение 4000×3000×2700: «Шкаф» 600×2000×550 у x=1000 (выбран), «Сосед» у x=2800.
//  1. «Спереди» (S): 4 ручки углов; правый верхний угол → ширина и высота растут, левый нижний угол на месте; Ctrl+Z — одной отменой.
//  2. «Сверху» (W): правый передний угол → ширина и глубина, задняя стенка на месте; Ctrl+Z.
//  3. «Сбоку» (D): передний верхний угол → глубина и высота; Ctrl+Z.
//  4. «Спереди»: Q → навести на правый край корпуса → щелчок → мышь правее → «600» → Enter → линия x = 1600 + 600 = 2200.
//     Q → тот же край → мышь левее → «300» → Enter → линия 1300 (сторона по мыши).
//  5. Правый верхний угол тянем к линии 2200 (отпускаем в 3 px от неё) — ширина ровно 1200 (привязка к линии).
//  6. Ctrl+Z — ширина 600, линии на месте; Ctrl+Z — линия 1300 убрана. Щелчок по линии + Delete — убрана.
//  7. Esc отменяет Q; «Убрать вспомогательные линии».
//  8. E — 3D, Q в 3D ничего не делает.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { initialModule, type Module } from "../src/model";
import { newProject, type PlacedModule, type Project } from "../src/project";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const mod = (name: string, width = 600, extra: Partial<Module> = {}): Module => ({ ...initialModule(), name, width, height: 2000, depth: 550, ...extra });
const at = (id: string, x: number, m: Module): PlacedModule => ({ id, x, y: 0, z: 3, rotation: 0, module: m });
const project = (): Project => { const p = newProject(); p.room = { ...p.room, width: 4000, depth: 3000, height: 2700 }; p.modules = [at("a", 1000, mod("Шкаф")), at("b", 2800, mod("Сосед"))]; return p; };
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.setDefaultTimeout(8000);
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
let n = 0;
const shot = async (name: string) => { await page.waitForTimeout(300); await page.screenshot({ path: `${out}/${String(++n).padStart(2, "0")}-${name}.png` }); };
type Box = { id: string; x: number; z: number; w: number; y: number; h: number; d: number };
const boxes = async () => Object.fromEntries(((await page.evaluate(() => (window as unknown as { __arrangement: () => unknown[] }).__arrangement())) as Box[]).map((b) => [b.id, b])) as Record<string, Box>;
const guides = async () => (await page.evaluate(() => (window as unknown as { __guides: () => unknown[] }).__guides())) as { at: number; n: number[] }[];
const fmt = (b: Box) => `x ${b.x} y ${b.y} z ${b.z} · ${b.w}×${b.h}×${b.d}`;
const handle = async (corner: string) => { const b = await page.locator(`.corner-handle[data-corner="${corner}"]`).first().boundingBox(); return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null; };
const blur = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
const key = async (k: string) => { await blur(); await page.keyboard.press(k); await page.waitForTimeout(250); };
const view = async (k: string) => { await key(k); await page.waitForTimeout(900); };
async function drag(from: { x: number; y: number }, to: { x: number; y: number }, name: string) {
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12); await page.waitForTimeout(25); }
  const live = (await page.locator(".drag-badge").innerText().catch(() => "")).trim();
  await shot(name + "-live");
  await page.mouse.up(); await page.waitForTimeout(600);
  return live;
}
async function settled(cond: (b: Record<string, Box>) => boolean) { let b = await boxes(); for (let i = 0; i < 20 && !cond(b); i++) { await page.waitForTimeout(150); b = await boxes(); } return b; }
try {
  await page.goto(url);
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-dock", "project"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(project()));
  await page.goto(url); await page.waitForSelector("canvas"); await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Двигать корпуса", exact: true }).click(); await page.waitForTimeout(400);
  const hint = (await page.locator(".orbit-help .view-keys").innerText().catch(() => "")).trim();
  check("подсказка: «E — 3D, Q — вспомогательная линия»", /E — 3D, Q — вспомогательная линия/.test(hint), hint);

  // 1. Спереди
  await view("s");
  check("1. «Спереди»: 4 ручки углов", (await page.locator(".corner-handle").count()) === 4);
  await shot("front-handles");
  const lo = (await handle("lo-lo"))!, hi = (await handle("hi-hi"))!;
  const pxmm = (hi.x - lo.x) / 600;
  const live1 = await drag(hi, { x: hi.x + 103 * pxmm, y: hi.y - 148 * pxmm }, "front-corner");
  const b1 = await settled((b) => b.a.w !== 600);
  check("1. живая плашка «ширина … × высота … мм»", /ширина \d+ × высота \d+ мм/.test(live1), live1);
  check("1. ширина 700, высота 2150, левый нижний угол на месте", b1.a.w === 700 && b1.a.h === 2150 && b1.a.x === 1000 && b1.a.y === 0, fmt(b1.a) + ` (px/мм ${pxmm.toFixed(3)})`);
  await shot("front-after");
  await key("Control+z");
  const u1 = await settled((b) => b.a.w === 600);
  check("1. Ctrl+Z — одной отменой обратно 600×2000", u1.a.w === 600 && u1.a.h === 2000, fmt(u1.a));
  // нижний левый угол вниз — пол не даёт (y < 0): отказ, ничего не меняется
  const lo2 = (await handle("lo-lo"))!;
  const live1b = await drag(lo2, { x: lo2.x, y: lo2.y + 80 * pxmm }, "front-below-floor");
  const b1b = await boxes();
  check("1. угол ниже пола — отказ с причиной, размер прежний", b1b.a.h === 2000 && b1b.a.y === 0, `«${live1b}» · ${fmt(b1b.a)}`);

  // 2. Сверху
  await view("w");
  check("2. «Сверху»: 4 ручки углов", (await page.locator(".corner-handle").count()) === 4);
  const tl = (await handle("lo-lo"))!, th = (await handle("hi-hi"))!;
  const kx = (th.x - tl.x) / 600, kz = (th.y - tl.y) / 550;
  const live2 = await drag(th, { x: th.x + 98 * kx, y: th.y + 98 * kz }, "top-corner");
  const b2 = await settled((b) => b.a.d !== 550);
  check("2. ширина 700, глубина 650, задняя стенка и левый край на месте", b2.a.w === 700 && b2.a.d === 650 && b2.a.x === 1000 && b2.a.z === 3, fmt(b2.a) + ` · «${live2}»`);
  await shot("top-after");
  await key("Control+z");
  check("2. Ctrl+Z", (await settled((b) => b.a.d === 550)).a.w === 600);

  // 3. Сбоку (справа)
  await view("d");
  check("3. «Сбоку»: 4 ручки углов", (await page.locator(".corner-handle").count()) === 4);
  const sl = (await handle("lo-lo"))!, sh = (await handle("hi-hi"))!;
  const sx = (sh.x - sl.x) / 550, sy = (sl.y - sh.y) / 2000;
  const live3 = await drag(sh, { x: sh.x + 98 * sx, y: sh.y - 102 * sy }, "side-corner");
  const b3 = await settled((b) => b.a.d !== 550);
  check("3. глубина 650, высота 2100, задняя стенка и низ на месте", b3.a.d === 650 && b3.a.h === 2100 && b3.a.z === 3 && b3.a.y === 0, fmt(b3.a) + ` · «${live3}»`);
  await shot("side-after");
  await key("Control+z");
  check("3. Ctrl+Z", (await settled((b) => b.a.d === 550)).a.h === 2000);

  // 4. Вспомогательные линии спереди
  await view("s");
  const fl = (await handle("lo-lo"))!, fh = (await handle("hi-hi"))!, fr = (await handle("hi-lo"))!;
  const k = (fh.x - fl.x) / 600, edge = { x: fh.x, y: (fh.y + fr.y) / 2 };
  await page.mouse.move(edge.x + 1, edge.y + 40); await key("q");
  const pick = (await page.locator(".drag-badge").innerText().catch(() => "")).trim();
  check("4. Q: подсветка линии под мышью", /край «Шкаф»|кромка/.test(pick), pick);
  await shot("q-hover");
  await page.mouse.click(edge.x + 1, edge.y + 40); await page.waitForTimeout(200);
  await page.mouse.move(edge.x + 120, edge.y + 40); await page.waitForTimeout(150);
  for (const c of "600") await page.keyboard.press(c);
  await page.waitForTimeout(200);
  const typed = (await page.locator(".drag-badge").innerText().catch(() => "")).trim();
  check("4. набранный размер виден: «Размер: 600»", /Размер: 600/.test(typed), typed);
  await shot("q-typed-600");
  await page.keyboard.press("Enter"); await page.waitForTimeout(500);
  let g = await guides();
  check("4. Enter — линия на 600 мм правее края: x = 2200", g.length === 1 && g[0].at === 2200 && g[0].n[0] === 1, JSON.stringify(g));
  await shot("guide-2200");
  await page.mouse.move(edge.x + 1, edge.y + 40); await key("q");
  await page.mouse.click(edge.x + 1, edge.y + 40); await page.waitForTimeout(200);
  await page.mouse.move(edge.x - 90, edge.y + 40); await page.waitForTimeout(150);
  for (const c of "300") await page.keyboard.press(c);
  await page.keyboard.press("Enter"); await page.waitForTimeout(500);
  g = await guides();
  check("4. мышь левее края — линия влево: x = 1300", g.length === 2 && g.some((x) => x.at === 1300), JSON.stringify(g.map((x) => x.at)));
  await shot("guide-1300");

  // 5. угол к линии 2200: отпускаем в 3 px от неё
  const h5 = (await handle("hi-hi"))!;
  const live5 = await drag(h5, { x: h5.x + 600 * k - 3, y: h5.y }, "corner-to-guide");
  const b5 = await settled((b) => b.a.w !== 600);
  check("5. угол привязался к линии: ширина 1200, левый край на месте", b5.a.w === 1200 && b5.a.x === 1000 && b5.a.h === 2000, fmt(b5.a) + ` · «${live5}»`);
  check("5. в плашке — «по: вспомогательная линия»", /вспомогательная линия/.test(live5), live5);
  await shot("corner-snapped");

  // 6. отмены, удаление линии
  await key("Control+z");
  const u6 = await settled((b) => b.a.w === 600);
  check("6. Ctrl+Z — ширина 600, линии остались", u6.a.w === 600 && (await guides()).length === 2);
  await key("Control+z"); await page.waitForTimeout(300);
  g = await guides();
  check("6. Ctrl+Z ещё раз — линия 1300 убрана", g.length === 1 && g[0].at === 2200, JSON.stringify(g.map((x) => x.at)));
  // щелчок по линии 2200 (на высоте ~ середины корпуса) и Delete
  const gx = fl.x + 1200 * k;
  await page.mouse.click(gx, edge.y - 60); await page.waitForTimeout(250);
  await shot("guide-selected");
  await page.keyboard.press("Delete"); await page.waitForTimeout(400);
  check("6. щелчок по линии + Delete — убрана", (await guides()).length === 0 && (await boxes()).a.w === 600);
  await key("Control+z");
  check("6. Ctrl+Z — линия вернулась", (await guides()).length === 1);

  // 7. Esc отменяет Q; «Убрать вспомогательные линии»
  await page.mouse.move(edge.x + 1, edge.y + 40); await key("q");
  await page.mouse.click(edge.x + 1, edge.y + 40); await page.keyboard.press("5"); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  check("7. Esc отменяет начатую линию", (await guides()).length === 1 && !(await page.locator(".scene.guide-tool").count()));
  const clear = page.getByRole("button", { name: /Убрать вспомогательные линии/ });
  check("7. кнопка «Убрать вспомогательные линии (1)»", /\(1\)/.test(await clear.innerText().catch(() => "")));
  await clear.click(); await page.waitForTimeout(400);
  check("7. линии убраны", (await guides()).length === 0 && !(await clear.count()));

  // 8. E — 3D; Q в 3D ничего не делает
  await view("e");
  check("8. E — «3D»", (await page.locator('.view-tabs button[aria-pressed="true"]').innerText().catch(() => "")).trim() === "3D");
  await key("q");
  check("8. Q в 3D — без инструмента, вид тот же", !(await page.locator(".scene.guide-tool").count()) && (await page.locator('.view-tabs button[aria-pressed="true"]').innerText()).trim() === "3D");
  check("8. в 3D ручек углов нет", (await page.locator(".corner-handle").count()) === 0);
  await shot("iso");
  console.log("ошибки страницы: " + (errors.length ? errors.join("; ") : "нет"));
  check("без ошибок страницы", !errors.length, errors.join("; "));
  const bad = results.filter((r) => !r[1]);
  console.log(`ИТОГ: ${results.length - bad.length}/${results.length}`);
  if (bad.length) process.exitCode = 1;
} finally { await browser.close(); }
