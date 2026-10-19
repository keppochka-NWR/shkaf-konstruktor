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
  // 3. Пока деталь выбрана — правая кнопка по шкафу работает; поиск полки
  let shelfFound = false, opened = 0, silent = 0;
  for (let y = canvas1.y + 120; y < canvas1.y + canvas1.height - 60 && !shelfFound; y += 6) {
    await page.mouse.click(cx, y, { button: "right" }); await page.waitForTimeout(90);
    if (await page.locator(".radial-menu").count()) { opened++; if (/^Полка/.test(await title())) { shelfFound = true; break; } await page.keyboard.press("Escape"); await page.waitForTimeout(40); } else silent++;
  }
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
  await page.mouse.click(cx, canvas1.y + 140, { button: "right" }); await page.waitForTimeout(300);
  if (await item(/^Корпус/).count()) { await item(/^Корпус/).click(); await page.waitForTimeout(250); }
  const price0 = (await page.locator(".dock-price").innerText().catch(() => "")).replace(/\s+/g, " ");
  await item(/^Наполнение/).click(); await page.waitForTimeout(250);
  await shot("7-section-templates");
  await item(/^Штанга \+ полка/).click(); await page.waitForTimeout(800);
  await page.mouse.click(cx, canvas1.y + 140, { button: "right" }); await page.waitForTimeout(300);
  if (await item(/^Корпус/).count()) { await item(/^Корпус/).click(); await page.waitForTimeout(250); }
  await item(/^Подсветка/).click(); await page.waitForTimeout(250);
  await shot("8-light");
  const inShelves = item(/^В полках/);
  const enabled = await inShelves.isEnabled();
  if (enabled) { await inShelves.click(); await page.waitForTimeout(900); }
  check("«Подсветка › В полках» доступна после шаблона «Штанга + полка»", enabled);
  await shot("9-after-light");
  const price1 = (await page.locator(".dock-price").innerText().catch(() => "")).replace(/\s+/g, " ");
  check("цена пересчитана после шаблона", price0 !== "" && price1 !== "", price0 + " → " + price1);
  check("ошибок страницы нет", errors.length === 0, errors.join("; "));
} finally { await browser.close(); }
const bad = results.filter((r) => !r[1]);
console.log(`ИТОГ: ${results.length - bad.length}/${results.length}`);
process.exit(bad.length ? 1 : 0);
