// Ширина в ряду мышью (запрос Макса 20.10.2026): npx tsx scripts/stretch-scenario.ts <url> <outDir>
// Ряд как на снимке Макса: пара 600 вплотную, комод, пара 600 вплотную, зазор 300, «Угловой».
// (а) поле «Ширина» 600 → 700 у правого модуля пары перед зазором — растёт вправо, левый сосед не меняется;
// (б) клик по плашке зазора → «Дотянуть» → зазор 0 (и Ctrl+Z обратно); (в) ручка правого края до соседа с привязкой;
// (г) тяга стыка между двумя вплотную; (д) Ctrl+Z — одно действие отмены.
import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";
import { initialModule, section, type Module } from "../src/model";
import { newProject, type PlacedModule, type Project } from "../src/project";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const mod = (name: string, width = 600, extra: Partial<Module> = {}): Module => ({ ...initialModule(), name, width, ...extra });
const at = (id: string, x: number, m: Module): PlacedModule => ({ id, x, y: 0, z: 3, rotation: 0, module: m });
const project = (): Project => {
  const p = newProject();
  p.room = { ...p.room, width: 5000 };
  // первым — «Шкаф 4» (правый модуль пары перед зазором): он выбран при открытии
  p.modules = [at("d", 3100, mod("Шкаф 4")), at("a", 500, mod("Шкаф 1")), at("b", 1100, mod("Шкаф 2")),
    at("k", 1700, mod("Комод", 800, { height: 900, doors: false, sections: [{ ...section(), drawers: 3 }] })),
    at("c", 2500, mod("Шкаф 3")), at("e", 4000, mod("Угловой"))];
  return p;
};
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const shot = (n: string) => page.screenshot({ path: `${out}/stretch-${n}.png` });
type Row = Record<string, { x: number; w: number }>;
async function row(p: Page): Promise<Row> {
  const list = await p.evaluate(() => (window as unknown as { __arrangement?: () => { id: string; x: number; w: number }[] }).__arrangement?.() ?? []);
  const r: Row = {};
  for (const a of list) r[a.id] = { x: Math.round(a.x), w: a.w };
  return r;
}
async function settled(expect: (r: Row) => boolean) { let r = await row(page); for (let i = 0; i < 20 && !expect(r); i++) { await page.waitForTimeout(150); r = await row(page); } return r; }
const fmt = (r: Row) => ["c", "d", "e"].map((id) => `${id}:${r[id]?.x}+${r[id]?.w}`).join(" ");
const center = async (sel: string) => { const b = await page.locator(sel).first().boundingBox(); return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null; };
const plaque = async (side: "left" | "right") => ((await page.locator(`.row-gap[data-side=${side}]`).count()) ? (await page.locator(`.row-gap[data-side=${side}]`).first().innerText()).trim() : "");
async function drag(from: { x: number; y: number }, toX: number, alt = false) {
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  if (alt) await page.keyboard.down("Alt");
  for (let i = 1; i <= 12; i++) { await page.mouse.move(from.x + ((toX - from.x) * i) / 12, from.y + (i % 2)); await page.waitForTimeout(25); }
  const live = (await page.locator(".drag-badge").innerText().catch(() => "")).trim();
  await shot(alt ? "live-alt" : "live-" + Math.round(toX));
  await page.mouse.up(); if (alt) await page.keyboard.up("Alt");
  await page.waitForTimeout(500);
  return live;
}
const undo = async () => { await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()); await page.keyboard.press("Control+z"); await page.waitForTimeout(500); };
try {
  await page.goto(url);
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-dock", "project"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(project()));
  await page.goto(url); await page.waitForSelector("canvas"); await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Двигать корпуса", exact: true }).click();
  // камера спереди на «Шкаф 3 · Шкаф 4 · зазор · Угловой» (координаты комнаты, мм)
  await page.evaluate(() => (window as unknown as { __camera: (p: number[], l: number[]) => void }).__camera([3450, 1150, 3600], [3450, 1000, 0]));
  await page.waitForTimeout(800);
  const start = await row(page);
  check("старт: Шкаф 4 600 у зазора 300", start.d?.w === 600 && start.e?.x === 4000, fmt(start));
  check("плашка зазора справа «← 300 мм →», слева (вплотную) — нет", (await plaque("right")) === "← 300 мм →" && !(await plaque("left")), `справа «${await plaque("right")}», слева «${await plaque("left")}»`);
  check("ручки «↔» на обоих боках", (await page.locator(".stretch-handle").count()) === 2);
  await shot("01-start");

  // (а) поле «Ширина» 600 → 700
  const cat = 'details[data-settings-category="Корпус и размещение"]';
  await page.locator(cat + " > summary").click();
  await page.evaluate((sel) => { for (let c: HTMLElement | null = document.querySelector(sel); c; c = c.parentElement) if (c instanceof HTMLDetailsElement) c.open = true; }, cat + ' input[aria-label="Ширина"]');
  const field = page.locator(cat + ' input[aria-label="Ширина"]').first();
  await field.click({ clickCount: 3 }); await field.fill("700"); await field.press("Enter");
  const a = await settled((r) => r.d?.w === 700);
  check("(а) Ширина 700: растёт вправо, левый сосед не меняется", a.d?.x === 3100 && a.d?.w === 700 && a.c?.w === 600 && a.c?.x === 2500 && a.e?.x === 4000, fmt(a));
  check("(а) плашка зазора 200", (await plaque("right")) === "← 200 мм →", await plaque("right"));
  await shot("02-width-700");

  // (б) клик по плашке → меню → «Дотянуть»
  await page.locator(".row-gap[data-side=right]").first().click();
  const menu = (await page.locator(".gap-menu").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  check("(б) меню плашки: Дотянуть / Придвинуть / Задать зазор", /Дотянуть \(\+200 мм\).*Придвинуть вплотную.*Задать зазор/.test(menu), menu);
  await shot("03-gap-menu");
  await page.getByRole("menuitem", { name: /Дотянуть/ }).click();
  const b = await settled((r) => r.d?.w === 900);
  check("(б) «Дотянуть»: ширина 900, зазор 0, плашки нет", b.d?.x === 3100 && b.d?.w === 900 && b.e?.x === 4000 && !(await plaque("right")), fmt(b));
  await shot("04-filled");
  await undo();
  const b2 = await settled((r) => r.d?.w === 700);
  check("(б) Ctrl+Z — обратно 700, зазор 200", b2.d?.w === 700 && (await plaque("right")) === "← 200 мм →", fmt(b2));

  // (в) ручка правого края — до соседа с привязкой (отпускаем за 15 мм до края «Углового»)
  const L = (await center(".stretch-handle[data-side=left]"))!, R = (await center(".stretch-handle[data-side=right]"))!;
  const pxmm = (R.x - L.x) / 700;
  const liveC = await drag(R, R.x + 185 * pxmm);
  const c = await settled((r) => r.d?.w !== 700);
  check("(в) живая плашка «ширина … · зазор …»", /ширина \d+ мм · зазор \d+/.test(liveC), liveC);
  check("(в) растяжение до соседа с привязкой: 900, левый край на месте, сосед не сдвинут", c.d?.x === 3100 && c.d?.w === 900 && c.e?.x === 4000 && c.c?.w === 600, fmt(c) + ` (px/мм ${pxmm.toFixed(3)})`);
  await shot("05-stretched");

  // (г) стык между двумя вплотную: левый край «Шкафа 4» (вплотную к «Шкафу 3») тянем влево на ~100 мм
  const L2 = (await center(".stretch-handle[data-side=left]"))!;
  const liveD = await drag(L2, L2.x - 100 * pxmm);
  const d = await settled((r) => r.c?.w !== 600);
  check("(г) стык: «Шкаф 4» 1000 и «Шкаф 3» 500 вместе, правый край на месте", d.d?.w === 1000 && d.d?.x === 3000 && d.c?.w === 500 && d.c?.x === 2500, fmt(d) + ` · «${liveD}»`);
  check("(г) живая плашка показывает соседа", /сосед «Шкаф 3» 500 мм/.test(liveD), liveD);
  await shot("06-joint");

  // (д) Ctrl+Z — одно действие: стык отменён, растяжение (в) осталось
  await undo();
  const e = await settled((r) => r.c?.w === 600);
  check("(д) Ctrl+Z: стык отменён одним действием", e.d?.w === 900 && e.d?.x === 3100 && e.c?.w === 600, fmt(e));
  await shot("07-undo");

  // правая кнопка по плашке не теряется (fromLabel), колесо проходит; меню «Размеры ›» с пунктами дотянуть/вплотную
  await undo();
  await page.locator(".row-gap[data-side=right]").first().click({ button: "right" }).catch(() => {});
  await page.waitForTimeout(300);
  const ringOpen = (await page.locator(".radial-menu").count()) > 0;
  let sizeItems = "";
  if (ringOpen) {
    await page.locator(".radial-item", { hasText: "Размеры" }).first().click().catch(() => {});
    await page.waitForTimeout(300);
    sizeItems = (await page.locator(".radial-item").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim()).join(" | ");
  }
  check("правый клик по плашке зазора — меню корпуса; «Размеры ›» с «Дотянуть вправо (+200)» и «Вплотную влево»", ringOpen && /Дотянуть вправо \(\+200\)/.test(sizeItems) && /Вплотную влево/.test(sizeItems), sizeItems);
  await shot("08-rclick-size");
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape");

  // Alt — без привязки
  const R3 = (await center(".stretch-handle[data-side=right]"))!;
  const liveAlt = await drag(R3, R3.x + 47 * pxmm, true);
  check("Alt: без привязки (плашка «Без привязки»)", /Без привязки/.test(liveAlt), liveAlt);
  console.log("ошибки страницы: " + (errors.length ? errors.join("; ") : "нет"));
  const bad = results.filter((r) => !r[1]);
  console.log(`ИТОГ: ${results.length - bad.length}/${results.length}`);
  if (bad.length) process.exitCode = 1;
} finally { await browser.close(); }
