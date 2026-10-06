// Проверка кругового меню: npx tsx scripts/radial-shots.ts <url> <project.json> <outDir>
// Правый клик по корпусу → кольцо; «Фасады» → «Петли» → Blum; цена до/после. Затем правый клик по полке и ящику при открытых фасадах.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const [url, file, out] = process.argv.slice(2);
const project = readFileSync(file, "utf8");
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url);
await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-dock", "project"); }, project);
await page.goto(url);
await page.waitForSelector("canvas");
await page.waitForTimeout(2500);
const price = async () => (await page.locator(".dock-price").innerText()).replace(/\s+/g, " ");
// Подписи и кнопки кольца не должны налезать друг на друга и выходить за окно.
const OVERLAP = `(() => { const els = [...document.querySelectorAll(".radial-label, .radial-item, .radial-center")].map(e => [e, e.getBoundingClientRect()]); const bad = [];
  for (let i = 0; i < els.length; i++) { const [e, r] = els[i]; if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) bad.push("за окном: " + e.textContent);
    for (let j = i + 1; j < els.length; j++) { const [f, q] = els[j]; if (e.contains(f) || f.contains(e)) continue;
      const round = (el) => el.classList.contains("radial-item") || el.classList.contains("radial-center");
      if (round(e) && round(f)) { const d = Math.hypot((r.left + r.right) / 2 - (q.left + q.right) / 2, (r.top + r.bottom) / 2 - (q.top + q.bottom) / 2); if (d < r.width / 2 + q.width / 2 - 1) bad.push("круги налезают: «" + e.textContent.trim() + "» и «" + f.textContent.trim() + "» d=" + Math.round(d) + " r1=" + Math.round(r.width/2) + " r2=" + Math.round(q.width/2)); continue; }
      const ix = Math.min(r.right, q.right) - Math.max(r.left, q.left), iy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top); if (ix > 2 && iy > 2) bad.push("налезают: «" + e.textContent.trim() + "» и «" + f.textContent.trim() + "»"); } }
  return bad; })()`;
const checkRing = async (name: string) => { await page.waitForTimeout(450); const bad = (await page.evaluate(OVERLAP)) as string[]; console.log("   кольцо", name, bad.length ? "— " + bad.join("; ") : "— без наложений"); };
page.on("console", () => {});
// Найти точку на корпусе: перебираем сетку по холсту, пока правый клик не откроет меню.
const canvas = (await page.locator("canvas").first().boundingBox())!;
async function rightClickOn(predicate: (title: string) => boolean, label: string) {
  for (let gy = 0.25; gy <= 0.85; gy += 0.025) for (let gx = 0.2; gx <= 0.8; gx += 0.04) {
    const x = canvas.x + canvas.width * gx, y = canvas.y + canvas.height * gy;
    await page.mouse.click(x, y, { button: "right" });
    await page.waitForTimeout(60);
    if (await page.locator(".radial-menu").count()) {
      const title = (await page.locator(".radial-center b").first().innerText()).trim();
      if (predicate(title)) { console.log(label, "→ меню:", title, "| пункты:", (await page.locator(".radial-item").allInnerTexts()).map((t) => t.trim()).join(", ")); return true; }
      await page.keyboard.press("Escape"); await page.waitForTimeout(80);
    }
  }
  console.log(label, "→ не найдено"); return false;
}
console.log("цена до:", await price());
if (await rightClickOn(() => true, "корпус")) {
  await page.screenshot({ path: `${out}/radial-1-body.png` }); await checkRing("корпус");
  if (await page.locator(".radial-item", { hasText: "Фасады" }).count()) { await page.locator(".radial-item", { hasText: "Фасады" }).click(); await page.waitForTimeout(250); }
  await page.screenshot({ path: `${out}/radial-2-facades.png` }); await checkRing("фасады");
  const hinges = page.locator(".radial-item", { hasText: "Петли" });
  if (await hinges.isEnabled()) {
    await hinges.click(); await page.waitForTimeout(250);
    await page.locator(".radial-item", { hasText: "Blum" }).hover(); await page.waitForTimeout(150);
    await page.screenshot({ path: `${out}/radial-3-hinges.png` }); await checkRing("петли");
    await page.locator(".radial-item", { hasText: "Blum" }).click(); await page.waitForTimeout(1200);
    console.log("цена после Blum:", await price());
  } else console.log("петли недоступны: у корпуса нет дверей");
}
// Открыть фасады и кликнуть по полке/ящику
const doors = page.getByRole("button", { name: "Открыть фасады" });
if (await doors.count() && (await doors.first().getAttribute("aria-pressed")) !== "true") await doors.first().click();
await page.waitForTimeout(800);
if (await rightClickOn((t) => t.startsWith("Полка"), "полка")) { await page.screenshot({ path: `${out}/radial-4-shelf.png` }); await checkRing("полка"); await page.keyboard.press("Escape"); }
if (await rightClickOn((t) => /^Ящик \d/.test(t), "ящик")) {
  await page.locator(".radial-item", { hasText: "Направляющие" }).click(); await page.waitForTimeout(250);
  await page.locator(".radial-item", { hasText: "Скрытые" }).click(); await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/radial-5-slides.png` }); await checkRing("скрытые направляющие");
  const before = await price();
  await page.locator(".radial-item", { hasText: "Premial · доводчик" }).click(); await page.waitForTimeout(1200);
  console.log("ящик → Premial с доводчиком:", before, "→", await price());
  const alert = (await page.locator("[role=alert]").allInnerTexts()).join(" | ").trim(); if (alert) console.log("сообщение:", alert);
}
await browser.close();
