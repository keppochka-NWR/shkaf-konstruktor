// Сценарий мышью «как менеджер» (волна 22.10, ветка w-docs): npx tsx scripts/w-docs-scenario.ts <url /studio/> <outDir>
// Шкаф → «Стоимость» → «Стоимость проекта» → «Скачать Excel» (файл сохранён, открыт LibreOffice, прочитан: итог = цене на экране)
// → КП (предпросмотр, снимок, PDF A4) → нижняя панель «Фурнитура» → окно → петли Blum → цена изменилась → снимки.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const settle = async () => {
  for (let i = 0; i < 100; i++) { const n = await page.evaluate(() => (window as unknown as { __pending?: () => number }).__pending?.() ?? 0); if (n === 0) break; await page.waitForTimeout(150); }
  await page.waitForTimeout(600);
};
const shot = async (n: string) => { await settle(); await page.screenshot({ path: join(out, `w-docs-${n}.png`) }); };
const money = (s: string | null | undefined) => Number(String(s ?? "").replace(/[^\d]/g, ""));
const SOFFICE = ["C:\\Program Files\\LibreOffice\\program\\soffice.exe", "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe"].find(existsSync);
try {
  await page.goto(url);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("studio-tip-rmb", "1"); });
  await page.goto(url); await page.waitForSelector("canvas"); await settle();
  await page.getByRole("button", { name: "Понятно" }).click().catch(() => {});
  await shot("00-start");
  // шкаф для одежды и комод из палитры (двери с петлями и ящики с направляющими — для окна «Фурнитура»)
  for (const tile of ["Для одежды", "Комод"]) {
    await page.locator("button", { hasText: tile }).first().click(); await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Добавить в комнату" }).first().click(); await settle();
  }
  check("в комнате два изделия", (await page.locator(".dock-tabs button", { hasText: "Стоимость" }).count()) === 1);
  await shot("00b-furniture");
  // 1. Стоимость → Скачать Excel
  await page.locator(".dock-tabs button", { hasText: "Стоимость" }).click(); await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Стоимость проекта" }).click(); await page.waitForTimeout(500);
  const shown = money(await page.locator(".sales-total").textContent());
  check("«Стоимость»: итог на экране", shown > 0, shown.toLocaleString("ru-RU") + " ₽");
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), page.getByRole("button", { name: "Скачать Excel" }).click()]);
  const xlsx = join(out, "Смета проекта.xlsx"); await dl.saveAs(xlsx);
  const buf = readFileSync(xlsx);
  check("файл .xlsx скачан (zip)", dl.suggestedFilename() === "Смета проекта.xlsx" && buf[0] === 0x50 && buf[1] === 0x4b, dl.suggestedFilename() + ", " + buf.length + " байт");
  await shot("01-estimate-excel");
  if (SOFFICE) {
    const csvDir = join(out, "xlsx-csv"); mkdirSync(csvDir, { recursive: true });
    execFileSync(SOFFICE, ["--headless", "--norestore", "--convert-to", "csv:Text - txt - csv (StarCalc):59,34,76,1,,1049,false,true,false,false,false,-1", "--outdir", csvDir, xlsx], { stdio: "pipe", timeout: 120000 });
    const csvs = readdirSync(csvDir).filter((f) => f.endsWith(".csv"));
    const rows = (f: string) => readFileSync(join(csvDir, f), "utf8").split(/\r?\n/).map((r) => r.split(";").map((c) => c.replace(/^"|"$/g, "")));
    const smeta = csvs.find((f) => f.endsWith("-Смета.csv")), brief = csvs.find((f) => f.endsWith("-Кратко для клиента.csv"));
    const total = smeta ? rows(smeta).find((r) => r[1] === "Расчётная цена")?.[5] : undefined, itog = brief ? rows(brief).find((r) => r[1] === "Итого")?.slice(2).find((c) => /\d/.test(c)) : undefined;
    check("LibreOffice открыл книгу: 3 листа", csvs.length === 3, csvs.join(", "));
    check("«Смета»: расчётная цена = цене на экране", money(total) === shown, String(total));
    check("«Кратко для клиента»: итог = цене на экране", money(itog) === shown, String(itog));
    const text = csvs.map((f) => readFileSync(join(csvDir, f), "utf8")).join("\n");
    check("в публичной сборке — без закупки и коэффициента", !/закупка|Себестоимость|Коэффициент/.test(text));
    writeFileSync(join(out, "xlsx-прочитано.txt"), csvs.map((f) => "=== " + f + "\n" + readFileSync(join(csvDir, f), "utf8")).join("\n\n"));
    try { execFileSync(SOFFICE, ["--headless", "--norestore", "--convert-to", "pdf", "--outdir", out, xlsx], { stdio: "pipe", timeout: 120000 }); } catch { /* PDF — для глаз, не обязателен */ }
  } else check("LibreOffice установлен", false);
  // 2. КП: предпросмотр, полный снимок и PDF A4
  await page.getByRole("button", { name: "Коммерческое предложение", exact: true }).first().click(); await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Подставить текущую смету" }).click().catch(() => {}); await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Предпросмотр КП" }).click(); await settle();
  const frame = page.locator('iframe[title="Предпросмотр коммерческого предложения"]');
  check("КП: предпросмотр открыт", (await frame.count()) === 1);
  check("КП: переключатель «Цены по изделиям» включён по умолчанию", await page.getByLabel("Цены по изделиям в КП").isChecked());
  await frame.scrollIntoViewIfNeeded(); await shot("02-kp-preview");
  const doc = (await frame.getAttribute("srcdoc")) ?? "";
  writeFileSync(join(out, "КП.html"), doc);
  check("КП: карточки изделий, миниатюра, образцы, цена изделия, «входит / не входит»", doc.includes('class="q-item"') && doc.includes('<div class="q-thumb"><svg') && doc.includes('class="sw"') && doc.includes('class="q-price"') && doc.includes("Не входит"));
  check("КП: без закупки", !/закуп|Себестоимость|коэффициент/i.test(doc));
  const kp = await ctx.newPage(); await kp.setViewportSize({ width: 900, height: 1200 }); await kp.setContent(doc, { waitUntil: "load" });
  await kp.screenshot({ path: join(out, "w-docs-03-kp-full.png"), fullPage: true });
  await kp.emulateMedia({ media: "print" }); await kp.pdf({ path: join(out, "КП.pdf"), format: "A4", printBackground: true }); await kp.close();
  await page.getByRole("button", { name: "Закрыть окно" }).click().catch(async () => { await page.keyboard.press("Escape"); }); await page.waitForTimeout(400);
  // 3. Окно «Фурнитура»: петли Blum → цена изменилась
  await page.locator(".dock-tabs button", { hasText: "Фурнитура" }).click(); await page.waitForTimeout(400);
  await shot("04-dock-hardware");
  const before = money(await page.locator(".dock-price b").textContent());
  await page.getByRole("button", { name: "Выбрать фурнитуру…" }).click();
  const win = page.getByRole("dialog", { name: "Фурнитура" });
  check("окно «Фурнитура» открыто", await win.isVisible());
  for (let i = 0; i < 40 && (await win.getByText("считаем…").count()); i++) await page.waitForTimeout(200);
  const blum = win.getByRole("button", { name: "Петли Blum" });
  const delta = await blum.locator(".hw-price").textContent();
  check("у варианта — розничная разница «+N ₽ к заказу»", /^\+[\d\s]+ ₽ к заказу$/.test((delta ?? "").replace(/\u00a0/g, " ")), String(delta));
  check("текущий выбор отмечен (GTV)", (await win.getByRole("button", { name: "Петли GTV" }).getAttribute("aria-pressed")) === "true");
  await shot("05-hardware-window");
  await blum.click(); await settle();
  const note = await win.locator(".hw-note").textContent();
  const after = money(await page.locator(".dock-price b").textContent());
  check("петли Blum применены: цена выросла на столько, сколько обещано", after > before && after - before === money(delta), `${before} → ${after}; ${note}`);
  check("теперь отмечен Blum", (await blum.getAttribute("aria-pressed")) === "true");
  await shot("06-hardware-blum");
  await win.getByRole("button", { name: "Направляющие" }).count() && await win.getByRole("button", { name: "Ручки" }).click();
  for (let i = 0; i < 60 && (await win.getByText("считаем…").count()); i++) await page.waitForTimeout(200);
  await shot("07-hardware-handles");
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  check("окно закрывается по Esc", !(await win.count()));
  console.log("ошибки страницы: " + (errors.length ? errors.join("; ") : "нет"));
  const bad = results.filter((r) => !r[1]);
  console.log(`ИТОГ: ${results.length - bad.length}/${results.length}`);
  if (bad.length || errors.length) process.exitCode = 1;
} finally { await browser.close(); }
