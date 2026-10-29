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
//  9. Набор при тяге за угол (ветка claude/guides-plan): «750;2200» + Enter; «800» — только ширина; «;2300» и отпустить кнопку —
//     только высота; «2500» не помещается — отказ с причиной; Esc — отмена; «Сбоку» «650;2100» (глубина;высота).
// 10. «План»: 4 ручки углов, угол → ширина и глубина; «900;600» + Enter; Q от правого края +600 → x = 2200 (look +Y); щелчок
//     без числа — на расстоянии мыши; корпус и угол привязываются к линии; те же линии в «Сверху», «Спереди» — нет;
//     щелчок по линии + Delete, Ctrl+Z, Esc отменяет Q, «Убрать вспомогательные линии».
// 11. Привязки клавишами (ветка claude/snap-binds, решение Макса 29.10): «Спереди» линии x = 1900 и y = 2250;
//     Ctrl + угол → в пересечение линий (ширина 900, высота 2250); Alt + угол → на линию (ширина 900, высота по мыши до 1 мм);
//     Shift + угол — без привязки (1 мм); Alt + «↔» → край на линию; Ctrl+щелчок по «Сосед» — отмечен (и снова — снят), не сдвинут;
//     Ctrl + перенос «Сосед» → левый нижний угол в пересечение линии и пола (x = 1900); Q + Ctrl → через угол «Сосед» (2800);
//     Q + Alt → на правый край «Сосед» (3400).
// 12. «План»: линии x = 1900 и z = 653; Ctrl + угол → ширина 900, глубина 650; Alt + перенос → правый край на линию (x = 1300);
//     Ctrl+щелчок по «Сосед» — отмечен/снят; Q + Ctrl → через угол «Сосед» (2800).
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
const planHandle = async (corner: string) => { const b = await page.locator(`.plan-corner[data-corner="${corner}"]`).first().boundingBox(); return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null; };
/** Тяга за угол с набором размеров: чуть сдвинуть, набрать text, завершить Enter / отпусканием кнопки / Esc. Возвращает плашку. */
async function typedDrag(from: { x: number; y: number }, text: string, finish: "enter" | "release" | "esc", name: string, badgeSel = ".drag-badge") {
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  for (let i = 1; i <= 4; i++) { await page.mouse.move(from.x + i * 3, from.y - i * 2); await page.waitForTimeout(25); }
  for (const c of text) await page.keyboard.press(c);
  await page.waitForTimeout(250);
  const live = (await page.locator(badgeSel).first().innerText().catch(() => "")).trim();
  await shot(name + "-live");
  if (finish === "enter") await page.keyboard.press("Enter");
  if (finish === "esc") await page.keyboard.press("Escape");
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

  // 9. Размеры с клавиатуры при тяге за угол (решение Макса 29.10): «Спереди» — ширина;высота
  await view("s");
  const t1 = (await handle("hi-hi"))!;
  const typedLive = await typedDrag(t1, "750;2200", "enter", "front-typed");
  const b9 = await settled((b) => b.a.w !== 600);
  check("9. плашка показывает набранное «Размер (ширина;высота): 750;2200»", /Размер \(ширина;высота\): 750;2200/.test(typedLive), typedLive);
  check("9. Enter — ширина 750, высота 2200, левый нижний угол на месте", b9.a.w === 750 && b9.a.h === 2200 && b9.a.x === 1000 && b9.a.y === 0, fmt(b9.a));
  await key("Control+z");
  check("9. Ctrl+Z — одной отменой", (await settled((b) => b.a.w === 600)).a.h === 2000);
  await typedDrag((await handle("hi-hi"))!, "800", "enter", "front-typed-one");
  const b9b = await settled((b) => b.a.w !== 600);
  check("9. одно число — только ширина (800), высота прежняя", b9b.a.w === 800 && b9b.a.h === 2000, fmt(b9b.a));
  await key("Control+z"); await settled((b) => b.a.w === 600);
  await typedDrag((await handle("lo-hi"))!, ";2300", "release", "front-typed-second");
  const b9c = await settled((b) => b.a.h !== 2000);
  check("9. «;2300» и отпустили кнопку — только высота 2300, ширина прежняя", b9c.a.h === 2300 && b9c.a.w === 600 && b9c.a.x === 1000, fmt(b9c.a));
  await key("Control+z"); await settled((b) => b.a.h === 2000);
  const big = await typedDrag((await handle("hi-hi"))!, "2500", "enter", "front-typed-too-wide");
  await page.waitForTimeout(300);
  const err = (await page.locator(".error-banner").innerText().catch(() => "")).trim();
  // причина — первая, что встретилась: правило ряда (сосед), предел фасада/корпуса или «не получается» (exactProblem)
  check("9. ширина 2500 не помещается — отказ с причиной в плашке и сообщении, размер прежний", !/Enter — применить/.test(big) && /Размер \(ширина;высота\): 2500/.test(big) && err.length > 10 && (await boxes()).a.w === 600, `«${big}» · «${err}»`);
  await typedDrag((await handle("hi-hi"))!, "900", "esc", "front-typed-esc");
  check("9. Esc — набранное отменено, ничего не изменилось", (await boxes()).a.w === 600 && !(await page.locator(".corner-dragging").count()));
  // «Сбоку» — глубина;высота
  await view("d");
  await typedDrag((await handle("hi-hi"))!, "650;2100", "enter", "side-typed");
  const b9d = await settled((b) => b.a.d !== 550);
  check("9. «Сбоку» «650;2100» — глубина 650, высота 2100, задняя стенка и низ на месте", b9d.a.d === 650 && b9d.a.h === 2100 && b9d.a.z === 3 && b9d.a.y === 0, fmt(b9d.a));
  await key("Control+z"); await settled((b) => b.a.d === 550);

  // 10. «План»: ручки углов (ширина + глубина), набор, Q — линии общие с «Сверху», привязка корпуса к линии
  await page.getByRole("button", { name: "План", exact: true }).click(); await page.waitForTimeout(800);
  const plan = (c: string) => planHandle(c);
  check("10. «План»: 4 ручки углов выбранного корпуса", (await page.locator(".plan-corner").count()) === 4);
  await shot("plan-handles");
  const pl = (await plan("lo-lo"))!, ph = (await plan("hi-hi"))!;
  const qx = (ph.x - pl.x) / 600, qz = (ph.y - pl.y) / 550;
  const live10 = await drag(ph, { x: ph.x + 98 * qx, y: ph.y + 98 * qz }, "plan-corner");
  const b10 = await settled((b) => b.a.w !== 600);
  check("10. угол на плане: ширина 700, глубина 650, задняя стенка и левый край на месте", b10.a.w === 700 && b10.a.d === 650 && b10.a.x === 1000 && b10.a.z === 3, fmt(b10.a) + ` · «${live10}»`);
  await key("Control+z");
  check("10. Ctrl+Z — одной отменой", (await settled((b) => b.a.w === 600)).a.d === 550);
  const live10b = await typedDrag((await plan("hi-hi"))!, "900;600", "enter", "plan-typed", ".plan-badge");
  const b10b = await settled((b) => b.a.w !== 600);
  check("10. набор на плане «900;600» — ширина 900, глубина 600", b10b.a.w === 900 && b10b.a.d === 600 && b10b.a.x === 1000 && b10b.a.z === 3, fmt(b10b.a) + ` · «${live10b}»`);
  await key("Control+z"); await settled((b) => b.a.w === 600);
  // Q от правого края корпуса: +600 → линия x = 2200 (вид сверху, общая с «Сверху»)
  const pr = (await plan("hi-lo"))!, ph2 = (await plan("hi-hi"))!, redge = { x: ph2.x, y: (pr.y + ph2.y) / 2 };
  await page.mouse.move(redge.x, redge.y); await key("q");
  const ppick = (await page.locator(".plan-badge").innerText().catch(() => "")).trim();
  check("10. Q на плане: подсветка края под мышью", /край «Шкаф»|кромка/.test(ppick) && (await page.locator(".plan-guide-hover").count()) === 1, ppick);
  await shot("plan-q-hover");
  await page.mouse.click(redge.x, redge.y); await page.waitForTimeout(200);
  await page.mouse.move(redge.x + 120, redge.y); await page.waitForTimeout(150);
  for (const c of "600") await page.keyboard.press(c);
  await page.waitForTimeout(150);
  const ptyped = (await page.locator(".plan-badge").innerText().catch(() => "")).trim();
  check("10. набранное расстояние видно: «Размер: 600»", /Размер: 600/.test(ptyped), ptyped);
  await shot("plan-q-typed");
  await page.keyboard.press("Enter"); await page.waitForTimeout(400);
  g = await guides();
  check("10. Enter — линия плана x = 2200, взгляд сверху", g.length === 1 && g[0].at === 2200 && g[0].n[0] === 1 && JSON.stringify((g[0] as unknown as { look: number[] }).look) === "[0,1,0]", JSON.stringify(g));
  check("10. линия нарисована на плане", (await page.locator(".plan-guide").count()) === 1);
  await shot("plan-guide");
  // от фасадной линии корпуса вниз по плану (к фасадной стене) — щелчок без числа: на расстоянии мыши
  const pf = (await plan("lo-hi"))!;
  await page.mouse.move((pf.x + ph2.x) / 2, pf.y); await key("q");
  await page.mouse.click((pf.x + ph2.x) / 2, pf.y); await page.waitForTimeout(150);
  await page.mouse.move((pf.x + ph2.x) / 2, pf.y + 400 * qz); await page.waitForTimeout(150);
  await page.mouse.click((pf.x + ph2.x) / 2, pf.y + 400 * qz); await page.waitForTimeout(400);
  g = await guides();
  const zline = g.find((x) => x.n[2] === -1);
  check("10. щелчок без числа — линия на расстоянии мыши (~400 мм перед фасадом)", g.length === 2 && !!zline && Math.abs(-zline.at - 953) < 15, JSON.stringify(g.map((x) => [x.n, x.at])));
  // перетаскивание корпуса на плане к линии 2200: правый край ложится на линию
  const body = { x: (pl.x + ph2.x) / 2, y: (pl.y + ph2.y) / 2 };
  await drag(body, { x: body.x + 600 * qx - 3, y: body.y }, "plan-move-to-guide");
  const b10c = await settled((b) => b.a.x !== 1000);
  check("10. корпус на плане привязался к линии: правый край 2200 (x = 1600)", b10c.a.x === 1600, fmt(b10c.a));
  await key("Control+z"); await settled((b) => b.a.x === 1000);
  // угол к линии 2200
  const ph3 = (await plan("hi-hi"))!;
  await drag(ph3, { x: ph3.x + 600 * qx - 3, y: ph3.y }, "plan-corner-to-guide");
  const b10d = await settled((b) => b.a.w !== 600);
  check("10. угол на плане привязался к линии: ширина 1200", b10d.a.w === 1200 && b10d.a.x === 1000 && b10d.a.d === 550, fmt(b10d.a));
  await key("Control+z"); await settled((b) => b.a.w === 600);
  // общие с «Сверху»: там те же 2 линии; «Спереди» — своих нет
  await view("w");
  const topClear = (await page.getByRole("button", { name: /Убрать вспомогательные линии/ }).innerText().catch(() => "")).trim();
  check("10. «Сверху» — те же линии (2)", /\(2\)/.test(topClear), topClear);
  await shot("top-shared-guides");
  await view("s");
  check("10. «Спереди» линий плана нет", !(await page.getByRole("button", { name: /Убрать вспомогательные линии/ }).count()));
  await page.getByRole("button", { name: "План", exact: true }).click(); await page.waitForTimeout(800);
  // щелчок по линии 2200 + Delete; Ctrl+Z; Esc отменяет Q; «Убрать вспомогательные линии»
  const gx2 = pl.x + 1200 * qx;
  await page.mouse.click(gx2, pl.y - 120 * qz); await page.waitForTimeout(250);
  check("10. щелчок по линии — выбрана", (await page.locator('.plan-guide[stroke="#e8590c"]').count()) === 1);
  await shot("plan-guide-selected");
  await page.keyboard.press("Delete"); await page.waitForTimeout(400);
  check("10. Delete — линия убрана, корпус на месте", (await guides()).length === 1 && (await boxes()).a.w === 600);
  await key("Control+z");
  check("10. Ctrl+Z — линия вернулась", (await guides()).length === 2);
  await page.mouse.move(redge.x + 1, redge.y); await key("q");
  await page.mouse.click(redge.x + 1, redge.y); await page.keyboard.press("7"); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  check("10. Esc отменяет начатую линию", (await guides()).length === 2 && !(await page.locator(".plan-guide-ghost").count()));
  const pclear = page.getByRole("button", { name: /Убрать вспомогательные линии/ });
  check("10. кнопка «Убрать вспомогательные линии (2)» на плане", /\(2\)/.test(await pclear.innerText().catch(() => "")));
  await pclear.click(); await page.waitForTimeout(400);
  check("10. линии убраны", (await guides()).length === 0 && !(await pclear.count()));
  await shot("plan-cleared");

  // 11. Привязки клавишами «Спереди»: Alt — на линию, Ctrl — пересечение, Shift — без привязки
  type Pt = { x: number; y: number };
  /** Тяга с зажатой клавишей (зажата до нажатия кнопки мыши): плашка и метка привязки перед отпусканием. */
  async function modDrag(mod: "Alt" | "Control" | "Shift", from: Pt, to: Pt, name: string, badgeSel = ".drag-badge", markSel = ".snap-mark:not([hidden])") {
    await page.mouse.move(from.x, from.y); await page.keyboard.down(mod); await page.mouse.down();
    for (let i = 1; i <= 12; i++) { await page.mouse.move(from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12); await page.waitForTimeout(25); }
    await page.waitForTimeout(120);
    const live = (await page.locator(badgeSel).first().innerText().catch(() => "")).trim();
    const mark = (await page.locator(markSel).first().getAttribute("data-kind").catch(() => null)) ?? "";
    await shot(name + "-live");
    await page.mouse.up(); await page.keyboard.up(mod); await page.waitForTimeout(600);
    return { live, mark };
  }
  async function modClick(mod: "Alt" | "Control", p: Pt) { await page.keyboard.down(mod); await page.mouse.click(p.x, p.y); await page.keyboard.up(mod); await page.waitForTimeout(400); }
  const status = async () => (await page.locator(".orbit-help").first().innerText().catch(() => "")).replace(/\s+/g, " ");
  await view("s");
  const f0 = (await handle("lo-lo"))!, f1 = (await handle("hi-hi"))!, f2 = (await handle("hi-lo"))!;
  const fk = (f1.x - f0.x) / 600, X = (x: number) => f0.x + (x - 1000) * fk, Y = (y: number) => f0.y - y * fk;
  // линия x = 1900 (правый край + 300) и y = 2250 (верх + 250)
  const fedge = { x: f1.x, y: (f1.y + f2.y) / 2 };
  await page.mouse.move(fedge.x + 1, fedge.y + 40); await key("q");
  await page.mouse.click(fedge.x + 1, fedge.y + 40); await page.waitForTimeout(200);
  await page.mouse.move(fedge.x + 120, fedge.y + 40); for (const c of "300") await page.keyboard.press(c); await page.keyboard.press("Enter"); await page.waitForTimeout(400);
  const ftop = { x: (f0.x + f1.x) / 2, y: f1.y };
  await page.mouse.move(ftop.x, ftop.y - 1); await key("q");
  await page.mouse.click(ftop.x, ftop.y - 1); await page.waitForTimeout(200);
  await page.mouse.move(ftop.x, ftop.y - 60); for (const c of "250") await page.keyboard.press(c); await page.keyboard.press("Enter"); await page.waitForTimeout(400);
  g = await guides();
  check("11. линии «Спереди»: x = 1900 и y = 2250", g.length === 2 && g.some((x) => x.at === 1900 && x.n[0] === 1) && g.some((x) => x.at === 2250 && x.n[1] === 1), JSON.stringify(g.map((x) => [x.n, x.at])));
  // Ctrl + угол → пересечение двух линий
  const c11 = await modDrag("Control", (await handle("hi-hi"))!, { x: X(1900) + 5, y: Y(2250) - 4 }, "ctrl-corner");
  const b11 = await settled((b) => b.a.w !== 600);
  check("11. Ctrl + угол → в пересечение линий: ширина 900, высота 2250, левый нижний угол на месте", b11.a.w === 900 && b11.a.h === 2250 && b11.a.x === 1000 && b11.a.y === 0, fmt(b11.a) + ` · «${c11.live}»`);
  check("11. Ctrl: плашка «Ctrl · пересечение» и метка-крестик", /Ctrl · пересечение: вспомогательные линии/.test(c11.live) && c11.mark === "cross", `«${c11.live}» · ${c11.mark}`);
  await key("Control+z"); await settled((b) => b.a.w === 600);
  check("11. Ctrl+Z — одной отменой", (await boxes()).a.h === 2000);
  // Alt + угол → точка на линии: ширина по линии, высота по мыши (1 мм, не шаг 10)
  // критик 29.10 (блокер): Alt отпустили ПОСЛЕ мыши — keyup Alt погашен (иначе Chrome на Windows уводит фокус в меню браузера)
  await page.evaluate(() => { const w = window as unknown as { __altUp: boolean[] }; w.__altUp = []; window.addEventListener("keyup", (e) => { if (e.key === "Alt") w.__altUp.push(e.defaultPrevented); }); });
  const altUp = async () => (await page.evaluate(() => (window as unknown as { __altUp: boolean[] }).__altUp.at(-1))) === true;
  const a11 = await modDrag("Alt", (await handle("hi-hi"))!, { x: X(1900) + 5, y: Y(2103) }, "alt-corner");
  check("11. Alt отпущен после мыши — keyup Alt погашен (фокус не уходит в меню браузера)", await altUp());
  const b11a = await settled((b) => b.a.w !== 600);
  check("11. Alt + угол → на линию: ширина ровно 900, высота по мыши ≈ 2103 (до 1 мм)", b11a.a.w === 900 && Math.abs(b11a.a.h - 2103) <= 3 && b11a.a.x === 1000, fmt(b11a.a) + ` · «${a11.live}»`);
  check("11. Alt: плашка «Alt · на линии» и метка-кружок", /Alt · на линии: вспомогательная линия/.test(a11.live) && a11.mark === "line", `«${a11.live}» · ${a11.mark}`);
  await key("Control+z"); await settled((b) => b.a.w === 600);
  // Shift + угол — без привязки (раньше Alt)
  const s11 = await modDrag("Shift", (await handle("hi-hi"))!, { x: f1.x + 103 * fk, y: f1.y - 148 * fk }, "shift-corner");
  const b11s = await settled((b) => b.a.w !== 600);
  check("11. Shift + угол — без привязки: ≈ 703 × 2148 (не 700 × 2150)", Math.abs(b11s.a.w - 703) <= 2 && Math.abs(b11s.a.h - 2148) <= 2 && /Без привязки/.test(s11.live), fmt(b11s.a) + ` · «${s11.live}»`);
  await key("Control+z"); await settled((b) => b.a.w === 600);
  // Alt + «↔» → край на линию
  const sr = await page.locator(".stretch-handle[data-side=right]").first().boundingBox();
  if (sr) {
    const from = { x: sr.x + sr.width / 2, y: sr.y + sr.height / 2 };
    const e11 = await modDrag("Alt", from, { x: from.x + (X(1900) - X(1600)) - 5, y: from.y }, "alt-edge");
    const b11e = await settled((b) => b.a.w !== 600);
    check("11. Alt + «↔» → правый край на линию: ширина 900", b11e.a.w === 900 && b11e.a.x === 1000 && /Alt · на линии/.test(e11.live), fmt(b11e.a) + ` · «${e11.live}»`);
    await key("Control+z"); await settled((b) => b.a.w === 600);
  } else check("11. ручка «↔» видна", false);
  // Ctrl+щелчок без движения — по-прежнему отметить корпус
  const nb = { x: X(3100), y: Y(1000) };
  await modClick("Control", nb);
  const st1 = await status(), bx1 = await boxes();
  check("11. Ctrl+щелчок по «Сосед» — отмечен (группа), не сдвинут", /Отмеченные корпуса/.test(st1) && bx1.b.x === 2800, st1);
  await modClick("Control", nb);
  check("11. Ctrl+щелчок ещё раз — снят", !/Отмеченные корпуса/.test(await status()));
  // критик 29.10 п.4: Ctrl+щелчок с дрожанием 6 px — щелчок (отмечен), корпус не сдвинут
  const jitter = async (p: Pt) => { await page.mouse.move(p.x, p.y); await page.keyboard.down("Control"); await page.mouse.down(); await page.mouse.move(p.x + 4, p.y + 2); await page.mouse.move(p.x + 6, p.y); await page.mouse.up(); await page.keyboard.up("Control"); await page.waitForTimeout(400); };
  await jitter(nb);
  const stj = await status(), bxj = await boxes();
  check("11. Ctrl+щелчок с дрожанием 6 px — отмечен, не сдвинут", /Отмеченные корпуса/.test(stj) && bxj.b.x === 2800, `x ${bxj.b.x} · ${stj}`);
  await modClick("Control", nb);
  // Ctrl + перенос «Сосед»: левый нижний угол — в пересечение линии x = 1900 и пола
  const grab = { x: X(2800) + 25, y: Y(0) - 40 };
  const m11 = await modDrag("Control", grab, { x: grab.x + X(1900) - X(2800) + 5, y: grab.y + 4 }, "ctrl-move");
  const b11m = await settled((b) => b.b.x !== 2800);
  check("11. Ctrl + перенос «Сосед» → угол в пересечение: x = 1900, y = 0", b11m.b.x === 1900 && b11m.b.y === 0 && /Ctrl · пересечение/.test(m11.live), fmt(b11m.b) + ` · «${m11.live}»`);
  check("11. Ctrl+протяжка не отмечает корпус", !/Отмеченные корпуса/.test(await status()));
  await key("Control+z"); await settled((b) => b.b.x === 2800);
  // Q + Ctrl: линия через угол «Сосед»; Q + Alt: на правый край «Сосед»
  await page.mouse.move(fedge.x + 1, fedge.y + 40); await key("q");
  await page.mouse.click(fedge.x + 1, fedge.y + 40); await page.waitForTimeout(200);
  await page.keyboard.down("Control"); await page.mouse.move(X(2800) + 4, Y(2000) + 5); await page.waitForTimeout(200);
  const q11 = (await page.locator(".drag-badge").innerText().catch(() => "")).trim();
  await shot("q-ctrl");
  await page.mouse.click(X(2800) + 4, Y(2000) + 5); await page.keyboard.up("Control"); await page.waitForTimeout(400);
  g = await guides();
  check("11. Q + Ctrl → линия через угол «Сосед»: x = 2800 точно", g.some((x) => x.at === 2800 && x.n[0] === 1) && /Ctrl · пересечение: угол: край «Сосед»/.test(q11), `«${q11}» · ${JSON.stringify(g.map((x) => x.at))}`);
  await page.mouse.move(fedge.x + 1, fedge.y + 40); await key("q");
  await page.mouse.click(fedge.x + 1, fedge.y + 40); await page.waitForTimeout(200);
  await page.keyboard.down("Alt"); await page.mouse.move(X(3400) + 5, Y(1000)); await page.waitForTimeout(200);
  await page.mouse.click(X(3400) + 5, Y(1000)); await page.keyboard.up("Alt"); await page.waitForTimeout(400);
  g = await guides();
  check("11. Q + Alt → линия на правый край «Сосед»: x = 3400", g.some((x) => x.at === 3400 && x.n[0] === 1), JSON.stringify(g.map((x) => x.at)));
  // критик 29.10 п.2: Q от левого края «Шкаф», Alt у пола (4 мм) у правого края — линия ровно 1600 (пол хода не «съедает»)
  await page.mouse.move(X(1000) - 1, Y(1000)); await key("q");
  await page.mouse.click(X(1000) - 1, Y(1000)); await page.waitForTimeout(200);
  await page.keyboard.down("Alt"); await page.mouse.move(X(1608), Y(4)); await page.waitForTimeout(200);
  await page.mouse.click(X(1608), Y(4)); await page.keyboard.up("Alt"); await page.waitForTimeout(400);
  g = await guides();
  check("11. Q + Alt у пола → линия на правый край «Шкаф»: x = 1600 точно", g.some((x) => x.at === 1600 && x.n[0] === 1), JSON.stringify(g.map((x) => x.at)));
  await page.getByRole("button", { name: /Убрать вспомогательные линии/ }).click(); await page.waitForTimeout(400);

  // 12. «План»: те же клавиши
  await page.getByRole("button", { name: "План", exact: true }).click(); await page.waitForTimeout(800);
  const p0 = (await plan("lo-lo"))!, p1 = (await plan("hi-hi"))!, p2 = (await plan("hi-lo"))!;
  const px = (p1.x - p0.x) / 600, pz = (p1.y - p0.y) / 550, PX = (x: number) => p0.x + (x - 1000) * px, PZ = (z: number) => p0.y + (z - 3) * pz;
  const pedge = { x: p1.x, y: (p1.y + p2.y) / 2 }, pfront = { x: (p0.x + p1.x) / 2, y: p1.y };
  await page.mouse.move(pedge.x, pedge.y); await key("q"); await page.mouse.click(pedge.x, pedge.y); await page.waitForTimeout(150);
  await page.mouse.move(pedge.x + 100, pedge.y); for (const c of "300") await page.keyboard.press(c); await page.keyboard.press("Enter"); await page.waitForTimeout(400);
  await page.mouse.move(pfront.x, pfront.y); await key("q"); await page.mouse.click(pfront.x, pfront.y); await page.waitForTimeout(150);
  await page.mouse.move(pfront.x, pfront.y + 60); for (const c of "100") await page.keyboard.press(c); await page.keyboard.press("Enter"); await page.waitForTimeout(400);
  g = await guides();
  check("12. линии плана: x = 1900 и z = 653", g.length === 2 && g.some((x) => x.at === 1900 && x.n[0] === 1) && g.some((x) => x.at === -653 && x.n[2] === -1), JSON.stringify(g.map((x) => [x.n, x.at])));
  const c12 = await modDrag("Control", (await plan("hi-hi"))!, { x: PX(1900) + 4, y: PZ(653) + 5 }, "plan-ctrl-corner", ".plan-badge", ".plan-snap-mark");
  const b12 = await settled((b) => b.a.w !== 600);
  check("12. Ctrl + угол на плане → в пересечение: ширина 900, глубина 650, задняя стенка на месте", b12.a.w === 900 && b12.a.d === 650 && b12.a.x === 1000 && b12.a.z === 3, fmt(b12.a) + ` · «${c12.live}»`);
  check("12. Ctrl: плашка и метка-крестик на плане", /Ctrl · пересечение/.test(c12.live) && c12.mark === "cross", `«${c12.live}» · ${c12.mark}`);
  await key("Control+z"); await settled((b) => b.a.w === 600);
  const pgrab = { x: PX(1600) - 15, y: PZ(553) - 15 };
  const m12 = await modDrag("Alt", pgrab, { x: pgrab.x + PX(1900) - PX(1600) - 5, y: pgrab.y + 17 * pz }, "plan-alt-move", ".plan-badge", ".plan-snap-mark");
  check("12. «План»: Alt отпущен после мыши — keyup Alt погашен", await altUp());
  const b12m = await settled((b) => b.a.x !== 1000);
  check("12. Alt + перенос на плане → правый край на линию: x = 1300, z по мыши ≈ 20", b12m.a.x === 1300 && Math.abs(b12m.a.z - 20) <= 3 && Number.isInteger(b12m.a.z) && m12.mark === "line", fmt(b12m.a) + ` · «${m12.live}» · ${m12.mark}`);
  await key("Control+z"); await settled((b) => b.a.x === 1000);
  const pnb = { x: PX(3100), y: PZ(278) }, fill = () => page.locator('g[aria-label="На плане: Сосед"] polygon').first().getAttribute("fill");
  await modClick("Control", pnb);
  check("12. Ctrl+щелчок по «Сосед» на плане — отмечен, не сдвинут", (await fill()) === "#cde6df" && (await boxes()).b.x === 2800, String(await fill()));
  await modClick("Control", pnb);
  check("12. Ctrl+щелчок ещё раз — снят", (await fill()) !== "#cde6df", String(await fill()));
  await page.mouse.move(pedge.x, pedge.y); await key("q"); await page.mouse.click(pedge.x, pedge.y); await page.waitForTimeout(150);
  await page.keyboard.down("Control"); await page.mouse.move(PX(2800) + 4, PZ(3) + 4); await page.waitForTimeout(200);
  const q12 = (await page.locator(".plan-badge").innerText().catch(() => "")).trim();
  await shot("plan-q-ctrl");
  await page.mouse.click(PX(2800) + 4, PZ(3) + 4); await page.keyboard.up("Control"); await page.waitForTimeout(400);
  g = await guides();
  check("12. Q + Ctrl на плане → линия через угол «Сосед»: x = 2800", g.some((x) => x.at === 2800 && x.n[0] === 1) && /Ctrl · пересечение/.test(q12), `«${q12}» · ${JSON.stringify(g.map((x) => x.at))}`);
  await page.getByRole("button", { name: /Убрать вспомогательные линии/ }).click(); await page.waitForTimeout(400);
  console.log("ошибки страницы: " + (errors.length ? errors.join("; ") : "нет"));
  check("без ошибок страницы", !errors.length, errors.join("; "));
  const bad = results.filter((r) => !r[1]);
  console.log(`ИТОГ: ${results.length - bad.length}/${results.length}`);
  if (bad.length) process.exitCode = 1;
} finally { await browser.close(); }
