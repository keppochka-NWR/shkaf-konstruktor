// Заказ 7441182 (прихожая): сборка МЫШЬЮ как менеджер — от пустой комнаты до готового изделия, варианты 1 и 2.
// Окно 1366×768, своя сборка, только мышь и клавиатура для действий (DOM и localStorage — только для проверки результата).
// npx tsx scripts/o-7441182-manager.ts <origin с папкой web, напр. http://127.0.0.1:8251> <outDir> <variant 1|2>
// Пишет <outDir>/steps-v<variant>.json (шаги: клики, клавиши, поля, мс), снимки после ключевых шагов и проект
// <outDir>/manager-v<variant>.json (кнопка «Сохранить проект файлом»).
// Порядок важен: антресоли создаются кнопкой «Антресоль сверху» (копия нижнего корпуса) ДО включения у тумбы сиденья/щита/цоколя —
// иначе антресоль унаследует их от тумбы. «Без фальша у стены» — сразу после тумбы: антресоль над ней наследует признак.
// Решения Макса 26.10: всё по эскизу (общая ширина 930 без фальша у стены, ниша 1500, фасад тумбы 420 от цоколя до верха сиденья),
// цена — «по большей модели» (нижняя панель «Стоимость» → «Модель цены»); проект сохраняется файлом последним, с моделью цены.
// НОВОЕ (дописывается в ветке claude/o-7441182, на базе a966b13 элементов нет — шаг пропускается с пометкой «нет в интерфейсе»):
//   «Открывание фасадов» → «Ручка · петли без доводчика»; «Цоколь утоплен»; «Материал крыши» → «Посадочное место 32 мм»;
//   «Щит над сиденьем» + «Высота щита над сиденьем» + «Декор щита над сиденьем»; вариант 2 — «Тип распашных фасадов» → «Зеркало на ЛДСП».
import { chromium, type Locator } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

const [origin = "http://127.0.0.1:8251", out = "o-7441182-manager", variantArg = "1"] = process.argv.slice(2);
const variant = variantArg === "2" ? 2 : 1;
const DUMP = process.env.DUMP === "1"; // разведка: рядом со снимком — список видимых элементов
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const pageErrors: string[] = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

// ── учёт шагов ────────────────────────────────────────────────────────────────────────────────────────────────
type Step = { name: string; clicks: number; keys: number; fields: number; ms: number; notes: string[] };
const steps: Step[] = [];
let cur: Step | null = null, t0 = 0;
const T_START = performance.now();
function step(name: string) {
  end();
  cur = { name, clicks: 0, keys: 0, fields: 0, ms: 0, notes: [] }; t0 = performance.now();
  console.log("▶ " + name);
}
function end() { if (cur) { cur.ms = Math.round(performance.now() - t0); steps.push(cur); cur = null; } }
const note = (s: string) => { cur?.notes.push(s); console.log("   · " + s); };
const missing: string[] = []; // новые элементы, которых нет в этой сборке
const checks: { name: string; ok: boolean; info: string }[] = [];
const check = (name: string, ok: boolean, info = "") => { checks.push({ name, ok, info }); console.log((ok ? "   OK   " : "   FAIL ") + name + (info ? " — " + info : "")); };

// ── действия (только мышь и клавиатура) ───────────────────────────────────────────────────────────────────────
const wait = (ms = 400) => page.waitForTimeout(ms);
/** Раскрыть свёрнутые разделы панели (details) над элементом — щелчками по их заголовкам, снаружи внутрь. */
async function reveal(l: Locator) {
  for (let guard = 0; guard < 4; guard++) {
    const idx = await l.evaluate((e) => {
      let outer: HTMLDetailsElement | null = null;
      for (let c = e.parentElement; c; c = c.parentElement) if (c instanceof HTMLDetailsElement && !c.open) outer = c;
      if (!outer) return -1;
      return Array.from(document.querySelectorAll("details")).indexOf(outer);
    });
    if (idx < 0) return;
    const summary = page.locator("details").nth(idx).locator(":scope > summary");
    await summary.scrollIntoViewIfNeeded(); await summary.click(); if (cur) cur.clicks++; await wait(250);
  }
}
async function click(l: Locator, opt: { button?: "right" } = {}) {
  const x = l.first();
  await reveal(x);
  await x.scrollIntoViewIfNeeded(); await x.click(opt); if (cur) cur.clicks++; await wait();
}
async function key(k: string) { await page.keyboard.press(k); if (cur) cur.keys++; }
/** Число в поле: тройной щелчок (выделить), набор, Tab. */
async function field(l: Locator, value: string, finish = "Tab") {
  const x = l.first();
  await reveal(x);
  await x.scrollIntoViewIfNeeded(); await x.click({ clickCount: 3 }); if (cur) { cur.clicks += 3; cur.fields++; }
  await page.keyboard.type(value); if (cur) cur.keys += value.length;
  await key(finish); await wait();
}
const byLabel = (aria: string) => page.getByLabel(aria, { exact: true });
const btn = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });
/** Выбор в списке клавиатурой: щелчок, стрелки до пункта, Enter. */
async function pick(sel: Locator, option: RegExp) {
  const s = sel.first();
  await reveal(s);
  const opts = await s.locator("option").allInnerTexts(), now = await s.evaluate((e: HTMLSelectElement) => e.selectedIndex);
  const want = opts.findIndex((o) => option.test(o));
  if (want < 0) return false;
  if (want === now) return true;
  await s.scrollIntoViewIfNeeded(); await s.click(); if (cur) cur.clicks++;
  for (let i = 0; i < Math.abs(want - now); i++) await key(want > now ? "ArrowDown" : "ArrowUp");
  await key("Enter"); await wait();
  return (await s.evaluate((e: HTMLSelectElement) => e.selectedIndex)) === want;
}
/** Выбор в длинном списке (декоры) как менеджер: щелчок, набрать начало названия, Enter; не попал — стрелками. */
async function pickType(sel: Locator, typed: string, option: RegExp) {
  const s = sel.first();
  await reveal(s);
  await s.scrollIntoViewIfNeeded(); await s.click(); if (cur) cur.clicks++;
  await page.keyboard.type(typed, { delay: 60 }); if (cur) cur.keys += typed.length;
  await key("Enter"); await wait();
  const txt = await s.evaluate((e: HTMLSelectElement) => e.options[e.selectedIndex]?.text ?? "");
  return option.test(txt) || pick(sel, option);
}
const exists = async (l: Locator) => (await l.count()) > 0;
/** Новый элемент интерфейса (ветка claude/o-7441182): нет — шаг пропускается, отмечается в отчёте. */
async function newControl(l: Locator, what: string) {
  if (await exists(l)) return true;
  missing.push(what); note("нет в интерфейсе: " + what); return false;
}

// ── проверка (только чтение) ──────────────────────────────────────────────────────────────────────────────────
type Placed = { x: number; y?: number; z: number; module: Record<string, unknown> & { name: string; width: number; height: number; depth: number; sections: Record<string, unknown>[] } };
type Saved = { room?: Record<string, number>; modules: Placed[]; calculation?: Record<string, unknown> };
async function saved(): Promise<Saved> {
  await wait(600);
  const raw = (await page.evaluate("localStorage.getItem('garderyob-rooms-v1') || ''")) as string;
  let res: Saved = { modules: [] };
  const walk = (v: unknown) => {
    if (!v || typeof v !== "object" || res.modules.length) return;
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.modules) && o.room) { res = { room: o.room as Record<string, number>, modules: o.modules as Placed[], calculation: o.calculation as Record<string, unknown> | undefined }; return; }
    for (const x of Object.values(o)) walk(x);
  };
  try { walk(JSON.parse(raw)); } catch { /* нет проекта */ }
  return res;
}
const findMod = (mods: Placed[], w: number, h: number) => mods.find((a) => a.module.width === w && a.module.height === h);
let priceShown = "";

let shotN = 0;
async function shot(name: string) {
  const tag = `v${variant}-${String(++shotN).padStart(2, "0")}-${name}`;
  await page.screenshot({ path: `${out}/${tag}.png` });
  if (DUMP) {
    const items = (await page.evaluate(`(() => { const out = []; document.querySelectorAll("button, select, input, summary").forEach((e) => {
      const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return;
      let t = (e.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 90); const tag = e.tagName.toLowerCase();
      if (tag === "select") t = "[" + Array.from(e.options).map((o) => o.text).join(" / ").slice(0, 400) + "] = " + e.value;
      if (tag === "input") t = "type=" + e.type + " value=" + e.value + " checked=" + e.checked;
      out.push(tag + " @" + Math.round(r.x) + "," + Math.round(r.y) + ' aria="' + (e.getAttribute("aria-label") || "") + '" ' + t); }); return out; })()`)) as string[];
    writeFileSync(`${out}/${tag}.txt`, items.join("\n"));
  }
}
/** Выбрать корпус в списке слева (кнопка с размерами корпуса). */
async function select(w: number, h: number, d = 510) {
  await click(page.getByRole("button", { name: new RegExp(`${w} × ${h} × ${d}`) }));
  await wait(500);
}

try {
  // ── 0. Пустая комната ───────────────────────────────────────────────────────────────────────────────────────
  step("0. Открыть студию с пустой комнатой");
  const url = `${origin}/studio/?fresh=1`;
  await page.goto(url);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("studio-tip-rmb", "1"); });
  await page.goto(url); await page.waitForSelector("canvas", { state: "attached", timeout: 90000 }); await wait(1500);
  await shot("empty");

  step("1. Комната 3000 × 2000 × 2600");
  await field(byLabel("Ширина пустой комнаты"), "3000");
  await field(byLabel("Глубина пустой комнаты"), "2000");
  await field(byLabel("Высота пустой комнаты"), "2600");

  // ── 2. Тумба 500 × 500 × 510 (цоколь 80 + фасад 420 до верха сиденья 32 — по эскизу) ───────────────────────────
  step("2. Тумба: «Пустой шкаф» 500 × 500 × 510 → «Добавить в комнату»");
  await click(btn("Пустой шкаф"));
  await field(byLabel("Ширина новой мебели"), "500");
  await field(byLabel("Высота новой мебели"), "500");
  await field(byLabel("Глубина новой мебели"), "510");
  await click(btn("Добавить в комнату")); await wait(1500);
  await shot("tumba");

  step("2а. Тумба: «Без фальша у стены» — по эскизу, общая ширина 930 (решение Макса 26.10)");
  const noFiller = byLabel("Без фальша у стены"); // НОВОЕ
  if (await newControl(noFiller, "«Без фальша у стены»")) { if (!(await noFiller.first().isChecked())) await click(noFiller); }

  step("3. Тумба: одна полка посередине («Полок в секции» = 1)");
  await field(byLabel("Полок в секции"), "1");

  // ── 4. Правый шкаф 430 × 2000 × 510 ──────────────────────────────────────────────────────────────────────────
  step("4. Шкаф: «Пустой шкаф» 430 × 2000 × 510 → «Добавить в комнату»");
  await click(btn("Пустой шкаф"));
  await field(byLabel("Ширина новой мебели"), "430");
  await field(byLabel("Высота новой мебели"), "2000");
  await field(byLabel("Глубина новой мебели"), "510");
  await click(btn("Добавить в комнату")); await wait(1500);
  await shot("wardrobe");

  step("5. Шкаф: штанга (Наполнение › Штанги)");
  await click(byLabel("Штанга"));
  await shot("rod");

  // ── 6–7. Антресоли (до включения сиденья/щита у тумбы — антресоль копирует нижний корпус) ───────────────────────
  step("6. Антресоль на шкаф: «Антресоль сверху», высота 450");
  await click(btn(/^Антресоль сверху$/));  await wait(1200);
  await field(byLabel("Высота"), "450");
  await shot("upper-right");

  step("7. Антресоль над тумбой: выбрать тумбу, «Антресоль сверху», высота 450, от пола 2000");
  await select(500, 500);
  await click(btn(/^Антресоль сверху$/)); await wait(1200);
  await field(byLabel("Высота"), "450");
  await field(byLabel("От пола"), "2000");
  await shot("upper-left");

  // ── 8. Декор всем корпусам: Lamarty «Каньон ледяной» (корпус и фасады) ─────────────────────────────────────────
  step("8. Декор корпуса всем: «Материал корпуса › Все» → «Все корпуса проекта» → «Каньон»");
  await click(page.locator('details[data-setting="Материал корпуса"] button.more-materials'));
  await pick(byLabel("К каким корпусам применить материал"), /^Все корпуса проекта/);
  await field(byLabel("Найти декор"), "Каньон", "Tab");
  await click(page.locator(".decor-grid button", { hasText: /Каньон Ледяной/i }));
  await shot("decor");

  step("9. Декор фасадов всем: «Фасад › Материал фасадов» → «Все корпуса проекта» → «Каньон»");
  await click(page.locator('details[data-setting="Фасад"] button', { hasText: /^Материал фасадов/ }));
  await pick(byLabel("К каким корпусам применить материал"), /^Все корпуса проекта/);
  await field(byLabel("Найти декор"), "Каньон", "Tab");
  await click(page.locator(".decor-grid button", { hasText: /Каньон Ледяной/i }));
  await shot("facade-decor");

  // ── 10. Ручка всем: торцевая FP527 160 ──────────────────────────────────────────────────────────────────────
  step("10. Ручка всем дверям: «Ручки › Ручки фасадов» → «Все корпуса проекта» → «FP527»");
  await click(page.locator('details[data-setting="Ручки"] button', { hasText: /^Ручки фасадов/ }));
  await pick(byLabel("К каким корпусам применить ручку"), /^Все корпуса проекта/);
  await field(byLabel("Найти ручку"), "FP527", "Tab");
  await click(page.locator(".handle-list button", { hasText: /FP527/ }));
  await shot("handles");

  // ── 11. Новое: петли без доводчика, цоколь утоплен, сиденье, щит, (вариант 2) зеркало ───────────────────────────
  const opening = byLabel("Открывание фасадов");
  for (const [w, h, label] of [[500, 500, "тумба"], [430, 2000, "шкаф"], [430, 450, "антресоль на шкафу"], [500, 450, "антресоль над нишей"]] as const) {
    step(`11. ${label}: петли без доводчика`);
    await select(w, h);
    if (await newControl(opening.locator("option", { hasText: "петли без доводчика" }), "«Открывание фасадов» → «Ручка · петли без доводчика»"))
      check(`${label}: петли без доводчика выбраны`, await pick(opening, /петли без доводчика/));
  }
  for (const [w, h, label] of [[500, 500, "тумба"], [430, 2000, "шкаф"]] as const) {
    step(`12. ${label}: цоколь утоплен`);
    await select(w, h);
    const recess = byLabel("Цоколь утоплен"); // НОВОЕ
    if (await newControl(recess, "«Цоколь утоплен»")) { if (!(await recess.first().isChecked())) await click(recess); }
  }
  step("13. Тумба: посадочное место 32 мм («Крыша корпуса», функция ветки o-7437584a)");
  await select(500, 500);
  const roof = byLabel("Крыша корпуса");
  if (await newControl(roof.locator("option", { hasText: "Посадочное место 32" }), "«Крыша корпуса» → «Посадочное место 32»"))
    check("тумба: посадочное место 32 мм", await pick(roof, /Посадочное место 32/));
  step("14. Тумба: щит над сиденьем 1500 (ниша по эскизу), декор Марципан");
  const panel = byLabel("Щит над сиденьем"); // НОВОЕ
  if (await newControl(panel, "«Щит над сиденьем»")) {
    if (!(await panel.first().isChecked())) await click(panel);
    await field(byLabel("Высота щита над сиденьем"), "1500"); // НОВОЕ
    check("щит: декор Марципан", await pickType(byLabel("Декор щита над сиденьем"), "МАРЦ", /марципан/i)); // НОВОЕ
  }
  await shot("tumba-seat");
  if (variant === 2) {
    step("15. Вариант 2: дверь шкафа — «Зеркало на фасадах» → зеркало серебро (функция ветки o-7427796)");
    await select(430, 2000);
    const mir = byLabel("Зеркало на фасадах");
    if (await newControl(mir.locator("option", { hasText: "Зеркало серебро" }), "«Зеркало на фасадах» → «Зеркало серебро 4 мм»"))
      check("шкаф: зеркальный фасад", await pick(mir, /Зеркало серебро/));
    await shot("mirror");
  }

  // ── 16. Цена по большей модели (решение Макса 26.10.2026): нижняя панель «Стоимость» → «Модель цены» ───────────────
  step("16. Цена: «Стоимость» → «Модель цены» → «Цена по большей модели»");
  await page.mouse.move(660, 450); await key("Escape"); await wait(300);
  await click(page.locator(".dock-tabs button", { hasText: "Стоимость" }));
  const model = byLabel("Модель цены"); // НОВОЕ
  if (await newControl(model, "«Модель цены» → «Цена по большей модели»")) {
    check("модель цены: по большей", await pick(model, /по большей модели/));
    await wait(900);
    note("цены по моделям: " + ((await byLabel("Цены по моделям").first().innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim());
  }
  await shot("price-model");
  await click(page.locator(".dock-tabs button", { hasText: "Стоимость" })); // закрыть панель (вкладка — переключатель)

  // ── 17. Итог: снимки ─────────────────────────────────────────────────────────────────────────────────────────
  step("17. Снимки: 3D, спереди, без фасадов (Esc — снять выделение)");
  await page.mouse.move(660, 450); await key("Escape"); await wait(300);
  // «Показать размеры» — снять подписи размеров на снимках; колесо мыши — приблизить композицию (как менеджер перед показом клиенту)
  const dims = byLabel("Показать размеры"); if (await exists(dims) && (await dims.first().getAttribute("aria-pressed")) === "true") await click(dims);
  const zoomIn = async () => { await page.mouse.move(560, 430); for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -240); note("колесо мыши: приблизить"); await wait(150); } await wait(500); };
  await click(btn("3D")); await wait(800); await zoomIn(); await shot("final-3d");
  await click(btn("Спереди")); await wait(800); await zoomIn(); await shot("final-front");
  await click(btn("Скрыть фасады")); await wait(800); await shot("final-nofacades");
  await click(btn("Показать фасады").or(btn("Скрыть фасады"))); await wait(400);
  await click(btn("3D")); await wait(400);

  // ── 18–19. Документы: смета Excel и КП (как менеджер: нижняя панель «Стоимость», «Коммерческое предложение») ──────────
  step("18. «Стоимость» → «Стоимость проекта» → «Скачать Excel»");
  await click(page.locator(".dock-tabs button", { hasText: "Стоимость" }));
  await click(btn("Стоимость проекта"));
  const shownTotal = ((await page.locator(".sales-total").first().textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
  note("итог на экране: " + shownTotal);
  const xl = page.waitForEvent("download", { timeout: 20000 }); xl.catch(() => {});
  await click(btn("Скачать Excel"));
  await (await xl).saveAs(`${out}/Смета-v${variant}.xlsx`);
  await shot("estimate");
  end();
  step("19. «Коммерческое предложение» → «Подставить текущую смету» → «Предпросмотр КП»");
  await click(page.getByRole("button", { name: "Коммерческое предложение", exact: true }));
  const fill = btn("Подставить текущую смету"); if (await exists(fill)) await click(fill);
  await click(btn("Предпросмотр КП")); await wait(1500);
  const frame = page.locator('iframe[title="Предпросмотр коммерческого предложения"]');
  const doc = (await frame.getAttribute("srcdoc").catch(() => null)) ?? "";
  if (doc) { writeFileSync(`${out}/КП-v${variant}.html`, doc);
    // PDF A4 из предпросмотра КП (тот же документ, что менеджер печатает кнопкой) — отдельной страницей для печати
    const kp = await context.newPage(); await kp.setViewportSize({ width: 900, height: 1200 }); await kp.setContent(doc, { waitUntil: "load" });
    await kp.emulateMedia({ media: "print" }); await kp.pdf({ path: `${out}/КП-v${variant}.pdf`, format: "A4", printBackground: true }); await kp.close(); }
  check("КП: предпросмотр есть", doc.length > 1000, doc.length + " символов");
  await shot("kp");
  await click(btn("Закрыть окно")).catch(async () => { await key("Escape"); });
  end();

  step("20. «Заказ и инструменты» → «Сохранить проект файлом» (последним — с моделью цены)");
  const save = byLabel("Сохранить проект файлом");
  if (!(await save.first().isVisible())) await click(byLabel("Заказ и инструменты"));
  const dl = page.waitForEvent("download", { timeout: 20000 });
  dl.catch(() => {});
  await click(save);
  const file = await dl; await file.saveAs(`${out}/manager-v${variant}.json`);
  note("проект сохранён: manager-v" + variant + ".json");
  end();


  // ── проверки результата (чтение localStorage и строки цены — без действий) ───────────────────────────────────
  priceShown = ((await byLabel("Открыть стоимость").first().innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
  console.log("   цена в строке состояния: " + priceShown);
  const p = await saved();
  check("комната 3000 × 2000 × 2600", p.room?.width === 3000 && p.room?.depth === 2000 && p.room?.height === 2600, JSON.stringify(p.room && { w: p.room.width, d: p.room.depth, h: p.room.height }));
  check("в проекте 4 корпуса", p.modules.length === 4, `корпусов ${p.modules.length}`);
  const tumba = findMod(p.modules, 500, 500), ward = findMod(p.modules, 430, 2000), upR = findMod(p.modules, 430, 450), upL = findMod(p.modules, 500, 450);
  check("тумба 500 × 500 × 510, одна полка", !!tumba && tumba.module.depth === 510 && (tumba.module.sections[0]?.shelves as unknown[])?.length === 1, tumba ? `x ${tumba.x}, полок ${(tumba.module.sections[0]?.shelves as unknown[])?.length}` : "нет");
  check("шкаф 430 × 2000 × 510 справа вплотную, штанга", !!ward && !!tumba && Math.abs(ward.x - (tumba.x + 500)) <= 1 && ward.module.sections[0]?.rod === true, ward ? `x ${ward.x}` : "нет");
  check("антресоль 430 × 450 на шкафу (от пола 2000)", !!upR && upR.y === 2000 && !!ward && upR.x === ward.x, upR ? `x ${upR.x} y ${upR.y}` : "нет");
  check("антресоль 500 × 450 над тумбой (от пола 2000)", !!upL && upL.y === 2000 && !!tumba && upL.x === tumba.x, upL ? `x ${upL.x} y ${upL.y} навесной ${String(upL.module.hanging)}` : "нет");
  check("декор корпуса и фасадов — Каньон Ледяной у всех", p.modules.every((a) => a.module.decor === "Каньон Ледяной" && a.module.facadeDecor === "Каньон Ледяной"), p.modules.map((a) => `${a.module.decor}/${a.module.facadeDecor}`).join(", "));
  check("ручка FP527 у всех", p.modules.every((a) => a.module.handleId === "fp527-160"), p.modules.map((a) => String(a.module.handleId)).join(", "));
  // новые функции (заказ 7441182 и влитые ветки)
  check("петли без доводчика у всех 4", p.modules.every((a) => a.module.hingeSoft === false), p.modules.map((a) => String(a.module.hingeSoft)).join(", "));
  check("цоколь утоплен у тумбы и шкафа (50)", tumba?.module.plinthRecess === 50 && ward?.module.plinthRecess === 50, `${tumba?.module.plinthRecess} / ${ward?.module.plinthRecess}`);
  check("тумба: посадочное место 32", tumba?.module.seatTop === true);
  const sp = tumba?.module.seatPanel as { height?: number; decor?: string } | undefined;
  check("тумба: щит над сиденьем 1500 Марципан (ниша 1500 по эскизу)", sp?.height === 1500 && sp?.decor === "МАРЦИПАН", JSON.stringify(sp));
  check("антресоли без сиденья/щита/утопленного цоколя", !!upL && !!upR && [upL, upR].every((a) => !a.module.seatTop && !a.module.seatPanel && a.module.plinthRecess === undefined));
  check(variant === 2 ? "вариант 2: зеркало на фасаде шкафа" : "вариант 1: зеркала нет", variant === 2 ? ward?.module.mirror === "mirror-silver" : !p.modules.some((a) => a.module.mirror), String(ward?.module.mirror));
  // решения Макса 26.10: общая ширина 930 без фальша у стены, цена по большей модели
  const left = Math.min(...p.modules.map((a) => a.x)), right = Math.max(...p.modules.map((a) => a.x + a.module.width));
  check("по эскизу: общая ширина 930 от стены (без фальша)", left === 0 && right - left === 930, `от ${left} до ${right}`);
  check("без фальша у стены: тумба и антресоль над нишей", !!tumba && !!upL && [tumba, upL].every((a) => a.module.autoFillersOff === true && !a.module.wallFiller));
  check("цена по большей модели в проекте", p.calculation?.maxModel === true, JSON.stringify(p.calculation && { maxModel: p.calculation.maxModel, sheetPrice: p.calculation.sheetPrice }));
  check("ошибок страницы нет", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
} catch (e) {
  note("ОШИБКА: " + (e as Error).message.split("\n")[0]);
  await shot("error").catch(() => {});
  end();
  checks.push({ name: "сценарий дошёл до конца", ok: false, info: (e as Error).message.split("\n")[0] });
}
end();
const total = { clicks: steps.reduce((s, x) => s + x.clicks, 0), keys: steps.reduce((s, x) => s + x.keys, 0), fields: steps.reduce((s, x) => s + x.fields, 0), ms: Math.round(performance.now() - T_START) };
writeFileSync(`${out}/steps-v${variant}.json`, JSON.stringify({ order: "7441182", variant, origin, viewport: "1366x768", priceShown, total, steps, missing, checks, pageErrors }, null, 1));
console.log(`ИТОГ v${variant}: кликов ${total.clicks}, клавиш ${total.keys}, полей ${total.fields}, ${Math.round(total.ms / 1000)} с; проверок ${checks.filter((c) => c.ok).length}/${checks.length}; нет в интерфейсе: ${missing.length}`);
await browser.close();
