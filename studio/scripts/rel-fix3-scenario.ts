// Критик целостности интерфейса, релиз 22.10 (ветка claude/rel-fix3): сценарий мышью на публичной сборке.
// npx tsx scripts/rel-fix3-scenario.ts <base-url, напр. http://127.0.0.1:8137> <outDir> <tag: before|after>
// На 4 разрешениях: B2 палитра (открытая/закрытая «Стоимость»), m5/m6 шрифты, m4 значок подвала, m1/m2/m3 круговое меню фасада,
// u2 меню плашки зазора, m9 калькулятор купе; на 1366 — B1 «Угловой шкаф» → «Кухня прямая 3000», m7 окно объекта комнаты.
// Подготовка (очистка localStorage, этап) — до первого действия; дальше только мышь и клавиатура, проверки читают DOM.
import { chromium, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const [base, out, tag] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const VIEWS = [{ w: 1280, h: 720, s: 1 }, { w: 1366, h: 768, s: 1 }, { w: 1536, h: 864, s: 1.25 }, { w: 1920, h: 1080, s: 1 }];
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
type R = { left: number; top: number; right: number; bottom: number };
const inter = (a: R, b: R) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) > 0 ? Math.min(Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top), Math.min(a.right, b.right) - Math.max(a.left, b.left)) : 0;

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
async function open(v: typeof VIEWS[number]) {
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: v.s });
  const page = await ctx.newPage();
  await page.addInitScript("window.__name=(f)=>f"); // tsx оборачивает функции в __name — в странице его нет
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, errors };
}
const name = (v: typeof VIEWS[number]) => `${v.w}x${v.h}${v.s !== 1 ? "@" + v.s : ""}`;
async function fresh(page: Page) {
  await page.goto(base + "/studio/?fresh=1");
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); });
  await page.goto(base + "/studio/?fresh=1"); await page.waitForSelector("canvas", { timeout: 30000 }); await page.waitForTimeout(2500);
  for (const t of ["Понятно", "Закрыть подсказку"]) await page.getByRole("button", { name: t }).first().click({ timeout: 800 }).catch(() => {});
}
const dock = (page: Page, label: string) => page.locator(".project-dock button, .dock-tabs button, footer button").filter({ hasText: new RegExp("^\\s*" + label) }).first();

async function palette(page: Page, v: string, state: string) {
  const r = await page.evaluate(() => {
    const q = (s: string) => document.querySelector(s)?.getBoundingClientRect().toJSON() as { left: number; top: number; right: number; bottom: number } | undefined;
    const btn = q(".module-palette > button.primary.full"), fields = [...document.querySelectorAll(".module-palette input, .module-palette select")].map((e) => ({ l: e.getAttribute("aria-label"), r: e.getBoundingClientRect().toJSON() }));
    const b = document.querySelector<HTMLElement>(".module-palette > button.primary.full"), s = document.querySelector<HTMLElement>('select[aria-label="Дверей у новой мебели"]');
    return { btn, fields, btnFont: b ? getComputedStyle(b).fontSize : "", selFont: s ? getComputedStyle(s).fontFamily + " " + getComputedStyle(s).fontSize : "", inputFont: getComputedStyle(document.querySelector(".module-palette input")!).fontFamily };
  });
  const worst = r.btn ? Math.max(0, ...r.fields.map((f) => inter(r.btn!, f.r))) : -1;
  check(`B2 ${v} ${state}: «Добавить в комнату» не перекрывает поля палитры`, worst === 0, `наложение ${worst.toFixed(1)} px`);
  check(`m6 ${v}: размер шрифта главной кнопки палитры 13–14 px`, ["13px", "14px"].includes(r.btnFont), r.btnFont);
  check(`m5 ${v}: select «Дверей» — шрифт как у полей`, r.selFont.includes("Golos") && r.inputFont.includes("Golos"), r.selFont);
}

for (const view of VIEWS) {
  const v = name(view), { ctx, page, errors } = await open(view);
  try {
    await fresh(page);
    // первый шкаф из палитры (пустой 600 × 2000, 1 дверь) — дальше нижняя панель со «Стоимостью»
    await page.locator(".module-palette > button.primary.full").click(); await page.waitForTimeout(2500);
    for (const t of ["Понятно", "Закрыть подсказку"]) await page.getByRole("button", { name: t }).first().click({ timeout: 500 }).catch(() => {});
    await palette(page, v, "панель закрыта");
    const pal = page.locator(".module-palette").first();
    await pal.screenshot({ path: `${out}/${tag}-${v}-B2-palette-closed.png` }).catch(() => {});
    await dock(page, "Стоимость").click().catch(() => {});
    await page.waitForTimeout(1200);
    await palette(page, v, "«Стоимость» открыта");
    await page.screenshot({ path: `${out}/${tag}-${v}-B2-cost-open.png` });
    // прокрутка левой панели: кнопку видно, если долистать
    const lib = page.locator("aside.library").first();
    const need = await page.evaluate(() => { const b = document.querySelector(".module-palette > button.primary.full")!.getBoundingClientRect(), l = document.querySelector("aside.library")!.getBoundingClientRect(); return Math.max(0, Math.ceil(b.bottom - l.bottom + 12)); });
    await lib.hover(); if (need) await page.mouse.wheel(0, need); await page.waitForTimeout(500);
    const vis = await page.evaluate(() => { const b = document.querySelector(".module-palette > button.primary.full")!.getBoundingClientRect(), l = document.querySelector("aside.library")!.getBoundingClientRect(); return b.top >= l.top - 1 && b.bottom <= l.bottom + 1; });
    check(`B2 ${v}: после прокрутки левой панели «Добавить в комнату» видна целиком`, vis);
    await pal.screenshot({ path: `${out}/${tag}-${v}-B2-palette-cost-scrolled.png` }).catch(() => {});
    await dock(page, "Стоимость").click().catch(() => {}); await page.waitForTimeout(600);
    // m4: значок подвала свойств не сжимается
    const foot = await page.evaluate(() => [...document.querySelectorAll(".property-footer > svg")].map((s) => { const r = s.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), getComputedStyle(s).flexShrink]; }));
    check(`m4 ${v}: значок подвала свойств не сжимается (flex-shrink 0)`, foot.every((f) => f[2] === "0"), JSON.stringify(foot));
    // m1/m2/m3: ПКМ по фасаду → кольцо фасада
    await page.getByRole("button", { name: "Спереди", exact: true }).click().catch(() => {}); await page.waitForTimeout(800);
    const cv = (await page.locator("canvas").first().boundingBox())!;
    const pts = [[0.5, 0.42], [0.5, 0.3], [0.45, 0.5], [0.55, 0.35]];
    let ring = 0;
    for (const [fx, fy] of pts) {
      await page.mouse.click(cv.x + cv.width * fx, cv.y + cv.height * fy, { button: "right" }); await page.waitForTimeout(600);
      ring = await page.locator(".radial-item").count();
      if (ring >= 9) break;
      await page.keyboard.press("Escape"); await page.waitForTimeout(200);
    }
    const m = await page.evaluate(() => {
      const labels = [...document.querySelectorAll(".radial-label")].map((e) => ({ t: e.textContent, r: e.getBoundingClientRect().toJSON() }));
      const items = [...document.querySelectorAll(".radial-item")].map((e) => e.getBoundingClientRect().toJSON());
      const bars = [".interaction-bar", ".view-header"].map((s) => document.querySelector(s)?.getBoundingClientRect().toJSON()).filter(Boolean);
      // m2: что под центром подписи — сама подпись/меню, а не ручка или плашка размера
      // подпись с pointer-events:none — по ней elementFromPoint не попадает; проверяем, что под подписью ручки и плашки не ловят мышь,
      // а слой меню (портал в body, z-index) выше слоя сцены
      const grabbers = [...document.querySelectorAll(".stretch-handle, .model-dimension")].filter((e) => getComputedStyle(e).pointerEvents !== "none");
      const covered = labels.filter((l) => grabbers.some((g) => { const r = g.getBoundingClientRect(); return r.left < l.r.right && l.r.left < r.right && r.top < l.r.bottom && l.r.top < r.bottom; })).map((l) => l.t);
      const z = Number(getComputedStyle(document.querySelector(".radial-menu")!).zIndex) || 0;
      const portal = document.querySelector(".radial-menu")?.parentElement === document.body;
      return { labels, items, bars, covered, portal: portal && z >= 60 };
    });
    let ll = 0, lb = 0, worstLL = 0;
    for (let i = 0; i < m.labels.length; i++) for (let j = 0; j < m.labels.length; j++) {
      if (j > i) { const o = inter(m.labels[i].r, m.labels[j].r); if (o > 0) { ll++; worstLL = Math.max(worstLL, o); } }
      if (i !== j && inter(m.labels[i].r, m.items[j]) > 0) lb++;
    }
    const underBar = m.labels.filter((l) => m.bars.some((b) => inter(l.r, b!) > 0)).map((l) => l.t);
    check(`m3 ${v}: кольцо (${ring} пунктов) — подписи не наезжают друг на друга и на кнопки`, ring > 0 && ll === 0 && lb === 0, `подпись/подпись ${ll} (до ${worstLL.toFixed(0)} px), подпись/кнопка ${lb}`);
    check(`m1 ${v}: подписи меню не под верхней панелью`, ring > 0 && underBar.length === 0, underBar.join(", "));
    check(`m2 ${v}: подписи меню не перекрыты ручками/плашками (меню в body)`, ring > 0 && m.covered.length === 0 && m.portal, m.covered.join(", "));
    await page.screenshot({ path: `${out}/${tag}-${v}-m3-facade-ring.png` });
    await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    // u2: плашка зазора → два явных пункта
    await page.getByRole("button", { name: "3D", exact: true }).click().catch(() => {}); await page.waitForTimeout(600);
    if (await page.locator(".dock-panel").count()) { await dock(page, "Проект").click().catch(() => {}); await page.waitForTimeout(600); } // нижняя панель закрыта — плашки зазоров не под ней
    await page.locator(".module-item").first().click().catch(() => {}); await page.waitForTimeout(800);
    const gap =page.locator("button.model-dimension.row-gap").first();
    if (await gap.count()) {
      await gap.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(400);
      const items = await page.locator(".gap-menu [role=menuitem]").allTextContents();
      check(`u2 ${v}: меню плашки зазора — «сдвинуть модуль» и «изменить ширину»`, items.some((t) => t.includes("сдвинуть модуль")) && items.some((t) => t.includes("изменить ширину")), items.join(" | "));
      await page.screenshot({ path: `${out}/${tag}-${v}-u2-gap-menu.png` });
      await page.keyboard.press("Escape");
    } else check(`u2 ${v}: плашка зазора на экране`, false, "нет button.model-dimension.row-gap");

    if (view.w === 1366) {
      // B1: «Угловой шкаф» → «Добавить в комнату» → «Кухонные модули» → «Кухня прямая» 3000 → «Добавить в комнату»
      await fresh(page);
      await page.locator(".module-kinds button").filter({ hasText: "Угловой шкаф" }).click();
      await page.locator(".module-palette > button.primary.full").click(); await page.waitForTimeout(1500);
      await page.getByRole("tab", { name: "Кухонные модули" }).click();
      await page.locator(".module-kinds button").filter({ hasText: "Кухня прямая" }).click();
      const w = await page.locator('input[aria-label="Ширина новой мебели"]').inputValue();
      await page.locator(".module-palette > button.primary.full").scrollIntoViewIfNeeded();
      await page.locator(".module-palette > button.primary.full").click(); await page.waitForTimeout(3000);
      const root = await page.evaluate(() => document.getElementById("root")?.innerHTML.length ?? 0);
      const boundary = await page.locator("[data-testid=safe-boundary]").count();
      check(`B1 ${v}: угловой + кухня прямая ${w} — студия на экране, без ошибок страницы`, root > 1000 && errors.length === 0 && boundary === 0, `root ${root}, pageerror: ${errors.join(" / ") || "нет"}, границ с ошибкой ${boundary}`);
      await page.screenshot({ path: `${out}/${tag}-${v}-B1-corner-kitchen.png` });
      if (root > 1000) {
        await dock(page, "Стоимость").click().catch(() => {}); await page.waitForTimeout(2500);
        const total = await page.locator(".dock-sum.total b").first().textContent().catch(() => "");
        check(`B1 ${v}: смета посчитана`, !!total && /₽/.test(total), total ?? "");
        await page.screenshot({ path: `${out}/${tag}-${v}-B1-cost.png` });
      }
      // m7: окно объекта комнаты
      await fresh(page);
      await page.getByRole("button", { name: /Помещение/ }).first().click().catch(() => {}); await page.waitForTimeout(1200);
      const addWin = page.getByRole("button", { name: /^(Добавить )?окно$/i }).first();
      if (await addWin.count()) { await addWin.click().catch(() => {}); await page.waitForTimeout(1000); }
      let env = await page.locator("aside.environment-properties").count();
      if (!env) { const t = page.getByRole("button", { name: /Свойства выбранного объекта|Окно/ }).first(); await t.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(800); env = await page.locator("aside.environment-properties").count(); }
      if (env) {
        const ov = await page.evaluate(() => { const a = document.querySelector("aside.environment-properties")!.getBoundingClientRect(), p = document.querySelector("aside.properties")?.getBoundingClientRect(); return p ? Math.max(0, Math.min(a.right, p.right) - Math.max(a.left, p.left)) : -1; });
        check(`m7 ${v}: окно объекта не закрывает правую панель «Замер помещения»`, ov === 0, `наложение по ширине ${ov} px`);
        await page.screenshot({ path: `${out}/${tag}-${v}-m7-env-props.png` });
        await page.keyboard.press("Escape"); await page.waitForTimeout(400);
        check(`m7 ${v}: Esc закрывает окно объекта`, (await page.locator("aside.environment-properties").count()) === 0);
      } else check(`m7 ${v}: окно объекта открыто мышью`, false, "не нашёл, как открыть");
    }
    // m9: калькулятор купе
    await page.goto(base + "/calc/"); await page.waitForTimeout(2500);
    const c = await page.evaluate(async () => {
      await document.fonts.ready;
      const el = document.scrollingElement!, body = getComputedStyle(document.body).fontFamily;
      const ru = [...document.querySelectorAll("body *")].find((e) => e.children.length === 0 && /[А-Яа-я]/.test(e.textContent ?? "") && (e as HTMLElement).offsetParent);
      return { extra: el.scrollHeight - innerHeight, body, ruFont: ru ? getComputedStyle(ru).fontFamily : "", golos: document.fonts.check('14px "Golos Text"', "Ж") };
    });
    check(`m9 ${v}: калькулятор — кириллический шрифт Golos Text`, c.body.includes("Golos") && c.golos, `${c.body}; загружен ${c.golos}`);
    check(`m9 ${v}: калькулятор без лишней прокрутки`, c.extra <= 0, `лишние ${c.extra} px`);
    await page.screenshot({ path: `${out}/${tag}-${v}-m9-calc.png` });
  } catch (e) { check(`${v}: сценарий`, false, (e as Error).message.split("\n")[0]); await page.screenshot({ path: `${out}/${tag}-${v}-ERR.png` }).catch(() => {}); }
  check(`${v}: ошибок страницы нет`, errors.length === 0, errors.slice(0, 3).join(" / "));
  await ctx.close();
}
await browser.close();
writeFileSync(`${out}/${tag}-results.json`, JSON.stringify(results, null, 1));
const fail = results.filter((r) => !r[1]).length;
console.log(`\nИТОГ ${tag}: ${results.length - fail}/${results.length} OK`);
