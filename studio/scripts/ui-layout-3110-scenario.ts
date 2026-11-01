// Раскладка экрана (Макс 31.10.2026, критик claude/ui-layout): мышью на разных ширинах окна. npx tsx scripts/ui-layout-3110-scenario.ts <url /?fresh=1> <outDir>
//  1. Шапка не перекрывает этапы: щелчок по центру каждой кнопки этапов/шапки попадает в неё; страница без горизонтальной прокрутки.
//  2. Полоса сцены: все кнопки внутри полосы — 1024…1920 и при колонках, растянутых мышью (в т. ч. запомненных на меньшем окне); сцене ≥ 480.
//  3. Двойной щелчок по разделителю сбрасывает только свою колонку.
//  4. «Открыть фасады» работает без выбранного корпуса; R и Esc видны на 1366.
//  5. Колонки приглушены только пока тянут корпус; линия Q и потеря фокуса окна не оставляют их приглушёнными.
//  6. Клавиши видов в пустой комнате; свёрнутая колонка показывает все корпуса.
//  7. Макс 01.11, «иконки непонятные, вернём текст»: у каждой кнопки полосы виден текст, значков в полосе нет; у каждой кнопки колонки — подпись; колонка не уходит на строку клавиш.
//  8. Макс 01.11, общий стиль: плашка детали и полоса подсветки — белые, в сцене, не на строке клавиш, текст кнопок в одну строку, одна синяя кнопка.
//  9. Макс 01.11, «параметры ящика открывают параметры секции»: мышью выбрать ящик в сцене → «Параметры» → видны и подсвечены поля этого ящика; то же у полки, штанги и двери.
// 10. Критик 01.11: плашка в одну строку (узко — «Ещё ▾», без подзаголовка); сообщение не закрывает её при любой высоте; на низком окне у колонки стрелка; вставка купе из колеса — свой редактор.
import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";
import { initialModule, section, id, type Module } from "../src/model";
import { newProject, type Project } from "../src/project";
import { createKupeModule } from "../src/paletteBuild";

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
  await page.waitForSelector("canvas", { timeout: 60000 }); await page.waitForTimeout(500); // иначе приложение успеет перезаписать этап после evaluate
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
    clipped:list('.scene-toolbar button').filter(function(e){var r=e.getBoundingClientRect();return r.left<bar.left-0.5||r.right>bar.right+0.5||r.top<bar.top-0.5||r.bottom>bar.bottom+0.5;}).map(name),
    noText:list('.scene-toolbar button').filter(function(e){return !e.innerText.trim()||e.scrollWidth>e.clientWidth+1||e.querySelector('svg')||getComputedStyle(e).fontSize==='0px';}).map(name),
    toolbarButtons:list('.scene-toolbar button').length,
    sceneUnderBar:(function(){var s=document.querySelector('.scene');return !s||Math.abs(s.getBoundingClientRect().top-bar.bottom)<=1.5;})(),
    noCap:list('.scene-tools button').filter(function(e){var c=e.querySelector('.tool-cap');return !c||!c.innerText.trim()||c.scrollWidth>c.clientWidth+1||!e.querySelector('svg');}).map(name),
    toolsScroll:(function(){var t=document.querySelector('.scene-tools');return t?t.scrollHeight-t.clientHeight:0;})(),
    toolsW:(function(){var t=document.querySelector('.scene-tools');return t?Math.round(t.getBoundingClientRect().width):0;})(),
    toolsOverKeys:(function(){var t=document.querySelector('.scene-tools'),k=document.querySelector('.key-hints');return !!t&&!!k&&t.getBoundingClientRect().bottom>k.getBoundingClientRect().top+0.5;})(),
    toolbarScroll:document.querySelector('.scene-toolbar').scrollWidth-document.querySelector('.scene-toolbar').clientWidth,
    scene:Math.round(document.querySelector('.viewport').getBoundingClientRect().width),
    keys:list('.key-hints kbd').map(function(e){return e.textContent;}).join(' '),
    keysClipped:(function(){var s=document.querySelector('.key-hints');if(!s)return false;return s.scrollWidth>s.clientWidth+1;})(),
    labels:list('.scene-toolbar .mode-label').length
  };})()`;
type Probe = { hscroll: boolean; headerOver: boolean; coveredStage: string[]; coveredHeader: string[]; offHeader: string[]; clipped: string[]; noText: string[]; toolbarButtons: number; sceneUnderBar: boolean; noCap: string[]; toolsScroll: number; toolsW: number; toolsOverKeys: boolean; toolbarScroll: number; scene: number; keys: string; keysClipped: boolean; labels: number };
const measure = (page: Page) => page.evaluate(probe) as Promise<Probe>;

// 1–2. Шапка, этапы и полоса сцены на всех ширинах
for (const w of [1024, 1100, 1150, 1200, 1240, 1280, 1366, 1400, 1600, 1920]) {
  for (const stage of ["bodies", "room"]) {
    const page = await open(w, w <= 1100 ? 700 : 768, stage);
    const m = await measure(page), tag = `${w} ${stage === "room" ? "помещение" : "мебель"}`;
    check(`${tag}: шапка над этапами, без прокрутки страницы`, !m.hscroll && !m.headerOver);
    check(`${tag}: этапы и шапка не перекрыты`, !m.coveredStage.length && !m.coveredHeader.length && !m.offHeader.length, [...m.coveredStage, ...m.coveredHeader, ...m.offHeader].join(", "));
    check(`${tag}: все кнопки полосы сцены внутри неё`, !m.clipped.length && m.toolbarScroll <= 0, `сцена ${m.scene}, подписей ${m.labels}, ${m.clipped.join(", ")}`);
    check(`${tag}: у каждой кнопки полосы виден текст, значков нет; сцена под полосой`, !m.noText.length && m.toolbarButtons >= 6 && m.sceneUnderBar, `кнопок ${m.toolbarButtons}: ${m.noText.join(", ")}`);
    check(`${tag}: у каждой кнопки колонки значок и подпись, колонка 64–72 px, влезает`, !m.noCap.length && m.toolsW >= 64 && m.toolsW <= 72 && m.toolsScroll <= 0 && !m.toolsOverKeys, `ширина ${m.toolsW}, прокрутка ${m.toolsScroll}: ${m.noCap.join(", ")}`);
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
  check(`${w}: запомненные 460/560 — сцена ≥ 480, кнопки полосы внутри и с текстом`, m.scene >= 480 && !m.clipped.length && m.toolbarScroll <= 0 && !m.noText.length && m.sceneUnderBar, `сцена ${m.scene}: ${[...m.clipped, ...m.noText].join(", ")}`);
  await page.close();
}
{
  const page = await open(1366, 768, "bodies");
  for (const side of ["left", "right"] as const) {
    const b = (await page.locator(".panel-resizer-" + side).boundingBox())!;
    await page.mouse.move(b.x + 5, b.y + 300); await page.mouse.down(); await page.mouse.move(b.x + 5 + (side === "left" ? 300 : -300), b.y + 300, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(300);
  }
  let m = await measure(page);
  check("1366: колонки растянуты мышью — сцена ≥ 480, кнопки полосы внутри и с текстом", m.scene >= 480 && !m.clipped.length && m.toolbarScroll <= 0 && !m.noText.length && m.sceneUnderBar, `сцена ${m.scene}: ${[...m.clipped, ...m.noText].join(", ")}`);
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

// 7–9. Плашки в общем стиле и «Параметры» детали: ящик слева, полки и штанга справа, двери
const filled = (): Project => { const p = project(); const s = section(); s.drawers = 3; s.drawerConfigs = undefined; const s2 = section(); s2.shelves = [0.3, 0.6]; s2.rod = true; const m: Module = { ...initialModule(), name: "Шкаф", width: 1200, height: 2000, depth: 550, doors: true, sections: [s, s2] }; p.modules = [{ id: id(), x: 100, y: 0, z: 3, rotation: 0, module: m }]; return p; };
const barCheck = `(function(){var bar=document.querySelector('.selection-action-bar'),keys=document.querySelector('.key-hints'),vp=document.querySelector('.viewport');if(!bar)return null;var r=bar.getBoundingClientRect(),v=vp.getBoundingClientRect();var btns=Array.from(bar.querySelectorAll(':scope > button, :scope > .sb-more > button')).filter(function(b){return b.getClientRects().length>0;});var sub=bar.querySelector('.selection-context span');
  return {rows:new Set(btns.map(function(b){return Math.round(b.getBoundingClientRect().top);})).size,barH:Math.round(r.height),subtitle:!!sub&&sub.getClientRects().length>0,more:btns.some(function(b){return b.innerText.indexOf('Ещё')===0;}),bg:getComputedStyle(bar).backgroundColor,overKeys:r.bottom>keys.getBoundingClientRect().top+0.5,inScene:r.left>=v.left-0.5&&r.right<=v.right+0.5&&r.top>=v.top-0.5,tall:btns.filter(function(b){return b.getBoundingClientRect().height>36;}).map(function(b){return b.innerText;}),primary:btns.filter(function(b){return getComputedStyle(b).backgroundColor==='rgb(50, 91, 238)';}).map(function(b){return b.innerText;}),danger:btns.filter(function(b){return getComputedStyle(b).color==='rgb(180, 35, 24)';}).map(function(b){return b.innerText;})};})()`;
type BarInfo = { rows: number; barH: number; subtitle: boolean; more: boolean; bg: string; overKeys: boolean; inScene: boolean; tall: string[]; primary: string[]; danger: string[] } | null;
const lit = (page: Page, sel: string) => page.evaluate(`(function(){var el=document.querySelector(${JSON.stringify(sel)});if(!el)return {ok:false,why:'нет блока'};var p=document.querySelector('.properties').getBoundingClientRect(),r=el.getBoundingClientRect();var inner=!!el.closest('details[data-setting]');return {ok:el.classList.contains('ui-highlight')&&el.offsetParent!==null&&r.top>=p.top-1&&r.top<p.bottom-40&&inner,why:(el.classList.contains('ui-highlight')?'':'без подсветки ')+Math.round(r.top)+'/'+Math.round(p.top)+'-'+Math.round(p.bottom),setting:(el.closest('details[data-setting]')||{dataset:{}}).dataset.setting,text:el.innerText.replace(/\\s+/g,' ').slice(0,3000),others:document.querySelectorAll('details[data-setting="Секция"] .ui-highlight,details[data-setting="Секция"].ui-highlight').length};})()`) as Promise<{ ok: boolean; why: string; setting?: string; text?: string; others?: number }>;
for (const [w, h] of [[1920, 1080], [1366, 768], [1024, 700]] as const) {
  const page = await open(w, h, "bodies", { p: filled() });
  await page.getByRole("button", { name: "Спереди", exact: true }).click(); await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Скрыть фасады", exact: true }).click(); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Выбрать", exact: true }).click(); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click(); await page.waitForTimeout(1200);
  // мышью по сцене: щелчками по нижней части корпуса, пока не выбран ящик (модель на разных ширинах стоит по-разному)
  const box = (await page.locator(".scene canvas").first().boundingBox())!;
  const part = async () => (await page.locator(".selection-context strong").first().innerText({ timeout: 200 }).catch(() => "")).trim();
  const pick = async (re: RegExp, xs: number[], ys: number[]) => { for (const dy of ys) for (const dx of xs) { const p = { x: box.x + box.width * dx, y: box.y + box.height * dy }; if (!(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName === "CANVAS", [p.x, p.y]))) continue; await page.mouse.click(p.x, p.y, { delay: 60 }); await page.waitForTimeout(250); if (re.test(await part())) return await part(); } return ""; };
  const picked = await pick(/^Ящик \d/, [0.46, 0.42, 0.5, 0.38, 0.54], [0.72, 0.68, 0.76, 0.64, 0.8, 0.6, 0.84]);
  check(`${w}: щелчком в сцене выбран ящик`, !!picked, picked);
  const params = async () => { await page.getByTestId("selection-params").click(); await page.waitForTimeout(650); };
  if (picked) {
    const b = (await page.evaluate(barCheck)) as BarInfo;
    check(`${w}: плашка детали белая, в сцене, не на строке клавиш, текст кнопок в одну строку`, !!b && b.bg === "rgb(255, 255, 255)" && !b.overKeys && b.inScene && !b.tall.length, JSON.stringify(b));
    check(`${w}: плашка в одну строку, не выше 44 px; подзаголовок и «Ещё ▾» — только где сцена уже 1040`, !!b && b.rows === 1 && b.barH <= 44 && b.subtitle === (w === 1920) && b.more === (w !== 1920), JSON.stringify(b && [b.rows, b.barH, b.subtitle, b.more]));
    check(`${w}: одна синяя кнопка «Параметры»`, !!b && b.primary.join() === "Параметры", JSON.stringify(b && [b.primary, b.danger]));
    if (w === 1920) check("1920: «Удалить ящик» на плашке красная", !!b && b.danger.join() === "Удалить ящик", JSON.stringify(b && b.danger));
    if (b?.more) {
      await page.getByRole("button", { name: "Ещё ▾", exact: true }).click(); await page.waitForTimeout(200);
      const menu = page.locator(".sb-menu"), items = (await menu.getByRole("button").allInnerTexts()).map((x) => x.trim()), red = await menu.locator("button.danger").evaluateAll((l) => l.filter((e) => e.getClientRects().length).map((e) => getComputedStyle(e).color));
      const need = w === 1024 ? ["↓ 10 мм", "Копировать", "Удалить ящик", "Снять фасад"] : ["Копировать", "Ручка этого фасада"];
      check(`${w}: «Ещё ▾» — второстепенное текстом` + (w === 1024 ? ", «Удалить ящик» красная" : ""), need.every((x) => items.includes(x)) && (w !== 1024 || red.join() === "rgb(180, 35, 24)"), items.join(" | "));
      await page.screenshot({ path: `${out}/bar-more-${w}.png` });
      await page.keyboard.press("Escape"); await page.waitForTimeout(200);
      check(`${w}: Esc закрывает только меню, деталь осталась`, (await menu.count()) === 0 && (await page.locator(".selection-action-bar").count()) === 1);
    }
    await page.screenshot({ path: `${out}/bar-${w}.png` });
    await params();
    const d = await lit(page, '.properties [data-part-params="drawer"]');
    check(`${w}: «Параметры» ящика — поля ${picked} видны и подсвечены, в разделе «Ящики», не в «Секции»`, d.ok && d.setting === "Ящики" && (d.text ?? "").startsWith(picked) && /Высота боковины ящика/.test(d.text ?? "") && /Направляющие/.test(d.text ?? "") && !d.others, `${d.why}; ${d.setting}; ${(d.text ?? "").slice(0, 60)}`);
    await page.screenshot({ path: `${out}/params-drawer-${w}.png` });
    // сообщение об ошибке над плашкой: «Копировать», пока ящики не упрутся в предел
    const copy = async () => { const inl = page.locator('.selection-action-bar > button', { hasText: "Копировать" }); if (await inl.isVisible().catch(() => false)) await inl.click(); else { await page.getByRole("button", { name: "Ещё ▾", exact: true }).click(); await page.locator(".sb-menu button", { hasText: "Копировать" }).click(); } await page.waitForTimeout(250); };
    for (let k = 0; k < 14 && !(await page.locator(".error-banner").isVisible().catch(() => false)); k++) await copy();
    const clash = `(function(){var a=document.querySelector('.error-banner'),b=document.querySelector('.selection-action-bar'),p=document.querySelector('[data-testid=selection-params]');if(!a||!b)return null;var x=a.getBoundingClientRect(),y=b.getBoundingClientRect(),q=p.getBoundingClientRect(),t=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2);return {overlap:Math.round(Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)),hit:t===p,varH:document.querySelector('.viewport').style.getPropertyValue('--selbar-h'),barH:b.offsetHeight};})()`;
    type Clash = { overlap: number; hit: boolean; varH: string; barH: number } | null;
    const c1 = (await page.evaluate(clash)) as Clash;
    check(`${w}: сообщение не закрывает плашку, «Параметры» под мышью`, !!c1 && c1.overlap <= 0 && c1.hit && c1.varH === c1.barH + "px", JSON.stringify(c1));
    await page.screenshot({ path: `${out}/banner-${w}.png` });
    // плашка выросла (перенос, длинное название) — сообщение уходит вместе с её настоящей высотой
    await page.evaluate(`document.querySelector('.selection-action-bar').style.paddingTop='70px'`); await page.waitForTimeout(200);
    const c2 = (await page.evaluate(clash)) as Clash;
    check(`${w}: плашка выше на 70 px — сообщение всё равно над ней`, !!c2 && c2.overlap <= 0 && c2.varH === c2.barH + "px", JSON.stringify(c2));
    await page.evaluate(`document.querySelector('.selection-action-bar').style.paddingTop=''`);
    await page.locator(".error-banner button").first().click().catch(() => {}); await page.waitForTimeout(200);
  }
  if (w === 1366) {
    // полка, штанга, дверь — своим блоком
    const shelf = await pick(/^Полка/, [0.55, 0.57, 0.53], [0.5, 0.48, 0.46, 0.44, 0.42, 0.4, 0.38, 0.36, 0.52, 0.54, 0.56, 0.58, 0.6, 0.62, 0.64, 0.66]);
    check("щелчком в сцене выбрана полка", !!shelf, shelf);
    if (shelf) { await params(); const s = await lit(page, '.properties [data-part-params="shelf"]'); check("«Параметры» полки — её карточка в «Полках» видна и подсвечена", s.ok && s.setting === "Полки" && /Высота выбранной полки/.test(s.text ?? ""), `${shelf}: ${s.why}; ${s.setting}`); }
    const rodPick = page.locator('button[aria-label="Выбрать: Высота штанги от дна"]').first();
    await page.evaluate(`document.querySelector('details[data-setting="Штанги"]').open=true`); await rodPick.scrollIntoViewIfNeeded(); await rodPick.click(); await page.waitForTimeout(400);
    const rodName = await part();
    await params();
    const r = await lit(page, '.properties [data-part-params="rod"]');
    check("«Параметры» штанги — её поля в «Штангах» видны и подсвечены", /Штанга/.test(rodName) && r.ok && r.setting === "Штанги" && /Высота штанги/.test(r.text ?? ""), `${rodName}: ${r.why}; ${r.setting}`);
    await page.getByRole("button", { name: "Показать фасады", exact: true }).click(); await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Выбрать", exact: true }).click(); await page.waitForTimeout(200);
    await page.keyboard.press("Escape"); await page.waitForTimeout(200);
    await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.42, { delay: 60 }); await page.waitForTimeout(400);
    const doorName = await part();
    await params();
    const dr = await lit(page, '.properties [data-part-params="door"]');
    check("«Параметры» двери — её поля в «Фасаде» видны и подсвечены", dr.ok && dr.setting === "Фасад" && /Открывание выбранной двери/.test(dr.text ?? ""), `${doorName}: ${dr.why}; ${dr.setting}`);
    await page.screenshot({ path: `${out}/params-door-${w}.png` });
  }
  // полоса подсветки: ПКМ по корпусу › Подсветка › Режим выбора деталей…
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  await page.locator(".module-item").first().click({ button: "right" }); await page.waitForTimeout(350);
  const radial = (l: string) => page.locator(".radial-item").filter({ has: page.locator(".radial-label", { hasText: new RegExp("^" + l + "( ›)?$") }) }).first();
  await radial("Подсветка").click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(250);
  await radial("Режим выбора деталей…").click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(400);
  const l = await page.evaluate(`(function(){var bar=document.querySelector('.light-mode-bar'),keys=document.querySelector('.key-hints'),vp=document.querySelector('.viewport'),tools=document.querySelector('.scene-tools');if(!bar)return null;var r=bar.getBoundingClientRect(),v=vp.getBoundingClientRect(),t=tools.getBoundingClientRect();var btns=Array.from(bar.querySelectorAll('button'));return {bg:getComputedStyle(bar).backgroundColor,overKeys:r.bottom>keys.getBoundingClientRect().top+0.5,inScene:r.left>=v.left-0.5&&r.right<=v.right+0.5,overTools:r.left<t.right,tall:btns.filter(function(b){return b.getBoundingClientRect().height>36;}).map(function(b){return b.innerText;}),done:getComputedStyle(bar.querySelector('button.primary')).backgroundColor};})()`) as { bg: string; overKeys: boolean; inScene: boolean; overTools: boolean; tall: string[]; done: string } | null;
  check(`${w}: полоса подсветки белая, «Готово» синяя, в сцене, не на колонке и не на клавишах`, !!l && l.bg === "rgb(255, 255, 255)" && l.done === "rgb(50, 91, 238)" && l.inScene && !l.overTools && !l.overKeys && !l.tall.length, JSON.stringify(l));
  await page.screenshot({ path: `${out}/light-bar-${w}.png` });
  await page.close();
}

// 10. Колонка на низком окне: все кнопки на месте, есть стрелка, прокрутка колесом доводит до последней
for (const [w, h] of [[1366, 640], [1280, 600]] as const) {
  const page = await open(w, h, "bodies", { p: filled() });
  const st = () => page.evaluate(`(function(){var t=document.querySelector('.scene-tools'),b=Array.from(t.querySelectorAll('button')),l=b[b.length-1].getBoundingClientRect(),r=t.getBoundingClientRect(),k=document.querySelector('.key-hints').getBoundingClientRect();return {over:t.scrollHeight-t.clientHeight,more:t.dataset.more||'',after:getComputedStyle(t,'::after').content,before:getComputedStyle(t,'::before').content,lastIn:l.bottom<=r.bottom+0.5&&l.top>=r.top,overKeys:r.bottom>k.top+0.5,n:b.length};})()`) as Promise<{ over: number; more: string; after: string; before: string; lastIn: boolean; overKeys: boolean; n: number }>;
  const a = await st();
  check(`${w}×${h}: не влезло — стрелка вниз; влезло — стрелки нет; колонка не на строке клавиш`, !a.overKeys && (a.over > 1 ? a.more === "below" && a.after.includes("▾") : a.more === "" && a.after === "none"), JSON.stringify(a));
  await page.screenshot({ path: `${out}/tools-${w}x${h}-top.png` });
  if (a.over > 1) {
    const tb = (await page.locator(".scene-tools").boundingBox())!; await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2); await page.mouse.wheel(0, 400); await page.waitForTimeout(500);
    const e = await st();
    check(`${w}×${h}: колесом до конца — «Открыть фасады» видна целиком, стрелка только вверх`, e.lastIn && e.more === "above" && e.after === "none" && e.before.includes("▴"), JSON.stringify(e));
    await page.screenshot({ path: `${out}/tools-${w}x${h}-end.png` });
  }
  await page.close();
}
// 10. Купе: правой кнопкой по вставке → «Профиль» — редактор этой секции; щелчок по вставке — он же
{
  const kp = project(); const km = createKupeModule(1800, 2400, initialModule()); kp.modules = [{ id: id(), x: 100, y: 0, z: 3, rotation: 0, module: km }];
  const page = await open(1366, 768, "bodies", { p: kp });
  await page.getByRole("button", { name: "Спереди", exact: true }).click(); await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click(); await page.waitForTimeout(1200);
  const box = (await page.locator(".scene canvas").first().boundingBox())!; let got = false;
  for (let dy = 0.4; dy <= 0.7 && !got; dy += 0.1) for (let dx = 0.35; dx <= 0.65 && !got; dx += 0.1) { await page.mouse.click(box.x + box.width * dx, box.y + box.height * dy, { button: "right" }); await page.waitForTimeout(350); if ((await page.locator(".radial-center b").first().innerText({ timeout: 300 }).catch(() => "")).includes("купе")) got = true; else { await page.keyboard.press("Escape"); await page.waitForTimeout(100); } }
  check("купе: меню правой кнопкой открылось", got);
  if (got) {
    await page.locator(".radial-item").filter({ has: page.locator(".radial-label", { hasText: /^Профиль( ›)?$/ }) }).first().click(); await page.waitForTimeout(600);
    const k = await page.evaluate(`(function(){var e=document.querySelector('.properties [data-part-params="kupe"]'),l=document.querySelector('.properties .ui-highlight'),p=document.querySelector('.properties').getBoundingClientRect(),r=l&&l.getBoundingClientRect();return {editor:!!e,lit:l?l.className:'',text:e?e.innerText.slice(0,40):'',seen:!!r&&r.top>=p.top-1&&r.top<p.bottom-40};})()`) as { editor: boolean; lit: string; text: string; seen: boolean };
    check("купе: «Профиль» со вставки — подсвечен редактор этой секции, виден", k.editor && k.lit.includes("kupe-sect-editor") && k.seen && /Дверь \d/.test(k.text), JSON.stringify(k));
    await page.screenshot({ path: `${out}/kupe-params.png` });
  }
  await page.close();
}

check("без ошибок страницы", !errors.length, errors.slice(0, 3).join(" | "));
await browser.close();
const fails = results.filter((r) => !r).length;
console.log(fails ? `ИТОГ: провалов ${fails} из ${results.length}` : `ИТОГ: ${results.length}/${results.length}`);
process.exit(fails ? 1 : 0);
