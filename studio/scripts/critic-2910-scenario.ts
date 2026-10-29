// Находки критика релиз-кандидата 29.10.2026 мышью, как менеджер (своя сборка, только мышь и клавиатура для действий; проект для
// проверки читается из хранилища браузера): npx tsx scripts/critic-2910-scenario.ts <url /studio/?fresh=1> <outDir>
//  A. п.3 «Комод» 800×1000×550: «−» → 2 равных фасада до крыши (было 404/338 и щель 224); ещё «−» → отказ с причиной, ящиков 2;
//     «+» «+» → 4 равных. Снимки спереди.
//  B. п.5 «Подвесной ящик» 825×400×431, 2 ящика: «Высота фасада ящика» 196 у нижнего — деталь 196 (было 211), щели между фасадами нет.
//  C. п.2 «Стеллаж» 800×2000×400: вырез Ø60 на верхней полке («Вырезы деталей…» → «Круглый» → «Сохранить»), «+» полка — вырез на той
//     же полке (по высоте), а не на соседней.
//  D. п.1 Модель цены «Цена по большей модели» → «Добавить комнату» → «Новый проект / восстановить» → «Создать новый проект»: модель
//     заказа осталась у документа и всех комнат.
import { chromium, type Locator } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { parts, facadeTop, facadeBottom, boxes, type Module, type Part } from "../src/model";
import { parseProject, type Project } from "../src/project";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.setDefaultTimeout(8000);
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => void d.accept());
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
let shotN = 0;
const shot = async (name: string) => { await page.waitForTimeout(700); await page.screenshot({ path: `${out}/${String(++shotN).padStart(2, "0")}-${name}.png` }); };
const click = async (l: Locator) => { await l.scrollIntoViewIfNeeded(); await l.click(); await page.waitForTimeout(350); };
const type = async (l: Locator, v: string | number) => { await l.scrollIntoViewIfNeeded(); await l.click({ clickCount: 3 }); await page.keyboard.press("Control+A"); await page.keyboard.type(String(v)); await page.keyboard.press("Enter"); await page.waitForTimeout(600); };
const btn = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" }).first();
const banner = async () => (await page.locator(".error-banner").allInnerTexts().catch(() => [] as string[])).join(" ").replace(/\s+/g, " ").trim();
async function openCat(cat: string) { let d = page.locator(`details[data-settings-category="${cat}"]`).first(); if (!(await d.count())) { await page.getByRole("button", { name: /Построение мебели/ }).first().click().catch(() => {}); await page.waitForTimeout(500); d = page.locator(`details[data-settings-category="${cat}"]`).first(); } if ((await d.getAttribute("open")) === null) await click(d.locator("summary").first()); }
/** Раскрыть свёрнутые разделы панели, пока элемент не станет виден (как менеджер: щелчки по заголовкам разделов). */
async function reveal(l: Locator) {
  await page.getByRole("button", { name: /Построение мебели/ }).first().click().catch(() => {});
  for (let round = 0; round < 5 && !(await l.isVisible().catch(() => false)); round++) {
    const closed = page.locator(".settings-tree details:not([open]) > summary");
    for (let i = 0, n = await closed.count(); i < n; i++) { const s = closed.nth(i); if (await s.isVisible().catch(() => false)) { await s.click().catch(() => {}); await page.waitForTimeout(80); if (await l.isVisible().catch(() => false)) return; } }
  }
}
async function openSet(cat: string, title: string) { await openCat(cat); const d = page.locator(`details[data-setting="${title}"]`).first(); if ((await d.getAttribute("open")) === null) await click(d.locator("summary").first()); }
/** Документ комнат и активный проект из хранилища (только для проверки). */
async function doc(): Promise<{ calc: Project["calculation"]; rooms: Project[]; active: Project }> {
  await page.waitForTimeout(900);
  const raw = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith("garderyob-rooms-v1") && !x.includes(":previous") && !x.includes(":damaged")); return k ? localStorage.getItem(k) : null; });
  if (!raw) throw Error("документ комнат не сохранён");
  const d = JSON.parse(raw);
  const rooms = d.rooms.map((r: { project: Project }) => parseProject({ ...r.project, ...(d.calculation ? { calculation: d.calculation } : {}) }, true));
  return { calc: d.calculation, rooms, active: rooms[d.rooms.findIndex((r: { id: string }) => r.id === d.activeRoomId)] };
}
const last = async () => { const p = (await doc()).active; return p.modules[p.modules.length - 1].module; };
const faces = (m: Module) => parts(m).filter((p) => /:drawer:\d+:facade$/.test(p.id)).sort((a, b) => a.position[1] - b.position[1]);
const hs = (ps: Part[]) => ps.map((p) => Math.round(p.size[1] * 10) / 10);
const gaps = (ps: Part[]) => ps.slice(1).map((p, i) => Math.round((p.position[1] - p.size[1] / 2 - (ps[i].position[1] + ps[i].size[1] / 2)) * 10) / 10);
const topGap = (m: Module) => { const f = faces(m); return Math.round((facadeTop(m) - Math.max(...f.map((p) => p.position[1] + p.size[1] / 2))) * 10) / 10; };
const equalNoGap = (m: Module) => { const f = faces(m), h = hs(f), c = facadeTop(m) - Math.min(facadeBottom(m), boxes(m)[0].bottom), sum = h.reduce((a, x) => a + x, 0) + gaps(f).reduce((a, x) => a + x, 0); return Math.max(...h) - Math.min(...h) <= 1 && Math.abs(sum - c) < 0.05; };
async function addFromPalette(kind: string, w: number, h: number, d: number) {
  const pal = page.locator("details.module-palette").first();
  if ((await pal.getAttribute("open")) === null) await click(pal.locator("summary").first());
  await click(pal.getByRole("tab", { name: "Шкафы распашные" }));
  await click(pal.locator(".module-kinds button", { hasText: kind }).first());
  await type(pal.locator('input[aria-label="Ширина новой мебели"]'), w);
  await type(pal.locator('input[aria-label="Высота новой мебели"]'), h);
  await type(pal.locator('input[aria-label="Глубина новой мебели"]'), d);
  await click(pal.getByRole("button", { name: "Добавить в комнату" }));
  await page.waitForTimeout(1200);
  const apart = page.getByRole("button", { name: /^Поставить отдельно/ });
  if (await apart.count() && await apart.first().isVisible()) { await click(apart.first()); await page.waitForTimeout(800); }
}
async function front() { await page.getByRole("button", { name: "Спереди", exact: true }).click().catch(() => {}); const z = page.getByRole("button", { name: "Приблизить выбранный корпус" }); if ((await z.getAttribute("aria-pressed").catch(() => "true")) !== "true") await z.click().catch(() => {}); await page.mouse.move(5, 300); await page.waitForTimeout(1200); }

try {
  await page.goto(url); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("studio-tip-rmb", "1"); });
  await page.goto(url); await page.waitForSelector("canvas", { state: "attached", timeout: 90000 }); await page.waitForTimeout(2500);

  // ── A. п.3: комод «−/+» ──
  await addFromPalette("Комод", 800, 1000, 550); await front();
  let k = await last();
  check("A0 комод 800×1000: 3 равных фасада до крыши", equalNoGap(k) && k.sections[0].drawers === 3, hs(faces(k)).join("/"));
  await shot("A0-komod-start");
  await openSet("Наполнение", "Ящики");
  await click(btn("Уменьшить: Ящики")); k = await last();
  check("A1 «−»: 2 равных фасада, без щели сверху (было 404/338, щель 224)", k.sections[0].drawers === 2 && equalNoGap(k) && topGap(k) <= 0.05, `${hs(faces(k)).join("/")}, зазоры ${gaps(faces(k)).join(",")}, до верха фасадов ${topGap(k)}`);
  await front(); await shot("A1-minus-2-equal");
  await openSet("Наполнение", "Ящики");
  await click(btn("Уменьшить: Ящики")); const why = await banner(); k = await last();
  check("A2 ещё «−»: отказ с причиной (фасад 968 > 800), ящиков 2, секция не изменилась", k.sections[0].drawers === 2 && /не встают|выше 800/.test(why), why.slice(0, 160));
  await shot("A2-minus-refused");
  await openSet("Наполнение", "Ящики");
  await click(btn("Добавить: Ящики")); await click(btn("Добавить: Ящики")); k = await last();
  check("A3 «+» «+»: 4 равных фасада до крыши", k.sections[0].drawers === 4 && equalNoGap(k), hs(faces(k)).join("/"));
  await front(); await shot("A3-plus-4-equal");

  // ── B. п.5: видимая высота фасада ──
  await addFromPalette("Подвесной ящик", 825, 400, 431); await front();
  let v = await last();
  await openSet("Наполнение", "Ящики");
  if (v.sections[0].drawers < 2) { await type(page.locator('input[aria-label="Ящиков в секции"]').first(), 2); v = await last(); }
  await click(page.locator(".drawer-tabs button").nth(0));
  const field = page.locator('input[aria-label="Высота фасада ящика"]').first();
  const shown0 = Number(await field.inputValue()), real0 = hs(faces(v))[0];
  check("B0 поле «Высота фасада ящика» = видимый фасад (деталь)", Math.abs(shown0 - real0) < 0.06, `поле ${shown0}, деталь ${real0}`);
  await type(field, 196); v = await last();
  const f = faces(v);
  check("B1 ввели 196 — нижний фасад 196 (было 211 и «не хватает 15 мм»)", Math.abs(hs(f)[0] - 196) < 0.06, `${hs(f).join("/")}; ${await banner()}`.slice(0, 200));
  check("B2 между фасадами — обычный зазор, щели нет", gaps(f).every((g) => g <= 3.01), `зазоры ${gaps(f).join(",")}`);
  check("B3 поле после ввода показывает 196", Math.abs(Number(await field.inputValue()) - 196) < 0.06, await field.inputValue());
  await front(); await shot("B-hanging-196");

  // ── C. п.2: вырез на верхней полке ──
  await addFromPalette("Стеллаж", 800, 2000, 400); await front();
  let s = await last();
  const shelves = (m: Module) => parts(m).filter((p) => p.role === "shelf" && /:shelf:\d+$/.test(p.id)).sort((a, b) => a.position[1] - b.position[1]);
  const top = shelves(s).at(-1)!;
  await reveal(btn("Вырезы деталей…"));
  await click(btn("Вырезы деталей…"));
  const hostSel = page.locator('select[aria-label="Деталь для выреза"]');
  const opt = (await hostSel.locator("option").evaluateAll((os) => os.map((o) => [(o as HTMLOptionElement).value, o.textContent ?? ""]))) as [string, string][];
  await hostSel.selectOption(top.id);
  await click(page.getByRole("group", { name: "Добавить вырез" }).getByRole("button", { name: /Круглый/ }));
  await click(btn("Сохранить вырезы")); s = await last();
  const hole = (m: Module) => parts(m).filter((p) => p.shape?.holes.length).map((p) => Math.round(p.position[1]));
  check("C0 вырез Ø60 на верхней полке", JSON.stringify(hole(s)) === JSON.stringify([Math.round(top.position[1])]), `полка ${Math.round(top.position[1])}, вырез на ${hole(s).join(",")}; полок в списке ${opt.length}`);
  const shelvesBefore = shelves(s).length;
  await openSet("Наполнение", "Полки");
  await click(btn("Добавить: Полки")); s = await last();
  const n = shelves(s).length;
  check("C1 «+» полка: полок стало больше, вырез на той же (верхней) полке, а не на соседней", n === shelvesBefore + 1 && JSON.stringify(hole(s)) === JSON.stringify([Math.round(top.position[1])]), `полки ${shelves(s).map((p) => Math.round(p.position[1])).join("/")}, вырез на ${hole(s).join(",")}; ${await banner()}`.slice(0, 220));
  await front(); await shot("C-cut-stays-on-top-shelf");

  // ── D. п.1: модель цены заказа ──
  const model = page.locator('select[aria-label="Модель цены"]').first();
  if (!(await model.isVisible().catch(() => false))) await click(page.getByRole("button", { name: /^Стоимость/ }).or(page.getByRole("tab", { name: /^Стоимость/ })).first());
  await model.scrollIntoViewIfNeeded(); await model.focus(); await page.keyboard.press("Alt+ArrowDown");
  const opts = await model.locator("option").allInnerTexts(), cur = await model.evaluate((e) => (e as HTMLSelectElement).selectedIndex), want = opts.findIndex((o) => /большей/.test(o));
  for (let i = 0; i < Math.abs(want - cur); i++) await page.keyboard.press(want > cur ? "ArrowDown" : "ArrowUp");
  await page.keyboard.press("Enter"); await page.waitForTimeout(800);
  let d = await doc();
  check("D0 «Цена по большей модели» — в документе заказа", !!d.calc?.maxModel);
  if (!(await btn("Добавить комнату").isVisible().catch(() => false))) await click(page.getByRole("button", { name: /Заказ и инструменты/ }).first());
  await click(btn("Добавить комнату")); await page.waitForTimeout(1500);
  d = await doc();
  check("D1 новая комната — по модели заказа", !!d.calc?.maxModel && d.rooms.every((r) => r.calculation?.maxModel));
  const add = page.getByRole("button", { name: /Добавить мебель|Начать с мебели|Добавить первый/ }).first();
  if (await add.isVisible().catch(() => false)) { await click(add); await page.waitForTimeout(1500); }
  await click(btn("Новый проект / восстановить"));
  await click(btn("Создать новый проект")); await page.waitForTimeout(1500);
  d = await doc();
  check("D2 «Создать новый проект» в комнате 2: модель заказа не стёрта (документ и все комнаты)", !!d.calc?.maxModel && d.rooms.every((r) => r.calculation?.maxModel), JSON.stringify(d.calc ?? null).slice(0, 120));
  const m2 = page.locator('select[aria-label="Модель цены"]').first();
  if (!(await m2.isVisible().catch(() => false))) await page.getByRole("button", { name: /^Стоимость/ }).or(page.getByRole("tab", { name: /^Стоимость/ })).first().click().catch(() => {});
  await page.waitForTimeout(800);
  const shown = await m2.inputValue().catch(() => "");
  check("D3 в редакторе комнаты «Модель цены» — по большей", shown === "max", shown);
  await shot("D-price-model-kept");
} catch (e) { check("сценарий без сбоя", false, (e as Error).message.split("\n")[0]); await shot("fail"); }
check("ошибок страницы нет", errors.length === 0, errors.slice(0, 2).join(" | "));
writeFileSync(`${out}/results.json`, JSON.stringify({ results, errors }, null, 1));
await browser.close();
const failed = results.filter((r) => !r[1]).length;
console.log(`\nИТОГ: ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
