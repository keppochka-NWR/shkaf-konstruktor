// Релиз 22.10, раунд 2 критика: K3–K6 мышью. npx tsx scripts/rel-fix-k36-scenario.ts <url /studio/> <outDir>
// K6: «Шкафы-купе → Шкаф-купе» 2400×2600×600, двери «отдельно» и «внутри шкафа» — оба добавляются; после добавления палитра
//     сохраняет «Установка дверей» и число дверей. K5: панель «Двери купе под ключ» = графа «Двери купе» в «Стоимости».
// K3/K4: кухня (ряд 3000) → КП: карточка столешницы «цена после финального расчёта конструктором», не «0 ₽»; сумма карточек = итог.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { initialModule } from "../src/model";
import { newProject, type Project } from "../src/project";
import { createKitchenRow } from "../src/ModulePalette";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const settle = async () => {
  for (let i = 0; i < 100; i++) { const n = await page.evaluate(() => (window as unknown as { __pending?: () => number }).__pending?.() ?? 0); if (n === 0) break; await page.waitForTimeout(150); }
  await page.waitForTimeout(600);
};
const shot = async (n: string) => { await settle(); await page.screenshot({ path: join(out, `k36-${n}.png`) }); };
const rub = (t: string) => Number(t.replace(/[^\d]/g, ""));
const fill = async (label: string, v: number) => { const f = page.getByLabel(label); await f.click({ clickCount: 3 }); await page.keyboard.type(String(v)); await page.keyboard.press("Tab"); };
try {
  await page.goto(url + "?fresh=1"); await page.waitForSelector("canvas"); await settle();
  await page.evaluate(() => { localStorage.setItem("studio-tip-rmb", "1"); });
  await page.getByRole("button", { name: "Понятно" }).click().catch(() => {});
  // если открыт шаг «Помещение» — к мебели
  await page.getByRole("button", { name: /Построение мебели/ }).first().click().catch(() => {}); await settle();
  await page.getByRole("tab", { name: "Шкафы-купе" }).click(); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Шкаф-купе" }).click(); await page.waitForTimeout(300);
  await fill("Ширина новой мебели", 2400); await fill("Высота новой мебели", 2600); await fill("Глубина новой мебели", 600);
  await page.getByLabel("Установка дверей купе").selectOption("free"); await page.waitForTimeout(200);
  await shot("01-kupe-free-form");
  await page.getByRole("button", { name: "Добавить в комнату" }).click(); await settle();
  const alert1 = (await page.locator(".module-palette [role=alert]").allInnerTexts()).join(" ");
  const list1 = await page.locator("body").innerText();
  check("K6: шкаф-купе 2600 «отдельно» добавлен (нет «250–2500»)", !/2500/.test(alert1) && /Корпус шкафа-купе/.test(list1), alert1.slice(0, 160));
  await shot("02-kupe-free-added");
  // палитра после добавления: «отдельно» и размеры сохранены; ставим «внутри шкафа» и 3 двери
  const mount1 = await page.getByLabel("Установка дверей купе").inputValue().catch(() => "");
  check("K6: после добавления «Установка дверей» не сброшена", mount1 === "free", mount1);
  // K5: выбрать двери купе в списке модулей, сравнить «под ключ» с графой «Двери купе» в «Стоимости»
  await page.locator(".module-list button, .module-list [role=button], .module-list > *", { hasText: /Двери купе/ }).last().click().catch(() => {}); await settle();
  let panel = 0;
  if (await page.locator(".kupe-total b").count()) panel = rub(await page.locator(".kupe-total b").first().innerText());
  await page.locator(".dock-tabs button", { hasText: "Стоимость" }).click(); await settle();
  const body = await page.locator("body").innerText();
  const kupeCard = /ДВЕРИ КУПЕ\s*\n?\s*([\d\s ]+₽)/i.exec(body)?.[1] ?? "";
  await shot("04-kupe-cost");
  check("K5: панель «Двери купе под ключ» = графа «Двери купе» сметы", panel > 0 && rub(kupeCard) === panel, `панель ${panel}, смета ${kupeCard.trim()}`);
  await page.locator(".dock-tabs button", { hasText: "Проект" }).click().catch(() => {}); await settle();
  await page.getByLabel("Установка дверей купе").selectOption("inside"); await page.waitForTimeout(200);
  const doorsSel = page.getByLabel("Дверей купе у новой мебели");
  const opts = await doorsSel.locator("option").allInnerTexts();
  const three = opts.some((o) => o.trim() === "3");
  if (three) await doorsSel.selectOption("3");
  // новый проект не нужен: второй шкаф ставим в ту же комнату (места может не хватить — проверяем только палитру и ошибку высоты)
  await page.getByRole("button", { name: "Добавить в комнату" }).click(); await settle();
  const alert2 = (await page.locator(".module-palette [role=alert]").allInnerTexts()).join(" ");
  check("K6: «внутри шкафа» 2600 — та же высота принимается", !/допустимо от 250 до 2500/.test(alert2), alert2.slice(0, 160));
  const mount2 = await page.getByLabel("Установка дверей купе").inputValue().catch(() => "");
  const doors2 = await doorsSel.inputValue().catch(() => "");
  check("K6: после добавления палитра хранит «внутри шкафа» и число дверей", mount2 === "inside" && (!three || doors2 === "3"), `установка ${mount2}, дверей ${doors2}`);
  await shot("03-kupe-inside-added");
  // K3/K4: кухня → КП
  // кухня мышью: новый проект, «Кухонные модули → Кухня прямая» 3000
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("studio-tip-rmb", "1"); });
  await page.goto(url + "?fresh=1"); await page.waitForSelector("canvas"); await settle();
  await page.getByRole("button", { name: "Понятно" }).click().catch(() => {});
  await page.getByRole("button", { name: /Построение мебели/ }).first().click().catch(() => {}); await settle();
  await page.getByRole("tab", { name: "Кухонные модули" }).click(); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Кухня прямая" }).click(); await page.waitForTimeout(300);
  await fill("Ширина новой мебели", 3000);
  await page.getByRole("button", { name: "Добавить в комнату" }).click(); await settle();
  await shot("05-kitchen-added");
  await page.locator(".dock-tabs button", { hasText: "Документы" }).click(); await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Коммерческое предложение", exact: true }).first().click(); await page.waitForTimeout(500);
  await settle(); await shot("05a-kp-form");
  const fillBtn = page.getByRole("button", { name: "Подставить текущую смету" });
  await fillBtn.waitFor({ timeout: 15000 }).catch(() => console.log("нет кнопки «Подставить текущую смету»"));
  await fillBtn.click().catch((e) => console.log("клик: " + (e as Error).message.slice(0, 120))); await settle(); await shot("05b-kp-filled");
  await page.getByRole("button", { name: "Предпросмотр КП" }).click(); await settle();
  const doc = (await page.locator('iframe[title="Предпросмотр коммерческого предложения"]').getAttribute("srcdoc").catch(() => "")) ?? "";
  writeFileSync(join(out, "k36-kp.html"), doc);
  const prices = [...doc.matchAll(/class="q-price">([\d\s ]+)₽</g)].map((m) => rub(m[1]));
  const total = rub(/<tr><td>Итого<\/td><td>([^<]+)<\/td>/.exec(doc)?.[1] ?? /Стоимость: ([^<]+)</.exec(doc)?.[1] ?? "");
  await page.locator('iframe[title="Предпросмотр коммерческого предложения"]').scrollIntoViewIfNeeded().catch(() => {});
  await shot("05-kp-kitchen");
  check("K3: карточка столешницы — «цена после финального расчёта конструктором», нет «0 ₽»", doc.includes("цена после финального расчёта конструктором") && !/class="q-price">0 ₽/.test(doc));
  check("K4: сумма карточек = итог КП", prices.length > 0 && prices.reduce((s, v) => s + v, 0) === total, `${prices.join(" + ")} = ${total}`);
  check("нет ошибок страницы", !errors.length, errors.join("; "));
  const failed = results.filter((r) => !r[1]);
  console.log(`ИТОГ: ${results.length - failed.length}/${results.length}`);
  writeFileSync(join(out, "k36-scenario.json"), JSON.stringify(results, null, 1));
  if (failed.length) process.exitCode = 1;
} finally { await browser.close(); }
