// Снимки студии для сверки с Базисом (браузер Chrome через Playwright, как видит Макс).
// npx tsx scripts/kitchen-shots.ts <url> <project.json> <outDir> "<команды через ;>"
// Команды: view:3D|Спереди|Сбоку|Сверху|План · free (свободная камера) · orbit:dx,dy · zoom:fx,fy,ticks · facades (скрыть/показать фасады)
//          open (открыть фасады) · fit (приблизить выбранный) · shot:имя · wait:мс
//          front[:запас] — спереди ГЛАВНОГО РЯДА кухни (поворот, у которого больше всего ширины модулей), перспектива на всю кухню;
//            не зависит от выбранного модуля (view:Спереди студии смотрит на фасад выбранного: у k01/k06 это вид сбоку, у k30 «Остров» — сзади)
//          present — режим «Показать клиенту» (без рамки выбранного модуля и панелей; open в нём тоже работает)
//          clean — дальше снимки без элементов интерфейса поверх сцены (панель снизу не закрывает цоколь и опоры)
// Каждый снимок — только после загрузки текстур и моделей фурнитуры (window.__pending() === 0), проект — из файла, без правок в браузере.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { parseProject } from "../src/project";
import { frontCamera } from "./kitchen/frontCamera";

const [url, file, out, script] = process.argv.slice(2);
const project = readFileSync(file, "utf8");
let clean = false;
const W = Number(process.env.W ?? 1600), H = Number(process.env.H ?? 1000);
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(url);
await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); localStorage.setItem("studio-stage-advanced", "1"); }, project);
await page.goto(url);
await page.waitForSelector("canvas");
const settle = async () => {
  for (let i = 0; i < 100; i++) { const n = await page.evaluate(() => (window as unknown as { __pending?: () => number }).__pending?.() ?? 0); if (n === 0) break; await page.waitForTimeout(150); }
  await page.waitForTimeout(700);
};
await settle();
for (const name of ["Показать размеры"]) { const b = page.getByRole("button", { name }); if (await b.count() && (await b.first().getAttribute("aria-pressed")) === "true") await b.first().click(); }
const canvas = async () => (await page.locator("canvas").first().boundingBox())!;
for (const cmd of (script ?? "view:3D;shot:3d").split(";").map((s) => s.trim()).filter(Boolean)) {
  const [op, arg = ""] = cmd.split(/:(.*)/s);
  if (op === "view") { await page.getByRole("button", { name: arg, exact: true }).first().click(); await settle(); }
  else if (op === "free") { const b = page.getByRole("button", { name: /Свободная камера/ }); if (await b.count()) await b.first().click(); }
  else if (op === "facades") { const b = page.getByRole("button", { name: /Скрыть фасады|Показать фасады/ }); if (await b.count()) await b.first().click(); await settle(); }
  else if (op === "open") { const b = page.getByRole("button", { name: /Открыть фасады|Закрыть фасады/ }); if (await b.count()) await b.first().click(); await settle(); }
  else if (op === "room") { const b = page.getByRole("button", { name: /Показать помещение|Скрыть помещение/ }); if (await b.count()) await b.first().click(); await settle(); }
  else if (op === "fit") { const b = page.getByRole("button", { name: "Приблизить выбранный корпус" }); if (await b.count()) await b.first().click(); await settle(); }
  else if (op === "orbit") {
    const [dx, dy] = arg.split(",").map(Number), c = await canvas(), x = c.x + c.width / 2, y = c.y + c.height / 2;
    await page.mouse.move(x, y); await page.mouse.down({ button: "left" });
    for (let i = 1; i <= 20; i++) await page.mouse.move(x + dx * i / 20, y + (dy || 0) * i / 20);
    await page.mouse.up({ button: "left" }); await settle();
  } else if (op === "zoom") {
    const [fx, fy, ticks] = arg.split(",").map(Number), c = await canvas();
    await page.mouse.move(c.x + c.width * fx, c.y + c.height * fy);
    for (let k = 0; k < ticks; k++) { await page.mouse.wheel(0, ticks > 0 ? -200 : 200); await page.waitForTimeout(60); }
    await settle();
  } else if (op === "cam") {
    // cam:px,py,pz,tx,ty,tz — камера в координатах комнаты (мм), взгляд на точку
    const v = arg.split(",").map(Number);
    await page.evaluate((v) => (window as unknown as { __camera?: (p: number[], l: number[]) => void }).__camera?.(v.slice(0, 3), v.slice(3, 6)), v);
    await settle();
  } else if (op === "front") {
    const c = await canvas(), v = frontCamera(parseProject(JSON.parse(project)), c.width / c.height, Number(arg) || 1.2);
    await page.evaluate((v) => (window as unknown as { __camera?: (p: number[], l: number[]) => void }).__camera?.(v.slice(0, 3), v.slice(3, 6)), v);
    await settle();
  } else if (op === "present") { const b = page.getByRole("button", { name: /Показать клиенту|Вернуться к редактору/ }); if (await b.count()) await b.first().click(); await settle(); }
  else if (op === "clean") clean = !clean;
  else if (op === "wait") await page.waitForTimeout(Number(arg));
  else if (op === "shot") {
    await settle();
    // clean: элементы интерфейса поверх сцены прячутся на время снимка (visibility), потом возвращаются
    if (clean) await page.evaluate(() => {
      const cv = document.querySelector("canvas")!, r = cv.getBoundingClientRect();
      for (const e of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
        if (e === cv || e.contains(cv)) continue;
        const b = e.getBoundingClientRect();
        if (b.width && b.height && b.right > r.left && b.left < r.right && b.bottom > r.top && b.top < r.bottom) { e.dataset.shotVis = e.style.visibility || "-"; e.style.visibility = "hidden"; }
      }
    });
    await page.screenshot({ path: `${out}/${arg}.png`, clip: await canvas() }); console.log("снимок", arg);
    if (clean) await page.evaluate(() => { for (const e of Array.from(document.querySelectorAll<HTMLElement>("[data-shot-vis]"))) { e.style.visibility = e.dataset.shotVis === "-" ? "" : e.dataset.shotVis!; delete e.dataset.shotVis; } });
  }
  else console.log("неизвестная команда", cmd);
}
if (errors.length) console.log("ошибки страницы:", errors.slice(0, 5).join(" | "));
await browser.close();
