// Заказ 7437584, изделия 2, 4, 5 — сборка МЫШЬЮ как менеджер, от пустой комнаты: размеры помещения, палитра, панели справа, клавиатура.
// npx tsx scripts/order-7437584-b-manager.ts <url studio/?fresh=1> <outDir>
// Действия — только клики, ввод с клавиатуры и выбор в списках клавиатурой. Проект берётся кнопкой «Сохранить проект файлом» (файл
// менеджера); DOM и хранилище — только чтение для проверки. В конце — сравнение с функциональной сборкой (scripts/order-7437584-b.ts):
// детали (число, габариты) по каждому модулю и цена по каждому изделию (modulePrices, как в КП).
import { chromium, type Locator } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parts, type Module } from "../src/model";
import { estimate } from "../src/pricing";
import { modulePrices } from "../src/itemPrices";
import { parseProject, type Project, type PlacedModule } from "../src/project";
import { orderProject } from "./order-7437584-b";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const st = { clicks: 0, inputs: 0, keys: 0 };
const log: { step: string; ok: boolean; sec: number; clicks: number; info: string }[] = [];
const shot = (n: string) => page.screenshot({ path: `${out}/${n}.png` }).catch(() => {});
const wait = (ms = 350) => page.waitForTimeout(ms);
const role = (r: Parameters<typeof page.getByRole>[0], name: string | RegExp) => page.getByRole(r, { name, includeHidden: true, exact: typeof name === "string" });
/** Раскрыть свёрнутые разделы панели над элементом — щелчком по их заголовкам (как менеджер). */
async function reveal(l: Locator) {
  if (!(await l.count())) throw Error("нет элемента " + l.toString());
  for (let k = 0; k < 4; k++) {
    const closed = l.locator("xpath=ancestor::details[not(@open)]/summary");
    if (!(await closed.count())) break;
    await closed.first().scrollIntoViewIfNeeded(); await closed.first().click(); st.clicks++; await wait(200);
  }
  await l.scrollIntoViewIfNeeded({ timeout: 4000 });
}
const banner = async () => { const s = (await page.locator(".error-banner[role=alert]").allInnerTexts().catch(() => [] as string[])).join(" ").replace(/\s+/g, " ").trim(); return s ? " · студия: " + s.slice(0, 220) : ""; };
const click = async (l: Locator) => { await reveal(l); await l.click({ timeout: 4000 }); st.clicks++; await wait(); };
async function field(label: string, value: number) {
  const l = page.getByLabel(label, { exact: true }).first();
  await reveal(l); await l.click({ clickCount: 3, timeout: 4000 }); st.clicks++;
  await page.keyboard.type(String(value)); st.inputs++;
  await page.keyboard.press("Enter"); st.keys++; await wait(500);
  const now = await l.inputValue().catch(() => "");
  if (now !== String(value)) throw Error(`«${label}» = ${now}, ожидалось ${value}` + (await banner()));
}
async function pick(label: string, option: RegExp) {
  const sel = page.getByLabel(label, { exact: true }).first();
  await reveal(sel);
  const opts = await sel.locator("option").allInnerTexts(), cur = await sel.evaluate((s: HTMLSelectElement) => s.selectedIndex);
  const want = opts.findIndex((o) => option.test(o.trim()));
  if (want < 0) throw Error(`«${label}»: нет пункта ${option} (${opts.slice(0, 8).join(" | ")})`);
  if (want === cur) return;
  await sel.focus(); st.clicks++;
  const key = want > cur ? "ArrowDown" : "ArrowUp";
  for (let i = 0; i < Math.abs(want - cur); i++) { await page.keyboard.press(key); st.keys++; }
  await wait(500);
  if ((await sel.evaluate((s: HTMLSelectElement) => s.selectedIndex)) !== want) throw Error(`«${label}»: не выбрался ${option}`);
}
async function check(label: string, on: boolean) { const cb = page.getByLabel(label, { exact: true }).first(); await reveal(cb); if ((await cb.isChecked()) !== on) { await cb.click(); st.clicks++; await wait(); } }
async function switchOn(name: string) { const sw = role("switch", name); await reveal(sw); if ((await sw.getAttribute("aria-checked")) !== "true") { await sw.click(); st.clicks++; await wait(); } if ((await sw.getAttribute("aria-checked")) !== "true") throw Error(name + ": не включился"); }
async function step(name: string, fn: () => Promise<unknown>) {
  const t = Date.now(), c0 = st.clicks;
  try { const info = await fn(); log.push({ step: name, ok: true, sec: (Date.now() - t) / 1000, clicks: st.clicks - c0, info: typeof info === "string" ? info : "" }); console.log("OK   " + name + (typeof info === "string" && info ? " — " + info : "")); }
  catch (e) { log.push({ step: name, ok: false, sec: (Date.now() - t) / 1000, clicks: st.clicks - c0, info: (e as Error).message.split("\n")[0] }); console.log("FAIL " + name + " — " + (e as Error).message.split("\n")[0]); await shot("fail-" + log.length); }
}
const selectInList = async (text: string) => { await click(page.locator(".project-modules").getByText(text, { exact: false }).first()); await wait(500); };
const section = async (n: number) => pick("Выбранная секция", new RegExp("^Секция " + n));
const addFromPalette = async (tab: string, kind: string, w: number, h: number, d: number, extra?: () => Promise<void>) => {
  await click(role("tab", tab));
  await click(page.locator(".module-kinds button").filter({ hasText: kind }).first());
  await field("Ширина новой мебели", w); await field("Высота новой мебели", h); await field("Глубина новой мебели", d);
  if (extra) await extra();
  const before = await page.locator(".project-modules").innerText().catch(() => "");
  await click(role("button", "Добавить в комнату")); await wait(1500);
  const alert = (await page.locator('.module-palette p[role="alert"], .palette-issues').allInnerTexts().catch(() => [] as string[])).join(" ").trim();
  if (alert) throw Error("палитра: " + alert.replace(/\s+/g, " ").slice(0, 200));
  if ((await page.locator(".project-modules").innerText().catch(() => "")) === before) throw Error("в список ничего не добавилось");
};
const drawerTab = (j: number) => page.locator(".drawer-tabs button").nth(j - 1);
/** Декор через окно материалов: «Материал корпуса» или «Материал ящиков» → поиск → плитка декора (выбранный корпус). */
async function decor(target: "body" | "drawers", name: string) {
  await click(target === "body" ? page.locator(".material-choice").first() : page.getByRole("button", { name: /^Материал ящиков/, includeHidden: true }).first());
  const s = page.getByLabel("Найти декор", { exact: true }); await s.click(); st.clicks++; await page.keyboard.type(name); st.inputs++; await wait(300);
  await click(page.locator(".decor-grid button").first()); await wait(400);
}
const t0 = Date.now();
try {
  await page.goto(url);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("studio-tip-rmb", "1"); });
  await page.goto(url); await page.waitForSelector("canvas", { state: "attached", timeout: 90000 }); await wait(2500);
  await shot("00-empty-room");
  await step("Помещение: 9000 × 3000 × 2800 (поля пустой комнаты; купе палитра ставит по центру стены)", async () => { await field("Ширина пустой комнаты", 9000); await field("Глубина пустой комнаты", 3000); await field("Высота пустой комнаты", 2800); });
  // ── Изделие 2: шкаф-купе 1660 × 2600 × 600, двери внутри, 2 двери
  await step("И2: палитра «Шкафы-купе» 1660×2600×600, двери внутри, 2 двери → «Добавить в комнату»", () => addFromPalette("Шкафы-купе", "Шкаф-купе", 1660, 2600, 600, async () => { await pick("Установка дверей купе", /внутри/); await pick("Дверей купе у новой мебели", /^2$/); }));
  await step("И2: выбрать корпус в списке слева", () => selectInList("Корпус шкафа-купе"));
  await step("И2: «Материал корпуса» › Клауд", () => decor("body", "Клауд"));
  await step("И2: «Опоры › Высота цоколя» 100", () => pick("Высота цоколя", /^100/));
  await step("И2: «Выбранная секция» 2 › «Разделить пополам» → 3 секции", async () => { await section(2); await click(role("button", /Разделить пополам/)); return (await page.getByLabel("Выбранная секция", { exact: true }).locator("option").count()) + " секции"; });
  await step("И2: «Внутренняя ширина» секции 1 — 816, секции 2 — 390 (секция 3 — 390)", async () => { await section(1); await field("Внутренняя ширина", 816); await section(2); await field("Внутренняя ширина", 390); await section(3); return "секция 3: " + (await page.getByLabel("Внутренняя ширина", { exact: true }).first().inputValue()); });
  await step("И2: секция 1 — «Полок в секции» 1, «Полка 1» 1976 (антресоль 500), жёсткая", async () => { await section(1); await field("Полок в секции", 1); await field("Полка 1", 1976); await check("Полка 1 жёсткая", true); });
  await step("И2: секция 1 — «Штанга» и «Вешалка в два яруса» (новое)", async () => { await switchOn("Штанга"); await switchOn("Вешалка в два яруса"); return "нижняя штанга " + (await page.getByLabel("Нижняя штанга от дна", { exact: true }).first().inputValue()) + " от дна"; });
  await shot("01-kupe-left-two-tier");
  await step("И2: секция 2 — «Полок в секции» 0, 4 ящика кнопкой «+»", async () => { await section(2); await field("Полок в секции", 0); for (let i = 0; i < 4; i++) await click(role("button", "Добавить: Ящики")); });
  await step("И2: секция 2 — «От дна пенала до верха полки над ящиками» 816 (ящики поровну по 200)", () => field("От дна пенала до верха полки над ящиками", 816));
  await step("И2: секция 2 — «Ящик 1» › «Направляющие ящика» скрытые Unihopper с доводчиком › «Эти направляющие всем ящикам секции»", async () => { await click(drawerTab(1)); await pick("Направляющие ящика", /Скрытые Unihopper · с доводчиком/); await click(role("button", "Эти направляющие всем ящикам секции")); });
  await step("И2: секция 2 — «Ручка ящика» › «Зазор между ящиками 30 мм» (открытие за верх фасада)", () => pick("Ручка ящика", /Зазор между ящиками 30/));
  await step("И2: секция 2 — «Полок в секции» 4; «Полка 1…4» 1976 / 1100 / 1392 / 1684; жёсткие 1 и 3", async () => {
    await field("Полок в секции", 4);
    for (const [j, v] of [[1, 1976], [4, 1684], [2, 1100], [3, 1392]] as const) await field(`Полка ${j}`, v);
    for (const j of [1, 2, 3, 4]) await check(`Полка ${j} жёсткая`, j === 1 || j === 3);
  });
  await step("И2: секция 2 › «Копировать наполнение секции» → секция 3 › «Вставить наполнение секции»", async () => { await click(role("button", "Копировать наполнение секции")); await section(3); await click(role("button", /Вставить наполнение секции|Заменить наполнение копией/)); });
  await step("И2: «Фасады ящиков › Материал ящиков» › Клауд", () => decor("drawers", "Клауд"));
  await shot("02-kupe-body");
  await step("И2: двери купе — «Наполнение дверей купе» Клауд", async () => { await selectInList("Двери купе"); await pick("Наполнение дверей купе", /Клауд|Cloud/i); });
  // ── Изделие 4: ТВ-зона
  await step("И4: палитра «Подвесной ящик» 800×200×284 (новое) → в комнату", () => addFromPalette("Шкафы распашные", "Подвесной ящик", 800, 200, 284));
  await step("И4: подвесной ящик — материал корпуса и ящика Тэффи", async () => { await decor("body", "Тэффи"); await decor("drawers", "Тэффи"); });
  await step("И4: подвесной ящик — «От пола» 600, «От левой стены» 3700", async () => { await field("От пола", 600); await field("От левой стены", 3700); });
  await step("И4: палитра «Комод» 1800×800×284 › «Корпусов в ряд» 2 → в комнату", () => addFromPalette("Шкафы распашные", "Комод", 1800, 800, 284, async () => { await pick("Корпусов в ряд у новой мебели", /^2/); }));
  for (const [n, x] of [[1, 4500], [2, 5400]] as const) {
    await step(`И4: комод ${n} — «От левой стены» ${x}`, async () => { await selectInList("Комод " + n); await field("От левой стены", x); });
    await step(`И4: комод ${n} — материал корпуса и ящиков Тэффи`, async () => { await decor("body", "Тэффи"); await decor("drawers", "Тэффи"); });
    await step(`И4: комод ${n} — боковины ящиков сверху вниз: 3-й 144, 2-й 220, 1-й 204 (верхние поднимаются сами; фасады 308 / 258 / 198)`, async () => {
      await click(drawerTab(3)); await field("Высота боковины ящика", 144);
      await click(drawerTab(2)); await field("Высота боковины ящика", 220);
      await click(drawerTab(1)); await field("Высота боковины ящика", 204);
    });
    await step(`И4: комод ${n} — скрытые Unihopper с доводчиком всем ящикам`, async () => { await click(drawerTab(1)); await pick("Направляющие ящика", /Скрытые Unihopper · с доводчиком/); await click(role("button", "Эти направляющие всем ящикам секции")); });
    await step(`И4: комод ${n} — «Ручки ящиков» › HEXA 160 чёрный мат`, async () => { await click(page.getByRole("button", { name: /^Ручки ящиков/, includeHidden: true })); await click(page.locator(".handle-item").filter({ hasText: "HEXA · 160 · чёрный мат" }).first()); await page.keyboard.press("Escape"); st.keys++; await wait(400); });
  }
  await step("И4: палитра «Кухонные модули › Столешница» 2600×32×320 → на комоды, ЛДСП 32 (новое)", () => addFromPalette("Кухонные модули", "Столешница", 2600, 32, 320));
  await step("И4: столешница — «От левой стены» 3700", () => field("От левой стены", 3700));
  // ── Изделие 5
  await step("И5: палитра «Подвесной ящик» 600×200×284 → в комнату", () => addFromPalette("Шкафы распашные", "Подвесной ящик", 600, 200, 284));
  await step("И5: материал корпуса и ящика Тэффи", async () => { await decor("body", "Тэффи"); await decor("drawers", "Тэффи"); });
  await step("И5: «От пола» 900, «От левой стены» 7000", async () => { await field("От пола", 900); await field("От левой стены", 7000); });
  await page.keyboard.press("Escape"); await wait(300);
  await step("Вид 3D", async () => { await click(role("button", "3D")); await wait(1500); });
  await shot("03-3d");
  await step("Вид спереди", async () => { await click(role("button", "Спереди")); await wait(1500); });
  await shot("04-front");
  await step("Стоимость", async () => { await click(page.getByRole("button", { name: "Стоимость" }).first()); await wait(1200); });
  await shot("05-estimate");
  await step("«Сохранить проект файлом» — файл проекта менеджера", async () => {
    const save = page.getByRole("button", { name: "Сохранить проект файлом", includeHidden: true }).first();
    if (!(await save.isVisible())) { await click(page.getByRole("button", { name: /Заказ и инструменты/ }).first()); }
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), click(save)]);
    await dl.saveAs(`${out}/manager-project.json`); return dl.suggestedFilename();
  });
} finally {
  const total = (Date.now() - t0) / 1000;
  const res: Record<string, unknown> = { seconds: Math.round(total), ...st, steps: log, pageErrors: errors.slice(0, 5) };
  let mp: Project | null = null;
  try { const raw = JSON.parse(readFileSync(`${out}/manager-project.json`, "utf8")); mp = parseProject(raw.modules ? raw : raw.project ?? raw); } catch (e) { res.readError = (e as Error).message; }
  if (mp) {
    const fp = orderProject();
    const kind = (a: PlacedModule): string => { const m = a.module; return m.kupeZone ? "И2 корпус" : m.kupe ? "И2 двери" : m.worktop ? "И4 столешница" : m.hanging && m.width === 800 ? "И4 подвесной ящик" : m.hanging && m.width === 600 ? "И5 подвесной ящик" : m.width === 900 && m.height === 800 ? "И4 комод" : "?"; };
    const order = (p: Project) => p.modules.map((a, i) => ({ a, i, k: kind(a) })).sort((x, y) => x.k.localeCompare(y.k) || x.a.x - y.a.x);
    const sig = (m: Module) => parts(m).map((x) => `${x.name} ${x.size.map((v) => Math.round(v)).join("×")} ${x.decor}`).sort();
    const fo = order(fp), mo = order(mp), rows: string[] = [];
    let same = fo.length === mo.length;
    fo.forEach((f, j) => {
      const m = mo.filter((x) => x.k === f.k)[fo.filter((x) => x.k === f.k).indexOf(f)];
      if (!m) { rows.push(`| ${f.k} | ${sig(f.a.module).length} | — | нет модуля мышью |`); same = false; return; }
      const a = sig(f.a.module), b = sig(m.a.module), only = (p: string[], q: string[]) => { const r = [...q]; return p.filter((x) => { const i = r.indexOf(x); if (i >= 0) { r.splice(i, 1); return false; } return true; }); };
      const df = only(a, b), dm = only(b, a); if (df.length || dm.length) same = false;
      rows.push(`| ${f.k} ${f.a.module.width}×${f.a.module.height}×${f.a.module.depth} | ${a.length} | ${b.length} | ${df.length || dm.length ? "функции: " + df.slice(0, 4).join("; ") + (df.length > 4 ? ` … (${df.length})` : "") + " · мышью: " + dm.slice(0, 4).join("; ") + (dm.length > 4 ? ` … (${dm.length})` : "") : "совпадает"} |`);
      void j;
    });
    const price = (p: Project) => { const e = estimate(p), t = e.byMarkup ?? e.bySheet ?? 0, pr = modulePrices(p, t) ?? []; const by: Record<string, number> = {}; p.modules.forEach((a, i) => { const g = kind(a).slice(0, 2); by[g] = (by[g] ?? 0) + (pr[i] ?? 0); }); return { total: t, by, sheets: e.ldspSheets }; };
    const pf = price(fp), pm = price(mp);
    res.priceFunctions = pf; res.priceManager = pm; res.partsTable = rows; res.equal = same && pf.total === pm.total;
    res.managerModules = mp.modules.map((a) => `${a.module.name} ${a.module.width}×${a.module.height}×${a.module.depth} @x${Math.round(a.x)} y${Math.round(a.y ?? 0)} z${Math.round(a.z)}`);
  }
  writeFileSync(`${out}/manager-report.json`, JSON.stringify(res, null, 1));
  console.log(JSON.stringify({ seconds: res.seconds, clicks: st.clicks, inputs: st.inputs, keys: st.keys, ok: log.filter((x) => x.ok).length + "/" + log.length, equal: res.equal, priceFunctions: res.priceFunctions, priceManager: res.priceManager, partsTable: res.partsTable, managerModules: res.managerModules, readError: res.readError, errors: errors.slice(0, 3) }, null, 1));
  await browser.close();
}
