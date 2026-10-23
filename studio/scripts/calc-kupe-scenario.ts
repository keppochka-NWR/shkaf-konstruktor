/** Калькулятор купе на сайте (web/calc = v2.10/2.11 после bake-calc-kupe.ts) мышью и клавиатурой, как менеджер.
 *  npx tsx scripts/calc-kupe-scenario.ts <origin с папкой web> <папка снимков> [--before]
 *  1) проём 1500 × «1300+1300» (сумма в поле, v2.11) → 2 двери → Стандарт, Серебро, зеркало → доводчик → «Рассчитать стоимость»:
 *     итог 44 747 ₽ = студия, ширина дверей 763 мм с нахлёстом 27 мм, строки спецификации = итог, без лишней прокрутки, Golos Text;
 *  2) КП: поля клиента → «Сформировать КП» → ширина дверей и итог в КП → «Печать / PDF» (window.print) → PDF листа A4;
 *  3) GRACE (подвесная) 1600 × 2600: без нижней направляющей, комплект подвесной фурнитуры, итог 102 026 ₽ = студия.
 *  --before: только шаг 1 на старой копии (v2.5) — снимок «до». Код 1, если проверка не прошла. */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2), before = args.includes("--before");
const [origin, out] = args.filter((a) => a !== "--before");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [], dialogs: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => { dialogs.push(d.message().slice(0, 140)); void d.accept(); });
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const pfx = before ? "before-" : "";
const shot = async (n: string) => { await page.waitForTimeout(400); await page.screenshot({ path: `${out}/${pfx}${n}.png` }); };
const rub = (s: string) => Number(s.replace(/\D/g, ""));
const field = async (sel: string, text: string) => { await page.locator(sel).click({ clickCount: 3 }); await page.keyboard.type(text); await page.keyboard.press("Tab"); };
/** Нативный список: клик (фокус) и выбор клавиатурой по видимому тексту варианта. */
const choose = async (sel: string, label: string) => {
  const opts = await page.locator(sel + " option").allTextContents(), cur = await page.locator(sel).evaluate((e) => (e as HTMLSelectElement).selectedIndex);
  const want = opts.findIndex((o) => o.trim() === label);
  if (want < 0) throw new Error(`в списке ${sel} нет «${label}»: ${opts.join(" | ")}`);
  await page.locator(sel).focus();
  for (let i = cur; i !== want; i += want > cur ? 1 : -1) await page.keyboard.press(want > cur ? "ArrowDown" : "ArrowUp");
  await page.waitForTimeout(300);
};
const spec = async () => {
  const rows = await page.locator("#resultContent .kupe-spec-list .kupe-spec-row").allInnerTexts();
  return rows.map((r) => r.replace(/\s+/g, " ").trim());
};
try {
  // шрифты Google — с сетью; если сети нет, страница всё равно работает на своих файлах
  await page.goto(origin + "/calc/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#width"); await page.waitForTimeout(1200);
  await shot("c01-start");
  // ── 1. проём → результат
  await field("#width", "1500");
  await field("#height", before ? "2600" : "1300+1300");
  if (!before) check("сумма в поле высоты: 1300+1300 → 2600", (await page.locator("#height").inputValue()) === "2600", await page.locator("#height").inputValue());
  await page.locator("#doorCountChips button", { hasText: /^2$/ }).click();
  await page.locator("label.toggle:has(#softClose)").click();
  await page.getByRole("button", { name: "Рассчитать стоимость" }).click(); await page.waitForTimeout(900);
  const hero = rub(await page.locator("#resultContent .kupe-hero-price").innerText());
  const sp = await spec();
  const specSum = sp.filter((r) => /₽$/.test(r) && !/^Итого/i.test(r)).reduce((a, r) => a + rub(/([\d\s]+)₽$/.exec(r)?.[1] ?? "0"), 0);
  const sizes = (await page.locator("#kupeDoorSizes").innerText().catch(() => "")).replace(/\s+/g, " ").trim(); // подпись в верхнем регистре (CSS)
  await shot("c02-result-1500x2600-soft");
  if (before) {
    check("до: итог 1500×2600×2 зеркало с доводчиками (старый прайс v2.5)", hero > 0, hero.toLocaleString("ru-RU") + " ₽; версия " + (await page.locator("#kupeVersion").innerText()));
  } else {
    check("итог 1500×2600×2, Стандарт, зеркало, доводчики = студия 44 747 ₽", hero === 44747, hero.toLocaleString("ru-RU") + " ₽");
    check("строки спецификации = итог", specSum === hero, specSum.toLocaleString("ru-RU") + " ₽");
    const softTxt = (await page.locator("#softClosePrice").innerText()).replace(/\s/g, " ");
    check("доводчик +5 600 ₽ за дверь", /\+5 600 ₽ за дверь/.test(softTxt), softTxt);
    check("ширина каждой двери 763 мм (нахлёст 27 мм на ручку)", /нахлёст 27 мм/i.test(sizes) && /Дверь 1 763 мм/i.test(sizes) && /Дверь 2 763 мм/i.test(sizes), sizes);
    check("версия v 2.11, прайс 2026.06.08", /2\.11.*2026\.06\.08/.test(await page.locator("#kupeVersion").innerText()), await page.locator("#kupeVersion").innerText());
    check("17 систем в списках профиля", (await page.evaluate("PROFILE_SYSTEMS.length")) === 17, String(await page.evaluate("PROFILE_SYSTEMS.length")));
    const fam = await page.locator("#profileFamily option").allTextContents();
    check("семейства без служебного «Свои»", !fam.includes("Свои") && fam.includes("GRACE"), fam.join(", "));
    const scroll = await page.evaluate(() => ({ v: document.documentElement.scrollHeight - innerHeight, h: document.documentElement.scrollWidth - innerWidth }));
    check("без лишней прокрутки страницы (1366×768)", scroll.v <= 1 && scroll.h <= 0, `по вертикали ${scroll.v} px, по горизонтали ${scroll.h} px`);
    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    check("шрифт Golos Text", /Golos Text/.test(font), font);
    check("нет кнопки «Отправить расчёт / заказать» и телефона", (await page.locator(".kupe-btn-order").count()) === 0 && !/tel:/.test(await page.content()));
    // ── 2. КП → печать
    await page.locator("#kpClient").click(); await page.keyboard.type("Тестовый клиент");
    await page.locator("#kpPhone").click(); await page.keyboard.type("+7 900 000-00-00");
    await page.locator("#kpManager").click(); await page.keyboard.type("Тест Менеджер");
    await page.locator("#kpClient").scrollIntoViewIfNeeded(); await shot("c03-kp-fields");
    await page.getByRole("button", { name: "Сформировать КП" }).click(); await page.waitForTimeout(1200);
    const kp = (await page.locator("#kpPageContent").innerText()).replace(/\s+/g, " ");
    check("КП: ширина двери 1 и 2 — 763 мм", /Ширина двери 1 763 мм/.test(kp) && /Ширина двери 2 763 мм/.test(kp), kp.match(/Ширина двери 1[^Н]{0,60}/)?.[0] ?? "");
    check("КП: итого 44 747 ₽", /ИТОГО К ОПЛАТЕ:? 44 747 ₽/.test(kp), kp.match(/ИТОГО К ОПЛАТЕ[^₽]*₽/)?.[0] ?? "");
    check("КП: без служебных слов", !/закуп|наценк|себестоим/i.test(kp));
    await shot("c04-kp-preview");
    await page.evaluate("window.__printed = 0; window.print = function () { window.__printed++; }");
    await page.getByRole("button", { name: /Печать \/ PDF/ }).click();
    check("кнопка «Печать / PDF» вызывает печать", (await page.evaluate("window.__printed")) === 1);
    await page.emulateMedia({ media: "print" });
    await page.pdf({ path: `${out}/c05-kp-print.pdf`, format: "A4", printBackground: true }).catch((e) => check("PDF КП", false, (e as Error).message.split("\n")[0]));
    await page.screenshot({ path: `${out}/c05-kp-print-media.png`, fullPage: true });
    await page.emulateMedia({ media: "screen" });
    await page.locator("#kpDocument .kp-btn-close").click(); await page.waitForTimeout(400);
    // ── 3. GRACE подвесная 1600 × 2600
    await field("#width", "1600");
    await page.locator("label.toggle:has(#softClose)").click();
    await choose("#profileFamily", "GRACE");
    // после первого расчёта калькулятор пересчитывает на лету (кнопки «Рассчитать» больше нет) — ждём пересчёт
    await page.waitForTimeout(1200);
    const g = (await spec()).join(" | "), gHero = rub(await page.locator("#resultContent .kupe-hero-price").innerText());
    check("GRACE: итог = студия 102 026 ₽", gHero === 102026, gHero.toLocaleString("ru-RU") + " ₽");
    check("GRACE: подвесная — без нижней направляющей, с комплектом фурнитуры", /подвесная/.test(g) && !/Направляющая нижняя/.test(g) && /Комплект подвесной фурнитуры GRACE/.test(g), g.slice(0, 220));
    await page.mouse.move(1200, 400); await page.mouse.wheel(0, -4000); // правая колонка — к итогу и спецификации
    await shot("c06-grace-1600x2600");
    // ── 4. фасады ALU не задеты: свой каталог стёкол (FASAD_FILLINGS, прайс прежний)
    await page.locator("#navTabs a", { hasText: "Фасады ALU" }).click(); await page.waitForTimeout(800);
    const alu = await page.locator("#fasadDefaultFillSel option").allTextContents();
    const aluBase = await page.evaluate("FASAD_FILLINGS.filter(function (f) { return FASAD_FILL_GROUPS.indexOf(f.g) !== -1; }).length");
    check("вкладка «Фасады ALU»: стёкла из своего каталога", alu.length > 0 && alu.length === aluBase, `вариантов ${alu.length}, в каталоге фасадов ${aluBase}`);
    await shot("c07-fasad-alu");
  }
  check("без ошибок страницы и окон", errors.length === 0 && dialogs.length === 0, [...errors, ...dialogs].slice(0, 3).join(" | "));
} catch (e) {
  check("сценарий выполнен до конца", false, (e as Error).message.split("\n")[0]);
  await page.screenshot({ path: `${out}/${pfx}zz-error.png` }).catch(() => {});
}
writeFileSync(`${out}/${pfx}calc-kupe-scenario.json`, JSON.stringify({ origin, results, errors, dialogs }, null, 1), "utf8");
console.log(`итог: ${results.filter((r) => r[1]).length}/${results.length}`);
await browser.close();
process.exit(results.every((r) => r[1]) ? 0 : 1);
