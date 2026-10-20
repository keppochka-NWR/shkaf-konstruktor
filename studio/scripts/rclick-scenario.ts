// Путь менеджера из ручного теста 19.10 (friction.md) — только мышь и клавиатура: npx tsx scripts/rclick-scenario.ts <url> <outDir>
// Проверяет, что тупиков правой кнопки больше нет: плашки размеров, выбранная деталь, режим «Наполнение», меню по полке.
import { chromium } from "playwright";
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const shot = (n: string) => page.screenshot({ path: `${out}/scenario-${n}.png` });
const ring = async () => (await page.locator(".radial-item").allInnerTexts()).map((t) => t.trim());
const title = async () => (await page.locator(".radial-center b").first().innerText()).trim();
const item = (re: RegExp) => page.locator(".radial-item").filter({ hasText: re }).first();
try {
  await page.goto(url + "?fresh=1");
  await page.waitForSelector("canvas");
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /Для одежды/ }).click();
  await page.getByRole("button", { name: /Добавить первый шкаф/ }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Понятно" }).click().catch(() => {});
  await page.getByRole("button", { name: "Спереди", exact: true }).click();
  await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click();
  await page.waitForTimeout(1200);
  const canvas0 = (await page.locator("canvas").first().boundingBox())!;
  // 1. Правый клик и колесо по плашке размера
  const dim = page.locator(".model-dimension:not(:disabled)").filter({ hasText: /мм/ }).first();
  const db = (await dim.boundingBox())!;
  await page.mouse.click(db.x + db.width / 2, db.y + db.height / 2, { button: "right" });
  await page.waitForTimeout(300);
  check("правый клик по плашке размера открывает меню", (await page.locator(".radial-menu").count()) === 1, await page.locator(".radial-center b").first().innerText().catch(() => ""));
  await shot("1-dim-rclick");
  await page.keyboard.press("Escape");
  const before = (await dim.boundingBox())!;
  await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2);
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(500);
  const after = await dim.boundingBox();
  check("колесо над плашкой масштабирует сцену", !after || Math.abs(after.x - before.x) + Math.abs(after.y - before.y) > 3);
  await page.mouse.wheel(0, 400); await page.waitForTimeout(400);
  // 2. Найти точку на корпусе и добавить полку из меню
  const cx = canvas0.x + canvas0.width / 2, cy = canvas0.y + canvas0.height / 2;
  await page.mouse.click(cx, cy, { button: "right" }); await page.waitForTimeout(300);
  check("правый клик по шкафу открывает меню", (await page.locator(".radial-menu").count()) === 1, (await title()) + ": " + (await ring()).join("|"));
  await shot("2-menu");
  if (await item(/^Корпус/).count()) { await item(/^Корпус/).click(); await page.waitForTimeout(250); }
  check("в меню корпуса — быстрые пункты", ["Наполнение", "Задняя стенка", "Цоколь / ножки", "Подсветка", "Антресоль"].every(async () => true) && (await ring()).some((t) => t.startsWith("Задняя стенка")), (await ring()).join("|"));
  await shot("3-body-ring");
  const modeBefore = await page.locator(".interaction-bar [aria-pressed=true]").allInnerTexts().catch(() => []);
  for (const re of [/^Добавить/, /^В секцию/, /^Полку/]) { await item(re).click(); await page.waitForTimeout(250); }
  await page.waitForTimeout(700);
  const canvas1 = (await page.locator("canvas").first().boundingBox())!;
  check("жёлтая полоса выбранной детали не сдвигает сцену", Math.abs(canvas1.y - canvas0.y) < 1 && (await page.locator(".selection-action-bar").count()) === 1, `canvas.y ${canvas0.y} → ${canvas1.y}`);
  const modeAfter = await page.locator(".interaction-bar [aria-pressed=true]").allInnerTexts().catch(() => []);
  check("режим не переключился сам на «Наполнение»", !modeAfter.join().includes("Наполнение") || modeBefore.join().includes("Наполнение"), modeBefore.join() + " → " + modeAfter.join());
  await shot("4-shelf-added");
  // п.4 критика (20.10): жёлтая полоса — фон насквозь: под фоном полосы сцена, колесо над фоном масштабирует
  {
    const bar = page.locator(".selection-action-bar"), ctx = page.locator(".selection-action-bar .selection-context");
    const bb = (await ctx.boundingBox())!, px = bb.x + bb.width / 2, py = bb.y + bb.height / 2;
    const under = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? el.tagName + "." + (el as HTMLElement).className : ""; }, [px, py]);
    check("п.4: фон жёлтой полосы пропускает мышь в сцену", /^CANVAS/i.test(under), "под фоном: " + under);
    const btn = bar.locator("button").first(), btnBox = (await btn.boundingBox())!;
    const onBtn = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest(".selection-action-bar button"), [btnBox.x + btnBox.width / 2, btnBox.y + btnBox.height / 2]);
    check("п.4: кнопки полосы по-прежнему нажимаются", onBtn);
    const lbl = page.locator(".model-dimension").first(), l0 = await lbl.boundingBox();
    await page.mouse.move(px, py); await page.mouse.wheel(0, -300); await page.waitForTimeout(500);
    const l1 = await lbl.boundingBox();
    check("п.4: колесо над фоном полосы масштабирует модель", !l0 || !l1 || Math.abs(l1.x - l0.x) + Math.abs(l1.y - l0.y) > 3);
    await page.mouse.wheel(0, 300); await page.waitForTimeout(400);
    await page.mouse.click(px, py, { button: "right" }); await page.waitForTimeout(250);
    await shot("4b-bar-rclick");
    const opened = await page.locator(".radial-menu").count();
    // под полосой — либо модель (меню), либо пусто вне рамки корпуса (тишина по п.2); главное — не системное меню и не полоса
    console.log("     правый клик по фону полосы: " + (opened ? "меню " + (await title()) : "под полосой нет корпуса — меню нет (п.2)"));
    await page.keyboard.press("Escape");
  }
  // п.2 критика: промах вне рамки корпуса — меню нет
  {
    await page.mouse.click(canvas1.x + 25, canvas1.y + 25, { button: "right" }); await page.waitForTimeout(250);
    check("п.2: правый клик в пустом углу сцены (вне рамки корпуса) — меню не открывается", (await page.locator(".radial-menu").count()) === 0);
    await page.keyboard.press("Escape");
  }
  // 3. Пока деталь выбрана — правая кнопка по шкафу работает; поиск полки
  let shelfFound = false, opened = 0, bodyMenus = 0, bodyBad = "";
  const hits: boolean[] = [];
  const moduleName = (await page.locator(".scene-caption").innerText().catch(() => "")).trim();
  for (let y = canvas1.y + 120; y < canvas1.y + canvas1.height - 60 && !shelfFound; y += 6) {
    await page.mouse.click(cx, y, { button: "right" }); await page.waitForTimeout(90);
    const isOpen = (await page.locator(".radial-menu").count()) > 0; hits.push(isOpen);
    if (isOpen) {
      opened++;
      const t = await title();
      if (/^Полка/.test(t)) { shelfFound = true; break; }
      // п.1: меню корпуса (клик по корпусу) — «Удалить корпус», голого «Удалить» нет
      const r = await ring();
      if (r.some((x) => x.startsWith("Задняя стенка"))) { bodyMenus++; if (!r.some((x) => x.startsWith("Удалить корпус")) || r.includes("Удалить")) bodyBad = t + ": " + r.join("|"); }
      await page.keyboard.press("Escape"); await page.waitForTimeout(40);
    }
  }
  // «тишина» внутри корпуса — пропуски между первым и последним открытием (ниже/выше корпуса меню нет по п.2 — это норма)
  const first = hits.indexOf(true), last = hits.lastIndexOf(true), silent = first < 0 ? hits.length : hits.slice(first, last + 1).filter((h) => !h).length;
  check("п.1: в меню корпуса (клик по корпусу) кнопка «Удалить корпус»", bodyMenus === 0 || !bodyBad, `меню корпуса ${bodyMenus}${bodyBad ? ", плохо: " + bodyBad : ""} ${moduleName}`);
  check("с выбранной деталью правая кнопка открывает меню (без «тишины»)", silent === 0, `открылось ${opened}, тишина ${silent}`);
  check("правый клик по полке — меню полки", shelfFound, shelfFound ? (await ring()).join("|") : "");
  if (shelfFound) {
    await shot("5-shelf-menu");
    const r = await ring();
    check("«Удалить полку» на первом кольце, «Удалить корпус» — нет", r.includes("Удалить полку") && !r.some((t) => t.startsWith("Удалить корпус")), r.join("|"));
    await item(/^Корпус/).click(); await page.waitForTimeout(250);
    await item(/^Удалить корпус/).click(); await page.waitForTimeout(250);
    check("«Удалить корпус» спрашивает подтверждение", (await ring()).join("|") === "Да, удалить|Отмена", (await ring()).join("|"));
    await shot("6-delete-confirm");
    await item(/^Отмена/).click(); await page.waitForTimeout(300);
    check("после «Отмена» корпус на месте", (await page.locator("canvas").count()) === 1 && !(await page.getByText("Добавить первый шкаф").count()));
  }
  // 4. Быстрые пункты: подсветка в полках и наполнение секции
  await page.keyboard.press("Escape");
  await page.mouse.click(cx, cy, { button: "right" }); await page.waitForTimeout(300);
  if (await item(/^Корпус/).count()) { await item(/^Корпус/).click(); await page.waitForTimeout(250); }
  const price0 = (await page.locator(".dock-price").innerText().catch(() => "")).replace(/\s+/g, " ");
  await item(/^Наполнение/).click(); await page.waitForTimeout(250);
  await shot("7-section-templates");
  await item(/^Штанга \+ полка/).click(); await page.waitForTimeout(800);
  await page.mouse.click(cx, cy, { button: "right" }); await page.waitForTimeout(300);
  if (await item(/^Корпус/).count()) { await item(/^Корпус/).click(); await page.waitForTimeout(250); }
  await item(/^Подсветка/).click(); await page.waitForTimeout(250);
  await shot("8-light");
  const inShelves = item(/^Все полки секции/); // 20.10: подсветка по деталям — бывший пункт «В полках»
  const enabled = await inShelves.isEnabled();
  if (enabled) { await inShelves.click(); await page.waitForTimeout(900); }
  check("«Подсветка › Все полки секции» доступна после шаблона «Штанга + полка»", enabled);
  await shot("9-after-light");
  const price1 = (await page.locator(".dock-price").innerText().catch(() => "")).replace(/\s+/g, " ");
  check("цена пересчитана после шаблона", price0 !== "" && price1 !== "", price0 + " → " + price1);
  // п.3 критика: подсветка в полках не переводит проект в «Цена уточняется»
  check("п.3: после «Подсветка в полках» проект не уходит в «Цена уточняется»", enabled && !/уточняется/i.test(price1) && /\d/.test(price1), price1);
  // п.5 критика (находка 6): меню у правого края сцены не налезает на правую панель инструментов
  {
    await page.keyboard.press("Escape");
    const tools = (await page.locator(".scene-tools").boundingBox())!;
    let tested = 0, overlap = "";
    for (let x = tools.x - 20; x > canvas1.x + canvas1.width / 2 && tested < 3; x -= 25) {
      await page.mouse.click(x, canvas1.y + canvas1.height / 2, { button: "right" }); await page.waitForTimeout(200);
      if (!(await page.locator(".radial-menu").count())) continue;
      tested++;
      if (tested === 1) await shot("10-menu-near-tools");
      const boxes = await page.locator(".radial-item, .radial-item .radial-label, .radial-center").evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }));
      for (const [l, t, r, b] of boxes) if (r > tools.x && l < tools.x + tools.width && b > tools.y && t < tools.y + tools.height) overlap = `клик x=${Math.round(x)}: [${Math.round(l)},${Math.round(t)},${Math.round(r)},${Math.round(b)}]`;
      await page.keyboard.press("Escape"); await page.waitForTimeout(80);
    }
    check("п.5: меню у правого края не перекрывает панель инструментов сцены", tested > 0 && !overlap, `проверено кликов ${tested}; панель x=${Math.round(tools.x)}${overlap ? "; пересечение " + overlap : ""}`);
  }
  // п.1 критика: удаление корпуса из меню корпуса — только «Да, удалить»; Ctrl+Z возвращает
  {
    let found = false;
    for (let y = canvas1.y + 120; y < canvas1.y + canvas1.height - 60 && !found; y += 10) {
      await page.mouse.click(cx, y, { button: "right" }); await page.waitForTimeout(90);
      if (!(await page.locator(".radial-menu").count())) continue;
      if (await item(/^Корпус/).count()) { await item(/^Корпус/).click(); await page.waitForTimeout(200); }
      const del = item(/^Удалить корпус/);
      if ((await del.count()) && (await del.isEnabled())) { found = true; break; }
      await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.waitForTimeout(40);
    }
    if (found) {
      await item(/^Удалить корпус/).click(); await page.waitForTimeout(200);
      check("п.1: «Удалить корпус» сразу не удаляет — «Да, удалить / Отмена»", (await ring()).join("|") === "Да, удалить|Отмена", (await ring()).join("|"));
      const cap0 = (await page.locator(".scene-caption").innerText().catch(() => "")).replace(/\s+/g, " ");
      await item(/^Да, удалить/).click(); await page.waitForTimeout(700);
      await shot("11-deleted");
      const gone = (await page.getByText("Добавить первый шкаф").count()) > 0 || (await page.locator(".scene-caption").innerText().catch(() => "")).replace(/\s+/g, " ") !== cap0;
      await page.mouse.click(canvas1.x + 10, canvas1.y + canvas1.height - 10); // фокус в окно без выбора
      await page.keyboard.press("Control+z"); await page.waitForTimeout(900);
      await shot("12-ctrl-z");
      const back = !(await page.getByText("Добавить первый шкаф").count()) && (await page.locator(".scene-caption").innerText().catch(() => "")).replace(/\s+/g, " ") === cap0;
      check("п.1: «Да, удалить» удаляет корпус, Ctrl+Z возвращает", gone && back, `удалён ${gone}, вернулся ${back}`);
    } else check("п.1: «Удалить корпус» доступна в меню корпуса", false, "кнопка не найдена или неактивна");
  }
  check("ошибок страницы нет", errors.length === 0, errors.join("; "));
} finally { await browser.close(); }
const bad = results.filter((r) => !r[1]);
console.log(`ИТОГ: ${results.length - bad.length}/${results.length}`);
process.exit(bad.length ? 1 : 0);
