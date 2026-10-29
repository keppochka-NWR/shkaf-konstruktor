// Ветка claude/fix-filler-worktop (правки Макса 29.10.2026) мышью и клавиатурой, как менеджер: своя сборка, системный Chrome headless,
// проект для проверки читается из хранилища браузера. npx tsx scripts/fix-filler-worktop-scenario.ts <url /?fresh=1> <папка>
//  A. Фальш из кругового меню «Корпус › Фальши › Фальшпанель слева/справа»: три шкафа 800 в ряд от левой стены —
//     у стены (фальш торцом 20 заменяется панелью, модуль на месте), между соседями (уже на 16 — пример Макса), справа свободно
//     (сдвиг на 16); Ctrl+Z. Кухня: два нижних 600 — у стены и сосед вплотную — модуль уже на 16, панель высотой модуля.
//  B. Палитра в остаток до стены: «Комод» 800 + 800 + 800 + 980 (h850 d500), затем 600 — добавлен 580 + фальш 20, сообщение
//     «Размер изменён … ширина 580 вместо 600».
//  C. «Столешница на модуль» правой кнопкой: комод на полу, стеллаж, поднятый «От пола» 1000, подвесной ящик.
import { chromium, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [url, out, only = "ABKC"] = process.argv.slice(2); // only — какие сцены: A шкафы, K кухня, B палитра, C столешница
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const results: [string, boolean, string][] = [], errors: string[] = [];
const stats = { clicks: 0, right: 0, keys: 0 };
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
let n = 0;
type PM = { id: string; x: number; y?: number; z: number; rotation?: number; module: { name: string; width: number; height: number; depth: number; sidePanels?: Record<string, { height: number; depth: number }>; wallFiller?: Record<string, unknown>; worktop?: { material: string; thickness: number } } };

async function fresh(): Promise<Page> {
  const p = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  p.setDefaultTimeout(6000);
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(url, { timeout: 60000 }); await p.waitForTimeout(4000);
  return p;
}
const shot = (p: Page, name: string) => p.screenshot({ path: join(out, `${String(++n).padStart(2, "0")}-${name}.png`) });
const vis = (p: Page, name: string) => p.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
async function click(p: Page, name: string) { const b = vis(p, name); if (!(await b.isVisible().catch(() => false))) { const pal = p.locator("details.module-palette").first(); if ((await pal.count()) && (await pal.getAttribute("open")) === null) { await pal.locator("summary").first().click(); stats.clicks++; await p.waitForTimeout(300); } } await vis(p, name).click(); stats.clicks++; await p.waitForTimeout(300); }
async function field(p: Page, label: string, v: number) { const f = p.getByLabel(label, { exact: true }).filter({ visible: true }).first(); await f.scrollIntoViewIfNeeded(); await f.click({ clickCount: 3 }); stats.clicks++; await p.keyboard.type(String(v)); await p.keyboard.press("Enter"); stats.keys += 2; await p.waitForTimeout(500); }
async function project(p: Page): Promise<{ modules: PM[] } | null> {
  return p.evaluate(() => { const s = JSON.parse(localStorage.getItem("garderyob-rooms-v1") || "null"); if (!s) return null; const r = s.rooms.find((r: { id: string }) => r.id === s.activeRoomId); return r?.project ?? null; });
}
async function palette(p: Page, kind: string, w: number, h: number, d: number) {
  await click(p, kind);
  await field(p, "Ширина новой мебели", w); await field(p, "Высота новой мебели", h); await field(p, "Глубина новой мебели", d);
  await click(p, "Добавить в комнату"); await p.waitForTimeout(1200);
  await p.locator('button:has-text("Понятно") >> visible=true').first().click({ timeout: 800 }).catch(() => undefined);
}
const notes = (p: Page) => p.locator(".error-banner").allInnerTexts().then((t) => t.join(" ").replace(/\s+/g, " ").trim()).catch(() => "");
/** Выбрать модуль i в списке слева и правой кнопкой по нему в 3D пройти путь кругового меню. */
async function radial(p: Page, i: number, path: string[]) {
  await p.locator(".module-list .module-item").nth(i).click(); stats.clicks++; await p.waitForTimeout(500);
  await vis(p, "3D").click(); await p.waitForTimeout(900);
  const pr = await project(p), m = pr!.modules[i].module, dims = `${m.width} × ${m.height} × ${m.depth}`;
  let opened = false;
  // над подписью ширины выбранного модуля; не попали (сосед впереди, пустое место) — выбрать снова и чуть выше/ниже/в стороны
  for (const [dx, dy] of [[0, 140], [0, 90], [0, 60], [0, 40], [0, 25], [0, 200], [-50, 30], [50, 30], [-80, 15], [80, 15], [0, -20]]) {
    if (dx || dy !== 140) { await p.locator(".module-list .module-item").nth(i).click(); stats.clicks++; await p.waitForTimeout(400); }
    const b = await p.locator(`text=/^${m.width} мм$/`).filter({ visible: true }).first().boundingBox().catch(() => null);
    const pt = b ? { x: b.x + b.width / 2 + dx, y: b.y - dy } : { x: 600, y: 420 };
    await p.mouse.click(pt.x, pt.y, { button: "right" }); stats.right++; await p.waitForTimeout(500);
    // курсор с пункта кольца (центр меню показывает подсказку пункта под курсором, а не размеры модуля)
    await p.mouse.move(1300, 700); await p.waitForTimeout(250);
    const txt = await p.locator(".radial-menu").first().innerText().catch(() => "");
    if (txt.includes(dims)) { opened = true; break; }
    if (process.env.DEBUG_MENU) console.log("  мимо", dx, dy, pt, JSON.stringify(txt.slice(-80)));
    await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  }
  if (!opened) { await shot(p, "fail-menu-" + m.width); throw Error(`меню модуля ${dims} не открылось`); }
  for (const label of path) {
    let item = p.locator(".radial-menu .radial-item", { hasText: label }).first();
    if (!(await item.isVisible().catch(() => false))) { const k = p.locator(".radial-menu .radial-item", { hasText: "Корпус" }).first(); if (await k.isVisible().catch(() => false)) { await k.click(); stats.clicks++; await p.waitForTimeout(500); } item = p.locator(".radial-menu .radial-item", { hasText: label }).first(); }
    await item.click(); stats.clicks++; await p.waitForTimeout(800);
  }
}
const mods = async (p: Page) => (await project(p))!.modules;
/** Раскрыть свёрнутые разделы панели справа (как менеджер щёлкает заголовки). */
async function openPanels(p: Page) {
  for (let round = 0; round < 3; round++) {
    const all = p.locator("details:not([open]) > summary"); let opened = 0;
    for (let i = 0, k = await all.count(); i < k && i < 40; i++) {
      const s = all.nth(i); if (!(await s.isVisible().catch(() => false))) continue;
      const txt = (await s.innerText().catch(() => "")).trim(); if (/^Добавить мебель|^Готовые кухонные/.test(txt)) continue;
      await s.click().catch(() => undefined); stats.clicks++; opened++; await p.waitForTimeout(80);
    }
    if (!opened) break;
  }
}
const t0 = Date.now();

// A. Фальш из кругового меню — шкафы
if (only.includes("A")) try {
  const p = await fresh();
  for (let i = 0; i < 3; i++) await palette(p, "Для одежды", 800, 2200, 600);
  let m = await mods(p);
  check("A: три шкафа 800 в ряд от левой стены (20 — фальш 16 + 4)", m.map((a) => a.x).join(",") === "20,820,1620", m.map((a) => a.x).join(","));
  await shot(p, "A-do-3-shkafa");
  await radial(p, 0, ["Фальши", "Фальшпанель слева"]);
  m = await mods(p);
  check("A1 у стены: панель вместо фальша торцом, шкаф на месте 800", m[0].x === 20 && m[0].module.width === 800 && !!m[0].module.sidePanels?.left && !m[0].module.wallFiller?.left, JSON.stringify({ x: m[0].x, w: m[0].module.width, sp: !!m[0].module.sidePanels?.left }) + " " + (await notes(p)));
  await shot(p, "A1-u-steny");
  await radial(p, 1, ["Фальши", "Фальшпанель слева"]);
  m = await mods(p);
  check("A2 пример Макса: справа сосед вплотную, фальш слева — шкаф уже на 16 (784, x 836)", m[1].x === 836 && m[1].module.width === 784 && !!m[1].module.sidePanels?.left, `x ${m[1].x} w ${m[1].module.width} · ${await notes(p)}`);
  await shot(p, "A2-suzhenie");
  await radial(p, 2, ["Фальши", "Фальшпанель слева"]);
  m = await mods(p);
  check("A3 справа свободно: шкаф сдвинут вправо на 16 (x 1636), ширина 800", m[2].x === 1636 && m[2].module.width === 800 && !!m[2].module.sidePanels?.left, `x ${m[2].x} w ${m[2].module.width} · ${await notes(p)}`);
  await shot(p, "A3-sdvig");
  await p.keyboard.press("Escape"); await p.locator("canvas").first().click({ position: { x: 5, y: 5 } }).catch(() => undefined);
  await p.keyboard.press("Control+z"); stats.keys++; await p.waitForTimeout(900);
  m = await mods(p);
  check("A3 Ctrl+Z: шкаф снова x 1620 без панели", m[2].x === 1620 && !m[2].module.sidePanels, `x ${m[2].x}`);
} catch (e) { check("A шкафы", false, (e as Error).message.split("\n")[0]); }

// A. Кухня
if (only.includes("K")) try {
  const p = await fresh();
  await p.getByRole("tab", { name: "Кухонные модули" }).first().click(); stats.clicks++; await p.waitForTimeout(400);
  for (let i = 0; i < 2; i++) await palette(p, "Нижний кухонный", 600, 860, 560);
  let m = await mods(p);
  check("A-кухня: два нижних 600 вплотную", m.length === 2 && Math.abs(m[1].x - m[0].x - 600) < 1, m.map((a) => a.x).join(","));
  await shot(p, "A-kuhnya-do");
  await radial(p, 1, ["Фальши", "Фальшпанель слева"]);
  m = await mods(p);
  const sp = m[1].module.sidePanels?.left;
  check("A-кухня: фальш слева у второго — справа свободно, сдвиг на 16; панель высотой модуля", !!sp && sp.height === m[1].module.height && m[1].module.width === 600, JSON.stringify({ x: m[1].x, w: m[1].module.width, sp }) + " " + (await notes(p)));
  await radial(p, 0, ["Фальши", "Фальшпанель справа"]);
  m = await mods(p);
  check("A-кухня: первый у стены, сосед справа (с панелью) вплотную — уже на 16 (584)", m[0].module.width === 584 && !!m[0].module.sidePanels?.right, `w ${m[0].module.width} · ${await notes(p)}`);
  await shot(p, "A-kuhnya-posle");
} catch (e) { check("A кухня", false, (e as Error).message.split("\n")[0]); }

// B. Палитра в остаток до стены
if (only.includes("B")) try {
  const p = await fresh();
  await click(p, "Комод");
  for (const w of [800, 800, 800, 980]) await palette(p, "Комод", w, 850, 500);
  let m = await mods(p);
  const right = Math.max(...m.map((a) => a.x + a.module.width));
  check("B: ряд комодов до 3400, остаток 600 до стены", Math.abs(right - 3400) < 1, String(right));
  await palette(p, "Комод", 600, 850, 500);
  await p.waitForTimeout(900);
  m = await mods(p);
  const last = m.at(-1)!, note = await notes(p);
  await shot(p, "B-komod-580");
  check("B: «Комод» 600 добавлен сразу шириной 580 в ряд (фальш 20 у стены)", m.length === 5 && last.module.width === 580 && Math.abs(last.x - 3400) < 1, `w ${last.module.width} x ${last.x}`);
  check("B: сообщение «ширина 580 вместо 600 — у стены фальш 20 мм (16 + 4)»", /ширина 580 вместо 600 — у стены фальш 20 мм \(16 \+ 4\)/.test(note), note.slice(0, 200));
  check("B: диалога «Поставить отдельно / Сузить до» нет", !(await p.getByRole("button", { name: /Поставить отдельно|Сузить до/ }).count()));
} catch (e) { check("B палитра", false, (e as Error).message.split("\n")[0]); }

// C. Столешница на модуль
if (only.includes("C")) try {
  const p = await fresh();
  await palette(p, "Комод", 800, 850, 500);
  await radial(p, 0, ["Столешница на модуль"]);
  let m = await mods(p), w = m.find((a) => a.module.worktop);
  check("C1 комод на полу: столешница ЛДСП 32 800 на высоте 850", !!w && w.y === 850 && w.module.width === 800 && w.module.worktop!.thickness === 32, JSON.stringify(w ? { y: w.y, w: w.module.width, d: w.module.depth } : null) + " " + (await notes(p)));
  await shot(p, "C1-komod");
  await palette(p, "Стеллаж", 600, 300, 400);
  m = await mods(p);
  const si = m.length - 1;
  await p.locator(".module-list .module-item").nth(si).click(); stats.clicks++; await p.waitForTimeout(400);
  const fl = p.getByLabel("От пола", { exact: true }).filter({ visible: true }).first();
  if (!(await fl.isVisible().catch(() => false))) await openPanels(p);
  await field(p, "От пола", 1000);
  m = await mods(p);
  check("C2 стеллаж поднят «От пола» 1000", m[si].y === 1000, String(m[si].y));
  await radial(p, si, ["Столешница на модуль"]);
  m = await mods(p); w = m.filter((a) => a.module.worktop).at(-1);
  check("C2 поднятая полка: столешница на её верху (1300), ширина 600", !!w && w.y === 1300 && w.module.width === 600, JSON.stringify(w ? { y: w.y, w: w.module.width, d: w.module.depth } : null) + " " + (await notes(p)));
  await shot(p, "C2-polka");
  await palette(p, "Подвесной ящик", 825, 400, 431);
  m = await mods(p);
  const hi = m.findIndex((a) => a.module.width === 825);
  await radial(p, hi, ["Столешница на модуль"]);
  m = await mods(p); w = m.filter((a) => a.module.worktop).at(-1);
  const h = m[hi];
  check("C3 подвесной ящик: столешница на верху тумбы, ширина 825", !!w && w.module.width === 825 && w.y === (h.y ?? 0) + h.module.height, JSON.stringify(w ? { y: w.y, top: (h.y ?? 0) + h.module.height } : null) + " " + (await notes(p)));
  await shot(p, "C3-podvesnoy");
} catch (e) { check("C столешница", false, (e as Error).message.split("\n")[0]); }

await browser.close();
const ok = results.filter((r) => r[1]).length;
console.log(`итог: ${ok}/${results.length}, ошибок страницы ${errors.length}, ${Math.round((Date.now() - t0) / 1000)} с, кликов ${stats.clicks}, правой ${stats.right}, клавиш ${stats.keys}`);
writeFileSync(join(out, "result.json"), JSON.stringify({ results, errors, stats }, null, 1));
process.exit(ok === results.length && !errors.length ? 0 : 1);
