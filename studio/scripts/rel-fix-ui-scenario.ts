// Сценарий мышью и клавиатурой, критик релиза 22.10, UI-пункты m4 m5 m6 m10 m11: npx tsx scripts/rel-fix-ui-scenario.ts <url> <outDir>
// m11 палитра на 1366×768 · m4 причина «ящик не помещается» · m5 Esc → «Ничего не выбрано» · m6 высота ручек всем дверям · m10 F5 без открытой панели.
// Подготовка (проект в localStorage) — до первого действия; дальше только мышь и клавиатура, проверки читают DOM.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { createModule } from "../src/ModulePalette";
import { initialModule, boxes } from "../src/model";
import { newProject, type Project } from "../src/project";
import { insertItem } from "../src/operations";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const project = (): Project => {
  const p = newProject();
  p.room = { ...p.room, width: 2400 };
  const m = createModule("wardrobe", 1200, 2400, 550, initialModule(), 2), s = m.sections[0], b = boxes(m).find((x) => x.id === s.id)!;
  m.name = "Модуль 1"; s.rod = false; s.shelves = [560, 1160, 1724].map((v) => v / (b.top - b.bottom));
  let n: Project = { ...p, modules: [{ id: "a", x: 0, y: 0, z: 30, rotation: 0, module: m }] };
  n = insertItem(n, "drawer", "a", s.id, b.bottom); n = insertItem(n, "drawer", "a", s.id, b.bottom + 180);
  return n;
};
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const shot = (n: string) => page.screenshot({ path: `${out}/${n}.png` });
const wait = (ms = 400) => page.waitForTimeout(ms);
const openSetting = async (category: string, setting: string) => {
  const cat = page.locator(`details[data-settings-category="${category}"]`).first();
  if (!(await cat.evaluate((d) => (d as HTMLDetailsElement).open))) await cat.locator("> summary").click();
  const set = cat.locator(`details[data-setting="${setting}"]`).first();
  if (!(await set.evaluate((d) => (d as HTMLDetailsElement).open))) await set.locator("> summary").click();
  await wait(250);
  return set;
};
try {
  // m11: чистый старт, палитра «Добавить мебель» — кнопка и поля видны без прокрутки
  await page.goto(url + (url.includes("?") ? "&" : "?") + "fresh=1");
  await page.waitForSelector(".app, .empty-room-app", { timeout: 20000 }); await wait(1500);
  const geo = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Добавить в комнату");
    const lib = document.querySelector(".library") as HTMLElement | null, w = document.querySelector('input[aria-label="Ширина новой мебели"]');
    return { btn: btn?.getBoundingClientRect().bottom ?? 9999, width: w?.getBoundingClientRect().bottom ?? 9999, lib: lib?.getBoundingClientRect().bottom ?? 0, scroll: document.documentElement.scrollHeight - innerHeight };
  });
  check("m11: «Добавить в комнату» видна без прокрутки на 1366×768", geo.btn <= geo.lib && geo.btn <= 768, `низ кнопки ${Math.round(geo.btn)}, низ панели ${Math.round(geo.lib)}`);
  check("m11: поле «Ширина» видно", geo.width <= geo.lib, `низ поля ${Math.round(geo.width)}`);
  check("m11: страница не прокручивается", geo.scroll <= 0, `лишняя высота ${geo.scroll}`);
  await shot("m11-start-palette");

  // проект: шкаф 1200×2400, 2 двери, 3 полки (нижняя на 560), 2 ящика
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "filling"); localStorage.setItem("studio-dock", "project"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(project()));
  await page.goto(url); await page.waitForSelector(".app"); await wait(1500);
  const close = page.locator('[role="dialog"] button[aria-label*="Закрыть"]'); if (await close.count()) { await close.first().click(); await wait(300); }

  // m4: «+» у «Ящики» — третий не встаёт: причина рядом со счётчиком
  const drawersSet = await openSetting("Наполнение", "Ящики");
  await drawersSet.scrollIntoViewIfNeeded();
  const t0 = Date.now();
  await page.locator('button[aria-label="Добавить: Ящики"]').first().click();
  await page.waitForSelector('[data-testid="drawer-limit"]', { timeout: 15000 }).catch(() => null);
  const ms = Date.now() - t0;
  const limit = (await page.locator('[data-testid="drawer-limit"]').first().textContent().catch(() => "")) ?? "";
  check("m4: причина под счётчиком «Ящики»", /Ящик 3 не помещается/.test(limit) && /помещается 2 ящика/.test(limit), limit.slice(0, 160));
  check("m4: ответ быстрый (без перебора всех высот)", ms < 5000, ms + " мс");
  const count = await page.locator(".counter", { has: page.locator('button[aria-label="Добавить: Ящики"]') }).locator("b").first().textContent();
  check("m4: ящиков осталось 2", count === "2", String(count));
  await page.locator('[data-testid="drawer-limit"]').first().scrollIntoViewIfNeeded();
  await shot("m4-drawer-limit");

  // m5: выбрать ящик (вкладка «Ящик 2» — панель «Настройка ящиков»), затем Esc, Esc — справа «Ничего не выбрано»
  const tab2 = page.locator(".drawer-tabs button").nth(1);
  await tab2.click(); await wait(300);
  check("m5: до Esc — «Настройка ящиков» видна", await page.locator(".drawer-selection h3").first().isVisible());
  await page.locator(".library h1").first().click(); await wait(150); // фокус с кнопки на текст заголовка слева — клавиши не в поле ввода
  await page.keyboard.press("Escape"); await wait(250);
  await page.keyboard.press("Escape"); await wait(400);
  const nothing = page.locator('[data-testid="nothing-selected"]');
  check("m5: после Esc справа «Ничего не выбрано»", await nothing.isVisible().catch(() => false));
  check("m5: «Настройка ящиков» скрыта", !(await page.locator(".drawer-selection h3").first().isVisible().catch(() => false)));
  await shot("m5-after-esc");
  await page.locator(".module-item").first().click(); await wait(400);
  check("m5: клик по модулю в списке — настройки модуля вернулись", !(await nothing.isVisible().catch(() => false)) && await page.locator(".selected-module-heading").first().isVisible());

  // m6: раздел «Ручки» — высота от пола всем распашным дверям
  const handles = await openSetting("Фасады и открывание", "Ручки");
  await handles.scrollIntoViewIfNeeded();
  const field = page.locator('input[aria-label="Высота ручек от пола · все двери"]');
  check("m6: поле в разделе «Ручки»", await field.isVisible().catch(() => false));
  await field.click(); await field.press("Control+a"); await page.keyboard.type("1100"); await page.keyboard.press("Enter"); await wait(600);
  // сохранённый проект (автосохранение в браузере): у секции handleFloor — 1100 у обеих створок
  const raw = await page.evaluate(() => Object.keys(localStorage).map((k) => localStorage.getItem(k) ?? "").join("\n"));
  const hf = [...raw.matchAll(/\\?"handleFloor\\?":\[([^\]]*)\]/g)].map((x) => x[1]).pop() ?? "";
  check("m6: обе двери — 1100 от пола", hf.split(",").filter((v) => v.trim() === "1100").length === 2, hf);
  const note = (await page.locator('[data-testid="module-handle-floor"] > small').first().textContent()) ?? "";
  check("m6: подпись без «разная высота»", !/разная/.test(note), note);
  await shot("m6-handles-floor");

  // m10: открыть «Стоимость», F5 — нижняя панель закрыта
  await page.locator(".project-dock .dock-tabs button", { hasText: "Стоимость" }).first().click(); await wait(600);
  check("m10: «Стоимость» открылась", await page.locator(".dock-body").first().isVisible().catch(() => false));
  await shot("m10-before-f5");
  await page.reload(); await page.waitForSelector(".app"); await wait(1500); // F5: в headless Chrome клавиша браузера не перезагружает — reload()
  check("m10: после F5 нижняя панель закрыта", !(await page.locator(".dock-body").first().isVisible().catch(() => false)));
  await shot("m10-after-f5");
} catch (e) { check("сценарий без исключений", false, (e as Error).message); await shot("error"); }
check("ошибок страницы нет", !errors.length, errors.join(" | "));
writeFileSync(`${out}/rel-fix-ui-scenario.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r[1]) ? 0 : 1);
