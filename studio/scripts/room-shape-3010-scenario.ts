// Форма комнаты (задача Макса 30.10.2026: «не все помещения ровные — 5-угольные, со скосом, со скруглениями; редактировать
// комнату свободнее», как в Базисе) мышью и клавиатурой, как менеджер:
//   npx tsx scripts/room-shape-3010-scenario.ts <url> [outDir=.qa/roomedit]
// Помещение 4000 × 3000 × 2700, «Шкаф» 600 у задней стены (x = 1000).
//  1. «План» → панель «Форма комнаты» → заготовка «Скошенный угол» — скошен задний правый угол (750), план в режиме формы.
//  2. Тянем угол 4 (передний правый) влево-вверх и набираем «200;100» + Enter — угол ровно на (3800; 2900).
//  3. Двойной щелчок по задней стене у x = 2200 — новая точка (шаг 10 мм).
//  4. Правая кнопка по передней стене → «Дуга…» → стрела 300 наружу.
//  5. Правая кнопка по углу 1 (задний левый) → «Скос угла…» → «400» + Enter.
//  6. Середину левой стены тянем влево и набираем «200» + Enter — стена ушла на 200, «Шкаф» стоит на месте (x 1000 → 1200 от новой стены).
//  7. Таблица стен: длина стены 3 → 1200 + Enter (следующая стена — параллельно).
//  8. Этап «Окна и двери»: «+ Окно», стена проёма — косая правая стена (Стена 5): окно на ней, вдоль неё.
//  9. Ctrl+Z ×3 — окно убрано, длина стены 3 прежняя; контур = расчёт тех же правок функциями roomOutline (числа сверяются).
// 10. Отказ: заднюю стену за шкафом (стена 2) внутрь на «300» — «Корпус «Шкаф» оказывается вне комнаты», контур не изменился.
// Критик 30.10 (редактор): 9б — одна отмена сразу (без задержки сброса истории); 9в/9г — клавиши в меню угла и во время тяги не уходят
// в редактор (Delete, W); 9д — точка посреди окна — отказ «Окно 1 на месте точки»; 11 — Esc выходит из режима формы;
// 12 — на «Построении мебели» план без ручек формы, с ручками угла корпуса; 1 — ручка середины стены не меньше 14 × 14 px.
import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";
import { initialModule } from "../src/model";
import { newProject, type Project, type Room } from "../src/project";
import { outlinePreset, moveVertex, insertVertex, setBulge, chamferCorner, moveEdge, setWallLength, edgeLength, insertEdgeMap, cornerEdgeMap, moveEdgeMap, sameEdges, type RoomOutline, type EdgeMap } from "../src/roomOutline";
import { shapeEdit } from "../src/roomShape";

const [url = "http://127.0.0.1:8481/", out = ".qa/roomedit"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page: Page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(8000);
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
let shotN = 0;
const shot = async (name: string) => { await page.waitForTimeout(500); await page.screenshot({ path: `${out}/${String(++shotN).padStart(2, "0")}-${name}.png`, timeout: 60000 }); };
const room = async (): Promise<Room> => (await page.evaluate("window.__room && window.__room()")) as Room;
const arrangement = async () => (await page.evaluate("window.__arrangement && window.__arrangement()")) as { id: string; x: number; z: number }[];
/** Точка помещения (мм) → экран. */
const scr = (x: number, z: number) => page.evaluate(([x, z]) => { const s = document.querySelector(".room-plan svg") as SVGSVGElement, m = s.getScreenCTM()!, p = new DOMPoint(x, z).matrixTransform(m); return { x: p.x, y: p.y }; }, [x, z] as const);
const center = async (sel: string) => { const b = (await page.locator(sel).first().boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const pts = (o?: RoomOutline) => JSON.stringify((o ?? []).map((q) => [q.x, q.z, q.bulge ?? 0]));
const near = (a: RoomOutline | undefined, b: RoomOutline | undefined, tol = 0.6) => !!a && !!b && a.length === b.length && a.every((q, i) => Math.abs(q.x - b[i].x) <= tol && Math.abs(q.z - b[i].z) <= tol && Math.abs((q.bulge ?? 0) - (b[i].bulge ?? 0)) <= tol);
async function typeKeys(text: string) { for (const ch of text) { await page.keyboard.press(ch === ";" ? "Semicolon" : ch === "-" ? "Minus" : ch); await page.waitForTimeout(40); } }
async function blur() { await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.()); }

// модель тех же правок — для сверки чисел (то, что делает мышь, повторяют функции roomOutline)
let model: Project = (() => { const p = newProject(); p.room = { ...p.room, width: 4000, depth: 3000, height: 2700, openings: [] }; p.modules = [{ id: "a", x: 1000, y: 0, z: 3, rotation: 0, module: { ...initialModule(), name: "Шкаф", width: 600, height: 2000, depth: 550 } }]; return p; })();
const step = (raw: (o: RoomOutline) => RoomOutline, map?: (n: number) => EdgeMap) => { const o = model.room.outline!, r = shapeEdit(model, raw(o), map?.(o.length)); if (r.problem) throw Error("модель: " + r.problem); model = r.project; };

await page.goto(url, { timeout: 60000 });
await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "room"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(model));
await page.goto(url, { timeout: 60000 });
await page.waitForSelector("canvas", { timeout: 60000 }); await page.waitForTimeout(1500);

// 1. «План» → «Скошенный угол»
await page.getByRole("button", { name: "План", exact: true }).click();
await page.waitForTimeout(500);
const panel = page.getByTestId("room-shape-panel").first();
await panel.scrollIntoViewIfNeeded();
await panel.getByRole("button", { name: /Скошенный угол/ }).click();
await page.waitForTimeout(600);
model = shapeEdit(model, outlinePreset("chamfer", 4000, 3000)).project;
let r = await room();
check("1. заготовка «Скошенный угол»: 5 углов, скос 750", near(r.outline, model.room.outline) && r.outline?.length === 5, pts(r.outline));
check("1. план в режиме «Форма комнаты» — ручки углов и стен", (await page.locator(".shape-vertex").count()) === 5 && (await page.locator(".shape-wall-mid").count()) === 5);
{ const b = (await page.locator('.shape-wall-mid').first().boundingBox())!; check("1. ручка середины стены не меньше 14 × 14 px (критик 30.10)", b.width >= 14 && b.height >= 14, Math.round(b.width) + ' × ' + Math.round(b.height)); }
check("1. угол 135° подписан на плане", (await page.locator(".plan-corner-angle").allTextContents()).filter((t) => t.startsWith("135")).length === 2);
await shot("preset-chamfer");

// 2. угол 4 (передний правый) — тяга + «200;100» + Enter
{
  const c = await center('[data-vertex="3"]');
  await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(c.x - 25, c.y - 18, { steps: 4 }); await page.waitForTimeout(200);
  await typeKeys("200;100");
  const badge = await page.locator(".plan-badge").innerText().catch(() => "");
  check("2. плашка показывает набор и сдвиг", /200;100/.test(badge) && /сдвиг -200; -100/.test(badge), badge);
  await shot("vertex-typed");
  await page.keyboard.press("Enter"); await page.mouse.up(); await page.waitForTimeout(400);
  step((o) => moveVertex(o, 3, { x: 3800, z: 2900 }), sameEdges);
  r = await room();
  check("2. угол ровно на (3800; 2900) — сдвиг по набору, знак — по мыши", near(r.outline, model.room.outline), pts(r.outline));
}

// 3. двойной щелчок по задней стене у x = 2200 — новая точка
{
  const p = await scr(2200, 0);
  await page.mouse.dblclick(p.x, p.y - 2); await page.waitForTimeout(500);
  r = await room();
  const v = r.outline?.[1];
  check("3. двойной щелчок по стене — точка на задней стене (шаг 10 мм)", r.outline?.length === 6 && !!v && v.z === 0 && Math.abs(v.x - 2200) <= 20 && v.x % 10 === 0, pts(r.outline));
  const x = v?.x ?? 2200;
  step((o) => insertVertex(o, 0, x / edgeLength(o, 0)), (n) => insertEdgeMap(n, 0));
  check("3. совпадает с моделью", near(r.outline, model.room.outline), pts(model.room.outline));
  await shot("point-added");
}

// 4. правая кнопка по передней стене (стена 5) → «Дуга…» → 300 наружу
{
  await page.locator('[data-wall="4"].shape-wall-mid').click({ button: "right" });
  const menu = page.getByRole("menu");
  check("4. меню стены: длина, дуга, прямая, точка", (await menu.innerText()).includes("Длина стены") && (await menu.innerText()).includes("Дуга") && (await menu.innerText()).includes("Добавить точку"));
  await shot("wall-menu");
  await menu.getByRole("menuitem", { name: "Дуга…" }).click();
  const dlg = page.getByRole("dialog", { name: /Дуга стены 5/ });
  await dlg.getByRole("radio", { name: "Наружу" }).click();
  await dlg.getByRole("textbox").fill("300");
  await shot("arc-dialog");
  await dlg.getByRole("textbox").press("Enter"); await page.waitForTimeout(500);
  step((o) => setBulge(o, 4, 300), sameEdges);
  r = await room();
  check("4. передняя стена — дуга, стрела 300 наружу", r.outline?.[4].bulge === 300 && near(r.outline, model.room.outline), pts(r.outline));
  check("4. глубина комнаты по габариту выросла (эркер наружу)", r.depth > 3000, String(r.depth));
}

// 5. правая кнопка по углу 1 → «Скос угла…» → 400
{
  await page.locator('[data-vertex="0"]').click({ button: "right" });
  const menu = page.getByRole("menu");
  const mt = await menu.innerText();
  check("5. меню угла: скос, скругление, удалить точку", ["Скос угла", "Скругление", "Удалить точку"].every((t) => mt.includes(t)), mt.replace(/\n/g, " | "));
  await menu.getByRole("menuitem", { name: "Скос угла…" }).click();
  const dlg = page.getByRole("dialog", { name: /Скос угла 1/ });
  await dlg.getByRole("textbox").fill("400"); await dlg.getByRole("textbox").press("Enter"); await page.waitForTimeout(500);
  step((o) => chamferCorner(o, 0, 400), (n) => cornerEdgeMap(n, 0));
  r = await room();
  check("5. скос угла 1 по 400 — 7 углов, (0; 400) и (400; 0)", r.outline?.length === 7 && near(r.outline, model.room.outline), pts(r.outline));
  await shot("chamfer");
}

// 6. левая стена (стена 7) — середину влево + «200» + Enter: стена ушла, шкаф на месте
{
  const before = (await arrangement())[0];
  const c = await center('[data-wall="6"].shape-wall-mid');
  await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(c.x - 20, c.y, { steps: 4 }); await page.waitForTimeout(150);
  await typeKeys("200");
  await shot("wall-move-typed");
  await page.keyboard.press("Enter"); await page.mouse.up(); await page.waitForTimeout(500);
  step((o) => moveEdge(o, 6, 200), (n) => moveEdgeMap(n, 6));
  r = await room();
  const after = (await arrangement())[0];
  check("6. левая стена ушла на 200 — ширина по габариту +200", r.width === model.room.width && near(r.outline, model.room.outline), `${r.width} · ${pts(r.outline)}`);
  check("6. «Шкаф» стоит на месте плана (от новой левой стены дальше на 200)", after.x === before.x + 200 && after.z === before.z, `${before.x} → ${after.x}`);
  await shot("wall-moved");
}

// 7. таблица стен: длина стены 3 → 1200
const beforeLength = model;
{
  const cell = panel.getByLabel("Длина стены 3", { exact: true });
  await cell.scrollIntoViewIfNeeded();
  await cell.fill("1200"); await cell.press("Enter"); await page.waitForTimeout(500);
  step((o) => setWallLength(o, 2, 1200), (n) => moveEdgeMap(n, 3));
  r = await room();
  check("7. длина стены 3 = 1200 (таблица, Enter)", Math.abs(edgeLength(r.outline!, 2) - 1200) < 1 && near(r.outline, model.room.outline), pts(r.outline));
  await shot("table-length");
}
const beforeWindow = await room();

// 8. окно на косой стене: этап «Окна и двери», «+ Окно», стена проёма — Стена 5 (правая, наискось)
{
  const add = page.getByRole("button", { name: "Окно", exact: true }).first();
  await add.scrollIntoViewIfNeeded(); await add.click(); await page.waitForTimeout(400);
  const sel = page.getByLabel("Стена проёма 1");
  const opts = await sel.locator("option").allInnerTexts();
  check("8. стены проёма — по номерам контура с длиной", opts.length === 7 && opts.every((t, i) => t.startsWith(`Стена ${i + 1} · `)), opts.join(" | "));
  await sel.selectOption("4"); await page.waitForTimeout(500);
  r = await room();
  const w = r.openings?.[0];
  check("8. окно на косой стене 5 (старое имя — правая)", w?.edge === 4 && w.wall === "right" && w.offset >= 0 && w.offset + w.width <= edgeLength(r.outline!, 4) + 0.1, JSON.stringify(w));
  const line = await page.locator(".plan-opening").first().getAttribute("data-edge");
  check("8. на плане окно лежит на стене 5", line === "4");
  await page.locator(".plan-opening").first().click(); await page.waitForTimeout(300);
  await shot("window-slanted");
}

// 9. Ctrl+Z ×3: стена окна, окно, длина стены 3
{
  await blur();
  for (let k = 0; k < 3; k++) { await page.keyboard.press("Control+z"); await page.waitForTimeout(350); }
  r = await room();
  check("9. Ctrl+Z ×3 — окна нет, длина стены 3 прежняя", !(r.openings ?? []).length && Math.abs(edgeLength(r.outline!, 2) - edgeLength(beforeLength.room.outline!, 2)) < 1 && !near(r.outline, beforeWindow.outline), pts(r.outline));
  check("9. контур после отмены = те же правки функциями roomOutline (до 0,6 мм)", near(r.outline, beforeLength.room.outline), pts(r.outline) + " vs " + pts(beforeLength.room.outline));
  console.log("   итоговый контур:", pts(r.outline), "габарит", r.width, "×", r.depth);
  await shot("after-undo");
}

// 9б. щелчок по длине стены на плане → набрать → Enter; Ctrl+Z — обратно
{
  const before = await room();
  await page.locator('.plan-wall-length[data-wall="2"]').click();
  const dlg = page.getByRole("dialog", { name: /Длина стены 3/ });
  await dlg.getByRole("textbox").fill("1100"); await dlg.getByRole("textbox").press("Enter"); await page.waitForTimeout(500);
  r = await room();
  check("9б. щелчок по длине стены на плане — 1100 + Enter", Math.abs(edgeLength(r.outline!, 2) - 1100) < 1, pts(r.outline));
  // критик 30.10: под нагрузкой первый рендер после отмены показывал прежний проект ~0,5 с — теперь сразу; и ровно один шаг
  await blur(); await page.keyboard.press("Control+z"); await page.waitForTimeout(250);
  r = await room();
  const first = pts(r.outline); await page.waitForTimeout(600);
  check("9б. Ctrl+Z — одной отменой обратно (сразу и без второго шага)", first === pts(before.outline) && pts((await room()).outline) === pts(before.outline), first);
}

// 9в. меню угла: Delete не открывает «Удалить корпус?», Esc закрывает меню, режим формы остаётся
{
  await page.locator('[data-vertex="1"]').click({ button: "right" });
  await page.keyboard.press("Delete"); await page.waitForTimeout(250);
  const ask = await page.getByTestId("delete-ask").count();
  await page.keyboard.press("Escape"); await page.waitForTimeout(250);
  check("9в. меню угла: Delete — без «Удалить корпус?», Esc закрыл меню", ask === 0 && (await page.getByRole("menu").count()) === 0 && (await page.locator(".shape-vertex").count()) > 0, 'вопрос: ' + ask);
  if (await page.getByTestId("delete-ask").count()) await page.keyboard.press("Escape");
}
// 9г. тяга угла: Delete и W не действуют (ни вопроса, ни смены вида), Esc — отмена тяги
{
  const before = await room(), c = await center('[data-vertex="2"]');
  await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(c.x + 15, c.y + 12, { steps: 3 });
  await page.keyboard.press("Delete"); await page.keyboard.press("w"); await page.keyboard.press("e"); await page.waitForTimeout(250);
  const ask = await page.getByTestId("delete-ask").count(), plan = await page.locator(".room-plan").count();
  await page.keyboard.press("Escape"); await page.mouse.up(); await page.waitForTimeout(300);
  check("9г. тяга угла: Delete/W/E — без вопроса и смены вида, Esc — контур тот же", ask === 0 && plan === 1 && pts((await room()).outline) === pts(before.outline), 'вопрос ' + ask + ', план ' + plan);
  if (ask) await page.keyboard.press("Escape");
}
// 9д. окно на стене 2 поперёк её середины → правая кнопка по стене → «Добавить точку» — отказ, окно и контур на месте
{
  const add = page.getByRole("button", { name: "Окно", exact: true }).first();
  await add.scrollIntoViewIfNeeded(); await add.click(); await page.waitForTimeout(400);
  await page.getByLabel("Стена проёма 1").selectOption("1"); await page.waitForTimeout(400);
  const before = await room(), w = before.openings?.[0], L = edgeLength(before.outline!, 1);
  await page.locator('[data-wall="1"].shape-wall-mid').click({ button: "right" });
  await page.getByRole("menu").getByRole("menuitem", { name: "Добавить точку" }).click(); await page.waitForTimeout(400);
  const note = await page.getByTestId("studio-note").innerText().catch(() => "");
  r = await room();
  check("9д. точка посреди окна — отказ «Окно 1 на месте точки — сдвиньте его», окно и контур на месте", !!w && w.edge === 1 && w.offset < L / 2 && w.offset + w.width > L / 2 && /Окно 1 на месте точки — сдвиньте его/.test(note) && pts(r.outline) === pts(before.outline) && JSON.stringify(r.openings) === JSON.stringify(before.openings), JSON.stringify(w) + ' | ' + note);
  await blur(); for (let k = 0; k < 2; k++) { await page.keyboard.press("Control+z"); await page.waitForTimeout(350); }
  check("9д. Ctrl+Z ×2 — окна нет", !((await room()).openings ?? []).length);
}

// 10. отказ: заднюю стену за шкафом внутрь
{
  if (!(await page.locator(".room-plan").count())) { await page.getByRole("button", { name: "План", exact: true }).click(); await page.waitForTimeout(300); }
  if (!(await page.locator(".shape-vertex").count())) { await page.locator(".room-shape-toggle").click(); await page.waitForTimeout(300); }
  const before = await room();
  const c = await center('[data-wall="1"].shape-wall-mid');
  await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(c.x, c.y + 20, { steps: 3 });
  await typeKeys("300");
  const badge = await page.locator(".plan-badge").innerText().catch(() => "");
  await shot("refuse-preview");
  await page.keyboard.press("Enter"); await page.mouse.up(); await page.waitForTimeout(500);
  const note = await page.getByTestId("studio-note").innerText().catch(() => "");
  r = await room();
  check("10. отказ: «Корпус «Шкаф» оказывается вне комнаты», контур тот же", /Корпус «Шкаф» оказывается вне комнаты/.test(badge + note) && pts(r.outline) === pts(before.outline), badge + " | " + note);
  await shot("refused");
}

// 11. Esc в режиме формы (без тяги и меню) — выход из режима, как в Базисе
{
  await blur(); await page.mouse.move(5, 5); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  check("11. Esc — выход из режима «Форма комнаты»", (await page.locator(".shape-vertex").count()) === 0 && (await page.locator(".room-shape-toggle").getAttribute("aria-pressed")) === "false");
}
// 12. режим формы не переходит на «Построение мебели»: там на плане — ручки угла корпуса, ручек формы нет
{
  await page.locator(".room-shape-toggle").click(); await page.waitForTimeout(300);
  const on = await page.locator(".shape-vertex").count();
  await page.getByRole("button", { name: /Построение мебели/ }).first().click(); await page.waitForTimeout(600);
  await page.getByRole("button", { name: "План", exact: true }).click(); await page.waitForTimeout(600);
  const handles = await page.locator(".shape-vertex, .shape-wall-mid, .room-shape-toggle").count(), corners = await page.locator(".plan-corner").count();
  check("12. «Построение мебели» → План: без ручек формы, ручки угла корпуса на месте", on > 0 && handles === 0 && corners > 0, 'форма ' + handles + ', угол корпуса ' + corners);
  await shot("bodies-plan");
}

check("без ошибок страницы", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((x) => !x[1]);
console.log(`\n${results.length - failed.length}/${results.length} проверок прошло` + (failed.length ? "; провалы: " + failed.map((x) => x[0]).join("; ") : ""));
process.exit(failed.length ? 1 : 0);
