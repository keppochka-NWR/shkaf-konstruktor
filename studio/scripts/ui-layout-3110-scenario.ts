// Раскладка экрана (Макс 31.10.2026, критик claude/ui-layout): мышью на разных ширинах окна. npx tsx scripts/ui-layout-3110-scenario.ts <url /?fresh=1> <outDir>
//  1. Шапка не перекрывает этапы: щелчок по центру каждой кнопки этапов/шапки попадает в неё; страница без горизонтальной прокрутки.
//  2. Полоса сцены: все кнопки внутри полосы — 1024…1920 и при колонках, растянутых мышью (в т. ч. запомненных на меньшем окне); сцене ≥ 480.
//  3. Двойной щелчок по разделителю сбрасывает только свою колонку.
//  4. «Открыть фасады» работает без выбранного корпуса; R и Esc видны на 1366.
//  5. Колонки приглушены только пока тянут корпус; линия Q и потеря фокуса окна не оставляют их приглушёнными.
//  6. Клавиши видов в пустой комнате; свёрнутая колонка показывает все корпуса.
import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";
import { initialModule, section, id, type Module } from "../src/model";
import { newProject, type Project } from "../src/project";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errors: string[] = [];
const results: boolean[] = [];
const check = (name: string, ok: boolean, info = "") => { results.push(ok); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const WIDTHS = "yo-constructor-panel-widths-v1";
const wardrobe = (name: string, x: number): Project["modules"][number] => { const m: Module = { ...initialModule(), name, width: 600, height: 2000, depth: 550, doors: true, sections: [section()] }; return { id: id(), x, y: 0, z: 3, rotation: 0, module: m }; };
const project = (n = 1): Project => { const p = newProject({ ...initialModule(), sections: [section()] }); p.room = { ...p.room, width: 12000, depth: 3000, height: 2700 }; p.modules = Array.from({ length: n }, (_, i) => wardrobe("Шкаф " + (i + 1), 100 + i * 650)); return p; };

async function open(w: number, h: number, stage: string, opts: { p?: Project; widths?: { left: number; right: number } } = {}) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(`${w}: ${e.message}`));
  await page.goto(url, { timeout: 120000, waitUntil: "domcontentloaded" });
  await page.evaluate(([raw, s, key, ws]) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw as string); localStorage.setItem("studio-stage", s as string); localStorage.setItem("studio-tip-rmb", "1"); if (ws) localStorage.setItem(key as string, ws as string); }, [JSON.stringify(opts.p ?? project()), stage, WIDTHS, opts.widths ? JSON.stringify(opts.widths) : ""]);
  await page.goto(url, { timeout: 120000, waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 60000 }); await page.waitForTimeout(1500);
  return page;
}
// строкой: tsx вставляет __name в функции page.evaluate
const probe = `(function(){
  var hit=function(el){var r=el.getBoundingClientRect();if(!r.width)return true;var t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !!t&&(t===el||el.contains(t));};
  var name=function(el){return (el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,28);};
  var vis=function(el){return el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden';};
  var list=function(s){return Array.from(document.querySelectorAll(s)).filter(vis);};
  var bar=document.querySelector('.scene-toolbar').getBoundingClientRect();
  var header=document.querySelector('.header').getBoundingClientRect(),stage=document.querySelector('.stage-bar').getBoundingClientRect();
  return {
    hscroll:document.documentElement.scrollWidth>innerWidth+1,
    headerOver:header.bottom>stage.top+0.5,
    coveredStage:list('.stage-step,.stage-actions button,.stage-advanced').filter(function(e){return !e.disabled&&!hit(e);}).map(name),
    coveredHeader:list('.header button').filter(function(e){return !hit(e);}).map(name),
    offHeader:list('.header button').filter(function(e){var r=e.getBoundingClientRect();return r.right>innerWidth+0.5||r.left<-0.5;}).map(name),
    clipped:list('.scene-toolbar button').filter(function(e){var r=e.getBoundingClientRect();return r.left<bar.left-0.5||r.right>bar.right+0.5;}).map(name),
    toolbarScroll:document.querySelector('.scene-toolbar').scrollWidth-document.querySelector('.scene-toolbar').clientWidth,
    scene:Math.round(document.querySelector('.viewport').getBoundingClientRect().width),
    keys:list('.key-hints kbd').map(function(e){return e.textContent;}).join(' '),
    keysClipped:(function(){var s=document.querySelector('.key-hints');if(!s)return false;return s.scrollWidth>s.clientWidth+1;})(),
    labels:list('.scene-toolbar .mode-label').length
  };})()`;
type Probe = { hscroll: boolean; headerOver: boolean; coveredStage: string[]; coveredHeader: string[]; offHeader: string[]; clipped: string[]; toolbarScroll: number; scene: number; keys: string; keysClipped: boolean; labels: number };
const measure = (page: Page) => page.evaluate(probe) as Promise<Probe>;

// 1–2. Шапка, этапы и полоса сцены на всех ширинах
for (const w of [1024, 1100, 1150, 1200, 1240, 1280, 1366, 1400, 1600, 1920]) {
  for (const stage of ["bodies", "room"]) {
    const page = await open(w, w <= 1100 ? 700 : 768, stage);
    const m = await measure(page), tag = `${w} ${stage === "room" ? "помещение" : "мебель"}`;
    check(`${tag}: шапка над этапами, без прокрутки страницы`, !m.hscroll && !m.headerOver);
    check(`${tag}: этапы и шапка не перекрыты`, !m.coveredStage.length && !m.coveredHeader.length && !m.offHeader.length, [...m.coveredStage, ...m.coveredHeader, ...m.offHeader].join(", "));
    check(`${tag}: все кнопки полосы сцены внутри неё`, !m.clipped.length && m.toolbarScroll <= 0, `сцена ${m.scene}, подписей ${m.labels}, ${m.clipped.join(", ")}`);
    if (stage === "bodies") check(`${tag}: строка клавиш помещается, Q видна`, !m.keysClipped && /\bQ\b/.test(m.keys), m.keys);
    if (w === 1366 && stage === "bodies") check("1366: R и Esc на виду", /\bR\b/.test(m.keys) && /Esc/.test(m.keys), m.keys);
    if (w === 1024) {
      await page.getByRole("button", { name: stage === "room" ? "Построение мебели" : "Помещение", exact: true }).click();
      await page.waitForTimeout(500);
      check(`1024: щелчок по этапу переключает этап (с «${stage}»)`, (await page.locator(".app").getAttribute("data-stage")) === (stage === "room" ? "bodies" : "room"));
    }
    await page.close();
  }
}

// 2. Колонки растянуты: запомненные на меньшем окне и мышью
for (const [w, h] of [[1366, 768], [1100, 700], [1024, 700]] as const) {
  const page = await open(w, h, "bodies", { widths: { left: 460, right: 560 } });
  const m = await measure(page);
  check(`${w}: запомненные 460/560 — сцена ≥ 480, кнопки полосы внутри`, m.scene >= 480 && !m.clipped.length && m.toolbarScroll <= 0, `сцена ${m.scene}: ${m.clipped.join(", ")}`);
  await page.close();
}
{
  const page = await open(1366, 768, "bodies");
  for (const side of ["left", "right"] as const) {
    const b = (await page.locator(".panel-resizer-" + side).boundingBox())!;
    await page.mouse.move(b.x + 5, b.y + 300); await page.mouse.down(); await page.mouse.move(b.x + 5 + (side === "left" ? 300 : -300), b.y + 300, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(300);
  }
  let m = await measure(page);
  check("1366: колонки растянуты мышью — сцена ≥ 480, кнопки полосы внутри", m.scene >= 480 && !m.clipped.length && m.toolbarScroll <= 0, `сцена ${m.scene}: ${m.clipped.join(", ")}`);
  // 3. двойной щелчок — только своя колонка
  const stored0 = await page.evaluate((k) => localStorage.getItem(k), WIDTHS);
  const rightBefore = (await page.locator(".properties").boundingBox())!.width, leftBefore = (await page.locator(".library").boundingBox())!.width;
  const b = (await page.locator(".panel-resizer-left").boundingBox())!;
  await page.mouse.dblclick(b.x + 5, b.y + 300); await page.waitForTimeout(400);
  const rightAfter = (await page.locator(".properties").boundingBox())!.width, leftAfter = (await page.locator(".library").boundingBox())!.width;
  check("двойной щелчок по левому разделителю: левая по экрану, правая на месте", leftAfter < leftBefore && Math.abs(rightAfter - rightBefore) < 1, `левая ${leftBefore} → ${leftAfter}, правая ${rightBefore} → ${rightAfter}`);
  const stored1 = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), WIDTHS)) || "{}");
  check("запомнена только правая", stored1.left === null && Number.isFinite(stored1.right), `${stored0} → ${JSON.stringify(stored1)}`);
  m = await measure(page);
  await page.close();
}

// 4. «Открыть фасады» без выбранного корпуса; 5. приглушение колонок
{
  const page = await open(1366, 768, "bodies", { p: project(2) });
  const opacity = () => page.evaluate(`getComputedStyle(document.querySelector('.library')).opacity`) as Promise<string>;
  const flag = () => page.evaluate(`document.documentElement.dataset.sceneDrag||''`) as Promise<string>;
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  const doorBtn = page.getByRole("button", { name: "Открыть фасады", exact: true });
  check("«Открыть фасады» доступна без выбранного корпуса", await doorBtn.isEnabled());
  const before = await doorBtn.getAttribute("aria-pressed");
  await doorBtn.click(); await page.waitForTimeout(300);
  check("«Открыть фасады» без выбранного корпуса переключает", (await doorBtn.getAttribute("aria-pressed")) !== before);
  await page.locator(".module-item").first().click(); await page.waitForTimeout(400);
  // перенос корпуса: приглушено, пока кнопка нажата и видна плашка; после отпускания — снято
  await page.getByRole("button", { name: "Спереди", exact: true }).first().click(); await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Двигать корпуса", exact: true }).click(); await page.waitForTimeout(200);
  const corner = page.locator(".corner-handle").first();
  const c = await corner.boundingBox();
  if (c) {
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2); await page.mouse.down(); await page.mouse.move(c.x + 40, c.y + 30, { steps: 5 }); await page.waitForTimeout(350);
    const during = await flag(), dim = await opacity();
    check("тяга за угол: колонки приглушены", during === "1" && Number(dim) < 0.9, `флаг «${during}», прозрачность ${dim}`);
    // окно потеряло фокус посреди тяги — приглушение снято
    await page.evaluate(`window.dispatchEvent(new Event('blur'))`); await page.waitForTimeout(300);
    check("потеря фокуса посреди тяги: колонки снова яркие", (await flag()) === "" && Number(await opacity()) > 0.95, await opacity());
    await page.keyboard.press("Escape"); await page.mouse.up(); await page.waitForTimeout(300);
    await page.keyboard.press("Control+z").catch(() => {}); await page.waitForTimeout(300);
  } else check("тяга за угол: ручка найдена", false);
  // линия Q: плашка видна, кнопка не нажата — колонки яркие
  await page.mouse.move(700, 400); await page.keyboard.press("q"); await page.waitForTimeout(300); await page.mouse.move(720, 420, { steps: 3 }); await page.waitForTimeout(300);
  check("инструмент Q: колонки не приглушены", (await flag()) === "" && Number(await opacity()) > 0.95, await opacity());
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  await page.close();
}

// 6. свёрнутая колонка: все корпуса, последний достижим
{
  const page = await open(1366, 768, "bodies", { p: project(17) });
  await page.getByTestId("left-collapse").click(); await page.waitForTimeout(500);
  const rail = page.locator(".library-rail button[aria-label^='Корпус ']");
  check("полоса значков: все 17 корпусов", (await rail.count()) === 17, String(await rail.count()));
  const last = rail.last(); await last.scrollIntoViewIfNeeded(); await last.click(); await page.waitForTimeout(400);
  check("полоса значков: последний корпус выбирается", (await last.getAttribute("aria-pressed")) === "true");
  await page.screenshot({ path: `${out}/rail-17.png` });
  await page.close();
}

// 6. пустая комната: клавиши видов
{
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.on("pageerror", (e) => errors.push("empty: " + e.message));
  await page.goto(url, { timeout: 120000, waitUntil: "domcontentloaded" });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("studio-tip-rmb", "1"); });
  await page.goto(url + (url.includes("?") ? "&" : "?") + "fresh=1", { timeout: 120000, waitUntil: "domcontentloaded" }); await page.waitForSelector(".empty-room-app canvas", { timeout: 60000 }); await page.waitForTimeout(1500);
  const pressed = async () => (await page.locator('.view-tabs button[aria-pressed="true"]').first().getAttribute("aria-label")) ?? "";
  await page.mouse.move(700, 400);
  await page.keyboard.press("w"); await page.waitForTimeout(400);
  check("пустая комната: W — «Сверху»", (await pressed()) === "Сверху", await pressed());
  await page.keyboard.press("p"); await page.waitForTimeout(500);
  check("пустая комната: P — «План»", (await pressed()) === "План" && (await page.locator(".room-plan").count()) === 1, await pressed());
  await page.keyboard.press("e"); await page.waitForTimeout(500);
  check("пустая комната: E — «3D»", (await pressed()) === "3D", await pressed());
  await page.close();
}

check("без ошибок страницы", !errors.length, errors.slice(0, 3).join(" | "));
await browser.close();
const fails = results.filter((r) => !r).length;
console.log(fails ? `ИТОГ: провалов ${fails} из ${results.length}` : `ИТОГ: ${results.length}/${results.length}`);
process.exit(fails ? 1 : 0);
