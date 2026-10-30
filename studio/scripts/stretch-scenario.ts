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
const tex404: string[] = [];
page.on("response", (r) => { if (r.status() >= 400 && /\/tex\//.test(r.url())) tex404.push(r.status() + " " + decodeURIComponent(r.url())); });
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
/** Галочка «Привязки корпусов» (с 30.10 «без привязки» — только она; Shift отмечает корпуса и тянет группу). */
const snapToggle = async (on: boolean) => { const cb = page.getByRole("checkbox", { name: "Привязки корпусов" }); if ((await cb.isChecked()) !== on) await cb.evaluate((el) => (el as HTMLInputElement).click()); await page.waitForTimeout(250); };
async function drag(from: { x: number; y: number }, toX: number, alt = false) {
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  if (alt) await snapToggle(false); // без привязки — галочка «Привязки корпусов» (до 29.10 — Alt, до 30.10 — Shift)
  for (let i = 1; i <= 12; i++) { await page.mouse.move(from.x + ((toX - from.x) * i) / 12, from.y + (i % 2)); await page.waitForTimeout(25); }
  const live = (await page.locator(".drag-badge").innerText().catch(() => "")).trim();
  await shot(alt ? "live-alt" : "live-" + Math.round(toX));
  await page.mouse.up(); if (alt) await snapToggle(true);
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
  check("(б) меню плашки: Дотянуть / Придвинуть / Задать зазор", /Дотянуть \(\+200 мм\).*Придвинуть вплотную.*Задать зазор — изменить ширину/.test(menu), menu);
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

  // без привязки — галочка «Привязки корпусов» снята (до 29.10 — Alt, до 30.10 — Shift)
  const R3 = (await center(".stretch-handle[data-side=right]"))!;
  const liveAlt = await drag(R3, R3.x + 47 * pxmm, true);
  check("галочка «Привязки корпусов» снята: без привязки (плашка «Без привязки»)", /Без привязки/.test(liveAlt), liveAlt);

  // m3: «Задать зазор…» меняет ширину (правый край), левый на месте; «Придвинуть вплотную» неактивно — оторвёт от «Шкаф 3»
  const m3a = await row(page);
  await page.locator(".row-gap[data-side=right]").first().click();
  const flushBtn = page.getByRole("menuitem", { name: /Придвинуть вплотную/ });
  check("m3: «Придвинуть вплотную» неактивно — оторвёт от «Шкаф 3»", (await flushBtn.isDisabled()) && /оторвёт от «Шкаф 3»/.test(await flushBtn.innerText()), (await flushBtn.innerText()).replace(/\s+/g, " "));
  await page.getByRole("menuitem", { name: /Задать зазор — изменить ширину/ }).click(); // два пункта: «сдвинуть модуль» и «изменить ширину» (App) — m3 про ширину await page.waitForTimeout(300);
  const dlg = (await page.locator(".dimension-editor").innerText().catch(() => "")).replace(/\s+/g, " ");
  check("m4: окно «Задать зазор» без двойного «мм»", !/мм, мм/.test(dlg) && /Зазор справа до «Угловой», мм/.test(dlg), dlg.slice(0, 80));
  await shot("09-gap-dialog");
  const inp = page.locator(".dimension-editor input").first(); await inp.fill("50"); await inp.press("Enter");
  const m3 = await settled((r) => r.d?.w !== m3a.d?.w);
  check("m3: зазор 50 — ширина меняется, левый край на месте", m3.d?.x === 3100 && m3.d?.w === 850 && m3.e?.x === 4000 && (await plaque("right")) === "← 50 мм →", fmt(m3));
  await shot("10-gap-50");

  // ── B1 и m8: 3D «Двигать корпуса», зазор 147 и 20 мм — плашка видна (elementFromPoint), не под ручкой и не под размерами
  const gapProject = (g: number) => { const p = project(); p.modules.find((a) => a.id === "e")!.x = 3700 + g; return p; };
  const open = async (p: Project) => {
    // сначала уйти со страницы студии (при уходе она сохраняет свой проект), потом подложить новый — тот же адрес сайта
    await page.goto(new URL("../", url).href); await page.evaluate((raw) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-dock", "project"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(p));
    await page.goto(url); await page.waitForSelector("canvas"); await page.waitForTimeout(2000);
    await page.getByRole("button", { name: "Двигать корпуса", exact: true }).click(); await page.waitForTimeout(500);
  };
  for (const g of [147, 20]) {
    await open(gapProject(g));
    // строкой: tsx (esbuild keepNames) оборачивает именованные функции в __name, которого нет на странице
    const vis = (await page.evaluate(`(() => {
      const el = document.querySelector(".row-gap[data-side=right]"), hs = [...document.querySelectorAll(".stretch-handle")];
      if (!el) return { ok: false, info: "плашки нет" };
      const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const cross = function (a, b) { return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom; };
      const handles = hs.filter(function (h) { return h.style.display !== "none"; }).map(function (h) { return h.getBoundingClientRect(); });
      const dims = [...document.querySelectorAll(".model-dimension:not(.row-gap)")].filter(function (d) { return d.style.display !== "none" && d.style.visibility !== "hidden"; }).map(function (d) { return d.getBoundingClientRect(); });
      return { ok: !!(hit && hit.closest(".row-gap")) && getComputedStyle(el).visibility !== "hidden" && !handles.some(function (h) { return cross(h, r); }) && !dims.some(function (d) { return cross(d, r); }),
        info: "«" + el.innerText + "» в " + Math.round(r.left + r.width / 2) + "," + Math.round(r.top + r.height / 2) + "; ручек " + handles.length + "; elementFromPoint → " + (hit ? hit.className : "") };
    })()`)) as { ok: boolean; info: string };

    check(`B1: 3D «Двигать корпуса», зазор ${g} — плашка видна, не под ручкой и размерами`, vis.ok, vis.info);
    await shot(`11-3d-gap-${g}`);
  }
  // m7: «Сбоку» — ось ширины вдоль взгляда, ручки в одной точке → скрыты
  await page.getByRole("button", { name: "Сбоку", exact: true }).click(); await page.waitForTimeout(800);
  const sideHandles = await page.locator(".stretch-handle").evaluateAll((els) => els.filter((e) => (e as HTMLElement).style.display !== "none").length);
  check("m7: «Сбоку» — ручки скрыты (ось ширины вдоль взгляда)", sideHandles === 0, `видно ручек: ${sideHandles}`);
  await shot("11-side-no-handles");
  // m8: тяга 50 px в 3D — мм по видимому масштабу оси (без усиления); на ближнем 3D-ракурсе ≤ ~150 мм
  for (const [name, cam] of [["3D по умолчанию", null], ["3D ближе", [[4300, 1700, 2900], [3400, 1000, 0]]]] as const) {
    await open(gapProject(700)); // зазор шире 50 px на любом из ракурсов — сдвиг не упирается в соседа
    if (cam) { await page.evaluate((c) => (window as unknown as { __camera: (p: number[], l: number[]) => void }).__camera(c[0] as number[], c[1] as number[]), cam); await page.waitForTimeout(600); }
    // Стартовый 3D-ракурс зависит от сборки (на dev-сервере vite, React StrictMode, камера дальше): корпус 600 издалека — ручки ближе
    // 48 px и по правилу m7 скрыты. Тогда, как менеджер, колесом ближе к ручкам (смотрим и в 788901d — так же), а не падаем на null.
    for (let i = 0; i < 6 && !(await center(".stretch-handle[data-side=right]")); i++) {
      const at = await page.evaluate(`(() => { const h = document.querySelector(".stretch-handle[data-side=right]"), c = document.querySelector(".scene canvas") || document.querySelector("canvas"); const r = c.getBoundingClientRect(); return h && h.style.left ? { x: r.left + parseFloat(h.style.left), y: r.top + parseFloat(h.style.top) } : { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`) as { x: number; y: number };
      await page.mouse.move(at.x, at.y); await page.mouse.wheel(0, -240); await page.waitForTimeout(500);
    }
    const hl = await center(".stretch-handle[data-side=left]"), hr = await center(".stretch-handle[data-side=right]");
    if (!hl || !hr) { check(`m8: ${name} — ручки «↔» видны после перезагрузки проекта`, false, "ручки скрыты и колесом"); await shot(`12-m8-${cam ? "near" : "default"}-no-handles`); continue; }
    const k = Math.hypot(hr.x - hl.x, hr.y - hl.y) / 600, ux = (hr.x - hl.x) / Math.hypot(hr.x - hl.x, hr.y - hl.y), uy = (hr.y - hl.y) / Math.hypot(hr.x - hl.x, hr.y - hl.y);
    await snapToggle(false); await page.mouse.move(hr.x, hr.y); await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(hr.x + ux * 5 * i, hr.y + uy * 5 * i); await page.waitForTimeout(20); }
    const live = (await page.locator(".drag-badge").innerText().catch(() => "")).trim();
    const badgeBox = await page.locator(".drag-badge").boundingBox();
    await shot(`12-m8-${cam ? "near" : "default"}`);
    await page.keyboard.press("Escape"); await page.mouse.up(); await snapToggle(true); await page.waitForTimeout(300);
    const mm = Number(/ширина (\d+(?:\.\d+)?) мм/.exec(live)?.[1] ?? NaN) - 600, expect = 50 / k;
    check(`m8: ${name} — 50 px ≈ ${Math.round(expect)} мм по масштабу (${k.toFixed(3)} px/мм)`, Math.abs(mm - expect) <= Math.max(10, expect * 0.15) && (!cam || mm <= 160), `сдвиг ${mm} мм · «${live}»`);
    check(`m6: ${name} — живая плашка у курсора`, !!badgeBox && Math.abs(badgeBox.x + badgeBox.width / 2 - (hr.x + ux * 50)) < 60 && badgeBox.y < hr.y, JSON.stringify(badgeBox));
  }
  // B2: свежая комната → «Пустой шкаф» → «Добавить в комнату» два раза подряд — без «пересекается»
  await page.evaluate(() => localStorage.clear()); await page.goto(url + "?fresh=1"); await page.waitForTimeout(2000);
  for (let i = 0; i < 2; i++) {
    await page.locator("button", { hasText: "Пустой шкаф" }).first().click();
    await page.getByRole("button", { name: "Добавить в комнату" }).first().click(); await page.waitForTimeout(1500);
  }
  const two = await row(page), banner = (await page.locator(".error-banner").innerText().catch(() => "")).replace(/\s+/g, " ");
  const xs = Object.values(two).map((v) => v.x).sort((a, b) => a - b);
  check("B2: два «Добавить в комнату» подряд — два шкафа, без ошибки", Object.keys(two).length === 2 && !/пересекается/.test(banner), `x: ${xs.join(", ")}; плашка: «${banner}»`);
  await shot("13-fresh-two");
  // m1 + m5: ошибка ширины — текст без кавычек в кавычках, плашка в углу (не на ручках), «×» нажимается, сама скрывается через 6 с
  await open(gapProject(147));
  const widthErr = async () => {
    await page.locator(cat + " > summary").click().catch(() => {});
    await page.evaluate((sel) => { for (let c: HTMLElement | null = document.querySelector(sel); c; c = c.parentElement) if (c instanceof HTMLDetailsElement) c.open = true; }, cat + ' input[aria-label="Ширина"]');
    const f = page.locator(cat + ' input[aria-label="Ширина"]').first(); await f.fill("900"); await f.press("Enter"); await page.waitForTimeout(400);
  };
  await widthErr();
  const ban = page.locator(".error-banner");
  const banText = (await ban.innerText().catch(() => "")).replace(/\s+/g, " ");
  check("m5: «справа свободно 147 мм до «Угловой», а нужно 300. Можно дотянуть до него (+147 мм)»", /справа свободно 147 мм до «Угловой», а нужно 300\. Можно дотянуть до него \(\+147 мм\)/.test(banText), banText);
  const geo = (await page.evaluate(`(() => {
    const b = document.querySelector(".error-banner"), x = b && b.querySelector('button[aria-label="Закрыть сообщение"]');
    if (!b || !x) return { ok: false, info: "нет плашки или «×»" };
    const r = b.getBoundingClientRect(), xr = x.getBoundingClientRect(), hit = document.elementFromPoint(xr.left + xr.width / 2, xr.top + xr.height / 2);
    const hs = [...document.querySelectorAll(".stretch-handle")].filter(function (h) { return h.style.display !== "none"; }).map(function (h) { return h.getBoundingClientRect(); });
    const cross = hs.some(function (h) { return h.left < r.right && r.left < h.right && h.top < r.bottom && r.top < h.bottom; });
    return { ok: !!(hit && hit.closest('button[aria-label="Закрыть сообщение"]')) && !cross && getComputedStyle(b).pointerEvents === "none", info: "плашка " + Math.round(r.left) + "," + Math.round(r.top) + " " + Math.round(r.width) + "×" + Math.round(r.height) + "; «×» → " + (hit ? hit.tagName : "") + "; на ручках: " + cross };
  })()`)) as { ok: boolean; info: string };
  check("m1: плашка ошибки в углу, не на ручках, фон пропускает мышь, «×» нажимается", geo.ok, geo.info);
  await shot("14-error-banner");
  await page.locator('.error-banner button[aria-label="Закрыть сообщение"]').click();
  check("m1: «×» закрывает", (await ban.count()) === 0);
  await widthErr(); await page.waitForTimeout(6600);
  check("m1: сама скрывается через 6 с", (await ban.count()) === 0);
  check("m10: текстуры декоров без 404", !tex404.length, tex404.slice(0, 4).join(" | "));
  console.log("ошибки страницы: " + (errors.length ? errors.join("; ") : "нет"));
  const bad = results.filter((r) => !r[1]);
  console.log(`ИТОГ: ${results.length - bad.length}/${results.length}`);
  if (bad.length) process.exitCode = 1;
} finally { await browser.close(); }
