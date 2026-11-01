// Ящики углового шкафа (Макс 01.11) мышью, как менеджер: npx tsx scripts/corner-drawers-0111-scenario.ts <url /?fresh=1> <outDir> [--base]
// От пустой комнаты: палитра «Угловой шкаф» 1110×2000×600 → прозрачный корпус (3D, сверху) → ящик левого и правого блока «Выдвинуть» → скрытые направляющие →
// центр угла (серый выбор ящиков с причиной, серый пункт меню ПКМ) → боковина 400 и сторона 950 → поворот → «Ручка» на фасаде ящика → смета и детали по сохранённому проекту.
// --base — прогон на сборке до правки: только снимки и числа «как было», без проверок новых надписей.
import { chromium, type Locator } from "playwright";
import { mkdirSync } from "node:fs";
import { parts, validate } from "../src/model";
import { partCollisions } from "../src/collisions";
import { parseProject, type Project } from "../src/project";
import { estimate } from "../src/pricing";
import { nest, details } from "../src/exports";

const [url, out] = process.argv.slice(2), base = process.argv.includes("--base");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(8000);
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const expectNew = (name: string, ok: boolean, info = "") => { if (base) console.log("·    " + name + " = " + ok + (info ? " — " + info : "")); else check(name, ok, info); };
let shotN = 0;
const shot = async (name: string) => { await page.waitForTimeout(1800); await page.screenshot({ path: `${out}/${String(++shotN).padStart(2, "0")}-${name}.png` }); };
const click = async (l: Locator) => { await l.scrollIntoViewIfNeeded(); await l.click(); await page.waitForTimeout(300); };
const type = async (l: Locator, v: string | number) => { await l.scrollIntoViewIfNeeded(); await l.click({ clickCount: 3 }); await page.keyboard.press("Control+A"); await page.keyboard.type(String(v)); await page.keyboard.press("Enter"); await page.waitForTimeout(600); };
const toolBtn = (label: string) => page.locator(`button[aria-label="${label}"]`).first();
const viewBtn = (name: string) => page.getByRole("button", { name, exact: true });
/** Проект из хранилища браузера (комнаты пишутся с задержкой). */
const saved = async (): Promise<Project> => {
  await page.waitForTimeout(1500);
  const all = (await page.evaluate(() => Object.keys(localStorage).map((k) => [k, localStorage.getItem(k) ?? ""]))) as [string, string][];
  const found: [string, Project][] = []; const walk = (k: string, v: unknown, depth = 0) => { if (!v || typeof v !== "object" || depth > 6) return; const o = v as Record<string, unknown>; if (Array.isArray(o.modules) && o.room) { found.push([k, o as unknown as Project]); return; } for (const x of Object.values(o)) walk(k, x, depth + 1); };
  for (const [k, s] of all) { try { walk(k, JSON.parse(s)); } catch { /* не JSON */ } }
  const best = found.filter(([k]) => !k.endsWith(":previous") && !/undo|history/i.test(k)).sort((a, b) => b[1].modules.length - a[1].modules.length)[0];
  if (!best) throw Error("проект не сохранён"); return parseProject(JSON.parse(JSON.stringify(best[1])));
};
const warned = async () => (await page.locator("body").innerText()).includes("Есть пересечения деталей");
const cat = page.locator('details[data-settings-category="Наполнение"]').first(), fill = page.locator("details.property-section", { hasText: "Наполнение угла" }).first();
const body = page.locator('details[data-settings-category="Корпус и размещение"]').first(), geom = page.locator("details.property-section", { hasText: "Глубина боковин угла" }).first();
const open = async (d: Locator) => { if ((await d.getAttribute("open")) === null) { await d.locator("summary").first().click(); await page.waitForTimeout(300); } };
const openFill = async () => { await open(cat); await open(fill); };
async function block(name: string) { await openFill(); await click(fill.getByRole("button", { name })); await page.waitForTimeout(700); await openFill(); }
async function pull(name: string, j: number) { await block(name); const d = fill.locator("details.corner-drawer").nth(j); await open(d); await d.getByRole("button", { name: /Выдвинуть/ }).click(); await page.waitForTimeout(800); }
async function radialAt(x: number, y: number) { await page.mouse.click(x, y, { button: "right" }); await page.waitForTimeout(500); return (await page.locator(".radial-center b").first().innerText({ timeout: 800 }).catch(() => "")).trim(); }
const esc = async () => { for (let k = 0; k < 3; k++) { await page.keyboard.press("Escape"); await page.waitForTimeout(100); } };
const radialItem = (label: string) => page.locator(`.radial-menu button[aria-label^="${label}"]`).first();

await page.goto(url, { timeout: 90000 }); await page.waitForTimeout(3000);
// 1. палитра
const pal = page.locator("details.module-palette").first();
if ((await pal.getAttribute("open")) === null) await click(pal.locator("summary").first());
await click(pal.getByRole("tab", { name: "Шкафы распашные" }));
await click(pal.locator(".module-kinds button", { hasText: "Угловой" }).first());
await type(pal.locator('input[aria-label="Сторона угла новой мебели"]'), 1110);
await type(pal.locator('input[aria-label="Высота новой мебели"]'), 2000);
await type(pal.locator('input[aria-label="Глубина боковины новой мебели"]'), 600);
await click(pal.getByRole("button", { name: "Добавить в комнату" }));
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Понятно" }).click({ timeout: 1500 }).catch(() => {});
await toolBtn("Свернуть левую панель").click().catch(() => {});
await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click();
await shot("closed-solid");
expectNew("нет красной плашки «Есть пересечения деталей» у нового углового шкафа", !(await warned()));
// 2. прозрачный корпус
await toolBtn("Прозрачный корпус").click();
await viewBtn("Наполнение").first().click();
await shot("clear-3d");
await viewBtn("Сверху").click(); await shot("clear-top");
await viewBtn("3D").click();
// 3. ящики выдвигаются вдоль своего блока
await pull("Левый блок", 1); await shot("pull-left-3d");
await viewBtn("Сверху").click(); await shot("pull-left-top");
await viewBtn("3D").click();
await pull("Правый блок", 1); await shot("pull-right-3d");
await viewBtn("Сверху").click(); await shot("pull-right-top");
await viewBtn("3D").click();
// 4. скрытые направляющие правого блока
await block("Правый блок");
{ const d = fill.locator("details.corner-drawer").nth(1); await open(d); await d.locator('select[aria-label^="Направляющие углового ящика"]').selectOption({ value: "gtv0fpo" }); await page.waitForTimeout(800); }
await pull("Правый блок", 1); await viewBtn("Сверху").click(); await shot("hidden-slides-top");
await viewBtn("Спереди").click(); await shot("hidden-slides-front");
{ const p = await saved(), m = p.modules[0].module, c = partCollisions(parts(m), m); expectNew("скрытые направляющие: в модели нет пересечений", c.length === 0, c.slice(0, 3).map((x) => x.names.join(" × ") + " " + x.depth).join("; ")); }
expectNew("скрытые направляющие: нет красной плашки", !(await warned()));
await viewBtn("3D").click();
// 5. центр угла — запрет с причиной
await block("Центр");
{ const sel = fill.locator('select[aria-label="Количество ящиков угловой секции"]').first(); expectNew("центр: выбор ящиков серый", (await sel.count()) > 0 && (await sel.isDisabled().catch(() => false))); expectNew("центр: причина под выбором", (await fill.innerText()).includes("под 45°")); }
await shot("centre-panel");
await esc();
let opened = false;
/* место щелчка ищем перебором: сцена сдвигается вместе с шириной колонок (Макс 01.11) */ const box = (await page.locator("[data-testid=scene] canvas").first().boundingBox())!; for (let dy = 40; dy <= 260 && !opened; dy += 20) for (let dx = -60; dx <= 60 && !opened; dx += 20) { const t = await radialAt(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy); if (t && (await radialItem("Корпус").count()) && !/Ящик/.test(t)) { console.log("·    меню ПКМ в центре:", t); opened = true; break; } await esc(); }
check("центр: меню ПКМ открылось", opened);
if (opened) {
  for (const name of ["Корпус", "Добавить", "В секцию"]) { await radialItem(name).click(); await page.waitForTimeout(350); }
  const item = radialItem("Ящик"), lab = (await item.getAttribute("aria-label").catch(() => "")) ?? "";
  expectNew("центр: пункт «Ящик» серый", await item.isDisabled().catch(() => false), lab);
  expectNew("центр: в подсказке пункта причина", lab.includes("45°"));
  const ib = await item.boundingBox(); if (ib) { await page.mouse.move(ib.x + ib.width / 2, ib.y + ib.height / 2); await page.waitForTimeout(400); }
  expectNew("центр: на наведении причина видна в середине меню", (await page.locator(".radial-center").innerText().catch(() => "")).includes("45°"));
  expectNew("центр: пункт выглядит серым", Number(await item.evaluate((b) => getComputedStyle(b).opacity).catch(() => "1")) < .6);
  await shot("centre-menu");
  await esc();
}
// 6. ПКМ по фасаду ящика: ручка не обещает того, чего нет
{ let got = false; const box2 = (await page.locator("[data-testid=scene] canvas").first().boundingBox())!; for (let dy = 40; dy <= 280 && !got; dy += 15) for (let dx = -160; dx <= 160 && !got; dx += 20) { const t = await radialAt(box2.x + box2.width / 2 + dx, box2.y + box2.height / 2 + dy); if (/Ящик/.test(t)) { got = true; break; } await esc(); }
  check("фасад ящика: меню ПКМ открылось", got);
  if (got) { const h = radialItem("Ручка"), lab = (await h.getAttribute("aria-label").catch(() => "")) ?? ""; expectNew("фасад ящика: «Ручка» серая с причиной", (await h.isDisabled().catch(() => false)) && lab.includes("вкладной"), lab); await shot("drawer-menu"); await esc(); } }
// 7. габариты: всё заявленное строится
await page.getByRole("button", { name: /^Настройки «/ }).click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(500);
await open(body); await open(geom);
await type(geom.locator('input[aria-label="Глубина боковин угла"]'), 400);
{ const p = await saved(), c = p.modules[0].module.corner!; expectNew("боковина 400: принято, блок подстроен", c.sideDepth === 400 && c.bayDepth <= 374, `боковина ${c.sideDepth}, блок ${c.bayDepth}, направляющая ${c.slideLength}`); }
await viewBtn("3D").click(); await shot("side-400");
await open(body); await open(geom);
await type(geom.locator('input[aria-label="Глубина боковин угла"]'), 450);
await type(geom.locator('input[aria-label="Сторона угла"]'), 950);
{ const p = await saved(), m = p.modules[0].module; expectNew("сторона 950: принято", m.width === 950 && m.depth === 950, `сторона ${m.width}, блок ${m.corner!.bayDepth}`); expectNew("сторона 950: ошибок модели нет", validate(m).length === 0, validate(m).join("; ")); }
await shot("side-950");
// 8. поворот: ящик едет вместе с корпусом
await toolBtn("Повернуть корпус на 90° по часовой").click(); await page.waitForTimeout(900);
await pull("Левый блок", 0); await viewBtn("Сверху").click(); await shot("rotated-pull-top");
// 9. смета и детали — по сохранённому проекту
{ const p = await saved(), m = p.modules[0].module, e = estimate(p, nest(p)), slides = e.lines.filter((l) => l.id.startsWith("slide:")).reduce((a, l) => a + l.quantity, 0), want = m.sections.reduce((a, s) => a + s.drawers, 0), cut = details(p).filter((d) => d.id.includes(":drawer:") && d.material === "board").length;
  check("смета: комплект направляющих на ящик", slides === want, `${slides} компл. на ${want} ящиков`);
  check("детали: 6 деталей ЛДСП на ящик", cut === want * 6, `${cut} деталей`);
  check("проект без ошибок", validate(m).length === 0, validate(m).join("; ")); }
await page.getByRole("button", { name: "Детали", exact: true }).click().catch(() => {}); await shot("details");
check("без ошибок страницы", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const bad = results.filter((r) => !r[1]);
console.log(`итого: ${results.length - bad.length}/${results.length}`);
process.exit(bad.length ? 1 : 0);
