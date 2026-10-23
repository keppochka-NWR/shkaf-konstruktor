// w-formerrors (23.10): задача w059 тестера-2 мышью — распашной шкаф 2575 × 2587 × 600 из формы «Добавить мебель».
// npx tsx scripts/w-formerrors-scenario.ts <url studio/?fresh=1> <outDir> <метка до|после>
// «До» (ошибки по одной): «Добавить» → отказ → исправляю то, что сказано → снова «Добавить»… считаем отказы (циклы).
// «После» (ошибки списком): после выхода из полей все ошибки видны сразу → «Исправить автоматически» → «Добавить».
// Затем п.3: в панели модуля «Ширина» 1500 — отказ поля со всеми причинами. Только мышь и клавиатура; DOM — для проверки.
import { chromium, type Locator } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const [url, out, tag = "run"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const stats = { clicks: 0, inputs: 0, keys: 0, refusals: 0, corrections: 0, seconds: 0, modules: 0, widths: [] as number[], heights: [] as number[], doors: [] as number[], messages: [] as string[], issuesShown: 0, panelReasons: 0, panelMessage: "" };
const shot = (n: string) => page.screenshot({ path: `${out}/${tag}-${n}.png` });
const click = async (l: Locator) => { await l.scrollIntoViewIfNeeded(); await l.click(); stats.clicks++; };
async function field(aria: string, value: string) {
  const l = page.getByLabel(aria, { exact: true });
  await l.scrollIntoViewIfNeeded(); await l.click({ clickCount: 3 }); stats.clicks++;
  await page.keyboard.type(value); stats.inputs++;
  await page.keyboard.press("Tab"); stats.keys++;
  await page.waitForTimeout(250);
}
// пустая комната держит в сцене корпус-заготовку — число модулей считаем по проекту, «В комнате пока нет мебели» = 0
const arrangement = async () => (await page.getByText("В комнате пока нет мебели").count()) ? [] : (await page.evaluate(() => (window as unknown as { __arrangement?: () => { id: string; w: number }[] }).__arrangement?.() ?? []));
const saved = () => page.evaluate(() => { try { const p = Object.keys(localStorage).filter((k) => k.startsWith("module-studio-v3")).map((k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } }).filter((x) => Array.isArray(x?.modules)).sort((x, y) => y.modules.length - x.modules.length)[0]; return (p?.modules ?? []).map((a: { module: { width: number; height: number; sections: { doorLeaves?: number }[] } }) => ({ w: a.module.width, h: a.module.height, doors: a.module.sections.reduce((s, x) => s + (x.doorLeaves ?? 0), 0) })); } catch { return []; } });
const alertText = async () => (await page.locator('.module-palette p[role="alert"], .error-banner').allInnerTexts().catch(() => [] as string[])).join(" | ").replace(/\s+/g, " ").trim();
/** Выбор в списке клавиатурой: щелчок открывает список, стрелками до нужного пункта, Enter. */
async function pick(aria: string, option: RegExp) {
  const sel = page.getByLabel(aria, { exact: true });
  const opts = await sel.locator("option").allInnerTexts(), cur = await sel.evaluate((s: HTMLSelectElement) => s.selectedIndex);
  const want = opts.findIndex((o) => option.test(o)); if (want < 0) return false;
  await sel.scrollIntoViewIfNeeded(); await sel.click(); stats.clicks++;
  const key = want > cur ? "ArrowDown" : "ArrowUp";
  for (let i = 0; i < Math.abs(want - cur); i++) { await page.keyboard.press(key); stats.keys++; }
  await page.keyboard.press("Enter"); stats.keys++;
  await page.waitForTimeout(250); return (await sel.evaluate((s: HTMLSelectElement) => s.selectedIndex)) === want;
}

await page.goto(url);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("studio-tip-rmb", "1"); });
await page.goto(url); await page.waitForSelector("canvas", { state: "attached", timeout: 90000 }); await page.waitForTimeout(2000);
const t0 = Date.now();
await field("Ширина новой мебели", "2575");
await field("Высота новой мебели", "2587");
await field("Глубина новой мебели", "600");
await page.getByLabel("Глубина новой мебели", { exact: true }).scrollIntoViewIfNeeded();
await shot("01-entered");
const live = page.locator(".palette-issues");
if (await live.count()) {
  // ПОСЛЕ: ошибки списком до «Добавить»
  stats.issuesShown = await live.locator("li").count();
  stats.messages.push((await live.innerText()).replace(/\s+/g, " ").trim());
  await live.scrollIntoViewIfNeeded(); await shot("02-issues-list");
  await click(page.getByRole("button", { name: "Исправить автоматически", exact: true })); stats.corrections++;
  await page.waitForTimeout(500); await shot("03-auto-fixed");
  await click(page.getByRole("button", { name: "Добавить в комнату", exact: true }));
  await page.waitForTimeout(1500);
  if (!(await arrangement()).length) { stats.refusals++; stats.messages.push(await alertText()); }
} else {
  // ДО: ошибки по одной — каждый отказ исправляю так, как подсказывает сообщение (как тестер-2 в w059)
  for (let i = 0; i < 6 && !(await arrangement()).length; i++) {
    await click(page.getByRole("button", { name: "Добавить в комнату", exact: true }));
    await page.waitForTimeout(1200);
    if ((await arrangement()).length) break;
    const msg = await alertText(); stats.refusals++; stats.messages.push(msg);
    await shot(`02-refusal-${stats.refusals}`);
    if (/Ширина: допустимо/.test(msg)) await field("Ширина новой мебели", "1288");
    else if (/Высота: допустимо/.test(msg)) await field("Высота новой мебели", "2500");
    else if (/Фасад шире/.test(msg)) await pick("Дверей у новой мебели", /^4 · секций 2/);
    else break;
    stats.corrections++;
  }
  // второй корпус до 2575: та же форма, ширина 1287
  if ((await arrangement()).length === 1) {
    await page.getByRole("button", { name: "Пустой шкаф", exact: true }).scrollIntoViewIfNeeded().catch(() => undefined);
    await field("Ширина новой мебели", "1287");
    await click(page.getByRole("button", { name: "Добавить в комнату", exact: true }));
    await page.waitForTimeout(1500);
    if ((await arrangement()).length < 2) { stats.refusals++; stats.messages.push(await alertText()); }
  }
}
stats.seconds = Math.round((Date.now() - t0) / 100) / 10;
const arr = await arrangement(), mods = await saved();
stats.modules = arr.length; stats.widths = arr.map((a) => a.w); stats.heights = mods.map((m: { h: number }) => m.h); stats.doors = mods.map((m: { doors: number }) => m.doors);
await shot("04-added");
// п.3: панель модуля — «Ширина» 2600 (4 створки по ~640 при пределе 600), отказ поля со всеми причинами
const panelWidth = page.getByLabel("Ширина", { exact: true });
const openDetails = async (summary: Locator) => { if (!(await summary.count())) return; const s = summary.first(); if (!(await s.evaluate((x) => (x.parentElement as HTMLDetailsElement).open))) await click(s); await page.waitForTimeout(200); };
try {
  await openDetails(page.locator('details[data-settings-category="Корпус и размещение"] > summary'));
  if (!(await panelWidth.first().isVisible())) await openDetails(page.locator("details > summary").filter({ hasText: /^Габариты/ }));
} catch (e) { stats.panelMessage = "раскрытие панели: " + (e as Error).message.slice(0, 80); }
if (await panelWidth.count() && await panelWidth.first().isVisible()) {
  await panelWidth.first().scrollIntoViewIfNeeded(); await panelWidth.first().click({ clickCount: 3 });
  stats.heights = [Number(await page.getByLabel("Высота", { exact: true }).first().inputValue().catch(() => "0"))];
  await page.keyboard.type("2600"); await page.keyboard.press("Enter"); await page.waitForTimeout(600);
  stats.panelReasons = await page.locator(".error-banner .error-list li").count();
  stats.panelMessage = (await page.locator(".error-banner").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  await page.locator(".number-field.has-error").first().scrollIntoViewIfNeeded().catch(() => undefined);
  await shot("05-panel-width-2600");
}
writeFileSync(`${out}/${tag}-stats.json`, JSON.stringify({ ...stats, pageErrors: errors }, null, 2));
console.log(JSON.stringify({ tag, ...stats, pageErrors: errors.length }, null, 1));
await browser.close();
