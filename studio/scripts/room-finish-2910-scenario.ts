// Отделка помещения (список Макса 29.10.2026) мышью, как менеджер: npx tsx scripts/room-finish-2910-scenario.ts <url /studio/?fresh=1> <outDir>
//  1. Пустая комната, этап «Помещение» → «Отделка: пол и стены» → «Пол»: поиск «серый дуб», ламинат — пол в 3D доской настоящего размера.
//  2. «Направление укладки» → вдоль глубины; группа «Плитка» → «Calacatta» 60×120; ламинат «ёлочка».
//  3. «Стены» → «Все стены» → обои Erismann Martinique; «Задняя» → покраска «Оливковая»; «Левая» → настенная плитка Cersanit.
//  4. Ссылка «Открыть на Лемана Про» — товар lemanapro.ru с артикулом. Отделка в документе комнат; F5 — на месте.
//  5. Шкаф в комнату: цена в доке с отделкой и без неё одинаковая.
import { chromium, type Locator } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { newProject, parseProject, type Project } from "../src/project";
import { initialModule } from "../src/model";
import { FINISHES } from "../src/roomFinishes";

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
const shot = async (name: string) => { await page.waitForTimeout(900); await page.screenshot({ path: `${out}/${String(++shotN).padStart(2, "0")}-${name}.png`, timeout: 60000 }); };
const click = async (l: Locator) => { await l.scrollIntoViewIfNeeded(); await l.click(); await page.waitForTimeout(350); };
const panel = () => page.getByTestId("room-finishes").first();
async function search(text: string) { const s = panel().getByLabel("Поиск отделки"); await s.scrollIntoViewIfNeeded(); await s.click({ clickCount: 3 }); await page.keyboard.press("Control+A"); await page.keyboard.press("Delete"); if (text) await page.keyboard.type(text); await page.waitForTimeout(300); }
async function pick(text: string) { await click(panel().getByTestId("finish-list").locator(".finish-item > button").filter({ hasText: text }).first()); }
async function active(): Promise<Project> {
  await page.waitForTimeout(900);
  const raw = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith("garderyob-rooms-v1") && !x.includes(":previous") && !x.includes(":damaged")); return k ? localStorage.getItem(k) : null; });
  if (!raw) throw Error("документ комнат не сохранён");
  const d = JSON.parse(raw), r = d.rooms.find((x: { id: string }) => x.id === d.activeRoomId) ?? d.rooms[0];
  return parseProject(r.project, true);
}
async function openFinishes() {
  if (!(await panel().isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /Помещение/ }).first().click().catch(() => {});
    await page.waitForTimeout(400);
    const s = page.locator("summary", { hasText: "Отделка: пол и стены" }).first();
    if (await s.count()) await click(s);
  }
  await panel().scrollIntoViewIfNeeded();
}
const byName = (t: string) => FINISHES.find((f) => f.name.includes(t))!;

// fix-plan-click (29.10): настоящий щелчок по «План» и обратно в проекте с мебелью, панель отделки ни разу не открывалась
// (вкладка «Помещение» монтирует список образцов): щелчок не возвращался — образцы растеризовались на холсте видеокарты
// десятки секунд. Отдельная вкладка: проект из хранилища, как в stretch-guides-scenario.
{
  const plan = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  plan.on("pageerror", (e) => errors.push(e.message));
  await plan.addInitScript({ content: "window.__long=[];try{new PerformanceObserver(function(l){l.getEntries().forEach(function(e){window.__long.push(Math.round(e.duration));});}).observe({type:'longtask',buffered:true});}catch(e){}" });
  const pr = newProject(); pr.room = { ...pr.room, width: 4000, depth: 3000, height: 2700 }; pr.modules = [{ id: "a", x: 1000, y: 0, z: 3, rotation: 0, module: { ...initialModule(), name: "Шкаф", width: 600, height: 2000, depth: 550 } }];
  await plan.goto(url, { timeout: 60000 });
  await plan.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(pr));
  await plan.goto(url, { timeout: 60000 }); await plan.waitForSelector("canvas"); await plan.waitForTimeout(2500);
  const n0 = (await plan.evaluate("window.__long.length")) as number;
  let t0 = Date.now();
  const planOk = await plan.getByRole("button", { name: "План", exact: true }).click({ timeout: 8000 }).then(() => true, () => false);
  const planMs = Date.now() - t0;
  check("план: настоящий щелчок по «План» возвращается быстро", planOk && planMs < 2000, planMs + " мс");
  await plan.waitForTimeout(1500);
  const frames = planOk ? ((await plan.evaluate("new Promise(function(r){var n=0,t=performance.now();(function f(){n++;if(performance.now()-t<1000)requestAnimationFrame(f);else r(n);})();})")) as number) : 0;
  const longs = planOk ? ((await plan.evaluate(`window.__long.slice(${n0})`)) as number[]) : [];
  check("план: после открытия страница свободна (кадры идут, нет задач > 500 мс)", planOk && frames >= 20 && longs.every((d) => d < 500), `кадров за 1 с: ${frames}, длинные задачи: ${JSON.stringify(longs)}`);
  if (planOk) await plan.screenshot({ path: `${out}/00-plan-open.png`, timeout: 60000 });
  t0 = Date.now();
  const backOk = planOk && (await plan.getByRole("button", { name: "3D", exact: true }).first().click({ timeout: 8000 }).then(() => true, () => false));
  check("план: щелчок «3D» обратно возвращается быстро", backOk && Date.now() - t0 < 2000, Date.now() - t0 + " мс");
  await plan.close().catch(() => {});
}await page.goto(url, { timeout: 60000 });
await page.waitForTimeout(2500);
await shot("start");
await openFinishes();
check("1. раздел «Отделка: пол и стены» на этапе «Помещение»", await panel().isVisible());
await click(panel().getByRole("tab", { name: "Пол" }));
await search("серый дуб");
const greyCount = await panel().locator(".finish-item").count();
check("1. поиск «серый дуб» — только подходящие позиции", greyCount > 0 && greyCount < 15, `${greyCount} поз.`);
const grey = byName("Estetica Дуб Натур Серый");
await pick("Estetica Дуб Натур Серый");
let p = await active();
check("1. ламинат на полу в документе", p.room.finish?.floor?.id === grey.id, JSON.stringify(p.room.finish));
const cur = panel().getByTestId("finish-current").first();
check("1. выбранное: название, артикул, размер доски", (await cur.innerText()).includes(grey.article) && (await cur.innerText()).includes("1292×194"));
const href = await cur.getByRole("link", { name: "Открыть на Лемана Про" }).getAttribute("href");
check("4. ссылка «Открыть на Лемана Про» — товар с артикулом", href === grey.url && /^https:\/\/lemanapro\.ru\/product\/.+-\d{8}\/$/.test(href ?? ""), href ?? "");
await shot("floor-laminate");
await panel().getByLabel("Направление укладки").selectOption("depth");
p = await active();
check("2. укладка вдоль глубины сохранена", p.room.finish?.floor?.along === "depth");
await shot("floor-laminate-depth");
await search("");
await click(panel().getByRole("button", { name: "Плитка", exact: true }));
const tilesOnly = await panel().getByTestId("finish-list").locator("h4").allInnerTexts();
check("2. группа «Плитка» — только плитка для пола", tilesOnly.length === 1 && /^плитка/i.test(tilesOnly[0]), tilesOnly.join(","));
const swatchOf = async () => { await page.waitForTimeout(400); return panel().getByTestId("finish-current").locator(".finish-swatch").first().evaluate((e) => (e as HTMLElement).style.backgroundImage); };
const before = await swatchOf();
await pick("Calacatta");
p = await active();
check("2. плитка Calacatta на полу", p.room.finish?.floor?.id === byName("Calacatta").id);
const after = await swatchOf();
check("2. образец выбранного сменился вместе с позицией", !!before && !!after && before !== after);
await shot("floor-tile-calacatta");
await click(page.getByRole("button", { name: "Сверху", exact: true }).first());
await shot("floor-tile-top");
await click(page.getByRole("button", { name: "3D", exact: true }).first());
await click(panel().getByRole("button", { name: "Ламинат", exact: true }));
await search("ёлочка");
await pick("Kronotex");
p = await active();
check("2. ламинат ёлочкой", p.room.finish?.floor?.id === byName("Kronotex").id);
await shot("floor-herringbone");
// Критик п.1: перебор каталога не копит текстуры — в памяти только позиции комнаты
await search("");
const floorItems = panel().getByTestId("finish-list").locator(".finish-item > button");
for (let i = 0; i < 8; i++) await click(floorItems.nth(i));
await pick("Kronotex");
const textures = await page.evaluate(() => (window as unknown as { __finishTextures?: () => number }).__finishTextures?.() ?? -1);
check("п.1 перебор 9 позиций пола — в памяти 1 текстура (пол)", textures === 1, String(textures));

await click(panel().getByRole("tab", { name: "Стены" }));
await panel().getByLabel("Стена для отделки").selectOption("all");
await search("Martinique");
await pick("Martinique");
p = await active();
const mart = byName("Martinique").id;
check("3. обои на все стены", ["back", "left", "right", "front"].every((w) => (p.room.finish?.walls as Record<string, { id?: string }>)?.[w]?.id === mart), JSON.stringify(p.room.finish?.walls));
await shot("walls-wallpaper");
await panel().getByLabel("Стена для отделки").selectOption("back");
await click(panel().getByRole("button", { name: "Покраска: Оливковая" }));
await panel().getByLabel("Стена для отделки").selectOption("left");
await search("Cersanit");
await pick("Cersanit Marvel");
p = await active();
const w = p.room.finish?.walls as Record<string, { id?: string; paint?: string }>;
check("3. задняя — покраска, левая — плитка, правая — обои", w?.back?.paint === "#a8ab8a" && w?.left?.id === byName("Cersanit Marvel").id && w?.right?.id === mart, JSON.stringify(w));
await panel().getByLabel("Стена для отделки").selectOption("all");
check("3. «Все стены» при разной отделке — «Отделка разная»", (await panel().innerText()).includes("Отделка разная"));
await shot("walls-mixed");
// Критик п.2: свой цвет — пока палитра открыта, проект не меняется; при закрытии — один раз
await panel().getByLabel("Стена для отделки").selectOption("right");
const rawDoc = () => page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith("garderyob-rooms-v1") && !x.includes(":previous") && !x.includes(":damaged")); return k ? localStorage.getItem(k) : null; });
await page.waitForTimeout(900);
const docBefore = await rawDoc();
await panel().getByLabel("Другой цвет покраски").evaluate((el) => { const i = el as HTMLInputElement, set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!; for (const c of ["#336699", "#3a6f9f", "#4477aa"]) { set.call(i, c); i.dispatchEvent(new Event("input", { bubbles: true })); } });
await page.waitForTimeout(1200);
check("п.2 палитра на ходу — проект не сохраняется", (await rawDoc()) === docBefore);
check("п.2 палитра на ходу — образец в панели показывает цвет", (await panel().getByTestId("finish-current").locator(".finish-swatch").first().evaluate((e) => getComputedStyle(e).backgroundColor)) === "rgb(68, 119, 170)");
await panel().getByLabel("Другой цвет покраски").evaluate((el) => el.dispatchEvent(new Event("change", { bubbles: true })));
p = await active();
check("п.2 палитру закрыли — цвет записан одним шагом", (p.room.finish?.walls as Record<string, { paint?: string }>)?.right?.paint === "#4477aa", JSON.stringify(p.room.finish?.walls));
// Критик п.3: артикул, которого нет в каталоге — «Неизвестная позиция» с «Убрать»
await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith("garderyob-rooms-v1") && !x.includes(":previous") && !x.includes(":damaged"))!; const d = JSON.parse(localStorage.getItem(k)!); for (const r of d.rooms) if (r.project.room.finish?.walls) r.project.room.finish.walls.front = { id: "99999999" }; localStorage.setItem(k, JSON.stringify(d)); });
await page.reload();
await page.waitForTimeout(2500);
await openFinishes();
await click(panel().getByRole("tab", { name: "Стены" }));
await panel().getByLabel("Стена для отделки").selectOption("front");
check("п.3 неизвестный артикул — «Неизвестная позиция 99999999»", (await panel().getByTestId("finish-current").first().innerText()).includes("Неизвестная позиция 99999999"));
await shot("unknown-article");
await click(panel().getByRole("button", { name: /Убрать отделку: Передняя/ }));
p = await active();
check("п.3 «Убрать» снимает неизвестную позицию", !(p.room.finish?.walls as Record<string, unknown>)?.front, JSON.stringify(p.room.finish?.walls));

await page.reload();
await page.waitForTimeout(2500);
await openFinishes();
p = await active();
check("4. после F5 отделка на месте", p.room.finish?.floor?.id === byName("Kronotex").id && (p.room.finish?.walls as Record<string, { paint?: string }>)?.back?.paint === "#a8ab8a");
check("4. после F5 в панели — выбранный пол", (await panel().getByTestId("finish-current").first().innerText()).includes(byName("Kronotex").article));
const floorMesh = await page.evaluate(() => (window as unknown as { __pending?: () => number }).__pending?.() ?? -1);
check("4. сцена собрана без ожидающих текстур", floorMesh === 0, String(floorMesh));
await shot("after-reload");

// 5. Цена: шкаф в комнату, цена с отделкой = без отделки
await click(page.getByRole("button", { name: "Добавить первый шкаф" }).first());
await page.waitForTimeout(2000);
const total = async () => { await page.waitForTimeout(800); return (await page.locator(".project-dock").first().innerText().catch(() => "")).replace(/\s+/g, " ").match(/\d[\d\s]*\s?₽/g)?.map((s) => s.trim()).join("|") ?? ""; };
p = await active();
check("5. шкаф в комнате, отделка сохранилась", p.modules.length > 0 && !!p.room.finish?.floor);
const withFinish = await total();
await shot("wardrobe-with-finish");
await openFinishes();
await click(panel().getByRole("tab", { name: "Пол" }));
await click(panel().getByRole("button", { name: /Убрать отделку: Пол/ }));
await click(panel().getByRole("tab", { name: "Стены" }));
await panel().getByLabel("Стена для отделки").selectOption("all");
await click(panel().getByRole("button", { name: /Убрать отделку: Все стены/ }));
p = await active();
check("5. отделка убрана — поля нет в проекте", p.room.finish === undefined, JSON.stringify(p.room.finish));
const without = await total();
check("5. цена в доке не зависит от отделки", withFinish !== "" && withFinish === without, `${withFinish} / ${without}`);
await shot("wardrobe-no-finish");

check("без ошибок страницы", errors.length === 0, errors.slice(0, 3).join(" | "));
writeFileSync(`${out}/results.json`, JSON.stringify({ results, errors }, null, 1));
await browser.close();
const failed = results.filter((r) => !r[1]).length;
console.log(failed ? `НЕ ПРОШЛО: ${failed}` : "ВСЁ ПРОШЛО");
process.exit(failed ? 1 : 0);
