// Заказ 7437584, изделия 2, 4, 5 — сборка МЫШЬЮ как менеджер, от пустой комнаты: палитра, панели справа, клавиатура.
// npx tsx scripts/order-7437584-b-manager.ts <url studio/?fresh=1> <outDir>
// Действия — только клики, ввод с клавиатуры и выбор в списках клавиатурой; DOM читается только для проверки и протокола.
// В конце: проект из хранилища вкладки → <outDir>/manager-project.json, сравнение с функциональной сборкой (scripts/order-7437584-b.ts).
import { chromium, type Locator } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { parts, type Module } from "../src/model";
import { estimate } from "../src/pricing";
import { parseProject, type Project } from "../src/project";
import { orderProject, PRODUCTS } from "./order-7437584-b";

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
/** Раскрыть свёрнутые разделы панели над элементом — щелчком по их заголовкам. */
async function reveal(l: Locator) {
  for (let k = 0; k < 4; k++) {
    const closed = l.locator("xpath=ancestor::details[not(@open)]/summary");
    if (!(await closed.count())) break;
    await closed.first().scrollIntoViewIfNeeded(); await closed.first().click(); st.clicks++; await wait(200);
  }
  await l.scrollIntoViewIfNeeded();
}
const click = async (l: Locator) => { await reveal(l); await l.click(); st.clicks++; await wait(); };
async function field(label: string | RegExp, value: number) {
  const l = page.getByLabel(label, { exact: typeof label === "string" }).first();
  await reveal(l); await l.click({ clickCount: 3 }); st.clicks++;
  await page.keyboard.type(String(value)); st.inputs++;
  await page.keyboard.press("Enter"); st.keys++; await wait(450);
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
  await wait(450);
  if ((await sel.evaluate((s: HTMLSelectElement) => s.selectedIndex)) !== want) throw Error(`«${label}»: не выбрался ${option}`);
}
async function step(name: string, fn: () => Promise<unknown>) {
  const t = Date.now(), c0 = st.clicks;
  try { const info = await fn(); log.push({ step: name, ok: true, sec: (Date.now() - t) / 1000, clicks: st.clicks - c0, info: typeof info === "string" ? info : "" }); console.log("OK   " + name); }
  catch (e) { log.push({ step: name, ok: false, sec: (Date.now() - t) / 1000, clicks: st.clicks - c0, info: (e as Error).message.split("\n")[0] }); console.log("FAIL " + name + " — " + (e as Error).message.split("\n")[0]); }
}
const project = async (): Promise<Project | null> => page.evaluate(() => {
  const all = Object.keys(localStorage).filter((k) => k.startsWith("module-studio-v3") && !k.endsWith(":previous")).map((k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } }).filter((x) => Array.isArray(x?.modules));
  return all.sort((a, b) => b.modules.length - a.modules.length)[0] ?? null;
}) as Promise<Project | null>;
const mod = async (re: RegExp): Promise<Module | undefined> => (await project())?.modules.find((a) => re.test(a.module.name))?.module;
const selectInList = async (text: string) => { await click(page.locator(".project-modules, .module-list, aside").getByText(text, { exact: false }).first()); };
const section = async (n: number) => pick("Выбранная секция", new RegExp("^Секция " + n));
const addFromPalette = async (tab: string, kind: string | null, w: number, h: number, d: number, extra?: () => Promise<void>) => {
  await click(page.getByRole("tab", { name: tab }));
  if (kind) await click(page.locator(".module-kinds button").filter({ hasText: kind }).first());
  await field("Ширина новой мебели", w); await field("Высота новой мебели", h); await field("Глубина новой мебели", d);
  if (extra) await extra();
  await click(page.getByRole("button", { name: "Добавить в комнату", exact: true })); await wait(1200);
};
const t0 = Date.now();
try {
  await page.goto(url);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("studio-tip-rmb", "1"); });
  await page.goto(url); await page.waitForSelector("canvas", { state: "attached", timeout: 90000 }); await wait(2500);
  await shot("00-empty-room");
  // ── Изделие 2: шкаф-купе 1660 × 2600 × 600, двери внутри, 2 двери
  await step("И2: палитра «Шкафы-купе» 1660×2600×600, двери внутри, 2 двери → «Добавить в комнату»", () => addFromPalette("Шкафы-купе", "Шкаф-купе", 1660, 2600, 600, async () => { await pick("Установка дверей купе", /внутри/); await pick("Дверей купе у новой мебели", /^2$/); }));
  await step("И2: выбрать корпус в списке", () => selectInList("Корпус шкафа-купе"));
  await step("И2: цоколь 100 (Опоры › Высота цоколя)", () => pick("Высота цоколя", /^100/));
  await step("И2: секция 2 › «Разделить пополам» → 3 секции", async () => { await section(2); await click(page.getByRole("button", { name: /Разделить пополам/ })); });
  await step("И2: ширины секций 816 / 390 / 390 (поле «Внутренняя ширина»)", async () => { await section(1); await field("Внутренняя ширина", 816); await section(2); await field("Внутренняя ширина", 390); const m = await mod(/Корпус шкафа-купе/); return JSON.stringify(m?.sections.map((s) => Math.round(s.weight))); });
  await step("И2: левая секция — одна полка (антресоль 500) жёсткая на 1976 от дна", async () => { await section(1); await field("Полок в секции", 1); await field("Полка 1", 1976); const cb = page.getByLabel("Полка 1 жёсткая", { exact: true }); await reveal(cb); if (!(await cb.isChecked())) { await cb.click(); st.clicks++; await wait(); } });
  await step("И2: левая секция — штанга и «Вешалка в два яруса» (новое)", async () => { const sw = page.getByRole("switch", { name: "Штанга", exact: true }); await reveal(sw); if ((await sw.getAttribute("aria-checked")) !== "true") await click(sw); await click(page.getByRole("switch", { name: "Вешалка в два яруса" })); const m = await mod(/Корпус шкафа-купе/); return "rodLower=" + m?.sections[0].rodLower; });
  await shot("01-kupe-left-two-tier");
  for (const k of [2]) {
    await step(`И2: секция ${k} — 4 ящика (кнопка «+»)`, async () => { await section(k); const minus = page.getByRole("button", { name: "Уменьшить: Полки" }); void minus; for (let i = 0; i < 4; i++) await click(page.getByRole("button", { name: "Увеличить: Ящики" })); });
    await step(`И2: секция ${k} — верх полки над ящиками 816 от дна (ящики поровну по 200)`, () => field("От дна пенала до верха полки над ящиками", 816));
    await step(`И2: секция ${k} — «Ящик 1» › скрытые Unihopper с доводчиком › «Эти направляющие всем ящикам»`, async () => { await click(page.getByRole("button", { name: /^Ящик 1/ }).first()); await pick("Направляющие ящика", /Скрытые Unihopper · с доводчиком/); await click(page.getByRole("button", { name: "Эти направляющие всем ящикам секции" })); });
    await step(`И2: секция ${k} — открытие за верх фасада («Зазор между ящиками 30 мм»)`, () => pick("Ручка ящика", /Зазор между ящиками 30/));
    await step(`И2: секция ${k} — 4 полки: антресоль 1976, 1100, 1392, 1684; жёсткие — антресоль и средняя`, async () => {
      await field("Полок в секции", 4);
      const hs = [1976, 1100, 1392, 1684];
      for (let j = 0; j < 4; j++) await field(`Полка ${j + 1}`, hs[j]);
      const m = await mod(/Корпус шкафа-купе/), s = m!.sections[k - 1], hh = (2584 - 116);
      const order = s.shelves.map((f, j) => [Math.round(f * hh), j]).sort((a, b) => a[0] - b[0]);
      const want = new Set([order[order.length - 1][1], order[1][1]]); // антресоль (верхняя) и средняя из трёх над крышкой
      for (let j = 0; j < 4; j++) { const cb = page.getByLabel(`Полка ${j + 1} жёсткая`, { exact: true }); await reveal(cb); if ((await cb.isChecked()) !== want.has(j)) { await cb.click(); st.clicks++; await wait(); } }
      return order.map(([y]) => y).join("/");
    });
  }
  await step("И2: секция 3 — «Копировать наполнение секции» из 2 и вставить", async () => { await section(2); await click(page.getByRole("button", { name: "Копировать наполнение секции" })); await section(3); await click(page.getByRole("button", { name: /Вставить наполнение секции|Заменить наполнение копией/ })); });
  await shot("02-kupe-body");
  await step("И2: двери купе — наполнение «Клауд» у обеих", async () => {
    await selectInList("Двери купе");
    const sels = page.locator('select[aria-label^="Дверь"]');
    const n = await sels.count();
    for (let i = 0; i < n; i++) { const lab = await sels.nth(i).getAttribute("aria-label"); if (lab && !/секция/.test(lab)) await pick(lab, /Клауд/); }
    return n + " списков";
  });
  // ── Изделие 4: ТВ-зона
  await step("И4: палитра «Подвесной ящик» 800×200×284 (новое) → в комнату", () => addFromPalette("Шкафы распашные", "Подвесной ящик", 800, 200, 284));
  await step("И4: подвесной ящик — «От пола» 600 (под столешницей)", () => field("От пола", 600));
  await step("И4: палитра «Комод» 1800×800×284 → «Корпусов в ряд» 2 → в комнату", () => addFromPalette("Шкафы распашные", "Комод", 1800, 800, 284, async () => { await pick("Корпусов в ряд у новой мебели", /^2/); }));
  for (const n of [1, 2]) {
    await step(`И4: комод ${n} — ящики 260 / 260 / до крыши (боковины 220 / 220 / 128), скрытые Unihopper с доводчиком`, async () => {
      await selectInList("Комод " + n);
      for (const [j, h] of [[1, 220], [2, 220], [3, 128]] as const) { await click(page.getByRole("button", { name: new RegExp("^Ящик " + j) }).first()); await field("Высота боковины ящика", h); }
      await click(page.getByRole("button", { name: "Собрать ящики от дна" }));
      await click(page.getByRole("button", { name: /^Ящик 1/ }).first()); await pick("Направляющие ящика", /Скрытые Unihopper · с доводчиком/);
      await click(page.getByRole("button", { name: "Эти направляющие всем ящикам секции" }));
    });
  }
  await step("И4: палитра «Кухонные модули › Столешница» 2600×32×320 → встаёт на комоды ЛДСП 32 (новое)", () => addFromPalette("Кухонные модули", "Столешница", 2600, 32, 320));
  // ── Изделие 5
  await step("И5: палитра «Подвесной ящик» 600×200×284 → в комнату (низ 750)", () => addFromPalette("Шкафы распашные", "Подвесной ящик", 600, 200, 284));
  await shot("03-all-added");
  await step("Вид 3D, общий план", async () => { await click(page.getByRole("button", { name: "3D", exact: true })); await wait(1500); });
  await shot("04-3d");
  await step("Вид спереди", async () => { await click(page.getByRole("button", { name: "Спереди", exact: true })); await wait(1500); });
  await shot("05-front");
  await step("Стоимость проекта", async () => { await click(page.getByRole("button", { name: "Стоимость" }).first()); await wait(1200); });
  await shot("06-estimate");
} finally {
  const p = await project().catch(() => null);
  const total = (Date.now() - t0) / 1000;
  const res: Record<string, unknown> = { seconds: Math.round(total), ...st, steps: log, pageErrors: errors.slice(0, 5) };
  if (p) {
    writeFileSync(`${out}/manager-project.json`, JSON.stringify(p, null, 1));
    let mp: Project | null = null; try { mp = parseProject(JSON.parse(JSON.stringify(p))); } catch (e) { res.parseError = (e as Error).message; }
    const fp = orderProject(), sig = (m: Module) => parts(m).filter((x) => !x.id.includes("wall-filler") && x.role !== "fastener").map((x) => x.name + " " + x.size.map((v) => Math.round(v)).join("×")).sort();
    res.modules = p.modules.map((a) => `${a.module.name} ${a.module.width}×${a.module.height}×${a.module.depth} @x${Math.round(a.x)} y${Math.round(a.y ?? 0)}`);
    if (mp) { const em = estimate(mp), ef = estimate(fp); res.priceManager = em.byMarkup ?? em.bySheet; res.priceFunctions = ef.byMarkup ?? ef.bySheet; res.sheets = [em.ldspSheets, ef.ldspSheets]; }
    // по изделиям: детали без крепежа и фальшей к стене — мышью vs функции (соответствие по размеру модуля)
    const cmp: string[] = [];
    for (const [label, re] of PRODUCTS) {
      const fm = fp.modules.filter((a) => re.test(a.module.name)).map((a) => a.module);
      for (const f of fm) {
        const cand = p.modules.map((a) => a.module).filter((m) => m.width === f.width && m.height === f.height && m.depth === f.depth && !!m.kupe === !!f.kupe && !!m.worktop === !!f.worktop);
        const best = cand.map((m) => { const a = sig(m), b = sig(f); const diff = a.filter((x) => !b.includes(x)).length + b.filter((x) => !a.includes(x)).length; return { diff, n: a.length }; }).sort((x, y) => x.diff - y.diff)[0];
        cmp.push(`${label} · ${f.name}: ${best ? `деталей ${best.n} (функции ${sig(f).length}), отличий ${best.diff}` : "не найден"}`);
      }
    }
    res.compare = cmp;
  }
  writeFileSync(`${out}/manager-report.json`, JSON.stringify(res, null, 1));
  console.log(JSON.stringify({ seconds: res.seconds, clicks: st.clicks, inputs: st.inputs, keys: st.keys, ok: log.filter((x) => x.ok).length + "/" + log.length, priceManager: res.priceManager, priceFunctions: res.priceFunctions, sheets: res.sheets, compare: res.compare, errors: errors.slice(0, 3) }, null, 1));
  await browser.close();
}
