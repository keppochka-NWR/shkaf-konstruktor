// Релиз 22.10, B1 + B2 на публичной сборке: npx tsx scripts/rel-fix-b12-scenario.ts <url /studio/> <outDir>
// Комната 2400 × 3000: «Модуль 1» 1200 (2 ящика, подсветка в стойках) и «Пустой шкаф» 1158 с торцевыми ручками HEXA L-1200.
// B2: в проверке нет «Фасад × Ручка», пара торцевых ручек — понятное сообщение про зазор между створками.
// B1: «Документы → Стоимость → Скачать Excel» мышью; в «Смете» сумма строк (с «Округлением») = «Итого по позициям» = «Расчётная цена»
// = итог на экране = итог КП; «Разбивка» = подытоги групп; «Кратко для клиента» — строки изделий, сумма = итог.
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "three/addons/libs/fflate.module.js";
import { initialModule, section, type Module } from "../src/model";
import { withDoorCount } from "../src/paletteDoors";
import { setAllStands } from "../src/lights";
import { newProject, type Project } from "../src/project";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const project = (): Project => {
  const p = newProject();
  p.room = { ...p.room, width: 2400, depth: 3000, height: 2700 };
  p.offer = { customer: "Тест B1", price: "", notes: "" };
  let empty: Module = { ...initialModule(), name: "Пустой шкаф", width: 1158, height: 2400, depth: 550, sections: [section()] };
  empty = withDoorCount(empty, 2); empty.handleId = "hexa1200a";
  const m1: Module = { ...initialModule(), name: "Модуль 1", width: 1200, height: 2400, depth: 550 };
  m1.sections = m1.sections.map((s, i) => (i === 0 ? { ...s, drawers: 2 } : s)); setAllStands(m1, true);
  p.modules = [{ id: "a", x: 0, y: 0, z: 30, rotation: 0, module: m1 }, { id: "b", x: 1221, y: 0, z: 30, rotation: 0, module: empty }];
  return p;
};
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors: string[] = [], bad: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => { if (r.status() >= 400) bad.push(r.status() + " " + r.url()); });
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const settle = async () => {
  for (let i = 0; i < 100; i++) { const n = await page.evaluate(() => (window as unknown as { __pending?: () => number }).__pending?.() ?? 0); if (n === 0) break; await page.waitForTimeout(150); }
  await page.waitForTimeout(600);
};
const shot = async (n: string) => { await settle(); await page.screenshot({ path: join(out, `b12-${n}.png`) }); };
const rub = (t: string) => Number(t.replace(/[^\d]/g, ""));
/** ячейки листа: адрес → {v, f, text} */
function cells(x: string) {
  const outm = new Map<string, { v?: number; f?: string; text?: string }>();
  for (const m of x.matchAll(/<c r="([A-Z]+\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const body = m[2] ?? "", v = /<v>([^<]*)<\/v>/.exec(body)?.[1], f = /<f>([^<]*)<\/f>/.exec(body)?.[1], t = /<t[^>]*>([^<]*)<\/t>/.exec(body)?.[1];
    outm.set(m[1], { ...(v !== undefined ? { v: Number(v) } : {}), ...(f !== undefined ? { f } : {}), ...(t !== undefined ? { text: t } : {}) });
  }
  return outm;
}
try {
  await page.goto(url);
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "bodies"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(project()));
  await page.goto(url); await page.waitForSelector("canvas"); await settle();
  await page.getByRole("button", { name: "Понятно" }).click().catch(() => {});
  await page.locator(".view-tabs button", { hasText: "Спереди" }).first().click(); await settle();
  // B2: выбрать «Пустой шкаф» мышью в списке модулей и открыть проверку
  await page.getByText("Пустой шкаф", { exact: true }).first().click(); await settle();
  await shot("01-b2-selected");
  const text = await page.locator("body").innerText();
  check("B2: нет ложного «Фасад × Ручка»", !/Фасад[^\n]{0,40}×[^\n]{0,40}Ручка|Ручка[^\n]{0,40}×[^\n]{0,40}Фасад/.test(text), (/[^\n]*×[^\n]*Ручк[^\n]*/.exec(text)?.[0] ?? "").slice(0, 160));
  const check1 = page.getByText(/Проверить расстановку/).first();
  if (await check1.count()) { await check1.click(); await settle(); }
  const t2 = await page.locator("body").innerText();
  await shot("02-b2-check");
  check("B2: пара торцевых ручек — понятное сообщение про зазор/кромки", /торцев[^\n]*(зазор|кромк)/i.test(t2), (/[^\n]*торцев[^\n]*/i.exec(t2)?.[0] ?? "нет").slice(0, 220));
  check("B2: нет «Ручка × Ручка» в общем списке «сдвиньте полку или петлю»", !/Ручка[^\n]{0,30}×[^\n]{0,30}Ручка/.test(t2));
  await page.keyboard.press("Escape"); await settle();
  // экран: итог в нижней строке
  const screen = rub(await page.locator(".dock-price").first().innerText());
  // КП: итог
  await page.locator(".dock-tabs button", { hasText: "Документы" }).click(); await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Коммерческое предложение", exact: true }).first().click(); await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Подставить текущую смету" }).click().catch(() => {}); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Предпросмотр КП" }).click(); await settle();
  const doc = (await page.locator('iframe[title="Предпросмотр коммерческого предложения"]').getAttribute("srcdoc").catch(() => "")) ?? "";
  const kpTotal = rub(/<tr><td>Итого<\/td><td>([^<]+)<\/td>/.exec(doc)?.[1] ?? /Стоимость: ([^<]+)</.exec(doc)?.[1] ?? "");
  const kpItems = [...doc.matchAll(/class="q-price">([^<]+)</g)].map((m) => rub(m[1]));
  await shot("03-kp");
  await page.getByRole("button", { name: "Закрыть окно" }).click().catch(async () => { await page.keyboard.press("Escape"); }); await page.waitForTimeout(400);
  // B1: Excel из окна «Стоимость»
  await page.locator(".dock-tabs button", { hasText: "Документы" }).click(); await page.waitForTimeout(500);
  await page.getByRole("dialog").getByRole("button", { name: "Стоимость", exact: true }).first().click(); await page.waitForTimeout(500);
  await shot("04-cost");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("dialog").getByRole("button", { name: "Скачать Excel" }).click()]);
  const file = join(out, "b12-smeta.xlsx"); await dl.saveAs(file);
  const z = unzipSync(new Uint8Array(readFileSync(file)));
  const c1 = cells(strFromU8(z["xl/worksheets/sheet1.xml"])), c3 = cells(strFromU8(z["xl/worksheets/sheet3.xml"]));
  const rowOf = (c: typeof c1, label: string) => [...c].find(([k, v]) => k.startsWith("B") && v.text === label)?.[0].slice(1);
  const F = (r?: string) => (r ? c1.get("F" + r)?.v ?? NaN : NaN);
  const lines = [...c1].filter(([k, v]) => /^F\d+$/.test(k) && /^C\d+\*E\d+$/.test(v.f ?? "")).reduce((s, [, v]) => s + (v.v ?? 0), 0);
  const rounding = [...c1].filter(([k, v]) => k.startsWith("B") && v.text === "Округление до итога сметы").reduce((s, [k]) => s + F(k.slice(1)), 0);
  const items = F(rowOf(c1, "Итого по позициям")), price = F(rowOf(c1, "Расчётная цена"));
  const priceNote = c1.get("G" + rowOf(c1, "Расчётная цена"))?.text ?? "";
  const sub = (g: string) => F(rowOf(c1, `Итого «${g}»`)) || 0;
  const sm = F(rowOf(c1, "Разбивка: Материалы")), sh = F(rowOf(c1, "Разбивка: Фурнитура"));
  writeFileSync(join(out, "b12-numbers.json"), JSON.stringify({ screen, kpTotal, kpItems, lines, rounding, items, price, priceNote, mat: sub("Материалы"), work: sub("Работа цеха"), hw: sub("Фурнитура"), sm, sh }, null, 1));
  check("B1: сумма строк + «Округление» = «Итого по позициям» = «Расчётная цена»", Math.abs(lines + rounding - price) < 0.01 && Math.abs(items - price) < 0.01, `строки ${lines.toFixed(2)} + округление ${rounding.toFixed(2)}; итого ${items}; цена ${price}`);
  check("B1: «Расчётная цена» = итог на экране = итог КП", price === screen && price === kpTotal, `Excel ${price}, экран ${screen}, КП ${kpTotal}`);
  check("B1: подпись «округлён до 100 ₽» только если итог кратен 100", !priceNote.includes("до 100") || price % 100 === 0, priceNote);
  check("B1: «Разбивка: Материалы» = «Материалы» + «Работа цеха», «Фурнитура» = группа", Math.abs(sm - sub("Материалы") - sub("Работа цеха")) < 0.01 && Math.abs(sh - sub("Фурнитура")) < 0.01, `${sm} = ${sub("Материалы")} + ${sub("Работа цеха")}; ${sh} = ${sub("Фурнитура")}`);
  const goods = [...c3].filter(([k, v]) => /^A\d+$/.test(k) && v.v !== undefined && Number(k.slice(1)) > 4);
  const goodsSum = goods.reduce((s, [k]) => s + (c3.get("F" + k.slice(1))?.v ?? 0), 0);
  const rowsXml = strFromU8(z["xl/worksheets/sheet3.xml"]);
  check("m8: «Кратко для клиента» — строки изделий с ценой и высотой, сумма = итог", goods.length === 2 && goodsSum === price && /<row r="5" ht="\d+/.test(rowsXml), `${goods.length} изделия, сумма ${goodsSum}`);
  check("КП: цены изделий в сумме = итог", kpItems.length === 2 && kpItems.reduce((s, v) => s + v, 0) === kpTotal, kpItems.join(" + "));
  check("нет 404 и ошибок страницы", !errors.length && !bad.length, [...errors, ...bad].join("; "));
  const failed = results.filter((r) => !r[1]);
  console.log(`ИТОГ: ${results.length - failed.length}/${results.length}`);
  writeFileSync(join(out, "b12-scenario.json"), JSON.stringify(results, null, 1));
  if (failed.length) process.exitCode = 1;
} finally { await browser.close(); }
