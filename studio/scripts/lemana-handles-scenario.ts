// Ручки Лемана мышью (задача Макса 22.10.2026 «визуализация лемановских ручек»): npx tsx scripts/lemana-handles-scenario.ts <url> <outDir>
// Навесной кухонный 600 → «Ручки фасадов» → окно: превью каждой ручки (процедурная модель) → раздел «Лемана Про» прокруткой колеса →
// выбрать 4 разные (дуговая бронза, двухцветная, рейлинг, профиль) → каждый раз крупный план ручки на фасаде (сдвиг Shift+ЛКМ, колесо, поворот).
// Сетка «все ручки Лемана» собирается из превью, которые окно показало клиенту (src картинок окна).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { initialModule } from "../src/model";
import { kitchenWall } from "../src/kitchen";
import { newProject } from "../src/project";
import { HANDLES, handleShape, HANDLE_SHAPE_LABELS } from "../src/handles";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const shot = (n: string, clip?: { x: number; y: number; width: number; height: number }) => page.screenshot({ path: `${out}/${n}.png`, ...(clip ? { clip } : {}) });
const HANDLE_BTN = /^Ручк(а|и фасадов):/;
const canvasBox = async () => (await page.locator("canvas").first().boundingBox())!;

/** Фасад на снимке (вид «Спереди»): светлая заливка у центра холста; ручка — пиксели внутри фасада, заметно отличные от его цвета. */
async function findHandle(win?: { x0: number; y0: number; x1: number; y1: number }) {
  const b64 = (await page.screenshot()).toString("base64"), c = await canvasBox();
  return page.evaluate(`(async () => {
    const img = new Image(); img.src = "data:image/png;base64,${b64}"; await img.decode();
    const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height; const g = cv.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data, at = function (x, y) { const i = (y * img.width + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const cx = ${Math.round(c.x + c.width / 2)}, cy = ${Math.round(c.y + c.height / 2)}, ref = at(cx, cy);
    const near = function (p) { return Math.abs(p[0] - ref[0]) + Math.abs(p[1] - ref[1]) + Math.abs(p[2] - ref[2]) < 24; };
    let x0 = cx, x1 = cx, y0 = cy, y1 = cy;
    [cy, cy - 140].forEach(function (ry) { let a0 = cx, a1 = cx; while (a0 > 0 && near(at(a0 - 1, ry))) a0--; while (a1 < img.width - 1 && near(at(a1 + 1, ry))) a1++; if (a0 < x0) x0 = a0; if (a1 > x1) x1 = a1; }); // две строки: ручка у кромки не обрывает скан
    while (y0 > 0 && near(at(cx, y0 - 1))) y0--; while (y1 < img.height - 1 && near(at(cx, y1 + 1))) y1++;
    let a = 1e9, b = 1e9, e = -1, f = -1, n = 0; const xs = [], ys = [];
    const W = ${JSON.stringify(win ?? null)}; const sy0 = W ? Math.max(y0 + 4, W.y0) : y0 + 4, sy1 = W ? Math.min(y1 - 3, W.y1) : y1 - 3, sx0 = W ? Math.max(x0 + 4, W.x0) : x0 + 4, sx1 = W ? Math.min(x1 - 3, W.x1) : x1 - 3;
    for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) { const p = at(x, y); if (Math.abs(p[0] - ref[0]) + Math.abs(p[1] - ref[1]) + Math.abs(p[2] - ref[2]) > 45) { n++; xs.push(x); ys.push(y); if (x < a) a = x; if (y < b) b = y; if (x > e) e = x; if (y > f) f = y; } }
    return { door: { x0: x0, y0: y0, x1: x1, y1: y1 }, handle: e < 0 ? null : { x0: a, y0: b, x1: e, y1: f, n: n, mx: xs.sort(function (p, q) { return p - q; })[xs.length >> 1], my: ys.sort(function (p, q) { return p - q; })[ys.length >> 1] } };
  })()`) as Promise<{ door: { x0: number; y0: number; x1: number; y1: number }; handle: { x0: number; y0: number; x1: number; y1: number; n: number; mx: number; my: number } | null }>;
}
async function frontView() {
  await page.getByRole("button", { name: "Спереди", exact: true }).click().catch(() => {});
  await page.waitForTimeout(900);
}
async function openHandles() {
  const btn = page.getByRole("button", { name: HANDLE_BTN }).first();
  if (!(await btn.isVisible().catch(() => false))) { // панель навесного кухонного: «Фасады и открывание» › «Ручки» › «Ручка: …»
    const cat = page.locator('details[data-settings-category="Фасады и открывание"]');
    if ((await cat.getAttribute("open")) === null) { await cat.locator("summary").first().click(); await page.waitForTimeout(300); }
    if (!(await btn.isVisible().catch(() => false))) { await cat.getByText("Ручки", { exact: true }).first().click(); await page.waitForTimeout(300); }
  }
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  await btn.click();
  await page.locator(".handle-list").waitFor();
}
/** Довести мышью раздел «Лемана Про» до кнопки ручки (колесо над списком) и нажать её. */
async function pickLemana(label: string) {
  await openHandles();
  const list = page.locator(".handle-list"), lb = (await list.boundingBox())!, item = page.locator(".handle-item").filter({ hasText: label }).first();
  await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2);
  for (let k = 0; k < 40; k++) {
    const ib = await item.boundingBox();
    if (ib && ib.y > lb.y + 4 && ib.y + ib.height < lb.y + lb.height - 4) break;
    await page.mouse.wheel(0, ib && ib.y < lb.y ? -120 : 120); await page.waitForTimeout(80);
  }
  await item.click();
  await page.locator(".handle-list").waitFor({ state: "detached" }).catch(() => {});
  await page.waitForTimeout(1200);
}
/** Сдвинуть точку экрана (x, y) в центр холста: Shift+ЛКМ — сдвиг камеры. */
async function panTo(x: number, y: number) {
  const c = await canvasBox(), mx = c.x + c.width / 2, my = c.y + c.height / 2;
  await page.mouse.move(x, y); await page.keyboard.down("Shift"); await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(x + (mx - x) * i / 20, y + (my - y) * i / 20);
  await page.mouse.up(); await page.keyboard.up("Shift"); await page.waitForTimeout(500);
  return { mx, my };
}
/** Крупный план: сброс вида → ручку в центр (Shift+ЛКМ) → колесо ближе → снимок спереди → поворот ЛКМ на три четверти → снова в центр → снимок. */
async function closeUp(name: string, label: string) {
  await frontView();
  await page.getByRole("button", { name: "Свободная камера" }).click().catch(() => {}); // ЛКМ — поворот камеры, а не перенос корпуса
  const fit = page.getByRole("button", { name: "Приблизить выбранный корпус" });
  if ((await fit.getAttribute("aria-pressed")) !== "true") await fit.click(); else { await fit.click(); await page.waitForTimeout(300); await fit.click(); }
  await page.waitForTimeout(1500);
  const f1 = await findHandle();
  check(`${label}: ручка видна на фасаде (вид спереди)`, !!f1.handle && f1.handle.n > 30, JSON.stringify(f1.handle));
  if (!f1.handle) { await shot(name + "-notfound"); return; }
  const { mx, my } = await panTo(f1.handle.mx, f1.handle.my); // медиана отличных от фасада пикселей
  for (let k = 0; k < 13; k++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(70); }
  await page.waitForTimeout(1000);
  const clip = { x: mx - 300, y: my - 170, width: 600, height: 380 };
  await shot(`${name}-front`, clip);
  // три четверти: снова общий вид, поворот ЛКМ на небольшой угол, ручка — рядом с прежним местом (окно поиска), в центр, ближе
  await frontView();
  if ((await fit.getAttribute("aria-pressed")) === "true") { await fit.click(); await page.waitForTimeout(300); } await fit.click(); await page.waitForTimeout(1500);
  await page.mouse.move(mx, my + 150); await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(mx + 45 * i / 20, my + 150 - 12 * i / 20);
  await page.mouse.up(); await page.waitForTimeout(1000);
  const h1 = f1.handle, f2 = await findHandle({ x0: h1.x0 - 50, x1: h1.x1 + 50, y0: h1.y0 - 30, y1: h1.y1 + 30 });
  check(`${label}: ручка видна на фасаде (вид на три четверти)`, !!f2.handle && f2.handle.n > 30, JSON.stringify(f2.handle));
  if (!f2.handle) return;
  await panTo(f2.handle.mx, f2.handle.my);
  for (let k = 0; k < 13; k++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(70); }
  await page.waitForTimeout(1000);
  await shot(`${name}-3q`, clip);
}
try {
  const p = newProject();
  const m = kitchenWall(initialModule(), 600); m.sections[0].hingeSide = "left";
  p.modules = [{ id: "w", x: 1000, y: 1400, z: 3, rotation: 0, module: m }];
  await page.goto(url);
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "facades"); localStorage.setItem("studio-dock", "project"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(p));
  await page.goto(url); await page.waitForSelector("canvas"); await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Понятно" }).click().catch(() => {});
  for (const name of ["Показать помещение", "Показать размеры"]) { const b = page.getByRole("button", { name }); if (await b.count() && (await b.first().getAttribute("aria-pressed")) === "true") await b.first().click(); }
  await frontView();
  await shot("00-start");

  // 1. окно ручек: превью у каждой ручки
  await openHandles();
  await page.waitForFunction((n) => document.querySelectorAll(".handle-list img.handle-thumb").length >= n, HANDLES.length, { timeout: 60000 }).catch(() => {});
  const thumbs = await page.locator(".handle-list img.handle-thumb").count(), bars = await page.locator(".handle-list .handle-bar").count();
  check("окно ручек: у каждой ручки превью процедурной модели", thumbs === HANDLES.length && bars === 0, `превью ${thumbs} из ${HANDLES.length}, заглушек ${bars}`);
  const sizes = await page.locator(".handle-list img.handle-thumb").evaluateAll((els) => els.map((e) => (e as HTMLImageElement).naturalWidth));
  check("превью отрисованы (220×88)", sizes.every((w) => w === 220), sizes.slice(0, 5).join(","));
  const modal = page.locator(".handle-list").locator("xpath=ancestor::*[contains(@class,'modal')][1]");
  const mb = (await modal.count()) ? await modal.boundingBox() : await page.locator(".handle-list").boundingBox();
  await shot("01-window-workshop", mb ?? undefined);
  // прокрутка колесом до раздела Лемана, кадры списка
  const list = page.locator(".handle-list"), lb = (await list.boundingBox())!;
  await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2);
  for (let k = 0; k < 30; k++) { const hb = await page.locator(".handle-list h3").nth(1).boundingBox(); if (hb && hb.y < lb.y + 40) break; await page.mouse.wheel(0, 120); await page.waitForTimeout(60); }
  await page.waitForTimeout(300);
  await shot("02-window-lemana-1", mb ?? undefined);
  for (let k = 0; k < 4; k++) { await page.mouse.wheel(0, 360); await page.waitForTimeout(300); await shot(`02-window-lemana-${k + 2}`, mb ?? undefined); }
  // сетка «все ручки Лемана» — из превью окна
  const grid = await page.locator(".handle-list .handle-item").evaluateAll((els) => els.map((e) => ({ src: (e.querySelector("img.handle-thumb") as HTMLImageElement | null)?.src ?? "", name: e.querySelector(".handle-name")?.firstChild?.textContent ?? "", form: e.querySelector(".handle-form")?.textContent ?? "", meta: e.querySelector(".handle-meta")?.textContent ?? "" })));
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  const lemanaLabels = new Set(HANDLES.filter((h) => h.vendor === "lemana").map((h) => h.label));
  const lem = grid.filter((g) => lemanaLabels.has(g.name.trim()));
  check("сетка: все ручки Лемана с превью", lem.length === lemanaLabels.size && lem.every((g) => g.src.startsWith("data:image/png")), `${lem.length} из ${lemanaLabels.size}`);
  const sheet = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await sheet.setContent(`<html><body style="margin:0;padding:16px;font:12px system-ui;background:#fff"><h2 style="margin:0 0 10px;font-size:16px">Ручки Лемана Про — превью из окна выбора (процедурная 3D-модель студии), ${lem.length} шт.</h2><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px">${lem.map((g) => `<div style="border:1px solid #e3e7ec;border-radius:8px;padding:6px"><img src="${g.src}" style="width:100%;background:#f4f6f8;border-radius:6px"><div style="font-weight:600;margin-top:4px">${g.name}</div><div style="color:#6b7280">${g.form} · ${g.meta}</div></div>`).join("")}</div></body></html>`);
  await sheet.screenshot({ path: `${out}/03-grid-lemana-all.png`, fullPage: true });
  const ws = grid.filter((g) => !lemanaLabels.has(g.name.trim()));
  await sheet.setContent(`<html><body style="margin:0;padding:16px;font:12px system-ui;background:#fff"><h2 style="margin:0 0 10px;font-size:16px">Ручки цеха — превью, ${ws.length} шт.</h2><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px">${ws.map((g) => `<div style="border:1px solid #e3e7ec;border-radius:8px;padding:6px"><img src="${g.src}" style="width:100%;background:#f4f6f8;border-radius:6px"><div style="font-weight:600;margin-top:4px">${g.name}</div><div style="color:#6b7280">${g.form} · ${g.meta}</div></div>`).join("")}</div></body></html>`);
  await sheet.screenshot({ path: `${out}/03-grid-workshop.png`, fullPage: true });
  await sheet.close();

  // 2. четыре разные ручки Лемана на фасаде, крупно
  const picks: [string, string][] = [
    ["04-arch-bronze", "Эра Ницца · 96 · старая бронза"],
    ["05-two-tone", "KONSENSA Виви · 128 · белая/хром"],
    ["06-rail-chrome", "Рейлинг KONSENSA · 400 · хром"],
    ["07-profile-black", "Профиль · 224 · матовый чёрный"],
    ["08-wood", "Colaptes · 96 · дерево"],
  ];
  for (const [name, label] of picks) {
    await pickLemana(label);
    const btnText = (await page.getByRole("button", { name: HANDLE_BTN }).first().innerText()).replace(/\s+/g, " ");
    const h = HANDLES.find((x) => x.label === label)!;
    check(`${label}: выбрана (${HANDLE_SHAPE_LABELS[handleShape(h)]})`, btnText.includes(label), btnText);
    await closeUp(name, label);
  }
  console.log("ошибки страницы: " + (errors.length ? errors.join("; ") : "нет"));
  const bad = results.filter((r) => !r[1]);
  console.log(`ИТОГ: ${results.length - bad.length}/${results.length}`);
  if (bad.length) process.exitCode = 1;
} finally { await browser.close(); }
