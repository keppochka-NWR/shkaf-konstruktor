// Снимки вкладки «Кухня» целиком (палитра, 3D, панель модуля) — Chrome через Playwright, как видит Макс.
// npx tsx scripts/kitchen-ui-shots.ts <url> <outDir> "<команды через ;>"
// Команды: stage:bodies|filling|facades · module:N (N-й корпус в списке слева) · click:текст кнопки · label:aria-label (клик по элементу)
//          menuitem:начало названия пункта меню (например, «Ещё проект» → «Кухня»)
//          fill:aria-label=значение (ввод + Enter) · open (открыть/закрыть фасады) · view:3D|Спереди|… · left:px / right:px (прокрутка панелей)
//          details:текст summary (раскрыть) · shot:имя (окно целиком) · canvas:имя (только 3D) · wait:мс
//          cam:px,py,pz,tx,ty,tz (камера в мм комнаты) · fit (приблизить выбранный) · facades (скрыть/показать фасады)
// Хранилище очищается перед началом: вкладка открывается как в первый раз (?order=kitchen — новая кухня 3600 × 3000).
import { chromium } from "playwright";

const [url, out, script] = process.argv.slice(2);
const W = Number(process.env.W ?? 1600), H = Number(process.env.H ?? 1000);
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(url);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); localStorage.setItem("studio-stage-advanced", "0"); });
await page.goto(url);
await page.waitForSelector("canvas");
const settle = async () => {
  for (let i = 0; i < 100; i++) { const n = await page.evaluate(() => (window as unknown as { __pending?: () => number }).__pending?.() ?? 0); if (n === 0) break; await page.waitForTimeout(150); }
  await page.waitForTimeout(600);
};
await settle();
for (const cmd of (script ?? "shot:kitchen").split(";").map((s) => s.trim()).filter(Boolean)) {
  const [op, arg = ""] = cmd.split(/:(.*)/s);
  if (op === "stage") { await page.getByRole("button", { name: new RegExp({ bodies: "Корпус", filling: "Наполнение", facades: "Фасад" }[arg] ?? arg) }).first().click(); await settle(); }
  else if (op === "module") { await page.locator(".module-list .module-item").nth(Number(arg) - 1).click(); await settle(); }
  else if (op === "click") { await page.getByRole("button", { name: arg }).first().click(); await settle(); }
  else if (op === "menuitem") { await page.getByRole("menuitem", { name: new RegExp("^\\s*" + arg) }).first().click(); await settle(); }
  else if (op === "label") { await page.getByLabel(arg, { exact: true }).first().click(); await settle(); }
  else if (op === "fill") { const [label, value] = arg.split("="); const f = page.getByLabel(label, { exact: true }).first(); await f.fill(value); await f.press("Enter"); await settle(); }
  else if (op === "open") { const b = page.getByRole("button", { name: /Открыть фасады|Закрыть фасады/ }); if (await b.count()) await b.first().click(); await settle(); }
  else if (op === "view") { await page.getByRole("button", { name: arg, exact: true }).first().click(); await settle(); }
  else if (op === "left" || op === "right") { await page.evaluate(([sel, px]) => { const el = document.querySelector(sel); if (el) el.scrollTop = Number(px); }, [op === "left" ? ".library" : ".properties", arg]); await page.waitForTimeout(200); }
  else if (op === "details") { await page.locator("summary", { hasText: arg }).first().click(); await page.waitForTimeout(200); }
  else if (op === "cam") { const v = arg.split(",").map(Number); await page.evaluate((v) => (window as unknown as { __camera?: (p: number[], l: number[]) => void }).__camera?.(v.slice(0, 3), v.slice(3, 6)), v); await settle(); }
  else if (op === "fit") { const b = page.getByRole("button", { name: "Приблизить выбранный корпус" }); if (await b.count()) await b.first().click(); await settle(); }
  else if (op === "facades") { const b = page.getByRole("button", { name: /Скрыть фасады|Показать фасады/ }); if (await b.count()) await b.first().click(); await settle(); }
  else if (op === "wait") await page.waitForTimeout(Number(arg));
  else if (op === "shot") { await settle(); await page.screenshot({ path: `${out}/${arg}.png` }); console.log("снимок", arg); }
  else if (op === "canvas") { await settle(); await page.screenshot({ path: `${out}/${arg}.png`, clip: (await page.locator("canvas").first().boundingBox())! }); console.log("снимок 3D", arg); }
  else console.log("неизвестная команда", cmd);
}
const alert = await page.locator("[role=alert]").allInnerTexts();
if (alert.filter((t) => t.trim()).length) console.log("сообщения:", alert.filter((t) => t.trim()).slice(0, 5).join(" | "));
if (errors.length) console.log("ошибки страницы:", errors.slice(0, 5).join(" | "));
await browser.close();
