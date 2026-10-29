// Находки критика релиз-кандидата 29.10.2026 мышью, как менеджер (своя сборка, только мышь и клавиатура для действий; проект для
// проверки читается из хранилища браузера): npx tsx scripts/critic-2910-scenario.ts <url /studio/?fresh=1> <outDir>
//  A. п.3 «Комод» 800×1000×550: «−» → 2 равных фасада до крыши (было 404/338 и щель 224); ещё «−» → отказ с причиной, ящиков 2;
//     «+» «+» → 4 равных. Снимки спереди.
//  B. п.5 «Подвесной ящик» 825×400×431, 2 ящика: «Высота фасада ящика» 196 у нижнего — деталь 196 (было 211), щели между фасадами нет.
//  C. п.2 «Стеллаж» 800×2000×400: вырез Ø60 на верхней полке («Вырезы деталей…» → «Круглый» → «Сохранить»), «+» полка — вырез на той
//     же полке (по высоте), а не на соседней.
//  D. п.1 Модель цены «Цена по большей модели» → «Добавить комнату» → «Новый проект / восстановить» → «Создать новый проект»: модель
//     заказа осталась у документа и всех комнат.
// Круг 2 (повторная проверка критика):
//  E. A: модель «за лист» → «Создать новый проект» (копия «за лист») → модель «по большей» 23 000 → «Восстановить предыдущий
//     проект»: заказ — по большей модели 23 000 (документ и комнаты), сообщение «В резервной копии своя модель цены».
//  F. B: «Комод» 800×1000×550, вырез на фасаде верхнего ящика → щелчок по нижнему ящику, «Удалить ящик целиком» — вырез на верхнем,
//     без «удалена»; «+» — вырез на своём ящике; удалили ящик с вырезом — вырез снят с сообщением.
//  G. C2: «Комод» 800×1000, «−» (482,5/482,5) → «Высота фасада ящика» 452,5 → «−» — отказ с причиной (968 > 800), «+» — 3 равных до крыши.
// Круг 3:
//  H. «Ящик 1» выбран: на плашке «Удалить ящик» и «Снять фасад»; Delete — весь ящик, Ctrl+Z; «Снять фасад» — только фасад, Ctrl+Z;
//     «Удалить ящик» на плашке — весь ящик.
// Постоянные id (решение Макса 29.10, ветка claude/stable-ids):
//  I. «Стеллаж»: вырез на второй сверху полке → «+» полка, «−» полка, Ctrl+Z ×2, Ctrl+Y, «Сохранить файл» → «Открыть» — вырез на своей
//     полке; «Комод»: вырез на среднем ящике → удалить нижний, «+», Ctrl+Z ×2, Ctrl+Y — на своём ящике; удалить ящик с вырезом — снят
//     с сообщением, Ctrl+Z — вернулся; файл и перезагрузка страницы — оба выреза на своих деталях.
import { chromium, type Locator } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { parts, facadeTop, facadeBottom, boxes, type Module, type Part } from "../src/model";
import { parseProject, type Project } from "../src/project";
import { cutHost } from "../src/partIds";

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
/** «Модель цены» с клавиатуры (стрелки в раскрытом списке, Enter), как менеджер. */
async function pickModel(re: RegExp) {
  const sel = page.locator('select[aria-label="Модель цены"]').first();
  if (!(await sel.isVisible().catch(() => false))) await page.getByRole("button", { name: /^Стоимость/ }).or(page.getByRole("tab", { name: /^Стоимость/ })).first().click().catch(() => {});
  await sel.scrollIntoViewIfNeeded(); await sel.focus(); await page.keyboard.press("Alt+ArrowDown");
  const os = await sel.locator("option").allInnerTexts(), cur = await sel.evaluate((e) => (e as HTMLSelectElement).selectedIndex), want = os.findIndex((o) => re.test(o));
  for (let i = 0; i < Math.abs(want - cur); i++) await page.keyboard.press(want > cur ? "ArrowDown" : "ArrowUp");
  await page.keyboard.press("Enter"); await page.waitForTimeout(800);
}
/** Выбрать ящик n, как менеджер: «Наполнение › Ящики» → «Настройка ящиков» → вкладка «Ящик n» (выделяет его фасад на сцене; плашка
 *  выбранной детали внизу сцены — «Ящик n»). Щелчки по сцене в режиме «Наполнение» ставят ящик — для выбора не годятся. */
async function selectDrawer(n: number): Promise<boolean> {
  await openSet("Наполнение", "Ящики");
  await click(page.locator(".drawer-tabs button").nth(n - 1));
  return (await page.locator(".selection-context strong").first().innerText({ timeout: 1500 }).catch(() => "")).trim() === "Ящик " + n;
}async function front() { await page.getByRole("button", { name: "Спереди", exact: true }).click().catch(() => {}); const z = page.getByRole("button", { name: "Приблизить выбранный корпус" }); if ((await z.getAttribute("aria-pressed").catch(() => "true")) !== "true") await z.click().catch(() => {}); await page.mouse.move(5, 300); await page.waitForTimeout(1200); }

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

  // ── E. круг 2, A: «Восстановить предыдущий проект» в комнате заказа не меняет модель цены заказа ──
  await pickModel(/^Цена за лист|^За лист/);
  d = await doc();
  check("E0 заказ «за лист» (так будет в резервной копии)", d.calc?.model === "sheet" && !d.calc?.maxModel, JSON.stringify(d.calc ?? null).slice(0, 120));
  await click(btn("Новый проект / восстановить")); await click(btn("Создать новый проект")); await page.waitForTimeout(1500);
  await pickModel(/большей/);
  d = await doc();
  check("E1 заказ снова «по большей модели» 23 000", !!d.calc?.maxModel && d.calc?.sheetPrice === 23000, JSON.stringify(d.calc ?? null).slice(0, 120));
  await click(btn("Новый проект / восстановить")); await click(btn("Восстановить предыдущий проект")); await page.waitForTimeout(1500);
  d = await doc();
  const note = (await page.locator('[data-testid="studio-note"]').allInnerTexts().catch(() => [] as string[])).join(" ").replace(/\s+/g, " ");
  check("E2 «Восстановить предыдущий проект» (копия «за лист»): заказ — по большей модели 23 000, документ и все комнаты (было: весь заказ «за лист»)", !!d.calc?.maxModel && d.calc?.sheetPrice === 23000 && d.rooms.every((r) => r.calculation?.maxModel && r.calculation.sheetPrice === 23000), JSON.stringify(d.calc ?? null).slice(0, 120));
  check("E3 менеджеру сообщение: в копии своя модель, заказ — по модели заказа", /В резервной копии своя модель цены — за лист ЛДСП/.test(note) && /по модели заказа — по большей модели/.test(note), note.slice(0, 220));
  await shot("E-restore-keeps-order-model");
  // панель «Стоимость» внизу закрыть (повторный щелчок по вкладке) — сцена и панель справа снова видны
  for (let k = 0; k < 2 && (await page.locator('select[aria-label="Модель цены"]').first().isVisible().catch(() => false)); k++) { await page.getByRole("button", { name: "Стоимость", exact: true }).last().click().catch(() => {}); await page.waitForTimeout(500); }

  // ── F. круг 2, B: вырез на ящике идёт за своим ящиком ──
  // новый сеанс (пустая комната, без панели заказа)
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("studio-tip-rmb", "1"); });
  await page.goto(url); await page.waitForSelector("canvas", { state: "attached", timeout: 90000 }); await page.waitForTimeout(2500);
  await addFromPalette("Комод", 800, 1000, 550); await front();
  let kk = await last();
  const ksid = kk.sections[0].id, faceIds = (m: Module) => faces(m).map((p) => p.id);
  const topFace = faceIds(kk)[2];
  await reveal(btn("Вырезы деталей…")); await click(btn("Вырезы деталей…"));
  await page.locator('select[aria-label="Деталь для выреза"]').selectOption(topFace);
  await click(page.getByRole("group", { name: "Добавить вырез" }).getByRole("button", { name: /Круглый/ }));
  await click(btn("Сохранить вырезы")); kk = await last();
  const cutOn = (m: Module) => (m.cutouts ?? []).map((c) => faceIds(m).indexOf(c.host));
  check("F0 комод 800×1000, 3 ящика: вырез на фасаде ВЕРХНЕГО ящика", JSON.stringify(cutOn(kk)) === "[2]", (kk.cutouts ?? []).map((c) => c.host.replace(/^[^:]+:/, "")).join(","));
  await page.locator('[data-testid="studio-note"] button[aria-label="Закрыть сообщение"]').click().catch(() => {});
  let picked = await selectDrawer(1);
  if (picked) { await reveal(btn("Удалить ящик целиком")); await click(btn("Удалить ящик целиком")); }
  kk = await last();
  let fnote = (await page.locator('[data-testid="studio-note"]').allInnerTexts().catch(() => [] as string[])).join(" ").replace(/\s+/g, " ");
  check("F1 удалили НИЖНИЙ ящик мышью: ящиков 2, вырез на верхнем (бывшем верхнем), без «удалена» (было: вырез снят «Ящик 3 удалена»)", picked && kk.sections[0].drawers === 2 && JSON.stringify(cutOn(kk)) === "[1]" && !/снят/.test(fnote), `выбран ${picked}, ящиков ${kk.sections[0].drawers}, вырез на ${cutOn(kk).join(",")}; ${fnote}`.slice(0, 220));
  await front(); await shot("F1-cut-stays-on-top-drawer");
  await openSet("Наполнение", "Ящики"); await click(btn("Добавить: Ящики")); kk = await last();
  check("F2 «+»: 3 ящика, вырез на своём ящике (номер 2 — средний, новый — сверху)", kk.sections[0].drawers === 3 && JSON.stringify(cutOn(kk)) === "[1]", `вырез на ${cutOn(kk).join(",")}`);
  await page.locator('[data-testid="studio-note"] button[aria-label="Закрыть сообщение"]').click().catch(() => {});
  picked = await selectDrawer(2);
  if (picked) { await reveal(btn("Удалить ящик целиком")); await click(btn("Удалить ящик целиком")); }
  kk = await last();
  fnote = (await page.locator('[data-testid="studio-note"]').allInnerTexts().catch(() => [] as string[])).join(" ").replace(/\s+/g, " ");
  check("F3 удалили сам ящик с вырезом: вырез снят с сообщением, на бывший ящик 3 не переехал", picked && kk.sections[0].drawers === 2 && !kk.cutouts?.length && /Вырез .* снят: деталь «Ящик 2»/.test(fnote), `выбран ${picked}, ящиков ${kk.sections[0].drawers}, вырезов ${kk.cutouts?.length ?? 0}; ${fnote}`.slice(0, 220));
  await front(); await shot("F3-cut-removed-with-drawer");

  // ── G. круг 2, C2: высота фасада полем, затем «−» / «+» ──
  await addFromPalette("Комод", 800, 1000, 550); await front();
  await openSet("Наполнение", "Ящики"); await click(btn("Уменьшить: Ящики"));
  let g = await last();
  check("G0 комод 800×1000, «−»: 2 фасада 482,5/482,5", hs(faces(g)).join("/") === "482.5/482.5", hs(faces(g)).join("/"));
  await click(page.locator(".drawer-tabs button").nth(0));
  await type(page.locator('input[aria-label="Высота фасада ящика"]').first(), 452.5); g = await last();
  check("G1 «Высота фасада ящика» нижнего 452,5 — верхний 512,5", hs(faces(g)).join("/") === "452.5/512.5", hs(faces(g)).join("/"));
  await openSet("Наполнение", "Ящики"); await click(btn("Уменьшить: Ящики"));
  const gwhy = await banner(); g = await last();
  check("G2 «−»: один фасад на весь проём не встаёт (968 > 800) — отказ с причиной, ящиков 2 (было: фасад 30…482,5 и ниша 515 мм без ошибки)", g.sections[0].drawers === 2 && /не встают: при 1 ящике фасад ящика выйдет 968/.test(gwhy), gwhy.slice(0, 160));
  await openSet("Наполнение", "Ящики"); await click(btn("Добавить: Ящики")); g = await last();
  check("G3 «+» после правки полем: 3 равных фасада до крыши (было: отказ «Ящики не до крыши»)", g.sections[0].drawers === 3 && equalNoGap(g) && topGap(g) <= 0.05, `${hs(faces(g)).join("/")}, до верха ${topGap(g)}; ${await banner()}`.slice(0, 200));
  await front(); await shot("G3-plus-after-manual-equal");
  // ── H. круг 3: ловушка удаления — «Ящик N» на плашке: «Удалить ящик» (и Delete) — весь ящик, «Снять фасад» — только фасад ──
  await addFromPalette("Комод", 800, 1000, 550); await front();
  const bar = page.locator(".selection-action-bar");
  const facesN = (m: Module) => faces(m).length;
  let hm = await last();
  const undo = async () => { await page.keyboard.press("Control+z"); await page.waitForTimeout(900); };
  let picked3 = await selectDrawer(1);
  const labels = (await bar.getByRole("button").allInnerTexts().catch(() => [] as string[])).map((x) => x.trim());
  check("H0 выбран «Ящик 1»: на плашке «Удалить ящик» и «Снять фасад» (было: общее «Удалить», снимавшее только фасад)", picked3 && labels.includes("Удалить ящик") && labels.includes("Снять фасад") && !labels.includes("Удалить"), labels.join(" | "));
  await page.locator(".drawer-tabs button").nth(0).focus().catch(() => {}); await page.keyboard.press("Delete"); await page.waitForTimeout(900); hm = await last();
  check("H1 Delete — весь ящик: ящиков 2, у каждого фасад", hm.sections[0].drawers === 2 && facesN(hm) === 2, `ящиков ${hm.sections[0].drawers}, фасадов ${facesN(hm)}`);
  await undo(); hm = await last();
  check("H2 Ctrl+Z — ящик вернулся (3 ящика, 3 фасада)", hm.sections[0].drawers === 3 && facesN(hm) === 3, `ящиков ${hm.sections[0].drawers}, фасадов ${facesN(hm)}`);
  picked3 = await selectDrawer(1); if (picked3) await click(bar.getByRole("button", { name: "Снять фасад", exact: true })); hm = await last();
  check("H3 «Снять фасад» — ящиков 3, фасадов 2", picked3 && hm.sections[0].drawers === 3 && facesN(hm) === 2, `ящиков ${hm.sections[0].drawers}, фасадов ${facesN(hm)}`);
  await undo(); hm = await last();
  check("H4 Ctrl+Z — фасад вернулся", hm.sections[0].drawers === 3 && facesN(hm) === 3, `фасадов ${facesN(hm)}`);
  picked3 = await selectDrawer(2); if (picked3) await click(bar.getByRole("button", { name: "Удалить ящик", exact: true })); hm = await last();
  check("H5 «Удалить ящик» на плашке — весь ящик: ящиков 2, фасадов 2", picked3 && hm.sections[0].drawers === 2 && facesN(hm) === 2, `ящиков ${hm.sections[0].drawers}, фасадов ${facesN(hm)}`);
  await front(); await shot("H5-delete-whole-drawer");

  // ── I. постоянные id (решение Макса 29.10): вырез на полке и на ящике держится при правках, отмене/повторе, файле и перезагрузке ──
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("studio-tip-rmb", "1"); });
  await page.goto(url); await page.waitForSelector("canvas", { state: "attached", timeout: 90000 }); await page.waitForTimeout(2500);
  const noteText = async () => (await page.locator('[data-testid="studio-note"]').allInnerTexts().catch(() => [] as string[])).join(" ").replace(/\s+/g, " ");
  const closeNote = async () => { await page.locator('[data-testid="studio-note"] button[aria-label="Закрыть сообщение"]').click({ timeout: 1000 }).catch(() => {}); };
  const redo = async () => { await page.keyboard.press("Control+y"); await page.waitForTimeout(900); };
  const mods = async () => (await doc()).active.modules.map((a) => a.module);
  /** Вырез: деталь (по постоянной ссылке) → место среди деталей своего рода снизу вверх, высота центра детали. */
  const cutAt = (m: Module, list: (m: Module) => Part[]) => (m.cutouts ?? []).map((c) => { const h = cutHost(m, c), ps = list(m), i = ps.findIndex((p) => p.id === h); return { rank: i, y: i < 0 ? null : Math.round(ps[i].position[1]), ref: c.ref ?? "" }; });
  const cutPart = async (pid: string) => { await reveal(btn("Вырезы деталей…")); await click(btn("Вырезы деталей…")); await page.locator('select[aria-label="Деталь для выреза"]').selectOption(pid); await click(page.getByRole("group", { name: "Добавить вырез" }).getByRole("button", { name: /Круглый/ })); await click(btn("Сохранить вырезы")); await closeNote(); };
  /** «Сохранить файл» → «Открыть» тот же файл (как менеджер: скачать, затем выбрать файл в окне). */
  async function saveAndOpen(tag: string) {
    // кнопки файла — в верхней панели; свёрнута — раскрыть («Заказ и инструменты»)
    if (!(await page.getByRole("button", { name: "Сохранить проект файлом" }).first().isVisible().catch(() => false))) await click(page.getByRole("button", { name: /Заказ и инструменты/ }).first());
    const [dl] = await Promise.all([page.waitForEvent("download"), click(page.getByRole("button", { name: "Сохранить проект файлом" }).first())]);
    const file = `${out}/I-${tag}.json`; await dl.saveAs(file);
    const [fc] = await Promise.all([page.waitForEvent("filechooser"), click(page.getByRole("button", { name: /^(Открыть|Заменить мебель комнаты)$/ }).first())]);
    await fc.setFiles(file); await page.waitForTimeout(1500); await closeNote();
  }
  // I0–I5: «Стеллаж» 800×2000×400 — вырез на второй сверху полке
  await addFromPalette("Стеллаж", 800, 2000, 400); await front();
  let st = await last();
  const sh0 = shelves(st), cutShelf = sh0.at(-2)!, shelfY = Math.round(cutShelf.position[1]);
  await cutPart(cutShelf.id); st = await last();
  let ci = cutAt(st, shelves)[0];
  check("I0 вырез на полке: постоянная ссылка (ref) и та же полка", sh0.length >= 3 && ci?.rank === sh0.length - 2 && ci.y === shelfY && /:shelf@/.test(ci.ref), JSON.stringify(ci));
  await openSet("Наполнение", "Полки"); await click(btn("Добавить: Полки")); st = await last(); ci = cutAt(st, shelves)[0];
  const n1 = shelves(st).length;
  check("I1 «+» полка: вырез на той же полке (по высоте)", n1 === sh0.length + 1 && ci?.y === shelfY, `полок ${n1}, ${JSON.stringify(ci)}`);
  await openSet("Наполнение", "Полки"); await click(btn("Уменьшить: Полки")); st = await last(); ci = cutAt(st, shelves)[0];
  check("I2 «−» полка (снята верхняя): вырез на своей полке", shelves(st).length === n1 - 1 && ci?.y === shelfY, `полок ${shelves(st).length}, ${JSON.stringify(ci)}; ${await noteText()}`.slice(0, 200));
  await undo(); await undo(); st = await last(); ci = cutAt(st, shelves)[0];
  check("I3 Ctrl+Z ×2: полок как было, вырез на своей полке", shelves(st).length === sh0.length && ci?.y === shelfY, `полок ${shelves(st).length}, ${JSON.stringify(ci)}`);
  await redo(); st = await last(); ci = cutAt(st, shelves)[0];
  check("I4 Ctrl+Y: снова +1 полка, вырез на своей полке", shelves(st).length === n1 && ci?.y === shelfY, `полок ${shelves(st).length}, ${JSON.stringify(ci)}`);
  await saveAndOpen("shelf"); st = await last(); ci = cutAt(st, shelves)[0];
  check("I5 «Сохранить файл» → «Открыть»: вырез на своей полке, ссылка та же", shelves(st).length === n1 && ci?.y === shelfY && /:shelf@/.test(ci.ref), JSON.stringify(ci));
  await front(); await shot("I5-shelf-cut-after-file");
  // I6–I11: «Комод» 800×1000×550 — вырез на фасаде среднего ящика
  await addFromPalette("Комод", 800, 1000, 550); await front();
  let km = await last();
  const fids = faces(km).map((p) => p.id);
  await cutPart(fids[1]); km = await last();
  let cd = cutAt(km, faces)[0];
  check("I6 вырез на фасаде среднего ящика: постоянная ссылка", km.sections[0].drawers === 3 && cd?.rank === 1 && /:drawer@/.test(cd.ref), JSON.stringify(cd));
  const dRef = cd.ref;
  let ok = await selectDrawer(1);
  if (ok) { await reveal(btn("Удалить ящик целиком")); await click(btn("Удалить ящик целиком")); }
  km = await last(); cd = cutAt(km, faces)[0];
  check("I7 удалили нижний ящик: вырез на своём ящике (теперь нижний), без «снят»", ok && km.sections[0].drawers === 2 && cd?.rank === 0 && cd.ref === dRef && !/снят/.test(await noteText()), `${JSON.stringify(cd)}; ${await noteText()}`.slice(0, 200));
  await closeNote();
  await openSet("Наполнение", "Ящики"); await click(btn("Добавить: Ящики")); km = await last(); cd = cutAt(km, faces)[0];
  check("I8 «+» ящик: 3 ящика, вырез на своём (нижнем)", km.sections[0].drawers === 3 && cd?.rank === 0 && cd.ref === dRef, JSON.stringify(cd));
  await undo(); await undo(); km = await last(); cd = cutAt(km, faces)[0];
  check("I9 Ctrl+Z ×2: 3 ящика как было, вырез на среднем", km.sections[0].drawers === 3 && cd?.rank === 1 && cd.ref === dRef, JSON.stringify(cd));
  await redo(); km = await last(); cd = cutAt(km, faces)[0];
  check("I10 Ctrl+Y: 2 ящика, вырез на своём (нижнем)", km.sections[0].drawers === 2 && cd?.rank === 0 && cd.ref === dRef, JSON.stringify(cd));
  // у комода 1000 один ящик на весь проём не встаёт (фасад 968 > 800) — удаляем ящик с вырезом из трёх
  await openSet("Наполнение", "Ящики"); await click(btn("Добавить: Ящики"));
  ok = await selectDrawer(1);
  if (ok) { await reveal(btn("Удалить ящик целиком")); await click(btn("Удалить ящик целиком")); }
  km = await last();
  check("I11 удалили ящик с вырезом (из трёх): вырез снят с сообщением, на соседний не переехал", ok && km.sections[0].drawers === 2 && !km.cutouts?.length && /Вырез .* снят: деталь «Ящик 1»/.test(await noteText()), `${km.sections[0].drawers}, вырезов ${km.cutouts?.length ?? 0}; ${await noteText()}`.slice(0, 200));
  await front(); await shot("I11-drawer-cut-removed");
  await closeNote(); await undo(); km = await last(); cd = cutAt(km, faces)[0];
  check("I12 Ctrl+Z: ящик и вырез на нём вернулись", km.sections[0].drawers === 3 && cd?.rank === 0 && cd.ref === dRef, JSON.stringify(cd));
  await saveAndOpen("drawer"); const [stF, kmF] = (await mods()).slice(-2); cd = cutAt(kmF, faces)[0]; ci = cutAt(stF, shelves)[0];
  check("I13 файл: оба выреза на своих деталях (полка, ящик)", ci?.y === shelfY && cd?.rank === 0 && cd.ref === dRef, `${JSON.stringify(ci)} ${JSON.stringify(cd)}`);
  await page.reload(); await page.waitForSelector("canvas", { state: "attached", timeout: 90000 }); await page.waitForTimeout(2500);
  const [stR, kmR] = (await mods()).slice(-2); ci = cutAt(stR, shelves)[0]; cd = cutAt(kmR, faces)[0];
  check("I14 перезагрузка страницы: вырезы на своих деталях", ci?.y === shelfY && cd?.rank === 0 && cd.ref === dRef, `${JSON.stringify(ci)} ${JSON.stringify(cd)}`);
  await front(); await shot("I14-after-reload");
} catch (e) { check("сценарий без сбоя", false, (e as Error).message.split("\n")[0]); await shot("fail"); }
check("ошибок страницы нет", errors.length === 0, errors.slice(0, 2).join(" | "));
writeFileSync(`${out}/results.json`, JSON.stringify({ results, errors }, null, 1));
await browser.close();
const failed = results.filter((r) => !r[1]).length;
console.log(`\nИТОГ: ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
