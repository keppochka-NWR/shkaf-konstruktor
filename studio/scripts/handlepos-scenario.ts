// Расположение ручки мышью (запрос Макса 20.10.2026): npx tsx scripts/handlepos-scenario.ts <url> <outDir>
// «Навесной кухонный» → ПКМ по фасаду → «Ручка › Снизу по центру» → «В углу напротив нижней петли» → «Петли справа» (ручка в другом углу) → Ctrl+Z.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { initialModule, parts, type Module } from "../src/model";
import { kitchenWall } from "../src/kitchen";
import { newProject, type Project } from "../src/project";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const shot = (n: string) => page.screenshot({ path: `${out}/handlepos-${n}.png` });
const ring = async () => (await page.locator(".radial-item").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
const item = (re: RegExp) => page.locator(".radial-item").filter({ hasText: re }).first();
/** Ручка фасада в сохранённом проекте страницы: позиция и ориентация относительно фасада. */
async function handle() {
  // проект клиента хранится под своим ключом (module-studio-v3:<клиент>); подложенный — под общим
  const all = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("module-studio-v3")).map((k) => [k, localStorage.getItem(k) ?? ""]));
  const found = all.filter(([, v]) => v.includes("Навесной кухонный")).sort((a, b) => (a[1] === injected ? 1 : 0) - (b[1] === injected ? 1 : 0));
  const p = JSON.parse(found[0]?.[1] ?? "{}") as Project, m = p.modules?.[0]?.module as Module | undefined;
  if (!m) return null;
  const list = parts(m), d = list.find((x) => x.role === "door")!, h = list.find((x) => x.id === d.id.replace(":door:", ":handle:"))!;
  const dx = h.position[0] - d.position[0], dy = h.position[1] - d.position[1];
  return { hinge: d.hinge, horizontal: h.size[0] > h.size[1], dx: Math.round(dx), dy: Math.round(dy), dw: d.size[0], dh: d.size[1], pos: m.sections[0].handlePos?.[0] ?? null };
}
const fmt = (h: Awaited<ReturnType<typeof handle>>) => h ? `петли ${h.hinge}, ${h.horizontal ? "горизонтально" : "вертикально"}, от центра фасада ${h.dx}/${h.dy} мм, поле ${h.pos}` : "нет";
async function openDoorMenu() {
  const c = (await page.locator("canvas").first().boundingBox())!;
  await page.mouse.click(c.x + c.width / 2, c.y + c.height * 0.55, { button: "right" }); await page.waitForTimeout(350);
  if (await item(/^Фасад/).count()) { await item(/^Фасад/).click(); await page.waitForTimeout(250); }
}
async function pick(path: RegExp[]) {
  await openDoorMenu();
  for (const re of path) { const it = item(re); if (!(await it.count())) return (await ring()).join(" | "); await it.click(); await page.waitForTimeout(300); }
  await page.waitForTimeout(400);
  return "";
}
let injected = "";
const undo = async () => { await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()); await page.keyboard.press("Control+z"); await page.waitForTimeout(600); };
try {
  const p = newProject();
  const m = kitchenWall(initialModule(), 600); m.sections[0].hingeSide = "left";
  p.modules = [{ id: "w", x: 1000, y: 1400, z: 3, rotation: 0, module: m }];
  await page.goto(url);
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "facades"); localStorage.setItem("studio-dock", "project"); localStorage.setItem("studio-tip-rmb", "1"); }, (injected = JSON.stringify(p)));
  await page.goto(url); await page.waitForSelector("canvas"); await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Понятно" }).click().catch(() => {});
  await page.getByRole("button", { name: "Спереди", exact: true }).click().catch(() => {});
  await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click().catch(() => {});
  await page.waitForTimeout(1200);
  const h0 = await handle();
  check("старт: «Навесной кухонный», умолчание — угол напротив нижней петли", !!h0 && !h0.horizontal && h0.dx > 0 && h0.dy < -h0.dh / 4 && h0.pos === null, fmt(h0));
  await shot("01-start");
  await openDoorMenu();
  if (await item(/^Ручка/).count()) { await item(/^Ручка/).click(); await page.waitForTimeout(300); }
  const items = await ring();
  check("«Ручка ›»: у навесного «Снизу по центру» и «В углу напротив нижней петли» первыми, «Для всех фасадов модуля»", /Снизу по центру/.test(items[0] ?? "") && /В углу напротив нижней петли/.test(items[1] ?? "") && items.some((t) => /Для всех фасадов модуля/.test(t)), items.join(" | "));
  await shot("02-menu");
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.waitForTimeout(200);

  const e1 = await pick([/^Ручка/, /Снизу по центру/]);
  const h1 = await handle();
  check("«Снизу по центру»: горизонтально, по центру ширины, у нижнего края", !!h1 && h1.horizontal && h1.dx === 0 && h1.dy === Math.round(-h1.dh / 2 + 40) && h1.pos === "bottomCenter", fmt(h1) + (e1 ? " · меню: " + e1 : ""));
  await shot("03-bottom-center");

  const e2 = await pick([/^Ручка/, /В углу напротив нижней петли/]);
  const h2 = await handle();
  check("«В углу напротив нижней петли»: вертикально, у кромки открывания (петли слева → справа), внизу", !!h2 && !h2.horizontal && h2.dx === Math.round(h2.dw / 2 - 40) && h2.dy < -h2.dh / 4 && h2.pos === "bottomCorner", fmt(h2) + (e2 ? " · меню: " + e2 : ""));
  await shot("04-corner");

  const e3 = await pick([/^Открывание/, /Петли справа/]);
  const h3 = await handle();
  check("«Петли справа» (перевес): ручка переехала в левый нижний угол", !!h3 && h3.hinge === "right" && !h3.horizontal && h3.dx === -Math.round(h3.dw / 2 - 40) && h3.dy === h2?.dy, fmt(h3) + (e3 ? " · меню: " + e3 : ""));
  await shot("05-rehung");

  await undo();
  const h4 = await handle();
  check("Ctrl+Z: петли слева, ручка снова в правом нижнем углу", !!h4 && h4.hinge === "left" && h4.dx === Math.round(h4.dw / 2 - 40) && h4.pos === "bottomCorner", fmt(h4));
  await shot("06-undo");
  console.log("ошибки страницы: " + (errors.length ? errors.join("; ") : "нет"));
  const bad = results.filter((r) => !r[1]);
  console.log(`ИТОГ: ${results.length - bad.length}/${results.length}`);
  if (bad.length) process.exitCode = 1;
} finally { await browser.close(); }
