// Релиз 22.10, m7: снимок общего вида для КП — всегда с закрытыми створками и без артефактов, ракурс как на экране.
// npx tsx scripts/m7-kp-scenario.ts <url /studio/> <outDir>
// Комната 2400 × 3000: «Для одежды» 1200 и «Пустой шкаф» 1158 с ручками HEXA L-1200, вид «Спереди», створки на экране открыты.
// Мышью: Документы → Коммерческое предложение → Предпросмотр КП; картинка КП сохраняется и проверяется: створки закрыты
// (на снимке нет внутренностей — серого задника), после снимка на экране створки по-прежнему открыты, камера на месте.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { initialModule, section, type Module } from "../src/model";
import { withDoorCount } from "../src/paletteDoors";
import { newProject, type Project } from "../src/project";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const project = (): Project => {
  const p = newProject();
  p.room = { ...p.room, width: 2400, depth: 3000, height: 2700 };
  let empty: Module = { ...initialModule(), name: "Пустой шкаф", width: 1158, height: 2400, depth: 550, sections: [section()] };
  empty = withDoorCount(empty, 2); empty.handleId = "hexa1200a";
  p.modules = [{ id: "a", x: 0, y: 0, z: 30, rotation: 0, module: { ...initialModule(), name: "Модуль 1", width: 1200, height: 2400, depth: 550 } },
    { id: "b", x: 1221, y: 0, z: 30, rotation: 0, module: empty }];
  return p;
};
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [], bad: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => { if (r.status() >= 400) bad.push(r.status() + " " + r.url()); });
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const settle = async () => {
  for (let i = 0; i < 100; i++) { const n = await page.evaluate(() => (window as unknown as { __pending?: () => number }).__pending?.() ?? 0); if (n === 0) break; await page.waitForTimeout(150); }
  await page.waitForTimeout(700);
};
const shot = async (n: string) => { await settle(); await page.screenshot({ path: join(out, `m7-${n}.png`) }); };
/** доля пикселей цвета задней стенки (ref — цвет задника, взятый на экране внутри открытого шкафа) в средней части картинки;
 *  dark — доля тёмно-серых пикселей (задник в тени, «треугольник» критика A39/A47) */
async function stats(dataUrl: string, ref: number[]) {
  return page.evaluate(async ([src, ref]) => {
    const img = new Image(); img.src = src as string; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d")!; g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, [R, G, B] = ref as number[];
    let back = 0, dark = 0, n = 0;
    for (let y = Math.floor(c.height * 0.3); y < c.height * 0.7; y += 4) for (let x = Math.floor(c.width * 0.2); x < c.width * 0.8; x += 4) {
      const i = (y * c.width + x) * 4, r = d[i], gg = d[i + 1], b = d[i + 2]; n++;
      if (Math.abs(r - R) < 9 && Math.abs(gg - G) < 9 && Math.abs(b - B) < 9) back++;
      if (Math.abs(r - gg) < 10 && Math.abs(gg - b) < 12 && r > 100 && r < 160) dark++;
    }
    return { w: c.width, h: c.height, back: back / n, dark: dark / n };
  }, [dataUrl, ref] as const);
}
const pct = (v: number) => (v * 100).toFixed(1) + " %";
try {
  await page.goto(url);
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-dock", "project"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(project()));
  await page.goto(url); await page.waitForSelector("canvas"); await settle();
  await page.getByRole("button", { name: "Понятно" }).click().catch(() => {});
  await page.locator(".view-tabs button", { hasText: "Спереди" }).first().click(); await settle();
  // створки открыты (по умолчанию «Открыть фасады» включено) — как у критика A39
  const openBtn = page.getByRole("button", { name: /Открыть фасады|Закрыть фасады/ }).first();
  if ((await openBtn.count()) && (await openBtn.getAttribute("aria-pressed")) !== "true") { await openBtn.click(); await settle(); }
  await shot("01-screen-open");
  const before = await page.evaluate(() => document.querySelector("canvas")!.toDataURL());
  // цвет задней стенки — в верхнем проёме «Модуля 1» (створки открыты, видно внутренность)
  const ref = await page.evaluate(async ([px, py]) => {
    const cv = document.querySelector("canvas")!, r = cv.getBoundingClientRect(), img = new Image(); img.src = cv.toDataURL(); await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d")!; g.drawImage(img, 0, 0);
    const d = g.getImageData(Math.round((px - r.left) * img.width / r.width), Math.round((py - r.top) * img.height / r.height), 1, 1).data; return [d[0], d[1], d[2]];
  }, [580, 350]);
  const scr0 = await stats(before, ref);
  check("на экране створки открыты, задник виден; без тёмного «треугольника» тени на заднике", scr0.back > 0.05 && scr0.dark < 0.02, `задник rgb(${ref.join(",")}) ${pct(scr0.back)}, тёмного ${pct(scr0.dark)}`);
  // Документы → КП → Предпросмотр
  await page.locator(".dock-tabs button", { hasText: "Документы" }).click(); await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Коммерческое предложение", exact: true }).first().click(); await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Подставить текущую смету" }).click().catch(() => {}); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Предпросмотр КП" }).click(); await settle();
  const frame = page.locator('iframe[title="Предпросмотр коммерческого предложения"]');
  check("КП: предпросмотр открыт", (await frame.count()) === 1);
  const doc = (await frame.getAttribute("srcdoc")) ?? "";
  const img = /src="(data:image\/png;base64,[^"]+)"/.exec(doc)?.[1] ?? "";
  check("КП: картинка общего вида есть", img.length > 1000, img.length + " символов");
  if (img) writeFileSync(join(out, "m7-kp-image.png"), Buffer.from(img.slice(22), "base64"));
  await frame.scrollIntoViewIfNeeded(); await page.mouse.wheel(0, 300); await page.waitForTimeout(300); await shot("02-kp-preview");
  const kp = img ? await stats(img, ref) : null;
  check("КП: створки закрыты — задника и тени внутри не видно", !!kp && kp.back < 0.02 && kp.dark < 0.02, kp ? `задник ${pct(kp.back)}, тёмного ${pct(kp.dark)}, ${kp.w}×${kp.h}` : "");
  await page.getByRole("button", { name: "Закрыть окно" }).click().catch(async () => { await page.keyboard.press("Escape"); }); await page.waitForTimeout(400);
  await shot("03-screen-after");
  const after = await page.evaluate(() => document.querySelector("canvas")!.toDataURL());
  const scr = await stats(after, ref);
  check("после снимка на экране створки по-прежнему открыты (задник виден, как до снимка)", scr.back > 0.05 && Math.abs(scr.back - scr0.back) < 0.03, `до ${pct(scr0.back)}, после ${pct(scr.back)}`);
  // тот же снимок из вида «3D» (перспектива): ракурс как на экране, створки закрыты
  await page.locator(".dock-tabs button", { hasText: "Документы" }).click().catch(() => {}); await page.waitForTimeout(300);
  await page.locator(".view-tabs button", { hasText: "3D" }).first().click(); await settle();
  await shot("04-screen-3d");
  await page.locator(".dock-tabs button", { hasText: "Документы" }).click(); await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Коммерческое предложение", exact: true }).first().click(); await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Предпросмотр КП" }).click(); await settle();
  const doc3 = (await page.locator('iframe[title="Предпросмотр коммерческого предложения"]').getAttribute("srcdoc").catch(() => "")) ?? "";
  const img3 = /src="(data:image\/png;base64,[^"]+)"/.exec(doc3)?.[1] ?? "";
  if (img3) writeFileSync(join(out, "m7-kp-image-3d.png"), Buffer.from(img3.slice(22), "base64"));
  const kp3 = img3 ? await stats(img3, ref) : null;
  check("КП из вида 3D: створки закрыты", !!kp3 && kp3.back < 0.02, kp3 ? `задник ${pct(kp3.back)}` : "нет картинки");
  await page.getByRole("button", { name: "Закрыть окно" }).click().catch(async () => { await page.keyboard.press("Escape"); }); await page.waitForTimeout(400);
  check("нет 404 и ошибок страницы", !errors.length && !bad.length, [...errors, ...bad].join("; "));
  const failed = results.filter((r) => !r[1]);
  console.log(`ИТОГ: ${results.length - failed.length}/${results.length}`);
  if (failed.length) process.exitCode = 1;
} finally { await browser.close(); }
