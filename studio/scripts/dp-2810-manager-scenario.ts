// dp-2810: сборка изделий МЫШЬЮ И КЛАВИАТУРОЙ как менеджер — от пустой комнаты, затем сверка с проектом зоны, собранным функциями
// (scripts/dp-2810-rooms.ts): детали каждого корпуса (размер и положение, допуск 0,6 мм) и смета.
// npx tsx scripts/dp-2810-manager-scenario.ts <url своей сборки /studio/?fresh=1> <папка вывода> [zone,zone…]
// Только палитра, панели, окна, клавиатура и правая кнопка по сцене; localStorage — только для сверки после сборки.
import { chromium, type Locator, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parts } from "../src/model";
import { parseProject, type Project, type PlacedModule } from "../src/project";
import { estimate } from "../src/pricing";
import { buildZone, itemOf, type ZoneId } from "./dp-2810-rooms";

const [url, outRoot, onlyArg] = process.argv.slice(2);
const only = onlyArg ? onlyArg.split(",") : ["bedroom", "tv", "bath", "shower"];
mkdirSync(outRoot, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

type Ctx = { page: Page; out: string; log: { step: string; ok: boolean; ms: number; err?: string }[]; stats: { clicks: number; keys: number; typed: number }; shotN: number };
function tools(c: Ctx) {
  const { page, stats } = c;
  const shot = (n: string) => page.screenshot({ path: join(c.out, `${String(++c.shotN).padStart(2, "0")}-${n}.png`) });
  async function step(name: string, fn: () => Promise<unknown>) {
    const t = Date.now();
    try { await fn(); c.log.push({ step: name, ok: true, ms: Date.now() - t }); }
    catch (e) { c.log.push({ step: name, ok: false, ms: Date.now() - t, err: (e as Error).message.split("\n")[0].slice(0, 220) }); console.log("FAIL", name, (e as Error).message.split("\n")[0].slice(0, 180)); await shot("fail-" + name.replace(/[^\wа-яё]+/gi, "_").slice(0, 40)); }
  }
  async function openPanels() {
    for (let round = 0; round < 4; round++) {
      const all = page.locator("details:not([open]) > summary"); let opened = 0;
      for (let i = 0, n = await all.count(); i < n && i < 80; i++) {
        const s = all.nth(i); if (!(await s.isVisible().catch(() => false))) continue;
        const txt = (await s.innerText().catch(() => "")).trim();
        if (/^Добавить мебель|^Точки замера|стена$|^Пол$|^Потолок$|^Двери и окна|^Трубы|^Колонны|^Карточка замера|^Мебель в нише|^Сдвинуть всю/.test(txt)) continue;
        await s.scrollIntoViewIfNeeded().catch(() => undefined); await s.click().catch(() => undefined); stats.clicks++; opened++; await page.waitForTimeout(60);
      }
      if (!opened) break;
    }
  }
  const vis = (l: Locator) => l.filter({ visible: true }).first();
  const click = async (l: Locator) => { if (!(await l.isVisible().catch(() => false))) await openPanels(); await l.scrollIntoViewIfNeeded(); await l.click(); stats.clicks++; await page.waitForTimeout(150); };
  const btn = async (name: string | RegExp) => { const l = vis(page.getByRole("button", { name, exact: typeof name === "string" })); if (!(await l.isVisible().catch(() => false))) await openPanels(); await click(vis(page.getByRole("button", { name, exact: typeof name === "string" }))); };
  const label = async (aria: string) => { let l = vis(page.getByLabel(aria, { exact: true })); if (!(await l.isVisible().catch(() => false))) { await openPanels(); l = vis(page.getByLabel(aria, { exact: true })); } return l; };
  async function field(aria: string, value: number | string, verify = true) {
    const l = await label(aria);
    await l.scrollIntoViewIfNeeded(); await l.click({ clickCount: 3 }); stats.clicks++;
    await page.keyboard.type(String(value)); stats.typed++; await page.keyboard.press("Enter"); stats.keys++; await page.waitForTimeout(300);
    const v = await l.inputValue().catch(() => "");
    if (verify && v !== "" && Number(v) !== Number(value) && String(v) !== String(value)) throw Error(`поле «${aria}»: ${v} вместо ${value}; ${(await page.locator(".error-banner").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 160)}`);
  }
  async function text(aria: string, value: string) { const l = await label(aria); await l.click({ clickCount: 3 }); stats.clicks++; await page.keyboard.press("Control+A"); await page.keyboard.type(value); stats.typed++; await page.keyboard.press("Tab"); stats.keys++; await page.waitForTimeout(300); }
  async function pick(aria: string, option: RegExp) {
    const sel = await label(aria); await sel.scrollIntoViewIfNeeded();
    const opts = await sel.locator("option").allInnerTexts(), cur = await sel.evaluate((s) => (s as HTMLSelectElement).selectedIndex);
    const want = opts.findIndex((o) => option.test(o)); if (want < 0) throw Error(`нет пункта ${option} в «${aria}»: ${opts.join(" | ").slice(0, 300)}`);
    if (want === cur) return;
    // раскрыть список (Alt+↓), стрелками до пункта, Enter: промежуточные пункты не применяются (их проверка может откатить выбор)
    await sel.focus(); stats.clicks++; await page.keyboard.press("Alt+ArrowDown"); stats.keys++; await page.waitForTimeout(150);
    const key = want > cur ? "ArrowDown" : "ArrowUp";
    for (let i = 0; i < Math.abs(want - cur); i++) { await page.keyboard.press(key); stats.keys++; }
    await page.keyboard.press("Enter"); stats.keys++; await page.waitForTimeout(500);
    if ((await sel.evaluate((s) => (s as HTMLSelectElement).selectedIndex)) !== want) throw Error(`«${aria}»: пункт не выбран`);
  }
  async function check(aria: string, on: boolean) { const l = await label(aria); await l.scrollIntoViewIfNeeded(); if ((await l.isChecked()) !== on) { await l.click(); stats.clicks++; await page.waitForTimeout(250); } if ((await l.isChecked()) !== on) throw Error(`флажок «${aria}» не переключился`); }
  async function checkText(re: RegExp, on: boolean) { await openPanels(); const l = vis(page.locator("label", { hasText: re }).locator("input[type=checkbox]")); await l.scrollIntoViewIfNeeded(); if ((await l.isChecked()) !== on) { await l.click(); stats.clicks++; await page.waitForTimeout(250); } }
  async function palette(kind: string, w: number, h: number, d: number, doors?: RegExp) {
    await click(vis(page.getByRole("button", { name: kind, exact: true })));
    await field("Ширина новой мебели", w); await field("Высота новой мебели", h); await field("Глубина новой мебели", d);
    if (doors) { const opts = await (await label("Дверей у новой мебели")).locator("option").allInnerTexts(); if (opts.some((o) => doors.test(o))) await pick("Дверей у новой мебели", doors); }
    await btn("Добавить в комнату"); await page.waitForTimeout(900);
    const apart = page.getByRole("button", { name: /^Поставить отдельно/ });
    if (await apart.count() && await apart.first().isVisible()) { await click(apart.first()); await page.waitForTimeout(800); }
  }
  async function paletteTab(tab: string, kind: string, w: number, h: number, d: number) {
    await click(page.getByRole("tab", { name: tab }).first()); await click(page.locator(".module-kinds button").filter({ hasText: kind }).first());
    await field("Ширина новой мебели", w); await field("Высота новой мебели", h); await field("Глубина новой мебели", d);
    await btn("Добавить в комнату"); await page.waitForTimeout(1200);
    const alert = (await page.locator('.module-palette p[role="alert"], .palette-issues').allInnerTexts().catch(() => [] as string[])).join(" ").trim();
    if (alert) throw Error("палитра: " + alert.replace(/\s+/g, " ").slice(0, 200));
    await click(page.getByRole("tab", { name: "Шкафы распашные" }).first()).catch(() => undefined);
  }
  async function modalPick(search: string, item: RegExp) {
    const s = vis(page.getByLabel(search.startsWith("руч:") ? "Найти ручку" : "Найти декор", { exact: true }));
    await s.click(); stats.clicks++; await page.keyboard.type(search.replace(/^руч:/, "")); stats.typed++; await page.waitForTimeout(300);
    const dlg = page.locator("[role=dialog], .modal, .modal-card").filter({ visible: true }).last();
    const inDlg = dlg.getByRole("button", { name: item }).filter({ visible: true }).first();
    await click((await inDlg.count()) ? inDlg : page.getByRole("button", { name: item }).filter({ visible: true }).last());
    await page.waitForTimeout(300);
    const close = page.getByRole("button", { name: "Закрыть окно" }).filter({ visible: true });
    if (await close.count()) await click(close.first()); // уже выбранный материал окно не закрывает
  }
  /** Список, где промежуточный пункт отклоняется проверкой (алюминиевая рамка у высокой двери): набор первых букв пункта с клавиатуры. */
  async function pickType(aria: string, option: RegExp, letters: string) {
    const sel = await label(aria); await sel.scrollIntoViewIfNeeded(); await sel.focus(); stats.clicks++;
    await page.keyboard.type(letters); stats.typed++; await page.waitForTimeout(500);
    const opts = await sel.locator("option").allInnerTexts();
    let i = await sel.evaluate((s) => (s as HTMLSelectElement).selectedIndex);
    if (!option.test(opts[i] ?? "")) { // раскрыть список (Alt+↓), стрелками до пункта, Enter — промежуточные пункты не применяются
      const want = opts.findIndex((o) => option.test(o));
      await sel.focus(); await page.keyboard.press("Alt+ArrowDown"); stats.keys++; await page.waitForTimeout(200);
      for (let k = 0; k < Math.abs(want - i); k++) { await page.keyboard.press(want > i ? "ArrowDown" : "ArrowUp"); stats.keys++; }
      await page.keyboard.press("Enter"); stats.keys++; await page.waitForTimeout(600);
      i = await sel.evaluate((s) => (s as HTMLSelectElement).selectedIndex);
    }
    if (!option.test(opts[i] ?? "")) throw Error(`«${aria}»: выбран «${opts[i]}», нужен ${option}`);
  }
  async function handles(item: RegExp, search: string, floor?: number) {
    await click(vis(page.getByRole("button", { name: /^Ручки фасадов/ })));
    await modalPick("руч:" + search, item);
    if (floor !== undefined) await field("Высота ручек от пола · все двери", floor);
  }
  async function decor(target: "body" | "facade", name: string) {
    await openPanels();
    if (target === "body") await click(vis(page.getByRole("button", { name: "Все", exact: true }))); else await click(vis(page.getByRole("button", { name: /^Материал фасадов/ })));
    await modalPick(name, new RegExp(name));
  }
  async function vernissage(o: { series: RegExp; milling: RegExp; cover: RegExp; color?: string; film?: RegExp; twoSided?: boolean }) {
    await pick("Серия Вернисаж", o.series); await pick("Фрезеровка Вернисаж", o.milling); await pick("Покрытие Вернисаж", o.cover);
    if (o.color) await text("Цвет эмали Вернисаж", o.color);
    if (o.film) await pick("Плёнка Вернисаж", o.film);
    if (o.twoSided) await checkText(/Покраска с 2 сторон/, true);
  }
  /** Правый клик по середине сцены (выбранный корпус приближен и показан спереди) → «Редактировать фасад» → окно фасада. */
  async function facadeEditorByRmb() {
    await btn("Спереди"); await click(page.getByRole("button", { name: "Приблизить выбранный корпус" }).first()); await page.waitForTimeout(800);
    const cv = (await page.locator("canvas").first().boundingBox())!;
    for (const [fx, fy] of [[0.5, 0.5], [0.4, 0.55], [0.6, 0.45], [0.5, 0.65]]) {
      await page.mouse.click(cv.x + cv.width * fx, cv.y + cv.height * fy, { button: "right" }); stats.clicks++; await page.waitForTimeout(500);
      const it = page.getByRole("menuitem", { name: /Редактировать фасад/ }).or(page.getByRole("button", { name: /Редактировать фасад/ }));
      if (await it.count() && await it.first().isVisible()) { await click(it.first()); await page.waitForTimeout(500); return; }
      await page.keyboard.press("Escape");
    }
    throw Error("в меню правой кнопки нет «Редактировать фасад»");
  }
  async function moduleTab(text: RegExp) { await click(page.locator("button", { hasText: text }).last()); await page.waitForTimeout(300); }
  return { shot, step, openPanels, click, btn, label, field, text, pick, pickType, check, checkText, palette, paletteTab, modalPick, handles, decor, vernissage, facadeEditorByRmb, moduleTab };
}

// ───────── сценарии по зонам: изделие → шаги менеджера ─────────
type Scenario = { zone: ZoneId; items: string[]; room: [number, number, number]; run: (t: ReturnType<typeof tools>, page: Page) => Promise<void> };
const ENAMEL = "RAL 9001 кремово-белый", MOCHA = "NCS S 4010-Y30R мокко";
const SCENARIOS: Scenario[] = [
  { zone: "bedroom", items: ["wardrobe"], room: [2705, 3000, 2714], run: async (t) => {
    for (const [k, x] of [[1, 200], [2, 1200]] as const) {
      await t.step(`шкаф 2 м · корпус ${k}: палитра «Для одежды» 1000 × 2500 × 479, 2 двери`, () => t.palette("Для одежды", 1000, 2500, 479, /^2 ·/));
      if (k === 1) await t.step("панель: «Все настройки»", () => t.check("Все настройки", true));
      await t.step(`корпус ${k}: задник ЛДСП 16, высота 2630, цоколь 100, эксцентрики`, async () => { await t.pick("Тип задней стенки", /ЛДСП 16/); await t.field("Высота", 2630); await t.pick("Высота цоколя", /^100 мм/); await t.pick("Крепёж корпуса", /Эксцентрики/); });
      await t.step(`корпус ${k}: фасады МДФ Вернисаж №63 эмаль мат, 2 стороны`, async () => { await t.pickType("Тип распашных фасадов", /Вернисаж/, "МДФ"); await t.vernissage({ series: /Престиж/, milling: /^№63 /, cover: /^Эмаль мат/i, color: ENAMEL, twoSided: true }); });
      await t.step(`корпус ${k}: ручки Brante 1200 золото, от пола 700`, () => t.handles(/Brante · 1200/, "Brante", 700));
      await t.step(`корпус ${k}: декор корпуса и фасадов «Кремовый»`, async () => { await t.decor("body", "Кремовый"); });
      await t.step(`корпус ${k}: от левой стены ${x}, от задней 0`, async () => { await t.field("От левой стены", x); await t.field("От задней стены", 0); }); await t.shot(`pos-${k}`);
    }
  } },
  { zone: "tv", items: ["tumba"], room: [3950, 3000, 2714], run: async (t) => {
    const xs = [0, 750, 1500, 2725], ws = [750, 750, 1225, 1225];
    for (let k = 0; k < 4; k++) {
      await t.step(`тумба · корпус ${k + 1}: палитра «Комод» ${ws[k]} × 378 × 431`, () => t.palette("Комод", ws[k], 378, 431));
      await t.step(`корпус ${k + 1}: «Без фальша у стены» (по эскизу)`, () => t.check("Без фальша у стены", true));
      if (!k) await t.step("панель: «Все настройки»", () => t.check("Все настройки", true));
      await t.step(`корпус ${k + 1}: цоколь 60, эксцентрики, 1 ящик DTC push 400, короб 246 от дна`, async () => {
        await t.pick("Высота цоколя", /^60 мм/); await t.pick("Крепёж корпуса", /Эксцентрики/);
        await t.field("Ящиков в секции", 1); await t.pick("Направляющие ящика", /Скрытые DTC · push/); await t.pick("Длина направляющих", /^400 мм/);
        await t.field("Высота боковины ящика", 246); await t.field("Ящик от дна проёма", 0);
      });
      await t.step(`корпус ${k + 1}: место x ${xs[k]}`, async () => { await t.field("От левой стены", xs[k]); await t.field("От задней стены", 0); });
      await t.step(`корпус ${k + 1}: фасад ящика — окно фасада (ПКМ): Вернисаж №86 эмаль мат, 2 стороны`, async () => {
        await t.pickType("Тип распашных фасадов", /Вернисаж/, "МДФ"); // тип фасадов в панели и у модуля с одними ящиками (дописано dp-2810)
        await t.vernissage({ series: /Престиж/, milling: /^№86 /, cover: /^Эмаль мат/i, color: "RAL 9001 кремово-белый", twoSided: true });
      });
      await t.step(`корпус ${k + 1}: декор «Кремовый»`, () => t.decor("body", "Кремовый"));
    }
    for (const [w, x] of [[1500, 0], [2450, 1500]] as const) {
      await t.step(`столешница ЛДСП 32 «Дуб Галиано» ${w}, x ${x} (палитра «Кухонные модули» → «Столешница»)`, async () => {
        await t.paletteTab("Кухонные модули", "Столешница", w, 32, 450); await t.decor("body", "Дуб Галиано"); await t.field("От левой стены", x); await t.field("От задней стены", 0);
      });
    }
  } },
  { zone: "bath", items: ["vanity"], room: [2700, 1775, 2714], run: async (t, page) => {
    for (const [k, x] of [[1, 300], [2, 1125]] as const) {
      await t.step(`тумба · корпус ${k}: палитра «Подвесной ящик» 825 × 400 × 431`, () => t.palette("Подвесной ящик", 825, 400, 431));
      if (k === 1) await t.step("панель: «Все настройки»", () => t.check("Все настройки", true));
      await t.step(`корпус ${k}: эксцентрики, 2 ящика DTC push: короб 144, нижний 400 от 0, верхний 300 от 184`, async () => {
        await t.pick("Крепёж корпуса", /Эксцентрики/);
        // сначала нижний ящик ниже (короб 144), иначе второй не помещается; затем второй ящик и его место
        // ящик палитры — на всю высоту (фасад 365): сначала нижний ниже (короб 100, фасад 150), чтобы второй встал; затем второй и снова первый
        await t.pick("Направляющие ящика", /Скрытые DTC · push/); await t.pick("Длина направляющих", /^400 мм/); await t.field("Высота боковины ящика", 100); await t.field("Высота фасада ящика", 150); await t.field("Ящик от дна проёма", 0);
        await t.field("Ящиков в секции", 2);
        await t.click(page.locator(".drawer-tabs button").nth(1)); await t.pick("Направляющие ящика", /Скрытые DTC · push/); await t.pick("Длина направляющих", /^300 мм/); await t.field("Высота боковины ящика", 144); await t.field("Ящик от дна проёма", 184);
        await t.click(page.locator(".drawer-tabs button").nth(0)); await t.field("Высота боковины ящика", 144); await t.field("Высота фасада ящика", 196);
      });
      await t.step(`корпус ${k}: от пола 470, x ${x}`, async () => { await t.field("От пола", 470); await t.field("От левой стены", x); await t.field("От задней стены", 0); });
      await t.step(`корпус ${k}: фасады — окно фасада (ПКМ): Вернисаж №86 эмаль мат мокко, 2 стороны`, async () => {
        await t.pickType("Тип распашных фасадов", /Вернисаж/, "МДФ");
        await t.vernissage({ series: /Престиж/, milling: /^№86 /, cover: /^Эмаль мат/i, color: MOCHA, twoSided: true });
      });
      await t.step(`корпус ${k}: декор «Кремовый»`, () => t.decor("body", "Кремовый"));
      if (k === 2) await t.step("корпус 2: видимый бок справа — из фасада, 400 × 449", async () => {
        await t.check("Боковая фальшпанель справа", true); await t.field("Высота боковой панели right", 400); await t.field("Глубина боковой панели right", 449);
        await t.check("Видимый бок из фасада справа", true);
      });
    }
    await t.step("столешница акрил 40 над тумбой 1650 × 460 (палитра «Столешница»)", async () => {
      await t.paletteTab("Кухонные модули", "Столешница", 1650, 40, 460); await t.pick("Материал столешницы", /Акрил 40/);
      await t.decor("body", "Кремовый"); await t.field("От левой стены", 300); await t.field("От задней стены", 0);
    });
  } },
  { zone: "shower", items: ["narrow"], room: [1910, 1760, 2714], run: async (t) => {
    await t.step("узкий пенал: палитра «Пустой шкаф» 250 × 2500 × 629, 1 дверь", () => t.palette("Пустой шкаф", 250, 2500, 629, /^1 ·/));
    await t.step("панель: «Все настройки»", () => t.check("Все настройки", true));
    await t.step("задник ЛДСП, высота 2650, цоколь 60, эксцентрики", async () => { await t.pick("Тип задней стенки", /ЛДСП 16/); await t.field("Высота", 2650); await t.pick("Высота цоколя", /^60 мм/); await t.pick("Крепёж корпуса", /Эксцентрики/); });
    await t.step("6 полок поровну", async () => { await t.field("Полок в секции", 6); await t.btn("Распределить полки"); });
    await t.step("фасады в 2 ряда: нижний 1300", async () => { await t.checkText(/Разделить фасады по высоте/, true); await t.field("Высота нижнего ряда фасадов", 1300); });
    await t.step("фасады — алюминиевая рамка F1-09 золото, стекло прозрачное", async () => {
      await t.pickType("Тип распашных фасадов", /Алюмин/, "Ал"); await t.pick("Профиль рамки", /F1-09/); await t.pick("Цвет профиля", /золото/); await t.pick("Вставка рамки", /Стекло прозрачное/);
    });
    await t.step("подсветка обеих стоек + блок питания", async () => { await t.check("Подсветка в стойках", true); await t.btn("Настроить подсветку…"); await t.check("Блок питания подсветки", true); await t.btn("Закрыть окно"); });
    await t.step("декор «Кремовый»", () => t.decor("body", "Кремовый"));
    await t.step("место: к левой и задней стене, «Без фальша у стены» (по эскизу)", async () => { await t.check("Без фальша у стены", true); await t.field("От левой стены", 0); await t.field("От задней стены", 0); });
  } },
];

const results: Record<string, unknown> = {};
for (const sc of SCENARIOS.filter((s) => only.includes(s.zone))) {
  const out = join(outRoot, sc.zone); mkdirSync(out, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } }); page.setDefaultTimeout(6000);
  const pageErrors: string[] = []; page.on("pageerror", (e) => pageErrors.push(e.message));
  const c: Ctx = { page, out, log: [], stats: { clicks: 0, keys: 0, typed: 0 }, shotN: 0 };
  const t = tools(c), t0 = Date.now();
  await page.goto(url); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("studio-tip-rmb", "1"); });
  await page.goto(url); await page.waitForSelector("canvas", { state: "attached", timeout: 90000 }); await page.waitForTimeout(2000);
  await t.step(`комната ${sc.room.join(" × ")}`, async () => { await t.field("Ширина пустой комнаты", sc.room[0]); await t.field("Глубина пустой комнаты", sc.room[1]); await t.field("Высота пустой комнаты", sc.room[2]); });
  await sc.run(t, page);
  await t.step("стоимость: «Модель цены» → «по большей модели»", async () => { await page.keyboard.press("Escape"); const est = page.getByRole("button", { name: "Стоимость проекта" }).filter({ visible: true }); if (!(await est.count())) await t.click(page.locator(".dock-tabs button", { hasText: "Стоимость" }).first()); if (!(await page.getByLabel("Модель цены", { exact: true }).filter({ visible: true }).count())) await t.click(est.first()); await page.waitForTimeout(500); await t.pick("Модель цены", /по большей модели/); });
  const seconds = Math.round((Date.now() - t0) / 1000);
  await page.keyboard.press("Escape"); await page.waitForTimeout(10000);
  await t.shot("final");
  const priceOnScreen = Number(((await page.getByRole("button", { name: "Открыть стоимость" }).first().innerText().catch(() => "")) || "").replace(/\D/g, "")) || null;
  const storageKeys = await page.evaluate(`Object.keys(localStorage).map((k) => k + ":" + (localStorage.getItem(k) || "").length + (/maxModel/.test(localStorage.getItem(k) || "") ? ":max" : ""))`) as string[];
  const saved = await page.evaluate(`(() => { try { const d = JSON.parse(localStorage.getItem("garderyob-rooms-v1") || "null"); const r = d && d.rooms && (d.rooms.find((x) => x.id === d.activeRoomId) || d.rooms[0]); if (r && r.project && Array.isArray(r.project.modules)) return d.calculation && !r.project.calculation ? Object.assign({}, r.project, { calculation: d.calculation }) : r.project; /* настройки расчёта — в документе (интеграция 29.10) */ } catch {} let best = null; /* документ помещений (RoomWorkspace) — живое состояние; module-studio-v3 и «предыдущий проект» — только запасной вариант */ const keys = Object.keys(localStorage).sort((a, b) => Number(/^module-studio-(v3|previous)/.test(a)) - Number(/^module-studio-(v3|previous)/.test(b))); const walk = (x, d) => { if (!x || typeof x !== "object" || d > 8) return; if (Array.isArray(x.modules) && x.room && (!best || x.modules.length > best.modules.length)) best = x; for (const v of Object.values(x)) walk(v, d + 1); }; for (const k of keys) { try { walk(JSON.parse(localStorage.getItem(k) || "null"), 0); } catch {} } return best; })()`) as Project | null;
  await page.close();
  writeFileSync(join(out, "manager-project.json"), JSON.stringify(saved, null, 1));
  // ───────── сверка с функциями: только изделия сценария ─────────
  const z = buildZone(sc.zone).project;
  const ref: Project = { ...z, modules: z.modules.filter((a) => sc.items.includes(itemOf(a.id))) };
  const key = (a: PlacedModule) => [Math.round(a.x), Math.round(a.y ?? 0), Math.round(a.z), a.rotation ?? 0].join(",");
  const norm = (id: string, m: PlacedModule["module"]) => { let r = id; m.sections.forEach((s, i) => { r = r.split(s.id).join("s" + i); }); return r; };
  const report: string[] = []; let partDiffs = 0;
  const mp = saved ? parseProject(saved) : null;
  if (mp) for (const a of ref.modules) {
    const b = mp.modules.find((x) => key(x) === key(a)) ?? mp.modules.find((x) => Math.abs(x.x - a.x) < 25 && Math.abs((x.y ?? 0) - (a.y ?? 0)) < 25 && Math.abs(x.z - a.z) < 25);
    if (!b) { report.push(`${a.id} ${a.module.name}: в сборке мышью нет корпуса в ${key(a)}`); partDiffs++; continue; }
    const pa = new Map(parts(a.module).filter((p) => p.role !== "fastener").map((p) => [norm(p.id, a.module), p])), pb = new Map(parts(b.module).filter((p) => p.role !== "fastener").map((p) => [norm(p.id, b.module), p]));
    const diffs: string[] = [];
    for (const [id, p] of pa) { const q = pb.get(id); if (!q) { diffs.push("нет " + id); continue; } const d = Math.max(...p.size.map((v, i) => Math.abs(v - q.size[i])), ...p.position.map((v, i) => Math.abs(v - q.position[i]))); if (d > 0.6) diffs.push(`${id} ±${d.toFixed(1)}`); }
    for (const id of pb.keys()) if (!pa.has(id)) diffs.push("лишняя " + id);
    partDiffs += diffs.length;
    report.push(`${a.id} ${a.module.name} ↔ ${b.module.name} (${key(b)}): деталей ${pa.size}/${pb.size}, отличий ${diffs.length}${diffs.length ? ": " + diffs.slice(0, 10).join("; ") : ""}`);
  }
  const er = estimate(ref), em = mp ? estimate(mp) : null;
  const lineDiff = em ? [...new Set([...er.lines, ...em.lines].map((l) => l.id))].map((id) => { const x = er.lines.find((l) => l.id === id), y = em.lines.find((l) => l.id === id); return x && y && Math.abs(x.quantity - y.quantity) < 0.01 && x.unitPrice === y.unitPrice ? null : `${id}: ${x?.quantity ?? "—"} / ${y?.quantity ?? "—"}`; }).filter(Boolean) : [];
  const r = { zone: sc.zone, items: sc.items, seconds, ...c.stats, steps: c.log.length, failed: c.log.filter((l) => !l.ok).map((l) => `${l.step}: ${l.err}`), modulesManager: mp?.modules.length ?? 0, modulesRef: ref.modules.length, partDiffs,
    managerModules: mp?.modules.map((a) => `${a.module.name} ${key(a)} ${a.module.width}×${a.module.height}×${a.module.depth}`) ?? [], priceRef: er.retail, priceManager: em?.retail ?? null, maxModelManager: !!mp?.calculation?.maxModel, priceOnScreen, storageKeys, byMarkup: [er.byMarkup, em?.byMarkup ?? null], bySheet: [er.bySheet, em?.bySheet ?? null], sheetsRef: er.ldspSheets, sheetsManager: em?.ldspSheets ?? null, lineDiff, report, pageErrors };
  writeFileSync(join(out, "manager-result.json"), JSON.stringify({ ...r, log: c.log }, null, 1));
  results[sc.zone] = r;
  console.log(JSON.stringify(r, null, 1));
}
await browser.close();
writeFileSync(join(outRoot, "manager-results.json"), JSON.stringify(results, null, 1));
