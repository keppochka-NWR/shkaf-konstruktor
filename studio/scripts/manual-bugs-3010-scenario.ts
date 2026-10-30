// Мелкие ошибки из руководства пользователя (30.10.2026) мышью: npx tsx scripts/manual-bugs-3010-scenario.ts <url /studio/> <outDir>
//  1. ПКМ по перегородке → «Частичная…» → подпись окна без двойного «мм» («Перегородка: низ от пола, мм»).
//  2. Пустая комната → палитра «Для одежды» → «Добавить в комнату» → первый корпус назван по виду, не «Модуль 1».
//  3. «Отделка» → «Стены» → «Все стены» → «Бежевая» → в 3D левая стена того же оттенка, что задняя (была серо-зелёной).
//  4. «Наполнение» → «Добавить: Ящики» → «Двигать корпуса» → створки закрыты; «Открыть фасады» → «Наполнение» → «Двигать корпуса» —
//     открыты (открыл сам пользователь).
import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";
import { initialModule, section, id, type Module } from "../src/model";
import { newProject, type Project } from "../src/project";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errors: string[] = [];
const results: [string, boolean][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const shot = (page: Page, n: string) => page.screenshot({ path: `${out}/${n}.png`, timeout: 60000 });
const doors = async (page: Page) => { await page.waitForTimeout(900); const s = (await page.evaluate("window.__openState?window.__openState():{}")) as Record<string, { t: number; target: number }>; return Object.entries(s).filter(([k]) => k.includes(":door:")).map(([, v]) => v.target); };
const modeBtn = (page: Page, name: string) => page.locator(".interaction-bar button", { hasText: name }).first();

// ── 4 и 1: шкаф 1200 в две секции с фасадами ───────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.setDefaultTimeout(8000);
  page.on("pageerror", (e) => errors.push(e.message));
  const wardrobe: Module = { ...initialModule(), name: "Шкаф QA", width: 1200, height: 2300, depth: 600, doors: true, sections: [section(), section()] };
  wardrobe.sections.forEach((s) => { s.shelves = []; s.drawers = 0; s.rod = false; });
  const proj: Project = newProject({ ...initialModule(), sections: [section()] });
  proj.modules = [{ id: id(), x: 600, y: 0, z: 3, rotation: 0, module: wardrobe }];
  await page.goto(url, { timeout: 60000 });
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "filling"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(proj));
  await page.goto(url, { timeout: 60000 }); await page.waitForSelector("canvas"); await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Спереди", exact: true }).click();
  await modeBtn(page, "Наполнение").click(); await page.waitForTimeout(300);
  let d = await doors(page);
  check("4. «Наполнение»: створки открыты на время работы", d.length > 0 && d.every((t) => t === 1), JSON.stringify(d));
  const add = page.getByRole("button", { name: "Добавить: Ящики" }).first();
  const cat = page.locator('details[data-settings-category="Наполнение"]');
  if (!(await cat.getAttribute("open").catch(() => null))) { await cat.locator("summary").first().click(); await page.waitForTimeout(300); }
  const sub = page.locator('details[data-setting="Ящики"]');
  if ((await sub.count()) && !(await sub.getAttribute("open").catch(() => null))) { await sub.locator("summary").first().scrollIntoViewIfNeeded(); await sub.locator("summary").first().click(); await page.waitForTimeout(300); }
  await add.scrollIntoViewIfNeeded(); await add.click(); await page.waitForTimeout(500); await add.click(); await page.waitForTimeout(800);
  await shot(page, "01-fill-drawers-doors-open");
  await modeBtn(page, "Двигать корпуса").click();
  d = await doors(page);
  check("4. выход в «Двигать корпуса»: створки закрыты (фасады не открывали)", d.length > 0 && d.every((t) => t === 0), JSON.stringify(d));
  await shot(page, "02-move-doors-closed");
  await page.getByRole("button", { name: "Открыть фасады", exact: true }).first().click();
  d = await doors(page);
  check("4. «Открыть фасады» в «Двигать корпуса»: открыты", d.length > 0 && d.every((t) => t === 1), JSON.stringify(d));
  await modeBtn(page, "Наполнение").click(); await page.waitForTimeout(300);
  await modeBtn(page, "Двигать корпуса").click();
  d = await doors(page);
  check("4. открыл сам → «Наполнение» → «Двигать корпуса»: остаются открытыми", d.length > 0 && d.every((t) => t === 1), JSON.stringify(d));
  await shot(page, "03-user-opened-stays-open");
  await page.getByRole("button", { name: "Открыть фасады", exact: true }).first().click();
  d = await doors(page);
  check("4. повторно «Открыть фасады»: закрыты", d.length > 0 && d.every((t) => t === 0), JSON.stringify(d));

  // 1. ПКМ по перегородке: фасады скрыты, корпус крупно, ищем перегородку по середине корпуса
  await page.getByRole("button", { name: /Скрыть фасады/ }).first().click().catch(() => {});
  await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click().catch(() => {});
  await page.waitForTimeout(1200);
  const c = (await page.locator("canvas").first().boundingBox())!;
  const title = async () => (await page.locator(".radial-center b").first().innerText({ timeout: 800 }).catch(() => "")).trim();
  let found = false;
  for (const fy of [0.3, 0.45, 0.6]) {
    for (let dx = 0; dx <= 140 && !found; dx += 3) for (const sgn of dx ? [1, -1] : [1]) {
      if (found) break;
      await page.mouse.click(c.x + c.width / 2 + sgn * dx, c.y + c.height * fy, { button: "right" }); await page.waitForTimeout(80);
      if (/^Перегородка/.test(await title())) { found = true; break; }
      for (let k = 0; k < 3 && (await page.locator(".radial-menu").count()); k++) { await page.keyboard.press("Escape"); await page.waitForTimeout(40); }
    }
    if (found) break;
  }
  check("1. ПКМ по перегородке открывает её меню", found);
  if (found) {
    await page.locator(".radial-item").filter({ has: page.locator(".radial-label", { hasText: /^Частичная…/ }) }).first().click();
    await page.waitForTimeout(500);
    const label = (await page.locator("form label").filter({ has: page.locator("input[type=number]") }).first().innerText().catch(() => "")).trim();
    check("1. окно «Частичная…»: подпись без двойного «мм»", /^Перегородка: низ от пола, мм$/.test(label) && (label.match(/мм/g) ?? []).length === 1, JSON.stringify(label));
    await shot(page, "04-partial-dialog");
    await page.keyboard.press("Escape");
  }
  await page.close();
}

// ── 2 и 3: пустая комната ──────────────────────────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.setDefaultTimeout(8000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url, { timeout: 60000 });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("studio-tip-rmb", "1"); });
  await page.goto(url + (url.includes("?") ? "&" : "?") + "fresh=1", { timeout: 60000 }); await page.waitForSelector("canvas"); await page.waitForTimeout(2500);
  // 3. отделка: все стены — бежевая покраска
  const panel = page.getByTestId("room-finishes").first();
  if (!(await panel.isVisible().catch(() => false))) { await page.locator("summary", { hasText: "Отделка: пол и стены" }).first().click(); await page.waitForTimeout(400); }
  await panel.getByRole("tab", { name: "Стены" }).click(); await page.waitForTimeout(300);
  await panel.getByLabel("Стена для отделки").selectOption("all");
  await panel.getByRole("button", { name: "Покраска: Бежевая" }).click(); await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "3D", exact: true }).first().click(); await page.waitForTimeout(1500);
  const buf = await page.screenshot({ path: `${out}/05-walls-beige.png`, timeout: 60000 });
  // оттенок стен по снимку: доля синего к красному на левой и задней стене (серо-зелёная левая была заметно «холоднее»)
  const pts = (await page.evaluate(() => { const r = document.querySelector("canvas")!.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })) as number[];
  // точки: левая стена — левая четверть холста, задняя — правее середины, чуть выше (строка, а не функция: tsx вставляет __name)
  const sample = (await page.evaluate(`(async function(b64,area){
    var img=new Image();img.src="data:image/png;base64,"+b64;await img.decode();
    var cv=document.createElement("canvas");cv.width=img.width;cv.height=img.height;var g=cv.getContext("2d");g.drawImage(img,0,0);
    function at(fx,fy){var d=g.getImageData(Math.round(area[0]+area[2]*fx)-3,Math.round(area[1]+area[3]*fy)-3,7,7).data,r=0,gg=0,b=0;for(var i=0;i<d.length;i+=4){r+=d[i];gg+=d[i+1];b+=d[i+2];}var n=d.length/4;return [r/n,gg/n,b/n];}
    var left=[],back=[];for(var fy=0.35;fy<=0.6;fy+=0.05){left.push(at(0.24,fy));back.push(at(0.62,fy-0.08));}
    return {left:left,back:back};
  })(${JSON.stringify(buf.toString("base64"))},${JSON.stringify(pts)})`)) as { left: number[][]; back: number[][] };
  const avg = (a: number[][]) => [0, 1, 2].map((i) => a.reduce((s, p) => s + p[i], 0) / a.length);
  const L = avg(sample.left), B = avg(sample.back), warm = (p: number[]) => (p[0] - p[2]) / p[0];
  check("3. «Все стены» бежевые: левая стена того же оттенка, что задняя (разница «тепла» < 0,05)", Math.abs(warm(L) - warm(B)) < 0.05 && warm(L) > 0.08, `левая ${L.map(Math.round)} задняя ${B.map(Math.round)} тепло ${warm(L).toFixed(3)} / ${warm(B).toFixed(3)}`);
  // 2. палитра «Для одежды» → «Добавить в комнату»
  await page.getByRole("button", { name: "Для одежды" }).first().click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Добавить в комнату" }).first().click(); await page.waitForTimeout(2500);
  const names = (await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith("garderyob-rooms-v1") && !x.includes(":previous") && !x.includes(":damaged")); if (!k) return []; const doc = JSON.parse(localStorage.getItem(k)!), r = doc.rooms.find((x: { id: string }) => x.id === doc.activeRoomId) ?? doc.rooms[0]; return r.project.modules.map((a: { module: { name: string } }) => a.module.name); })) as string[];
  check("2. первый корпус из пустой комнаты назван по виду («Для одежды»), не «Модуль 1»", names.length === 1 && /Для одежды/.test(names[0]) && !/^Модуль \d/.test(names[0]), JSON.stringify(names));
  await shot(page, "06-first-module-name");
  await page.close();
}
await browser.close();
check("без ошибок страницы", errors.length === 0, errors.slice(0, 3).join(" | "));
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} проверок`);
process.exit(failed ? 1 : 0);
