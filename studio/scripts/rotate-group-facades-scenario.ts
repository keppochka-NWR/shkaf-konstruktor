// Решение Макса 29.10.2026 мышью, как менеджер (своя сборка; проект для проверки читается из хранилища браузера):
// npx tsx scripts/rotate-group-facades-scenario.ts <url ?fresh=1> <outDir>
//  R. Поворот в обе стороны: кнопки «↺»/«↻» на панели сцены, R / Shift+R, круговое меню «Повернуть ↻/↺»; Ctrl+Z возвращает.
//  G. Групповые фасады: три шкафа Ctrl+щелчком → раздел «Фасады выделенных модулей · 3» → декор фасадов и ручки → у всех трёх;
//     «— разные —» до правки; одна отмена Ctrl+Z возвращает всех трёх; модуль без фасадов в группе — «не применено: причина».
import { chromium, type Locator } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { parseProject, bounds, type Project } from "../src/project";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
page.setDefaultTimeout(8000);
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => void d.accept());
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
let shotN = 0;
const shot = async (name: string) => { await page.waitForTimeout(700); await page.screenshot({ path: `${out}/${String(++shotN).padStart(2, "0")}-${name}.png` }); };
const click = async (l: Locator, opts: { modifiers?: ("Control" | "Shift")[] } = {}) => { await l.scrollIntoViewIfNeeded(); await l.click(opts); await page.waitForTimeout(400); };
const type = async (l: Locator, v: string | number) => { await l.scrollIntoViewIfNeeded(); await l.click({ clickCount: 3 }); await page.keyboard.press("Control+A"); await page.keyboard.type(String(v)); await page.keyboard.press("Enter"); await page.waitForTimeout(600); };
async function current(): Promise<Project> {
  await page.waitForTimeout(900);
  const raw = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith("garderyob-rooms-v1") && !x.includes(":previous") && !x.includes(":damaged")); return k ? localStorage.getItem(k) : null; });
  if (!raw) throw Error("документ комнат не сохранён");
  const d = JSON.parse(raw);
  const room = d.rooms.find((r: { id: string }) => r.id === d.activeRoomId) ?? d.rooms[0];
  return parseProject({ ...room.project, ...(d.calculation ? { calculation: d.calculation } : {}) }, true);
}
async function addFromPalette(kind: string, w: number, h: number, d: number) {
  const pal = page.locator("details.module-palette").first();
  if ((await pal.getAttribute("open")) === null) await click(pal.locator("summary").first());
  await click(pal.getByRole("tab", { name: "Шкафы распашные" }));
  await click(pal.locator(".module-kinds button", { hasText: kind }).first());
  await type(pal.locator('input[aria-label="Ширина новой мебели"]'), w);
  await type(pal.locator('input[aria-label="Высота новой мебели"]'), h);
  await type(pal.locator('input[aria-label="Глубина новой мебели"]'), d);
  await click(pal.getByRole("button", { name: "Добавить в комнату" }));
  await page.waitForTimeout(1200);
  const apart = page.getByRole("button", { name: /^Поставить отдельно/ });
  if (await apart.count() && await apart.first().isVisible()) { await click(apart.first()); await page.waitForTimeout(800); }
}
const item = (i: number) => page.locator(".module-list .module-item").nth(i);
const rot = (p: Project, id: string) => ((((p.modules.find((a) => a.id === id)?.rotation ?? 0) % 360) + 360) % 360);
const inside = (p: Project) => p.modules.every((a) => { const b = bounds(a); return b.x >= -0.5 && b.z >= -0.5 && b.x + b.w <= p.room.width + 0.5 && b.z + b.d <= p.room.depth + 0.5; });
/** Вид сверху кнопкой «Сверху» (Esc снял бы выделение группы). */
async function top() { await page.getByRole("button", { name: "Сверху", exact: true }).first().click().catch(() => {}); await page.mouse.move(5, 300); await page.waitForTimeout(1200); }
/** Центр корпуса id на экране (по проекции three.js нет доступа — щёлкаем по модулю в списке слева, а в сцене — по центру канвы). */

try {
  await page.goto(url); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("studio-tip-rmb", "1"); });
  await page.goto(url); await page.waitForSelector("canvas", { state: "attached", timeout: 90000 }); await page.waitForTimeout(2500);
  // три шкафа «Для одежды» разной ширины и открытый стеллаж — как менеджер, из палитры
  for (const w of [800, 900, 600]) await addFromPalette("Для одежды", w, 2100, 600);
  await addFromPalette("Стеллаж", 800, 2000, 400);
  let p = await current();
  console.log("модули:", p.modules.map((a) => `${a.module.name} ${a.module.width} doors=${a.module.doors}`).join(" | "));
  await shot("00-start");

  // ── R. поворот в обе стороны ──
  await click(item(0));
  const id0 = p.modules[0].id, r0 = rot(p, id0);
  await click(page.getByRole("button", { name: "Повернуть корпус на 90° по часовой" }));
  p = await current();
  check("R1 кнопка ↻ — по часовой (−90°)", rot(p, id0) === (r0 + 270) % 360 && inside(p), `${r0} → ${rot(p, id0)}`);
  await top(); await shot("R1-cw-top");
  await click(item(0));
  await click(page.getByRole("button", { name: "Повернуть корпус на 90° против часовой" }));
  await click(page.getByRole("button", { name: "Повернуть корпус на 90° против часовой" }));
  p = await current();
  check("R2 кнопка ↺ дважды — против часовой (+90° от начального)", rot(p, id0) === (r0 + 90) % 360 && inside(p), `→ ${rot(p, id0)}`);
  await top(); await shot("R2-ccw-top");
  await page.keyboard.press("Control+z"); p = await current();
  check("R3 Ctrl+Z — один шаг назад (поворот на исходный)", rot(p, id0) === r0, `→ ${rot(p, id0)}`);
  await click(item(0)); await page.mouse.move(5, 300);
  await page.keyboard.press("r"); p = await current();
  check("R4 клавиша R — по часовой", rot(p, id0) === (r0 + 270) % 360, `→ ${rot(p, id0)}`);
  await page.keyboard.press("Shift+R"); p = await current();
  check("R5 Shift+R — против часовой (вернулся)", rot(p, id0) === r0, `→ ${rot(p, id0)}`);
  // круговое меню по правой кнопке на модуле в списке слева
  await item(0).click({ button: "right" }); await page.waitForTimeout(500);
  const body = page.getByRole("menuitem", { name: /^Корпус/ }).first();
  if (await body.isVisible().catch(() => false)) await click(body);
  const ccwItem = page.getByRole("menuitem", { name: /^Повернуть ↺/ }).first(), cwItem = page.getByRole("menuitem", { name: /^Повернуть ↻/ }).first();
  check("R6 в круговом меню оба пункта: «Повернуть ↻» и «Повернуть ↺»", (await cwItem.isVisible().catch(() => false)) && (await ccwItem.isVisible().catch(() => false)));
  await shot("R6-radial-both");
  await click(ccwItem); p = await current();
  check("R7 «Повернуть ↺» в меню — против часовой", rot(p, id0) === (r0 + 90) % 360 && inside(p), `→ ${rot(p, id0)}`);
  await page.keyboard.press("Control+z"); p = await current();
  check("R8 Ctrl+Z — исходный поворот", rot(p, id0) === r0);

  // ── G. групповые фасады ──
  p = await current();
  const list = p.modules, wardrobes = list.slice(0, 3), shelf = list[3];
  // делаем у шкафов разный декор: второму — через окно «Материалы» (как менеджер), чтобы в группе было «— разные —»
  const idx = (id: string) => list.findIndex((a) => a.id === id);
  // одному шкафу — петли Blum по одному (круговое меню «Фасады › Петли › Blum»): в группе поле «Петли» будет «— разные —»
  await item(idx(wardrobes[1].id)).click({ button: "right" }); await page.waitForTimeout(500);
  await click(page.getByRole("menuitem", { name: /^Фасады/ }).first()); await click(page.getByRole("menuitem", { name: /^Петли/ }).first()); await click(page.getByRole("menuitem", { name: /Blum/i }).first());
  p = await current();
  check("G0 петли Blum у одного шкафа (по одному)", p.modules.find((x) => x.id === wardrobes[1].id)!.module.hingeBrand === "blum");
  await click(item(idx(wardrobes[0].id)));
  for (const a of wardrobes.slice(1)) await click(item(idx(a.id)), { modifiers: ["Control"] });
  await click(item(idx(wardrobes[0].id)), { modifiers: ["Control"] });
  await click(item(idx(shelf.id)), { modifiers: ["Control"] });
  const panel = page.getByTestId("group-facades");
  check("G1 Ctrl+щелчок по 3 шкафам и стеллажу — раздел «Фасады выделенных модулей · 4»", await panel.isVisible() && /· 4/.test(await panel.locator("summary").innerText()));
  const hingeSel = panel.locator('select[aria-label="Группа: Петли"]');
  const hingeShown = await hingeSel.evaluate((s) => (s as HTMLSelectElement).selectedOptions[0]?.textContent ?? "");
  check("G1b поле «Петли» у группы — «— разные —» (у одного Blum, у двух GTV)", /разные/.test(hingeShown), hingeShown);
  await panel.scrollIntoViewIfNeeded();
  await shot("G1-group-selected-before");
  const decorSel = panel.locator('select[aria-label="Группа: Декор фасадов ЛДСП"]'), handleSel = panel.locator('select[aria-label="Группа: Ручки распашных фасадов"]');
  const decorOpts = await decorSel.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  const before = await current(), decorBefore = wardrobes.map((a) => before.modules.find((x) => x.id === a.id)!.module.facadeDecor);
  const newDecor = decorOpts.find((v) => v && !v.startsWith("__") && !decorBefore.includes(v))!;
  await decorSel.scrollIntoViewIfNeeded(); await decorSel.selectOption(newDecor); await page.waitForTimeout(900);
  p = await current();
  const decorAfter = wardrobes.map((a) => p.modules.find((x) => x.id === a.id)!.module.facadeDecor);
  check("G2 декор фасадов — у всех трёх шкафов", decorAfter.every((d) => d === newDecor), decorAfter.join(", "));
  const note = await panel.getByTestId("group-facades-note").innerText().catch(() => "");
  check("G3 стеллаж без фасадов — «к 1 модулю не применено: нет фасадов»", /К 1 модулю не применено: нет фасадов/.test(note), note);
  check("G3b у стеллажа ничего не поменялось", JSON.stringify(p.modules.find((x) => x.id === shelf.id)!.module) === JSON.stringify(before.modules.find((x) => x.id === shelf.id)!.module));
  const handleOpts = await handleSel.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  const handleBefore = wardrobes.map((a) => p.modules.find((x) => x.id === a.id)!.module.handleId ?? "");
  const shown = await handleSel.inputValue(); // текущая общая ручка (умолчание — uz819-128)
  const newHandle = handleOpts.find((v) => v && !v.startsWith("__") && !v.startsWith("*") && v !== shown && !handleBefore.includes(v))!;
  await handleSel.scrollIntoViewIfNeeded(); await handleSel.selectOption(newHandle); await page.waitForTimeout(900);
  p = await current();
  const handleAfter = wardrobes.map((a) => p.modules.find((x) => x.id === a.id)!.module.handleId);
  check("G4 ручки распашных фасадов — у всех трёх шкафов", handleAfter.every((h) => h === newHandle), handleAfter.join(", "));
  await top(); await shot("G4-group-after-decor-handles");
  await page.keyboard.press("Control+z"); p = await current();
  const undoHandle = wardrobes.map((a) => p.modules.find((x) => x.id === a.id)!.module.handleId ?? "");
  check("G5 Ctrl+Z — ручки вернулись у всех трёх одним шагом", JSON.stringify(undoHandle) === JSON.stringify(handleBefore), undoHandle.join(", "));
  await page.keyboard.press("Control+z"); p = await current();
  const undoDecor = wardrobes.map((a) => p.modules.find((x) => x.id === a.id)!.module.facadeDecor);
  check("G6 ещё Ctrl+Z — декор вернулся у всех трёх одним шагом", JSON.stringify(undoDecor) === JSON.stringify(decorBefore), undoDecor.join(", "));
  // «разные»: у одного шкафа другие петли → поле петель показывает «— разные —»
  await panel.locator('select[aria-label="Группа: Петли"]').selectOption("blum"); await page.waitForTimeout(700);
  p = await current();
  check("G7 петли Blum — у трёх шкафов", wardrobes.every((a) => p.modules.find((x) => x.id === a.id)!.module.hingeBrand === "blum"));
  await shot("G7-group-hinges-blum");
  // круговое меню группы — правой кнопкой по модулю из отмеченных
  await item(idx(wardrobes[1].id)).click({ button: "right" }); await page.waitForTimeout(500);
  const groupMenu = page.getByRole("menuitem", { name: /^Фасады выделенных/ }).first();
  check("G8 круговое меню на модуле из группы — пункт «Фасады выделенных · 4»", await groupMenu.isVisible().catch(() => false));
  await shot("G8-radial-group");
  await click(groupMenu);
  await click(page.getByRole("menuitem", { name: /^Петли/ }).first());
  await click(page.getByRole("menuitem", { name: /GTV/i }).first());
  p = await current();
  check("G9 круговое меню группы: петли GTV — у трёх шкафов разом", wardrobes.every((a) => (p.modules.find((x) => x.id === a.id)!.module.hingeBrand ?? "gtv") === "gtv"));
  await shot("G9-after-radial-hinges");
  // поворот группы: оставить в группе два шкафа (Ctrl+щелчок снимает), R — оба по часовой, Ctrl+Z — оба назад
  await page.keyboard.press("Escape").catch(() => {}); // закрыть меню, если открыто
  p = await current();
  if (!(await page.getByTestId("group-facades").isVisible().catch(() => false))) { await click(item(idx(wardrobes[0].id))); for (const a of [wardrobes[0], wardrobes[1]]) await click(item(idx(a.id)), { modifiers: ["Control"] }); }
  else { await click(item(idx(wardrobes[2].id)), { modifiers: ["Control"] }); await click(item(idx(shelf.id)), { modifiers: ["Control"] }); }
  const g2 = [wardrobes[0].id, wardrobes[1].id], rb = g2.map((id) => rot(p, id));
  await page.mouse.move(5, 300); await page.keyboard.press("r"); p = await current();
  check("G10 R на группе из 2 — оба шкафа по часовой, в комнате", g2.every((id, i) => rot(p, id) === (rb[i] + 270) % 360) && inside(p), g2.map((id) => rot(p, id)).join(","));
  await top(); await shot("G10-group-rotated-cw");
  await page.keyboard.press("Shift+R"); p = await current();
  check("G11 Shift+R — группа против часовой (вернулась)", g2.every((id, i) => rot(p, id) === rb[i]), g2.map((id) => rot(p, id)).join(","));

  // ── M. «Как быстро понять высоту левого модуля и сделать правый такой же» (Макс 29.10) ──
  await click(page.getByRole("button", { name: "Снять выделение" }).first());
  // как у Макса: слева колонна из модулей стопкой 2500 (шкаф 600 высотой 1900 + «Антресоль сверху» 600), справа — открытый стеллаж 2000
  await click(item(idx(wardrobes[2].id)));
  const cat = page.locator('details[data-settings-category="Корпус и размещение"]').first();
  if ((await cat.getAttribute("open")) === null) await click(cat.locator("summary").first());
  const dims = cat.locator('details[data-setting="Габариты"]').first();
  if (await dims.count() && (await dims.getAttribute("open")) === null) await click(dims.locator("summary").first());
  await type(cat.locator('input[aria-label="Высота"]').first(), 1900);
  await click(page.getByRole("button", { name: /Антресоль сверху/ }).first());
  p = await current();
  const antr = p.modules[p.modules.length - 1];
  check("M0 слева колонна: шкаф 1900 + антресоль сверху = 2500", p.modules.find((x) => x.id === wardrobes[2].id)!.module.height === 1900 && Math.abs((antr.y ?? 0) + antr.module.height - 2500) < 0.5, `антресоль ${antr.module.height} на ${antr.y}`);
  // (c) у выбранного стеллажа на виде спереди видна общая высота, даже при подписях проёмов полок
  await click(item(idx(shelf.id)));
  await page.getByRole("button", { name: "Спереди", exact: true }).first().click(); await page.mouse.move(5, 300); await page.waitForTimeout(1500);
  const hDim = page.locator('.model-dimension[data-dim="height"]').first();
  const hVisible = await hDim.evaluate((e) => getComputedStyle(e).visibility !== "hidden" && getComputedStyle(e).display !== "none").catch(() => false);
  const gapsShown = await page.locator(".model-dimension.gap-dimension:not(.row-gap)").evaluateAll((es) => es.filter((e) => getComputedStyle(e).display !== "none" && getComputedStyle(e).visibility !== "hidden").length);
  check("M1 вид спереди: у стеллажа видна общая высота «2000 мм» (и ширина) вместе с проёмами полок", hVisible && /^2000 мм$/.test((await hDim.innerText()).trim()) && await page.locator('.model-dimension[data-dim="width"]').first().isVisible(), `проёмов подписано: ${gapsShown}`);
  const colDim = page.locator('.model-dimension[data-dim="column"]').first();
  check("M1b у соседней колонны (стопка) — общая высота «колонна 2500 мм»", (await colDim.count()) > 0 && /колонна 2500 мм/.test(await colDim.innerText()) && await colDim.evaluate((e) => getComputedStyle(e).visibility !== "hidden" && getComputedStyle(e).display !== "none"));
  await shot("M1-front-overall-height");
  // (a) ПКМ по стеллажу › Размеры › «Высота как у соседа слева (2500)»
  await item(idx(shelf.id)).click({ button: "right" }); await page.waitForTimeout(500);
  await click(page.getByRole("menuitem", { name: /^Размеры/ }).first());
  const asLeft = page.getByRole("menuitem", { name: /^Высота как у соседа слева \(2500\)/ }).first(), asRight = page.getByRole("menuitem", { name: /^Высота как у соседа справа/ }).first();
  check("M2 в меню «Высота как у соседа слева (2500)»; справа соседа нет — пункт недоступен", await asLeft.isVisible() && await asRight.isDisabled().catch(() => false));
  await shot("M2-radial-height-as-left");
  await click(asLeft); p = await current();
  const sh = p.modules.find((x) => x.id === shelf.id)!;
  check("M3 стеллаж стал 2500, стоит на полу, ширина та же", sh.module.height === 2500 && (sh.y ?? 0) === 0 && sh.module.width === 800 && inside(p), `${sh.module.width}×${sh.module.height}, y ${sh.y ?? 0}`);
  await page.mouse.move(5, 300); await shot("M3-shelf-2500");
  await page.keyboard.press("Control+z"); p = await current();
  check("M4 Ctrl+Z — стеллаж снова 2000", p.modules.find((x) => x.id === shelf.id)!.module.height === 2000);
  // (b) мультивыбор: «Выровнять высоту по «шкаф» (2500)» — всем отмеченным одним шагом
  await click(item(idx(wardrobes[2].id)));
  for (const a of [wardrobes[2], wardrobes[0], wardrobes[1], shelf]) await click(item(idx(a.id)), { modifiers: ["Control"] });
  await item(idx(wardrobes[2].id)).click({ button: "right" }); await page.waitForTimeout(500);
  await click(page.getByRole("menuitem", { name: /^Выровнять отмеченные · 4/ }).first());
  await shot("M5-radial-align-group");
  await click(page.getByRole("menuitem", { name: /^Выровнять высоту по .*колонна \(2500\)/ }).first()); p = await current();
  const hs4 = [wardrobes[0], wardrobes[1], wardrobes[2], shelf].map((a) => p.modules.find((x) => x.id === a.id)!.module.height);
  check("M5 «Выровнять высоту по … · колонна (2500)» — остальные отмеченные 2500, шкаф колонны 1900 не тронут", hs4.join(",") === "2500,2500,1900,2500" && inside(p), hs4.join(","));
  await page.mouse.move(5, 300); await shot("M5-group-2500");
  await page.keyboard.press("Control+z"); p = await current();
  const back4 = [wardrobes[0], wardrobes[1], wardrobes[2], shelf].map((a) => p.modules.find((x) => x.id === a.id)!.module.height);
  check("M6 одна отмена Ctrl+Z — высоты вернулись у всех (2100, 2100, 1900, 2000)", back4.join(",") === "2100,2100,1900,2000", back4.join(","));
} catch (e) {
  check("сценарий выполнен без исключений", false, (e as Error).message.slice(0, 300));
  await shot("zz-exception").catch(() => {});
}
check("ошибок страницы нет", errors.length === 0, errors.slice(0, 3).join(" | "));
writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 1));
const failed = results.filter((r) => !r[1]).length;
console.log(`итого: ${results.length - failed}/${results.length}`);
await browser.close();
process.exit(failed ? 1 : 0);
