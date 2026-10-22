// Сценарий мышью и клавиатурой, волна 22.10, ветка claude/w-ui: npx tsx scripts/w-ui-scenario.ts <url> <outDir>
// п.17 полки числом · п.19 Esc по шагам · п.28 виды W/A/S/D/Q/E · п.4 ошибки списком с «Показать» · п.21 число дверей в палитре · п.29 комод без полки.
// Подготовка (проект в localStorage) — до первого действия; дальше только мышь и клавиатура, проверки читают DOM.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { initialModule, section, type Module } from "../src/model";
import { newProject, type PlacedModule, type Project } from "../src/project";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const mod = (name: string, extra: Partial<Module> = {}): Module => ({ ...initialModule(), name, width: 600, ...extra });
const at = (id: string, x: number, m: Module): PlacedModule => ({ id, x, y: 0, z: 3, rotation: 0, module: m });
const project = (): Project => {
  const p = newProject();
  p.room = { ...p.room, width: 5200 };
  // восемь шкафов в ряд: первый с полками (выбран при открытии), остальные — обычные (ящики + полка)
  p.modules = [at("a", 200, mod("Шкаф 1", { sections: [{ ...section(), shelves: [0.3, 0.6] }] })),
    ...Array.from({ length: 7 }, (_, i) => at("m" + (i + 2), 200 + 600 * (i + 1), mod("Шкаф " + (i + 2))))];
  return p;
};
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const shot = (n: string) => page.screenshot({ path: `${out}/${n}.png` });
const wait = (ms = 400) => page.waitForTimeout(ms);
const pressedView = async () => (await page.locator('.view-tabs button[aria-pressed="true"]').allInnerTexts()).join(",");
const pressedModule = async () => (await page.locator('.module-item[aria-pressed="true"] b').allInnerTexts()).join(",");
const openSetting = async (category: string, setting: string) => {
  const cat = page.locator(`details[data-settings-category="${category}"]`).first();
  if (!(await cat.evaluate((d) => (d as HTMLDetailsElement).open))) await cat.locator("> summary").click();
  const set = cat.locator(`details[data-setting="${setting}"]`).first();
  if (!(await set.evaluate((d) => (d as HTMLDetailsElement).open))) await set.locator("> summary").click();
  await wait(200);
  return set;
};
const shelfHeights = async () => {
  const vals: number[] = [];
  for (let j = 1; j <= 12; j++) { const f = page.locator(`input[aria-label="Полка ${j}"]`); if (!(await f.count())) break; vals.push(Number(await f.first().inputValue())); }
  return vals;
};
try {
  await page.goto(url);
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-dock", "project"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(project()));
  await page.goto(url); await page.waitForSelector("canvas"); await wait(2500);
  await shot("01-start");

  // ── п.17: полки числом ──
  const shelves = await openSetting("Наполнение", "Полки");
  const count = shelves.locator('input[aria-label="Полок в секции"]');
  check("п.17 поле «Полок в секции» есть, показывает 2", (await count.count()) === 1 && (await count.inputValue()) === "2", await count.inputValue().catch(() => "нет поля"));
  await count.click({ clickCount: 3 }); await page.keyboard.type("5"); await page.keyboard.press("Enter"); await wait(600);
  const h5 = await shelfHeights(), steps = h5.map((y, j) => y - (j ? h5[j - 1] : 0));
  check("п.17 «5» → пять полок поровну", h5.length === 5 && Math.max(...steps.slice(1)) - Math.min(...steps.slice(1)) <= 2, "высоты " + h5.join(", "));
  await shot("02-shelves-5");
  const range = (await shelves.locator('input[aria-label="Полок в секции"] >> xpath=../following-sibling::span').first().innerText()).trim();
  const max = Number(/до (\d+)/.exec(range)?.[1] ?? 0);
  await count.click({ clickCount: 3 }); await page.keyboard.type(String(max + 3)); await page.keyboard.press("Enter"); await wait(400);
  const fb = (await shelves.locator(".number-feedback").allInnerTexts()).join(" ");
  check("п.17 больше предела — понятный отказ, полки не меняются", /Введите число от 0 до \d+/.test(fb) && (await shelfHeights()).length === 5, `предел ${max}; «${fb}»`);
  await shot("03-shelves-over-max");

  // ── п.19: Esc по шагам ──
  await shelves.locator('button[aria-label="Выбрать: Полка 1"]').click(); await wait(400);
  const bar = page.locator(".selection-action-bar");
  check("п.19 выбрана полка — панель действий с деталью", (await bar.count()) === 1, (await bar.innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 60));
  await shot("04-part-selected");
  // круговое меню правой кнопкой по корпусу в списке → Esc закрывает только меню
  await page.locator(".module-item").first().click({ button: "right" }); await wait(300);
  const menuOpen = (await page.locator(".radial-menu").count()) === 1;
  await page.keyboard.press("Escape"); await wait(300);
  check("п.19 Esc №1: закрыло круговое меню, деталь и модуль остались выбраны", menuOpen && (await page.locator(".radial-menu").count()) === 0 && (await bar.count()) === 1 && (await pressedModule()) === "Шкаф 1", `меню было: ${menuOpen}; модуль «${await pressedModule()}»`);
  await page.keyboard.press("Escape"); await wait(300);
  check("п.19 Esc №2: снято выделение детали, модуль остался", (await bar.count()) === 0 && (await pressedModule()) === "Шкаф 1", `модуль «${await pressedModule()}»`);
  await shot("05-esc-part");
  await page.keyboard.press("Escape"); await wait(300);
  check("п.19 Esc №3: снято выделение модуля (в списке ни один не выбран)", (await pressedModule()) === "", `«${await pressedModule()}»`);
  await shot("06-esc-module");
  await page.locator(".module-item").first().click(); await wait(300);
  check("п.19 клик по модулю — снова выбран", (await pressedModule()) === "Шкаф 1");

  // ── п.28: виды W/A/S/D/Q/E ──
  const hint = (await page.locator(".orbit-help .view-keys").innerText().catch(() => "")).trim();
  check("п.28 подсказка в строке сцены", /W A S D — виды/.test(hint), hint);
  // фокус на кнопке корпуса в списке (последний клик) — не поле ввода
  const seq: [string, string][] = [["w", "Сверху"], ["s", "Спереди"], ["a", "Сбоку"], ["d", "Сбоку"], ["q", "3D"], ["e", "3D"]];
  for (const [k, label] of seq) {
    await page.keyboard.press(k); await wait(500);
    const v = await pressedView();
    check(`п.28 клавиша ${k.toUpperCase()} → «${label}»`, v === label, v);
    if (k === "w" || k === "a" || k === "d") await shot(`07-view-${k}`);
  }
  await count.click(); await page.keyboard.press("w"); await wait(300);
  check("п.28 в поле ввода W не переключает вид", (await pressedView()) === "3D", await pressedView());
  await page.keyboard.press("Escape");

  // ── п.4: ошибки списком с «Показать» ──
  await page.getByRole("button", { name: "Замер помещения" }).click(); await wait(400);
  const roomW = page.locator('input[aria-label="Ширина комнаты"]').first();
  await roomW.click({ clickCount: 3 }); await page.keyboard.type("1000"); await page.keyboard.press("Enter"); await wait(700);
  const banner = page.locator(".error-banner");
  const items = banner.locator(".error-list > li:not(.error-more)");
  const head = (await banner.locator("strong").first().innerText().catch(() => "")).trim();
  const more = (await banner.locator(".error-more").innerText().catch(() => "")).trim();
  const first = (await items.first().innerText().catch(() => "")).replace(/\s+/g, " ");
  const total = Number(/ошибок: (\d+)/.exec(head)?.[1] ?? 0);
  check("п.4 плашка: все ошибки — счётчик, 5 в списке и «ещё N»", total > 5 && (await items.count()) === 5 && more.includes(`ещё ${total - 5}`), `«${head}»; пунктов ${await items.count()}; «${more}»`);
  check("п.4 у ошибки — корпус, что не так, что сделать, «Показать»", /Шкаф \d/.test(first) && /Что сделать:/.test(first) && (await items.first().locator(".error-show").count()) === 1, first.slice(0, 160));
  await shot("08-errors-list");
  const place3 = (await items.nth(2).locator(".error-place").innerText()).trim().replace(/:$/, ""), name3 = place3.split(" · ")[0];
  await items.nth(2).locator(".error-show").click(); await wait(800);
  const zoom = (await page.locator('button[aria-label="Приблизить выбранный корпус"][aria-pressed="true"]').count()) === 1;
  check("п.4 «Показать» у третьей ошибки — выбран её корпус, лупа включена", (await pressedModule()) === name3 && zoom, `ошибка про «${place3}»; выбран «${await pressedModule()}»; лупа ${zoom}`);
  await shot("09-errors-show");
  await banner.locator('button[aria-label="Закрыть сообщение"]').click();
  await page.locator('button[aria-label="Приблизить выбранный корпус"]').click(); await wait(300);
  await page.locator('button[aria-label="Вписать модель"]').click(); await wait(300);

  // ── п.21: число дверей в палитре ──
  const palette = page.locator(".module-palette");
  await page.locator(".module-item").first().click(); await wait(300);
  await palette.getByRole("tab", { name: "Шкафы распашные" }).click();
  await palette.locator("button", { hasText: "Пустой шкаф" }).first().click();
  const pw = palette.locator('input[aria-label="Ширина новой мебели"]');
  await pw.click({ clickCount: 3 }); await page.keyboard.type("1200"); await page.keyboard.press("Tab"); await wait(300);
  const doorsSel = palette.locator('select[aria-label="Дверей у новой мебели"]');
  const opts = await doorsSel.locator("option").allInnerTexts();
  check("п.21 «Дверей»: авто и только допустимые по ширине 1200", opts[0].startsWith("Авто") && !opts.some((o) => /^1 ·/.test(o)) && opts.some((o) => /^3 · секций 2/.test(o)), opts.join(" | "));
  await doorsSel.selectOption("3"); await wait(200);
  await shot("10-palette-doors");
  await palette.getByRole("button", { name: "Добавить в комнату" }).click(); await wait(900);
  const secs = await page.locator('select[aria-label="Выбранная секция"] option').count();
  check("п.21 добавлен шкаф на 3 двери: 2 секции", secs === 2 && /Пустой шкаф/.test(await pressedModule()), `секций ${secs}; модуль «${await pressedModule()}»`);
  await page.keyboard.press("s"); await wait(300);
  await page.locator('button[aria-label="Приблизить выбранный корпус"]').click();
  const doorsOpen = page.locator('button[aria-label="Открыть фасады"][aria-pressed="true"]');
  if (await doorsOpen.count()) await doorsOpen.click();
  await wait(900); await shot("11-three-doors-front");
  await page.locator('button[aria-label="Приблизить выбранный корпус"]').click(); await wait(300);
  await palette.getByRole("tab", { name: "Шкафы-купе" }).click();
  await palette.locator("button", { hasText: "Двери купе" }).first().click(); await wait(200);
  const kupeSel = palette.locator('select[aria-label="Дверей купе у новой мебели"]');
  const kopts = await kupeSel.locator("option").allInnerTexts();
  await kupeSel.selectOption("3"); await wait(200);
  await palette.getByRole("button", { name: "Добавить в комнату" }).click(); await wait(900);
  const kd = ((await page.locator('[aria-label="Количество дверей купе"] button[aria-pressed="true"]').textContent().catch(() => "")) ?? "").trim();
  check("п.21 двери купе: выбрали 3 полотна при добавлении", kd === "3", `варианты ${kopts.join(" | ")}; в панели «${kd}»`);
  await shot("12-kupe-3");

  // ── п.29: комод без полки над ящиками ──
  await palette.getByRole("tab", { name: "Шкафы распашные" }).click();
  await palette.locator("button", { hasText: "Комод" }).first().click(); await wait(200);
  await palette.getByRole("button", { name: "Добавить в комнату" }).click(); await wait(900);
  check("п.29 комод добавлен", /Комод/.test(await pressedModule()), await pressedModule());
  await page.keyboard.press("s"); await wait(300);
  await page.locator('button[aria-label="Приблизить выбранный корпус"]').click(); await wait(900);
  await shot("13-komod-front");
  const drawers = await openSetting("Наполнение", "Ящики");
  const cap = drawers.locator('select[aria-label="Полка над ящиками"]');
  const capText = (await cap.locator("option:checked").innerText().catch(() => "")).trim();
  check("п.29 у комода «Полка над ящиками: Авто · нет, ящики до крыши»", /нет, ящики до крыши/.test(capText), capText);
  const capField = async () => (await drawers.locator('input[aria-label="От дна пенала до верха полки над ящиками"]').isVisible().catch(() => false));
  check("п.29 без полки — поле «до верха полки над ящиками» скрыто", !(await capField()));
  await page.keyboard.press("Escape");
  // меню правой кнопки по ящику: правый клик в центр комода на виде спереди
  const box = await page.locator("canvas").first().boundingBox();
  if (box) { await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 + 40, { button: "right" }); await wait(500); }
  const title = (await page.locator(".radial-center").innerText().catch(() => "")).replace(/\s+/g, " ");
  let capMenu = "";
  if (/Ящик/.test(title)) {
    let item = page.locator(".radial-menu button", { hasText: "Полка над ящиками" });
    // по фасаду ящика действия ящика — в подменю «Ящик ›»
    if (!(await item.count())) { const sub = page.locator(".radial-menu button.radial-item", { hasText: /^Ящик ›/ }); if (await sub.count()) { await sub.first().click(); await wait(400); } item = page.locator(".radial-menu button", { hasText: "Полка над ящиками" }); }
    capMenu = (await item.count()) ? "есть пункт «Полка над ящиками»" : "нет пункта";
    await shot("14-drawer-menu");
    if (await item.count()) { await item.first().click(); await wait(800); }
  } else await page.keyboard.press("Escape");
  check("п.29 меню правой кнопки ящика: «Полка над ящиками» ставит полку", /есть пункт/.test(capMenu) && /Есть|есть/.test((await cap.locator("option:checked").innerText().catch(() => ""))), `меню «${title.slice(0, 40)}»: ${capMenu}; выбор «${await cap.locator("option:checked").innerText().catch(() => "")}»`);
  await shot("15-komod-cap-on");
  await cap.selectOption("off"); await wait(700);
  const third = ((await drawers.locator(".drawer-tabs button").nth(2).textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
  check("п.29 «Нет» — полки нет, ящики снова до крыши (третий на 492 мм от дна, поле «до верха полки» скрыто)", /^Нет$/.test((await cap.locator("option:checked").innerText().catch(() => "")).trim()) && !(await capField()) && /492 мм от дна/.test(third), third);
  await shot("16-komod-off");
} catch (e) {
  check("сценарий без исключений", false, String(e).slice(0, 300));
  await shot("99-exception").catch(() => {});
}
check("без ошибок страницы", errors.length === 0, errors.slice(0, 3).join(" | "));
const ok = results.filter((r) => r[1]).length;
writeFileSync(`${out}/w-ui-scenario.txt`, results.map(([n, o, i]) => (o ? "OK   " : "FAIL ") + n + (i ? " — " + i : "")).join("\n") + `\nИТОГ ${ok}/${results.length}\n`);
console.log(`ИТОГ ${ok}/${results.length}`);
await browser.close();
