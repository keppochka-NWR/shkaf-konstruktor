// Критик релиза 24.10 — короткие сценарии мышью по пяти замечаниям (окно 1366×768, своя сборка, только мышь и клавиатура; DOM — для проверки).
// npx tsx scripts/rel-2410-critic-scenario.ts <origin с папкой web, напр. http://127.0.0.1:8201> <outDir>
//  1) калькулятор купе: в DOM нет полей наценки profMarkup/fillMarkup, подпись версии «v 2.11 — прайс 2026.06.08» на месте;
//  2) шкаф 1200, «4 · секций 2» → «Частичная» перегородка → секции сами на одну створку (сообщение); «Две створки» — отказ с кнопкой;
//  3) «Кухня прямая» 7000 и «Прямая кухня по длине стены» 7000 — одна подпись «Длина 6000»;
//  4) «Кухня угловая (Г)», крыло у левой стены → «Добавить в комнату» → поле «Второе крыло» осталось «у левой стены»;
//  5) 2575 × 2587 × 600 → список ошибок → «Добавить в комнату» видна (над нижней панелью), поля не перекрыты.
import { chromium, type Locator, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const [origin = "http://127.0.0.1:8201", out = "rel-2410-critic"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const pageErrors: string[] = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
const results: { name: string; ok: boolean; info: string }[] = [];
const check = (name: string, ok: boolean, info = "") => { results.push({ name, ok, info }); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const shot = (n: string) => page.screenshot({ path: `${out}/${n}.png` });
const click = async (l: Locator) => { await l.scrollIntoViewIfNeeded(); await l.click(); };
async function field(aria: string, value: string, key = "Tab") {
  const l = page.getByLabel(aria, { exact: true });
  await l.scrollIntoViewIfNeeded(); await l.click({ clickCount: 3 });
  await page.keyboard.type(value); await page.keyboard.press(key); await page.waitForTimeout(300);
}
/** Выбор в списке клавиатурой: щелчок, стрелки до нужного пункта, Enter. */
async function pick(sel: Locator, option: RegExp) {
  const opts = await sel.locator("option").allInnerTexts(), cur = await sel.evaluate((s: HTMLSelectElement) => s.selectedIndex);
  const want = opts.findIndex((o) => option.test(o)); if (want < 0) return false;
  await sel.scrollIntoViewIfNeeded(); await sel.click();
  for (let i = 0; i < Math.abs(want - cur); i++) await page.keyboard.press(want > cur ? "ArrowDown" : "ArrowUp");
  await page.keyboard.press("Enter"); await page.waitForTimeout(300);
  return (await sel.evaluate((s: HTMLSelectElement) => s.selectedIndex)) === want;
}
async function fresh(p: Page) {
  const url = `${origin}/studio/?fresh=1`;
  await p.goto(url);
  await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("studio-tip-rmb", "1"); });
  await p.goto(url); await p.waitForSelector("canvas", { state: "attached", timeout: 90000 }); await p.waitForTimeout(1500);
}
/** Сохранённые модули проекта (localStorage) — для проверки результата действий. */
// проект живёт в «garderyob-rooms-v1» (комнаты) или «module-studio-v3…»: модули — объекты с sections и width (разбор — в node)
type M = { width: number; sections: { doorLeaves?: number; divider?: unknown }[] };
const savedModules = async (): Promise<M[]> => {
  await page.waitForTimeout(600);
  const raw = (await page.evaluate("Object.keys(localStorage).filter(k => k === 'garderyob-rooms-v1' || (k.startsWith('module-studio-v3') && !k.endsWith(':previous'))).sort().map(k => localStorage.getItem(k) || '')")) as string[];
  const out: M[] = [];
  const walk = (v: unknown) => { if (!v || typeof v !== "object") return; const o = v as Record<string, unknown>;
    if (Array.isArray(o.modules)) { for (const a of o.modules as { module?: M }[]) if (a?.module && Array.isArray(a.module.sections)) out.push(a.module); return; }
    for (const x of Object.values(o)) walk(x); };
  for (const s of raw) { try { walk(JSON.parse(s)); } catch { /* не JSON */ } if (out.length) break; }
  return out;
};
const rect = (l: Locator) => l.evaluate((e) => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
const dockTop = () => page.evaluate(() => Math.round(document.querySelector(".project-dock")?.getBoundingClientRect().top ?? innerHeight));

try {
  // ── 1. Калькулятор купе ─────────────────────────────────────────────────────────
  await page.goto(`${origin}/calc/`); await page.waitForTimeout(1500);
  const markup = await page.evaluate(() => document.querySelectorAll("#profMarkup, #fillMarkup, .inp-markup").length);
  const ver = (await page.locator("body").innerText()).match(/v\s*2\.11[^\n]*/)?.[0] ?? "";
  check("1. калькулятор купе: полей наценки profMarkup/fillMarkup в DOM нет", markup === 0, `найдено ${markup}`);
  check("1. подпись версии «v 2.11 — прайс 2026.06.08» на месте", /2\.11.*2026\.06\.08/.test(ver), ver);
  await shot("1-calc");

  // ── 5. 1366×768: список ошибок формы и кнопка «Добавить в комнату» ────────────────────
  await fresh(page);
  await field("Ширина новой мебели", "2575"); await field("Высота новой мебели", "2587"); await field("Глубина новой мебели", "600");
  await page.waitForTimeout(500);
  const issues = page.locator(".module-palette .palette-issues"), add = page.getByRole("button", { name: "Добавить в комнату", exact: true });
  let ir = await rect(issues), ar = await rect(add), dt = await dockTop();
  check("5. ошибки после выхода из полей: список и под ним «Добавить в комнату» видны (над нижней панелью)", ir.top >= 98 && ar.bottom <= dt && ar.top > ir.bottom - 1, `список ${ir.top}…${ir.bottom}, кнопка ${ar.top}…${ar.bottom}, панель ${dt}`);
  await shot("5-01-issues-live");
  await add.click(); await page.waitForTimeout(800); // мышью, без прокрутки — кнопка уже на экране
  ir = await rect(issues); ar = await rect(add);
  check("5. после «Добавить» (отказ) кнопка видна, список над ней", ar.bottom <= dt && ar.top >= 98 && ar.top > ir.bottom - 1, `список ${ir.top}…${ir.bottom}, кнопка ${ar.top}…${ar.bottom}`);
  const pos = await add.evaluate((e) => getComputedStyle(e).position);
  check("5. кнопка в обычном потоке (не прилипает поверх полей)", pos === "static", pos);
  await shot("5-02-after-add");
  await click(page.getByRole("button", { name: "Исправить автоматически", exact: true })); await page.waitForTimeout(600);
  ar = await rect(add);
  check("5. после «Исправить автоматически» кнопка тоже видна", ar.bottom <= dt && ar.top >= 98, `кнопка ${ar.top}…${ar.bottom}`);
  await shot("5-03-autofixed");

  // ── 3. Один предел — одна подпись (этап «Построение мебели»: там у кухни есть «Готовые кухонные модули») ─────
  await fresh(page);
  await click(page.getByRole("button", { name: "Добавить в комнату", exact: true })); await page.waitForTimeout(2000); // первый шкаф — открывается редактор
  if (!(await page.getByRole("tab", { name: /Кухонные/ }).first().isVisible())) { await click(page.locator("summary", { hasText: "Добавить мебель" }).first()); await page.waitForTimeout(400); }
  await click(page.getByRole("tab", { name: /Кухонные/ }).first());
  await click(page.getByRole("button", { name: /Кухня прямая/ }).first());
  await field("Ширина новой мебели", "7000");
  const tileFix = (await page.locator(".module-palette .palette-issues .pi-fixes button").allInnerTexts()).map((t) => t.trim());
  const tileProblem = (await page.locator(".module-palette .palette-issues b").allInnerTexts()).join(" | ");
  check("3. плитка «Кухня прямая» 7000: кнопка «Длина 6000»", tileFix.includes("Длина 6000") && !tileFix.some((t) => /^Ширина/.test(t)), `${tileProblem} · ${tileFix.join(", ")}`);
  await shot("3-01-tile-7000");
  await field("Ширина новой мебели", "6000");
  const presets = page.locator("details.catalog-presets").first();
  if (!(await presets.getAttribute("open"))) await click(presets.locator("summary").first());
  await field("Длина стены кухни", "7000");
  const rowFix = (await page.locator('[aria-label="Ошибки прямой кухни"] .pi-fixes button').allInnerTexts()).map((t) => t.trim());
  check("3. «Готовые кухонные модули › Прямая кухня по длине стены» 7000: тоже «Длина 6000»", rowFix.includes("Длина 6000"), rowFix.join(", "));
  await page.locator('[aria-label="Ошибки прямой кухни"]').scrollIntoViewIfNeeded();
  await shot("3-02-presets-7000");

  // ── 4. Г-кухня: «Второе крыло» сохраняется после «Добавить в комнату» ─────────────────
  await fresh(page);
  await click(page.getByRole("tab", { name: /Кухонные/ }).first());
  await click(page.getByRole("button", { name: /Кухня угловая/ }).first());
  const wing = () => page.getByLabel("Второе крыло угловой кухни", { exact: true });
  check("4. выбрал «у левой стены»", await pick(wing(), /у левой стены/));
  await shot("4-01-form-left");
  await click(page.getByRole("button", { name: "Добавить в комнату", exact: true })); await page.waitForTimeout(2000);
  const mods = (await savedModules()).length;
  if (!(await wing().first().isVisible().catch(() => false))) { await click(page.locator("summary", { hasText: "Добавить мебель" }).first()); await page.waitForTimeout(400); }
  const after = await wing().evaluate((s: HTMLSelectElement) => s.options[s.selectedIndex].text).catch(() => "нет поля");
  check("4. Г-кухня добавлена, «Второе крыло» осталось «у левой стены»", mods > 0 && after === "у левой стены", `модулей ${mods}, поле: ${after}`);
  await wing().scrollIntoViewIfNeeded().catch(() => {});
  await shot("4-02-after-add");

  // ── 2. Частичная перегородка при двух створках в секции ─────────────────────────────
  await fresh(page);
  await field("Ширина новой мебели", "1200"); await field("Высота новой мебели", "2300"); await field("Глубина новой мебели", "600");
  check("2. «Дверей: 4 · секций 2»", await pick(page.getByLabel("Дверей у новой мебели", { exact: true }), /^4 · секций 2/));
  await click(page.getByRole("button", { name: "Добавить в комнату", exact: true })); await page.waitForTimeout(2000);
  let m = (await savedModules())[0];
  check("2. шкаф 1200 добавлен: 2 секции по 2 створки", m?.sections.length === 2 && m.sections.every((s) => (s.doorLeaves ?? 0) === 2), JSON.stringify(m?.sections.map((s) => s.doorLeaves)));
  if (await page.getByText("Построение мебели").count()) { await click(page.getByText("Построение мебели").first()); await page.waitForTimeout(1200); }
  const cat = page.locator('details[data-settings-category="Наполнение"]');
  if (await cat.count() && !(await cat.getAttribute("open"))) await click(cat.locator("summary").first());
  const sub = page.locator('details[data-setting="Перегородки секции"]');
  if (await sub.count() && !(await sub.getAttribute("open"))) await click(sub.locator("summary").first());
  const row = page.getByTestId("divider-1");
  await click(row.getByRole("button", { name: "Частичная" })); await page.waitForTimeout(800);
  const note = (await page.getByTestId("studio-note").innerText().catch(() => "")).replace(/\s+/g, " ");
  m = (await savedModules())[0];
  check("2. «Частичная»: применилось, секции сами на одну створку, сообщение", !!m?.sections[1].divider && m.sections.every((s) => s.doorLeaves === 1) && /одна створка/.test(note) && !(await page.locator(".error-banner[role=alert]").count()), `створки ${JSON.stringify(m?.sections.map((s) => s.doorLeaves))}; «${note}»`);
  await shot("2-01-partial-one-leaf");
  // менеджер всё же выбирает «Две створки» в секции 1 — отказ с выполнимым советом и кнопкой
  const fac = page.locator('details[data-settings-category="Фасады и открывание"]');
  if (await fac.count() && !(await fac.getAttribute("open"))) await click(fac.locator("summary").first());
  await page.waitForTimeout(300);
  const leaves = page.getByLabel("Створки выбранной секции", { exact: true });
  for (let k = 0; k < 4; k++) { const closed = page.locator("details:not([open])", { has: leaves }); if (!(await closed.count())) break; await click(closed.first().locator(":scope > summary")); await page.waitForTimeout(300); }
  await pick(leaves, /^Две створки/); // «Фасады секции 1 › Створки» (отказ вернёт список на «Одна створка»)
  await page.waitForTimeout(600);
  const banner = page.locator(".error-banner[role=alert]");
  const btext = (await banner.innerText().catch(() => "")).replace(/\s+/g, " ");
  const oneBtn = banner.getByRole("button", { name: "Одна створка в секции", exact: true });
  check("2. «Две створки» у перегородки — отказ: «В секции у частичной перегородки — одна створка» + кнопка, без «Перевесьте»", /В секции у частичной перегородки — одна створка/.test(btext) && !/Перевесьте/.test(btext) && (await oneBtn.count()) === 1, btext.slice(0, 260));
  await shot("2-02-two-leaves-refused");
  await click(oneBtn); await page.waitForTimeout(800);
  m = (await savedModules())[0];
  check("2. кнопка «Одна створка в секции»: плашка закрыта, секция 1 — одна створка", !(await banner.count()) && m?.sections[0].doorLeaves === 1, JSON.stringify(m?.sections.map((s) => s.doorLeaves)));
  await shot("2-03-one-leaf-button");
} catch (e) {
  check("исключение", false, (e as Error).message.split("\n")[0]);
  await shot("zz-exception").catch(() => {});
}
check("без ошибок страницы", pageErrors.length === 0, pageErrors.join(" | "));
writeFileSync(`${out}/result.json`, JSON.stringify({ results, pageErrors }, null, 1));
await browser.close();
const bad = results.filter((r) => !r.ok).length;
console.log(`итог: ${results.length - bad} из ${results.length}`);
process.exit(bad ? 1 : 0);
