// Правки Макса 01.11 мышью, как менеджер: npx tsx scripts/facade-rows-0111-scenario.ts <url /studio/?fresh=1> <outDir>
// 1) шкаф 600×2400 → «Разделить фасады по высоте» → «Рядов фасадов» 3 → высота среднего ряда → кнопки «Дверь N · ряд K» → дверь верхнего ряда: своя ручка →
// открыть фасады (снимок) → Ctrl+Z одним шагом на правку; 2) шкаф 800×2000 с двумя ящиками за дверью → в настройках ящика «Фасад ящика вровень с распашными
// фасадами» → снимок сбоку: лицо фасада и лицо двери в одной плоскости → вид спереди → ящик выдвинут → Ctrl+Z; 3) два ряда у соседней секции и ящики вровень.
import { chromium, type Locator } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { parts, facadeBottom, facadeTop, type Module, type Part } from "../src/model";
import { parseProject, type Project } from "../src/project";
import { estimate } from "../src/pricing";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.setDefaultTimeout(30000); // программный WebGL: клик ждёт кадр сцены
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
let shotN = 0;
const shot = async (name: string) => { await page.waitForTimeout(900); await page.screenshot({ path: `${out}/${String(++shotN).padStart(2, "0")}-${name}.png` }); };
const click = async (l: Locator) => { await l.scrollIntoViewIfNeeded(); await l.click(); await page.waitForTimeout(300); };
const type = async (l: Locator, v: string | number) => { await l.scrollIntoViewIfNeeded(); await l.click({ clickCount: 3 }); await page.keyboard.press("Control+A"); await page.keyboard.type(String(v)); await page.keyboard.press("Enter"); await page.waitForTimeout(500); };
const field = (label: string) => page.locator(`input[aria-label="${label}"]`).first();
async function openCat(cat: string) { const d = page.locator(`details[data-settings-category="${cat}"]`).first(); if (!(await d.count())) throw Error("нет категории " + cat); if ((await d.getAttribute("open")) === null) await click(d.locator("summary").first()); }
async function openSet(cat: string, title: string) { await openCat(cat); const d = page.locator(`details[data-setting="${title}"]`).first(); if ((await d.getAttribute("open")) === null) await click(d.locator("summary").first()); }
let lastRaw = "";
const snapshot = () => page.evaluate(() => Object.keys(localStorage).sort().map((key) => localStorage.getItem(key) ?? "").join("\u0001")) as Promise<string>;
const saved = async (): Promise<Project> => { for (let k = 0; k < 24; k++) { await page.waitForTimeout(250); const raw = await snapshot(); if (raw !== lastRaw) { await page.waitForTimeout(300); lastRaw = await snapshot(); break; } }
  const all = (await page.evaluate(() => Object.keys(localStorage).map((k) => [k, localStorage.getItem(k) ?? ""]))) as [string, string][];
  const found: [string, Project][] = []; const walk = (k: string, v: unknown, depth = 0) => { if (!v || typeof v !== "object" || depth > 6) return; const o = v as Record<string, unknown>; if (Array.isArray(o.modules) && o.room) { found.push([k, o as unknown as Project]); return; } for (const x of Object.values(o)) walk(k, x, depth + 1); };
  for (const [k, s] of all) { try { const doc = JSON.parse(s), n0 = found.length; walk(k, doc); if (doc?.calculation) for (const f of found.slice(n0)) if (!f[1].calculation) f[1] = { ...f[1], calculation: doc.calculation }; } catch { /* не JSON */ } }
  const best = found.filter(([k]) => !k.endsWith(":previous") && !/undo|history/i.test(k)).sort((a, b) => b[1].modules.length - a[1].modules.length)[0];
  if (!best) throw Error("проект не сохранён"); return parseProject(JSON.parse(JSON.stringify(best[1]))); };
const doors = (m: Module) => parts(m).filter((p) => p.role === "door" && /:door:\d+$/.test(p.id)).sort((a, b) => a.position[1] - b.position[1]);
const fronts = (m: Module) => parts(m).filter((p) => /:drawer:\d+:facade$/.test(p.id)).sort((a, b) => a.position[1] - b.position[1]);
const lo = (p: Part) => p.position[1] - p.size[1] / 2, hi = (p: Part) => p.position[1] + p.size[1] / 2, faceZ = (p: Part) => p.position[2] + p.size[2] / 2;
async function addFromPalette(kind: string, w: number, h: number, d: number) {
  const pal = page.locator("details.module-palette").first();
  if ((await pal.getAttribute("open")) === null) await click(pal.locator("summary").first());
  await click(pal.getByRole("tab", { name: "Шкафы распашные" }));
  await click(pal.locator(".module-kinds button", { hasText: kind }).first());
  await type(pal.locator('input[aria-label="Ширина новой мебели"]'), w);
  await type(pal.locator('input[aria-label="Высота новой мебели"]'), h);
  await type(pal.locator('input[aria-label="Глубина новой мебели"]'), d);
  await click(pal.getByRole("button", { name: "Добавить в комнату" }));
  await page.waitForTimeout(1000);
}
async function zoomOn() { const z = page.getByRole("button", { name: "Приблизить выбранный корпус" }); if ((await z.getAttribute("aria-pressed").catch(() => "true")) !== "true") await z.click().catch(() => {}); }
/** Чистый вид для снимка: без открытых створок, выбранный корпус, вид и приближение. */
let viewName = /600 × 2400/;
async function view(mode: "Спереди" | "Справа" | "3D", openDoors = false) {
  // Esc снимает выбор детали (режим наполнения держит 3D), затем корпус снова выбирается в списке слева: иначе вид сбоку не включится
  for (let k = 0; k < 3; k++) { await page.keyboard.press("Escape"); await page.waitForTimeout(120); }
  await page.locator("button, [role=button], li").filter({ hasText: viewName }).first().click().catch(() => {}); await page.waitForTimeout(300);
  const d = page.locator('button[aria-label="Открыть фасады"]').first();
  if (((await d.getAttribute("aria-pressed").catch(() => null)) === "true") !== openDoors) await d.click().catch(() => {});
  await page.getByRole("button", { name: mode, exact: true }).click();
  check("вид включился: " + mode, (await page.locator('.view-button[aria-pressed="true"]').getAttribute("aria-label")) === mode);
  await zoomOn(); await page.waitForTimeout(1300);
}
async function openFacades() {
  await page.getByRole("button", { name: /Построение мебели/ }).first().click().catch(() => {}); await page.waitForTimeout(300);
  await openSet("Фасады и открывание", "Фасад");
  const d = page.locator("details.section-facades").first(); if ((await d.getAttribute("open")) === null) await click(d.locator("summary").first());
}
/** Снимок сбоку крупно: передний край корпуса у ящиков — видно, где лицо фасада относительно лица двери. */
const closeUp = async (name: string) => { await page.mouse.move(620, 500); for (let k = 0; k < 3; k++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(120); } await shot(name); };
const undo = async () => { await page.locator("canvas").first().hover().catch(() => {}); await page.keyboard.press("Control+Z"); await page.waitForTimeout(700); };
try {
  await page.goto(url, { timeout: 120000 }); await page.waitForSelector("canvas", { timeout: 60000 }); await page.waitForTimeout(3000);
  await page.evaluate(() => localStorage.setItem("studio-tip-rmb", "1"));
  // ── 1. Ряды у обычного шкафа ──
  await addFromPalette("Для одежды", 600, 2400, 600);
  let p = await saved(), m = p.modules[0].module;
  const price0 = estimate(p).retail;
  await openFacades(); await shot("rows-panel-closed");
  await click(page.getByText("Разделить фасады по высоте", { exact: true }));
  p = await saved(); m = p.modules[0].module;
  check("«Разделить фасады»: 2 ряда", doors(m).length === 2, doors(m).map((d) => Math.round(d.size[1])).join("/"));
  const rows = page.locator('select[aria-label="Рядов фасадов"]');
  check("список «Рядов фасадов» виден у шкафа: 2, 3, 4, 5", (await rows.count()) === 1 && (await rows.locator("option").allInnerTexts()).map((x) => x.trim()[0]).join("") === "2345");
  await rows.selectOption("3");  await page.waitForTimeout(500);
  p = await saved(); m = p.modules[0].module;
  const r3 = doors(m);
  check("3 ряда поровну, низ и верх как у фасадов", r3.length === 3 && Math.abs(lo(r3[0]) - facadeBottom(m)) < 0.1 && Math.abs(hi(r3[2]) - facadeTop(m)) < 0.1 && Math.max(...r3.map((d) => d.size[1])) - Math.min(...r3.map((d) => d.size[1])) <= 2.5, r3.map((d) => Math.round(d.size[1])).join("/"));
  const hingesOn = (d: Part) => parts(m).filter((x) => x.id.startsWith(d.id.replace(":door:", ":hingecup:") + ":"));
  check("петли на каждом ряду и в пределах двери", r3.every((d) => hingesOn(d).length >= 2 && hingesOn(d).every((h) => h.position[1] > lo(d) && h.position[1] < hi(d))), r3.map((d) => hingesOn(d).length).join("/"));
  await type(field("Высота фасада 2-го ряда"), 500);
  p = await saved(); m = p.modules[0].module;
  check("высота среднего ряда 500, верхний — остаток", doors(m)[1].size[1] === 500 && (await page.locator('[data-testid="door-rows-top"]').innerText()).includes(String(Math.round(doors(m)[2].size[1]))), doors(m).map((d) => Math.round(d.size[1])).join("/"));
  const pick = page.locator(".facade-pick-list button");
  check("кнопки дверей по рядам", (await pick.count()) === 3 && (await pick.nth(2).innerText()).includes("ряд 3"), (await pick.allInnerTexts()).join(" | "));
  await click(pick.nth(2));
  check("кнопка выбирает дверь верхнего ряда", (await pick.nth(2).getAttribute("aria-pressed")) === "true");
  await shot("rows-door-selected");
  await page.keyboard.press("Escape");
  await view("Спереди"); await shot("rows-3-front");
  await view("3D", true); await shot("rows-3-open");
  await view("3D", false);
  check("цена выросла на петли и ручки рядов", estimate(await saved()).retail >= price0);
  // по одному шагу отмены на правку
  await undo(); p = await saved(); m = p.modules[0].module;
  check("Ctrl+Z: высота ряда вернулась одним шагом", doors(m).length === 3 && Math.abs(doors(m)[1].size[1] - r3[1].size[1]) < 0.1, doors(m).map((d) => Math.round(d.size[1])).join("/"));
  await undo(); p = await saved(); m = p.modules[0].module;
  check("Ctrl+Z: снова 2 ряда", doors(m).length === 2);
  await undo(); p = await saved(); m = p.modules[0].module;
  check("Ctrl+Z: снова цельная дверь", doors(m).length === 1 && m.sections[0].doorSplit === undefined);

  // ── 2. Вровень ──
  await addFromPalette("Для одежды", 800, 2000, 600); viewName = /800 × 2000/;
  await page.getByRole("button", { name: /Построение мебели/ }).first().click().catch(() => {});
  await openSet("Наполнение", "Ящики");
  await click(page.getByRole("button", { name: "Добавить: Ящики", exact: true })); await click(page.getByRole("button", { name: "Добавить: Ящики", exact: true }));
  p = await saved(); m = p.modules[1].module;
  const door0 = doors(m)[0];
  check("ящики за дверью: лицо фасада глубже лица двери", fronts(m).every((f) => faceZ(f) < faceZ(door0) - 10), `${faceZ(fronts(m)[0])} / ${faceZ(door0)}`);
  await view("Справа"); await closeUp("flush-before-side");
  const flush = page.locator('.drawer-selection input[aria-label="Фасад ящика вровень с распашными фасадами"]').first();
  await openSet("Наполнение", "Ящики");
  await page.getByRole("button", { name: /Построение мебели/ }).first().click().catch(() => {}); await openSet("Наполнение", "Ящики"); await page.locator(".drawer-tabs button").first().click(); await page.waitForTimeout(300);
  check("галочка «вровень» в настройках ящика", await flush.isVisible());
  await flush.scrollIntoViewIfNeeded(); await shot("flush-panel"); await flush.check(); await page.waitForTimeout(500);
  p = await saved(); m = p.modules[1].module;
  const ds = doors(m), fs = fronts(m);
  check("лицо фасадов ящиков = лицо двери", fs.length === 2 && fs.every((f) => Math.abs(faceZ(f) - faceZ(ds[0])) < 0.01), `${faceZ(fs[0])} = ${faceZ(ds[0])}`);
  check("дверь над ящиками через зазор 2 мм", Math.abs(lo(ds[0]) - hi(fs[1]) - 2) < 0.1);
  check("нижний фасад — по низу фасадов", Math.abs(lo(fs[0]) - facadeBottom(m)) < 0.1);
  const xs = ds.flatMap((d) => [d.position[0] - d.size[0] / 2, d.position[0] + d.size[0] / 2]); check("ширина фасада = ширина дверей секции", Math.abs(fs[0].size[0] - (Math.max(...xs) - Math.min(...xs))) < 0.1, `${fs[0].size[0]}`);
  check("галочка отмечена", await flush.isChecked());
  // снимок сбоку доказывает плоскость: дверь и ящики — одна линия
  await page.keyboard.press("Escape");
  await view("Справа"); await closeUp("flush-after-side");
  await view("Спереди"); await shot("flush-after-front");
  await view("3D"); await shot("flush-after-3d");
  await openSet("Наполнение", "Ящики");
  await click(page.locator(".drawer-tabs button").first());
  await click(page.getByRole("button", { name: "Выдвинуть для просмотра" })); await page.waitForTimeout(1000); await shot("flush-drawer-out");
  await click(page.getByRole("button", { name: "Задвинуть ящик" }));
  // тот же признак в «Фасадах секции» — один и тот же
  await openFacades();
  const secFlush = page.locator('details.section-facades input[aria-label="Фасад ящика вровень с распашными фасадами"]');
  check("галочка секции показывает то же", await secFlush.isChecked());
  await undo(); p = await saved(); m = p.modules[1].module;
  check("Ctrl+Z: один шаг — снова за дверью", !m.sections[0].externalDrawers && fronts(m).every((f) => faceZ(f) < faceZ(doors(m)[0]) - 10));
  await secFlush.check(); await page.waitForTimeout(500); p = await saved(); m = p.modules[1].module;
  check("галочка секции — то же действие", !!m.sections[0].externalDrawers && fronts(m).every((f) => Math.abs(faceZ(f) - faceZ(doors(m)[0])) < 0.01));
  // в ту же секцию ряды над ящиками: первый ряд — над ящиками
  await click(page.getByText("Разделить фасады по высоте", { exact: true }));
  await page.locator('select[aria-label="Рядов фасадов"]').selectOption("3"); await page.waitForTimeout(500);
  p = await saved(); m = p.modules[1].module;
  check("ряды над ящиками вровень: 3 ряда по 2 створки, верх до верха фасадов", doors(m).length === 6 && Math.abs(hi(doors(m)[5]) - facadeTop(m)) < 0.1 && Math.abs(lo(doors(m)[0]) - hi(fronts(m).at(-1)!) - 2) < 0.1, doors(m).map((d) => Math.round(d.size[1])).join("/"));
  await page.keyboard.press("Escape"); await view("Спереди"); await shot("flush-with-rows-front");
  await view("Справа"); await shot("flush-with-rows-side");
  // ── 3. Ответы Макса 01.11: ряд от 200 мм; верх ящиков по ряду соседней секции ──
  await addFromPalette("Для одежды", 600, 900, 600); viewName = /600 × 900/;
  await openFacades();
  await click(page.getByText("Разделить фасады по высоте", { exact: true }));
  const low = page.locator('select[aria-label="Рядов фасадов"]');
  const opts = (await low.locator("option").allInnerTexts()).map((x) => x.trim());
  check("при высоте 900: 4 ряда можно, 5 — отключено с причиной про 200 мм", !(await low.locator('option[value="4"]').evaluate((e) => (e as HTMLOptionElement).disabled)) && (await low.locator('option[value="5"]').evaluate((e) => (e as HTMLOptionElement).disabled)) && /ниже 200 мм/.test(opts.at(-1)!), opts.join(" | "));
  await low.selectOption("4"); await page.waitForTimeout(500);
  p = await saved(); m = p.modules[2].module;
  check("4 ряда по 200+ мм, на каждом 2 петли", doors(m).length === 4 && doors(m).every((d) => d.size[1] >= 200 && parts(m).filter((x) => x.id.startsWith(d.id.replace(":door:", ":hingecup:") + ":")).length === 2), doors(m).map((d) => Math.round(d.size[1])).join("/"));
  await view("Спереди"); await shot("rows-4-at-900-front");
  // шкаф в 2 секции: справа ряды, слева ящики вровень
  await addFromPalette("Пустой шкаф", 1000, 2400, 600); viewName = /1000 × 2400/;
  await page.getByRole("button", { name: /Построение мебели/ }).first().click().catch(() => {}); await page.waitForTimeout(300);
  await openSet("Наполнение", "Секция");
  await click(page.getByRole("button", { name: "Разделить пополам" }));
  const pickSec = async (i: number) => { await page.locator('select[aria-label="Выбранная секция"]').selectOption({ index: i }); await page.waitForTimeout(400); };
  await pickSec(1); await openFacades();
  await click(page.getByText("Разделить фасады по высоте", { exact: true }));
  await type(field("Высота нижнего ряда фасадов"), 600);
  await pickSec(0); await openSet("Наполнение", "Ящики");
  await click(page.getByRole("button", { name: "Добавить: Ящики", exact: true })); await click(page.getByRole("button", { name: "Добавить: Ящики", exact: true }));
  await page.locator(".drawer-tabs button").first().click(); await page.waitForTimeout(300);
  await page.locator('.drawer-selection input[aria-label="Фасад ящика вровень с распашными фасадами"]').first().check(); await page.waitForTimeout(600);
  p = await saved(); m = p.modules[3].module;
  const sid0 = m.sections[0].id, sid1 = m.sections[1].id;
  const pair = (x: Module) => { const a = doors(x).filter((d) => d.sectionId === sid0)[0], bs = doors(x).filter((d) => d.sectionId === sid1); return { a, near: bs.sort((u, v) => Math.abs(lo(u) - lo(a)) - Math.abs(lo(v) - lo(a)))[0] }; };
  let q0 = pair(m);
  check("дверь над ящиками встала на низ ряда соседа", Math.abs(lo(q0.a) - lo(q0.near)) < 0.4, `${lo(q0.a)} / ${lo(q0.near)}`);
  const toRow = page.locator('.drawer-selection input[aria-label="Верх ящиков по ряду соседней секции"]').first();
  check("галочка «Верх ящиков по ряду соседней секции» стоит", await toRow.isChecked());
  await page.keyboard.press("Escape"); await view("Спереди"); await shot("flush-on-neighbour-row-front");
  // сосед меняет нижний ряд — ящики идут за ним; Ctrl+Z — один шаг
  await pickSec(1); await openFacades(); await type(field("Высота нижнего ряда фасадов"), 800);
  p = await saved(); m = p.modules[3].module; q0 = pair(m);
  check("сосед 800: ящики пошли за рядом", m.sections[1].doorSplit === 800 && Math.abs(lo(q0.a) - lo(q0.near)) < 0.4, `${lo(q0.a)} / ${lo(q0.near)}`);
  await page.keyboard.press("Escape"); await view("Спереди"); await shot("flush-follows-neighbour-front");
  await undo(); p = await saved(); m = p.modules[3].module; q0 = pair(m);
  check("Ctrl+Z одним шагом: и ряд соседа, и ящики вернулись", m.sections[1].doorSplit === 600 && Math.abs(lo(q0.a) - lo(q0.near)) < 0.4, `${m.sections[1].doorSplit}`);
  check("ошибок страницы нет", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (e) { check("сценарий дошёл до конца", false, (e as Error).message); await shot("error"); }
writeFileSync(`${out}/result.json`, JSON.stringify(results, null, 1));
await browser.close();
const bad = results.filter((r) => !r[1]).length;
console.log(bad ? `ПРОВАЛОВ: ${bad}` : "сценарий: всё OK");
process.exit(bad ? 1 : 0);
