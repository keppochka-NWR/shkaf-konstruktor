// Разведка тупиков правой кнопки: npx tsx scripts/rclick-probe.ts <url> <outDir> [prefix]
import { chromium } from "playwright";
const [url, out, prefix = "probe"] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
try {
  await page.goto(url + "?fresh=1");
  await page.waitForSelector("canvas");
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /Для одежды/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Добавить первый шкаф/ }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Понятно" }).click().catch(() => {});
  await page.getByRole("button", { name: "Спереди", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click();
  await page.waitForTimeout(1500);
  const c = (await page.locator("canvas").first().boundingBox())!;
  const at = (x: number, y: number) => page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + "." + e.className + " " + (e.textContent ?? "").slice(0, 20) : "none"; }, [x, y]);
  const menu = async (tag: string) => { await page.waitForTimeout(300); const n = await page.locator(".radial-menu").count(); console.log(tag, "menu", n, n ? (await page.locator(".radial-center b").first().innerText()) + " / " + (await page.locator(".radial-item").allInnerTexts()).map((t) => t.trim()).join("|") : ""); return n; };
  const cx = c.x + c.width / 2, cy = c.y + c.height / 2;
  console.log("canvas", JSON.stringify(c), "center", await at(cx, cy));
  await page.screenshot({ path: `${out}/${prefix}-0.png` });
  await page.mouse.click(cx, cy, { button: "right" });
  await menu("1 rclick body");
  await page.screenshot({ path: `${out}/${prefix}-1-menu.png` });
  const corp = page.locator(".radial-item", { hasText: /^Корпус/ });
  if (await corp.count()) { await corp.first().click(); await page.waitForTimeout(250); console.log("   Корпус ›:", (await page.locator(".radial-item").allInnerTexts()).map((t) => t.trim()).join("|")); await page.screenshot({ path: `${out}/${prefix}-1b-body.png` }); }
  for (const name of ["Добавить", "В секцию", "Полку"]) { await page.locator(".radial-item", { hasText: name }).first().click(); await page.waitForTimeout(250); }
  await page.waitForTimeout(600);
  const c2 = (await page.locator("canvas").first().boundingBox())!;
  console.log("after add: canvas", JSON.stringify(c2), "bar", await page.locator(".selection-action-bar").count(), "mode-fill pressed", await page.locator('[aria-pressed="true"]').allInnerTexts());
  await page.screenshot({ path: `${out}/${prefix}-2-added.png` });
  console.log("el at center", await at(cx, cy));
  await page.mouse.click(cx, cy, { button: "right" });
  await menu("3 rclick with selected part");
  await page.screenshot({ path: `${out}/${prefix}-3-menu-selected.png` });
  await page.keyboard.press("Escape");
  // сетка точек по шкафу: где правый клик молчит
  const box = await page.evaluate(() => { const c = document.querySelector("canvas")!.getBoundingClientRect(); return { x: c.x, y: c.y, w: c.width, h: c.height }; });
  const silent: string[] = []; let opened = 0;
  for (let y = box.y + 150; y < box.y + box.h - 60; y += 40) for (let x = 610; x <= 700; x += 30) {
    const el = await at(x, y); if (!el.startsWith("CANVAS")) continue;
    await page.mouse.click(x, y, { button: "right" }); await page.waitForTimeout(120);
    if (await page.locator(".radial-menu").count()) { opened++; await page.keyboard.press("Escape"); await page.waitForTimeout(60); } else silent.push(`${x},${Math.round(y)}`);
  }
  console.log("grid opened", opened, "silent", silent.join(" "));
  await page.screenshot({ path: `${out}/${prefix}-4-grid.png` });
  // плашки размеров
  const dims = await page.locator(".model-dimension").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [e.textContent, Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; }));
  console.log("dims", JSON.stringify(dims));
  for (const [t, x, y] of dims as [string, number, number][]) { if (!/мм/.test(t)) continue; await page.mouse.click(x, y, { button: "right" }); const n = await menu("rclick on dim " + t); if (n) await page.keyboard.press("Escape"); break; }
} finally { await browser.close(); }
