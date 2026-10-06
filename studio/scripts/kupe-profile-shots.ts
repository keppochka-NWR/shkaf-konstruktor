// Профили купе крупно: шкаф-купе из палитры, вид сверху на стык полотен и изометрия угла. npx tsx scripts/kupe-profile-shots.ts <url> <outDir>
import { chromium } from "playwright";
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(url);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); });
await page.goto(url);
await page.waitForSelector("canvas");
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Двери купе" }).first().click();
await page.getByRole("button", { name: "Добавить в комнату" }).click();
await page.waitForTimeout(2500);
// оставить в проекте только купе, чтобы шкаф не заслонял профили
await page.evaluate(() => {
  for (const key of Object.keys(localStorage).filter((k) => k.startsWith("module-studio-v3"))) {
    try { const p = JSON.parse(localStorage.getItem(key)!); if (Array.isArray(p.modules) && p.modules.some((a: { module?: { kupe?: unknown } }) => a.module?.kupe)) { p.modules = p.modules.filter((a: { module?: { kupe?: unknown } }) => a.module?.kupe); localStorage.setItem(key, JSON.stringify(p)); } } catch { /* не проект */ }
  }
});
await page.reload(); await page.waitForSelector("canvas"); await page.waitForTimeout(2500);
for (const name of ["Показать помещение", "Показать размеры"]) {
  const b = page.getByRole("button", { name }); if (await b.count() && (await b.first().getAttribute("aria-pressed")) === "true") await b.first().click();
}
const fit = page.getByRole("button", { name: "Приблизить выбранный корпус" }); if (await fit.count()) await fit.first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/profile-0-iso.png` });
const zoom = async (fx: number, fy: number, ticks: number, file: string) => {
  const c = (await page.locator("canvas").first().boundingBox())!;
  await page.mouse.move(c.x + c.width * fx, c.y + c.height * fy);
  for (let k = 0; k < ticks; k++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(80); }
  await page.waitForTimeout(1500); await page.screenshot({ path: `${out}/${file}` });
};
const view = async (name: string) => { await page.getByRole("button", { name, exact: true }).click(); await page.waitForTimeout(1200); if (await fit.count()) await fit.first().click(); await page.waitForTimeout(1200); };
// VIEW=3D|Спереди|Сверху; ZOOM="fx,fy,ticks;fx,fy,ticks" — шаги приближения к точкам холста (доли ширины/высоты), снимок после каждого
await view(process.env.VIEW ?? "3D");
await page.screenshot({ path: `${out}/profile-1-view.png` });
let n = 2;
for (const step of (process.env.ZOOM ?? "").split(";").filter(Boolean)) {
  const [fx, fy, ticks] = step.split(",").map(Number);
  await zoom(fx, fy, ticks, `profile-${n++}-zoom.png`);
}
await browser.close();
