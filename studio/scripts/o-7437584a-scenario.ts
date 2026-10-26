// Заказ 7437584, изделия 1 и 3 — сборка МЫШЬЮ И КЛАВИАТУРОЙ как менеджер, от пустой комнаты до готовых изделий
// (окно 1366×768, своя сборка, только палитра, панели, списки и поля; DOM — только для проверок и чтения итога).
// npx tsx scripts/o-7437584a-scenario.ts <origin с папкой web, напр. http://127.0.0.1:8270> <outDir>
// Итог: <outDir>/steps.json (шаги, время, клики, клавиши), <outDir>/mouse-project.json (проект из localStorage), снимки.
import { chromium, type Locator } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const [origin = "http://127.0.0.1:8270", out = "o-7437584a-mouse"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const pageErrors: string[] = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
let clicks = 0, keys = 0, shotN = 0;
type Step = { step: string; seconds: number; clicks: number; keys: number; note?: string };
const steps: Step[] = [];
let stepStart = Date.now(), stepClicks = 0, stepKeys = 0, stepName = "";
const begin = (name: string) => { stepName = name; stepStart = Date.now(); stepClicks = clicks; stepKeys = keys; console.log("▶ " + name); };
const end = async (note?: string) => {
  steps.push({ step: stepName, seconds: Math.round((Date.now() - stepStart) / 100) / 10, clicks: clicks - stepClicks, keys: keys - stepKeys, ...(note ? { note } : {}) });
  await page.screenshot({ path: `${out}/${String(++shotN).padStart(2, "0")}-${stepName.replace(/[^\wа-яё]+/gi, "-").slice(0, 40)}.png` });
};
/** Клик мышью в центр элемента (прокрутка панели к нему — колесом мыши в его контейнере, как у человека; здесь — scrollIntoView). */
const click = async (l: Locator, opts: { button?: "left" | "right" } = {}) => {
  l = await visible(l); await l.evaluate((e) => e.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" })); await page.waitForTimeout(150);
  const b = await l.boundingBox(); if (!b) throw Error("элемент без размеров");
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2, { button: opts.button ?? "left" }); clicks++; await page.waitForTimeout(250);
};
/** Первый видимый из совпадений (панели держат скрытые копии полей в закрытых разделах). */
const visible = async (l: Locator): Promise<Locator> => {
  for (let t = 0; t < 30; t++) {
    const i = await l.evaluateAll((els) => els.findIndex((e) => { const r = (e as HTMLElement).getBoundingClientRect(); return (e as HTMLElement).offsetParent !== null && r.width > 0 && r.height > 0; }));
    if (i >= 0) return l.nth(i);
    // поле в свёрнутом разделе панели: раскрыть разделы мышью — щелчком по заголовку (summary), от внешнего к внутреннему
    if (false && t % 5 === 1 && (await l.count())) {
      const closed = l.first().locator("xpath=ancestor::details[not(@open)]");
      const n = await closed.count();
      for (let k = 0; k < n; k++) { const s = closed.nth(0).locator(":scope > summary"); const b = await s.boundingBox(); if (!b) break; await s.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" })); const bb = (await s.boundingBox())!; await page.mouse.click(bb.x + 12, bb.y + bb.height / 2); clicks++; await page.waitForTimeout(250); }
    }
    await page.waitForTimeout(300);
  }
  throw Error("не виден: " + l.toString() + " · совпадений " + (await l.count()) + " · " + JSON.stringify(await l.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), !!(e as HTMLElement).offsetParent, (e as HTMLButtonElement).disabled]; }))));
};
const btn = (name: string | RegExp, exact = true) => typeof name === "string" ? page.locator(`button[aria-label="${name}"]`).or(page.getByRole("button", { name, exact })) : page.getByRole("button", { name }); /* кнопка-переключатель с aria-label (role=switch) — по метке */
const byLabel = (label: string) => page.getByLabel(label, { exact: true });
async function type(text: string) { await page.keyboard.type(text); keys += text.length; }
async function press(key: string) { await page.keyboard.press(key); keys++; }
/** Поле: тройной щелчок (выделить), набрать, Tab. */
/** Элемент в свёрнутом разделе (details закрыт, но разметка видна): раскрыть разделы мышью по заголовкам, от внешнего к внутреннему. */
async function openAncestors(l: Locator) {
  for (let k = 0; k < 4; k++) { const n = await l.evaluate((e) => { let c = 0; for (let d = e.closest("details"); d; d = d.parentElement?.closest("details") ?? null) if (!d.open) c++; return c; }); if (!n) break;
    await click(l.locator("xpath=ancestor::details[not(@open)][last()]/summary").first()); }
}
async function field(label: string, value: number | string) {
  const l = await visible(byLabel(label)); await openAncestors(l); await l.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" })); await page.waitForTimeout(150);
  const b = (await l.boundingBox())!; await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); clicks++;
  const act = await page.evaluate(() => { const a = document.activeElement as HTMLElement | null; return a ? a.tagName + "|" + (a.getAttribute("aria-label") ?? "") + "|" + a.className : "нет"; });
  if (!act.includes(label)) console.log(`  [поле «${label}»: после щелчка фокус на ${act}] ` + await l.evaluate((e) => { const b = e.getBoundingClientRect(); const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2) as HTMLElement; const d = e.closest("details"); return `rect ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}; сверху: ${t?.tagName} «${t?.innerText?.slice(0, 40)}»; details open=${(d as HTMLDetailsElement)?.open}, summary «${d?.querySelector("summary")?.textContent?.slice(0, 30)}»`; }));
  await page.keyboard.press("Control+A"); keys++; await type(String(value)); const typed = await l.inputValue(); await press("Tab"); await page.waitForTimeout(350);
  const after = await l.inputValue().catch(() => "?"); if (after !== String(value)) console.log(`  [поле «${label}»: набрано ${typed}, стало ${after}]`);
}
/** Список: щелчок, стрелки до нужного пункта, Enter (как с клавиатуры). */
async function pick(label: string, option: RegExp) {
  const sel = await visible(byLabel(label)); await openAncestors(sel);
  for (let t = 0; t < 10 && !(await sel.evaluate((s: HTMLSelectElement, src: string) => [...s.options].some((o) => new RegExp(src).test(o.text) && !o.disabled), option.source)); t++) await page.waitForTimeout(300);
  const info = await sel.evaluate((s: HTMLSelectElement) => ({ opts: [...s.options].map((o) => o.text), cur: s.selectedIndex, dis: [...s.options].map((o) => o.disabled) }));
  const want = info.opts.findIndex((o, i) => option.test(o) && !info.dis[i]);
  if (want < 0) throw Error(`нет пункта ${option} в «${label}»: ${info.opts.join(" | ")}`);
  if (want === info.cur) return;
  await sel.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" })); await sel.focus(); clicks++; /* щелчок по списку: фокус без раскрытия системного меню */
  /* по одному шагу стрелкой: список, который сразу применяет выбор, перерисовывает панель — фокус возвращаем щелчком */
  for (let i = 0; i < Math.abs(want - info.cur); i++) { if (i) { const s2 = await visible(byLabel(label)); await s2.focus(); clicks++; } await press(want > info.cur ? "ArrowDown" : "ArrowUp"); await page.waitForTimeout(350); }
  await page.waitForTimeout(400);
  const now = (await byLabel(label).count()) ? await sel.evaluate((s: HTMLSelectElement) => s.selectedIndex, undefined, { timeout: 3000 }).catch(() => want) : want; /* список скрылся после выбора (корпусов в ряд = 1) */
  if (now !== want) throw Error(`«${label}»: выбрано ${now}, нужно ${want}`);
}
async function pickIf(label: string, option: RegExp) { if (await byLabel(label).evaluateAll((els) => els.some((e) => (e as HTMLElement).offsetParent !== null))) await pick(label, option); }
async function pickAny(label: string, options: RegExp[]) { const sel = await visible(byLabel(label)); await page.waitForTimeout(600); const texts = await sel.evaluate((s: HTMLSelectElement) => [...s.options].map((o) => o.text)); const o = options.find((r) => texts.some((t) => r.test(t))); if (!o) throw Error(`нет пунктов ${options.join(", ")} в «${label}»: ${texts.join(" | ")}`); await pick(label, o); }
async function checkbox(label: string, on: boolean) {
  const l = await visible(byLabel(label)); await openAncestors(l); const before = await l.isChecked(); if (before !== on) await click(l);
  if ((await (await visible(byLabel(label))).isChecked()) !== on) { const r = await (await visible(byLabel(label))).evaluate((e) => { const b = e.getBoundingClientRect(), t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return t ? t.tagName + "." + (t as HTMLElement).className : "нет"; }); console.log(`  [щелчок по галочке попал в ${r} — пробел с клавиатуры]`); await (await visible(byLabel(label))).focus(); await press("Space"); await page.waitForTimeout(400); }
  console.log(`  [галочка «${label}»: было ${before}, стало ${await (await visible(byLabel(label))).isChecked()}]`);
}
/** Раскрыть раздел панели (summary), если закрыт. */
async function open(text: string) {
  for (let k = 0; k < 3; k++) {
    const own = page.locator(`details[data-setting="${text}"]`);
    const d = (await own.count()) ? await visible(own) : (await visible(page.locator("summary", { hasText: new RegExp("^\\s*" + text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\s|$|[А-ЯЁA-Z])") }))).locator("xpath=..");
    if (await d.evaluate((e) => (e as HTMLDetailsElement).open)) return;
    await click(d.locator(":scope > summary")); await page.waitForTimeout(200);
  }
}
/** Корпус из списка слева (кнопка «имя · размеры · номер»). */
async function selectModule(n: number) { await click(page.locator("button").filter({ hasText: new RegExp(`×\\s*\\d+\\s*${n}$`) })); }
async function errorText() { return (await page.locator(".error:visible, [role=alert]:visible").allInnerTexts()).join(" | "); }
const savedProject = async () => {
  await page.waitForTimeout(700);
  return page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((k) => k === "garderyob-rooms-v1" || (k.startsWith("module-studio-v3") && !k.endsWith(":previous"))).sort();
    let best: any = null;
    for (const k of keys) { try { const v = JSON.parse(localStorage.getItem(k) || ""); const walk = (o: any) => { if (!o || typeof o !== "object") return; if (Array.isArray(o.modules) && o.room) { if (!best || o.modules.length > best.modules.length) best = o; return; } for (const x of Object.values(o)) walk(x); }; walk(v); } catch { /* */ } }
    return best;
  });
};
const moduleCount = async () => ((await savedProject())?.modules?.length ?? 0) as number;

try {
  const url = `${origin}/studio/?fresh=1`;
  await page.goto(url);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("studio-tip-rmb", "1"); });
  await page.goto(url); await page.waitForSelector("canvas", { state: "attached", timeout: 90000 }); await page.waitForTimeout(1500);

  // ── 1. Помещение ─────────────────────────────────────────────────────────────────
  begin("Помещение 4800 × 2400 × 2700");
  await field("Ширина пустой комнаты", 4800); await field("Глубина пустой комнаты", 2400); await field("Высота пустой комнаты", 2700);
  await end();

  // ── 2. Изделие 3: три корпуса 533 × 2000 × 384 одной командой палитры ───────────────────
  begin("И3: палитра — 3 корпуса 533 в ряд, 1 дверь");
  await click(btn("Пустой шкаф"));
  await field("Ширина новой мебели", 1600); await field("Высота новой мебели", 2000); await field("Глубина новой мебели", 384);
  await pick("Корпусов в ряд у новой мебели", /^3 ·/); await pick("Дверей у новой мебели", /^1 · секций 1/);
  await click(btn("Добавить в комнату")); await page.waitForTimeout(1500);
  await end(`корпусов: ${await moduleCount()}`);

  begin("И3: положение группы — от левой стены 200, от задней 3");
  await open("Корпус и размещение"); await open("Положение");
  await checkbox("Двигать всю композицию", true);
  await field("От левой стены", 200); await field("От задней стены", 3);
  await end();

  begin("И3: торцевая ручка HEXA L-1200 чёрный мат на все корпуса");
  await open("Фасады и открывание"); await open("Ручки");
  await click(btn(/^Ручки фасадов:/));
  await pick("К каким корпусам применить ручку", /^Все корпуса/);
  await click(byLabel("Найти ручку")); await type("HEXA L-1200");
  await click(page.locator("button.handle-item").filter({ hasText: "чёрный мат" }).first());
  await end();

  // левый: полка жёсткая на 500 от дна, выдвижной тремпель под крышей
  begin("И3 левый: полка 500 (жёсткая) + выдвижной тремпель");
  await selectModule(1); await open("Наполнение");
  await open("Полки"); await click(btn("Добавить: Полки")); await field("Полка 1", 508); await checkbox("Полка 1 жёсткая", true);
  await open("Штанги"); await click(page.getByRole("group", { name: "Выдвижные тремпели в секции" }).getByRole("button", { name: "1", exact: true }));
  await end();

  // центр: полка съёмная 300, ящики 200 + 200 (скрытые Unihopper с доводчиком, за верх фасада), тремпель
  begin("И3 центр: 2 ящика скрытого монтажа (Unihopper, доводчик), подняты на 516/716, за верх фасада");
  await selectModule(2); await open("Наполнение"); await open("Ящики");
  await click(btn("Добавить: Ящики")); await page.waitForTimeout(400); await click(btn("Добавить: Ящики")); await page.waitForTimeout(400);
  for (const j of [1, 0]) {
    await click(page.getByRole("button", { name: new RegExp(`^Ящик ${j + 1}\\b`) }));
    await pick("Направляющие ящика", /Unihopper/i);
    await pick("Длина направляющих", /^300 мм/);
    await field("Ящик от дна проёма", 516 + j * 200);
  }
  await pick("Ручка ящика", /Зазор|30 мм/);
  await end(await errorText());

  begin("И3 центр: полка съёмная 300 под ящиками, выдвижной тремпель");
  await open("Полки"); await click(btn("Добавить: Полки")); await field("Полка 1", 308);
  await open("Штанги"); await click(page.getByRole("group", { name: "Выдвижные тремпели в секции" }).getByRole("button", { name: "1", exact: true }));
  await end(await errorText());
  begin("И3 правый: полка 1500 (жёсткая) + тремпель под ней");
  await selectModule(3); await open("Наполнение");
  await open("Полки"); await click(btn("Добавить: Полки")); await field("Полка 1", 1508); await checkbox("Полка 1 жёсткая", true);
  await open("Штанги"); await click(page.getByRole("group", { name: "Выдвижные тремпели в секции" }).getByRole("button", { name: "1", exact: true }));
  await end();

  begin("И3: нижние фасады по эскизу — 1996 (2000 от пола до антресоли, зазоры 2 + 2)");
  for (const n of [1, 2, 3]) { await selectModule(n); await open("Фасады и открывание"); await field("Высота фасадов по эскизу", 1996); const err = await errorText(); if (err) console.log(`  [корпус ${n}: ${err.slice(0, 200)}]`); const x = page.locator('button[aria-label="Закрыть сообщение"]'); if (await x.evaluateAll((els) => els.some((e) => (e as HTMLElement).offsetParent))) await click(x); }
  await end(await errorText());
  // антресоли: «Антресоль сверху на этот корпус» → высота 590, push, карниз 90
  for (const n of [1, 2, 3]) {
    begin(`И3 антресоль над корпусом ${n}: 590, push, карниз 90${n === 3 ? ", полка съёмная" : ""}`);
    await selectModule(n); await open("Корпус и размещение"); await open("Габариты");
    await click(btn(/Антресоль сверху на этот корпус/, false)); await page.waitForTimeout(800);
    await open("Габариты"); await field("Высота", 590);
    await open("Фасады и открывание"); await open("Тип открывания"); await pick("Открывание фасадов", /^Push/);
    await open("Дополнительно"); await open("Конструкция и фурнитура"); await pick("Планка под крышей", /^90 мм/); await open("Фасады и открывание"); await field("Высота фасадов по эскизу", 500); /* эскиз: фасад 500 под карнизом 90 (решение 26.10) */
    if (n === 3) { await open("Наполнение"); await open("Полки"); await click(btn("Добавить: Полки")); await field("Полка 1", 279); }
    await end(await errorText());
  }

  // ── 3. Изделие 1 ─────────────────────────────────────────────────────────────────
  begin("И1: антресоль 800 × 590 × 282 (палитра, 2 двери — одна створка 800 не проходит предел)");
  await click(btn("Пустой шкаф"));
  await field("Ширина новой мебели", 800); await field("Высота новой мебели", 590); await field("Глубина новой мебели", 282);
  await pickIf("Корпусов в ряд у новой мебели", /^1 ·/);
  await pick("Дверей у новой мебели", /^Авто · 2/);
  await click(btn("Добавить в комнату")); await page.waitForTimeout(1500);
  await open("Корпус и размещение"); await open("Положение");
  await checkbox("Двигать всю композицию", false);
  await field("От пола", 2000); await field("От левой стены", 2800); await field("От задней стены", 3);
  await end(await errorText());

  begin("И1 антресоль 800: карниз 90, push, жёсткая полка у кромки фасада, петли сверху (АДАЖИО), одна створка");
  await open("Дополнительно"); await open("Конструкция и фурнитура"); await pick("Планка под крышей", /^90 мм/); await open("Фасады и открывание"); await field("Высота фасадов по эскизу", 500); /* эскиз: фасад 500 под карнизом 90 (решение 26.10) */
  await open("Фасады и открывание"); await open("Тип открывания"); await pick("Открывание фасадов", /^Push/);
  await open("Наполнение"); await open("Полки"); await click(btn("Добавить: Полки")); await field("Полка 1", 468); await checkbox("Полка 1 жёсткая", true);
  await open("Фасады и открывание"); await open("Фасад");
  await open("Фасады секции 1");
  await click(page.getByRole("group", { name: "Выбрать отдельный фасад" }).getByRole("button").first());
  await pick("Открывание выбранной двери", /Петли сверху/);
  await pick("Створки выбранной секции", /^Одна створка/);
  await end(await errorText());

  begin("И1: антресоль 1000 × 590 × 282, 2 секции по двери, push, карниз 90");
  await click(btn("Пустой шкаф"));
  await field("Ширина новой мебели", 1000); await field("Высота новой мебели", 590); await field("Глубина новой мебели", 282);
  await pickIf("Корпусов в ряд у новой мебели", /^1 ·/);
  await pickAny("Дверей у новой мебели", [/^2 · секций 1/]); /* две створки в одной секции, затем «Разделить пополам» — отсеки 500 + 500 */
  await click(btn("Добавить в комнату")); await page.waitForTimeout(1500);
  await open("Корпус и размещение"); await open("Положение");
  await checkbox("Двигать всю композицию", false);
  await field("От пола", 2000); await field("От левой стены", 3600); await field("От задней стены", 3);
  await open("Фасады и открывание"); await open("Тип открывания"); await pick("Открывание фасадов", /^Push/);
  await open("Дополнительно"); await open("Конструкция и фурнитура"); await pick("Планка под крышей", /^90 мм/); await open("Фасады и открывание"); await field("Высота фасадов по эскизу", 500); /* эскиз: фасад 500 под карнизом 90 (решение 26.10) */ await open("Наполнение"); await open("Секция"); await click(page.locator("button").filter({ hasText: "Разделить пополам" })); await pick("Выбранная секция", /Секция 1/); await pick("Створки выбранной секции", /^Одна створка/); /* после деления у первой секции остались 2 створки из палитры */
  await end(await errorText());

  begin("И1: подвесной ящик 800 × 200 × 282 (комод), push, низ на 750");
  await click(btn("Комод"));
  await field("Ширина новой мебели", 800); await field("Высота новой мебели", 200); await field("Глубина новой мебели", 282);
  await pickIf("Корпусов в ряд у новой мебели", /^1 ·/);
  await click(btn("Добавить в комнату")); await page.waitForTimeout(1500);
  await open("Корпус и размещение"); await open("Положение");
  await checkbox("Двигать всю композицию", false);
  await field("От пола", 750); await field("От левой стены", 2800); await field("От задней стены", 3);
  await open("Наполнение"); await open("Ящики");
  await pick("Направляющие ящика", /DTC.*push|push.*DTC/i);
  await pick("Длина направляющих", /^250 мм/);
  await field("Высота боковины ящика", 100);
  await end(await errorText());

  begin("И1: скамья 1000 × 450 × 300 — две открытые секции, без цоколя, посадочное место 32");
  await click(btn("Пустой шкаф"));
  await field("Ширина новой мебели", 1000); await field("Высота новой мебели", 450); await field("Глубина новой мебели", 300);
  await pickIf("Корпусов в ряд у новой мебели", /^1 ·/);
  await pickAny("Дверей у новой мебели", [/^2 · секций 1/]);
  await click(btn("Добавить в комнату")); await page.waitForTimeout(1500);
  await open("Корпус и размещение"); await open("Положение");
  await checkbox("Двигать всю композицию", false);
  await field("От левой стены", 3600); await field("От задней стены", 3);
  await open("Опоры"); await pick("Основание корпуса", /^Без цоколя/);
await open("Наполнение"); await open("Секция"); await click(page.locator("button").filter({ hasText: "Разделить пополам" }));   await open("Фасады и открывание"); await open("Фасад"); await click(btn("Распашные фасады", false));
  await open("Дополнительно"); await open("Конструкция и фурнитура"); await pick("Материал крыши", /^Посадочное место 32/);
  // решение Макса 26.10: скамья без дна — обувь на полу; «Без дна» у сиденья само ставит царгу спереди 80
  await pick("Дно корпуса", /^Без дна/);
  await end(await errorText());

  begin("И1: щит 1000 × 1550 над скамьёй — отдельная панель ЛДСП");
  await click(btn("Заказ и инструменты"));
  await open("Общий план · замер · панели");
  await field("Длина панели", 1000); await field("Ширина панели", 1550); await field("Кромка по контуру", 2); await pick("Материал отдельной панели", /^Клауд$/);
  await click(btn("Добавить панель в комнату")); await page.waitForTimeout(1200);
  await end(await errorText());

  begin("И1 щит: положение — от пола 450, от левой стены 3600, к стене");
  await click(btn("Свернуть верхнюю панель")); await page.waitForTimeout(500);
  await click(page.locator("button").filter({ hasText: /^\s*Панель/ }).last()); await page.waitForTimeout(500);
  await open("Положение").catch(() => undefined);
  await field("От пола", 450); await field("От левой стены", 3600); await field("От задней стены", 0);
  await end(await errorText());
  // ── 4. Материал Lamarty Клауд — корпуса и фасады всех корпусов ──────────────────────────
  begin("Материал «Клауд» — корпус и фасады всех корпусов");
  await selectModule(1); await open("Корпус и размещение"); await open("Материал корпуса");
  await click(btn(/Lamarty · 16 мм/, false));
  await pick("К каким корпусам применить материал", /^Все корпуса/);
  await click(byLabel("Найти декор")); await type("Клауд");
  await click(page.locator(".decor-grid button").filter({ hasText: "Клауд" }).first());
  await open("Фасады и открывание"); await open("Фасад"); await click(btn(/^Материал фасадов:/));
  await pick("К каким корпусам применить материал", /^Все корпуса/);
  await click(byLabel("Найти декор")); await type("Клауд");
  await click(page.locator(".decor-grid button").filter({ hasText: "Клауд" }).first());
  await end();

  begin("Итог: стоимость");
  await click(page.getByRole("button", { name: "Стоимость", exact: true }).first());
  await page.waitForTimeout(800);
  await end();
} catch (e) {
  console.log("FAIL на шаге «" + stepName + "»: " + (e as Error).message.split("\n")[0]);
  await page.screenshot({ path: `${out}/FAIL.png` });
  writeFileSync(`${out}/FAIL.txt`, stepName + "\n" + (e as Error).message + "\n\n" + await page.evaluate(() => [...document.querySelectorAll("button,input,select,summary,label")].filter((e) => (e as HTMLElement).offsetParent).map((e) => `${e.tagName} | ${(e.getAttribute("aria-label") ?? "")} | ${((e as HTMLElement).innerText ?? "").replace(/\s+/g, " ").slice(0, 80)} | ${(e as HTMLInputElement).value ?? ""}`).join("\n")));
}
// проект — файлом, как менеджер: «Заказ и инструменты» → «Скачать комнату»
let project: any = null;
try { await press("Escape"); if (!(await page.locator('button[aria-label="Сохранить проект файлом"]').evaluateAll((els) => els.some((e) => (e as HTMLElement).offsetParent)))) await click(btn("Заказ и инструменты")); const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), click(page.getByRole("button", { name: "Сохранить проект файлом" }))]); await dl.saveAs(`${out}/mouse-room.json`); const raw = JSON.parse(readFileSync(`${out}/mouse-room.json`, "utf8")); const walk = (o: any): any => { if (!o || typeof o !== "object") return null; if (Array.isArray(o.modules) && o.room) return o; for (const x of Object.values(o)) { const r = walk(x); if (r) return r; } return null; }; project = walk(raw); } catch (e) { console.log("скачать проект не вышло: " + (e as Error).message.split("\n")[0]); project = await savedProject(); }
writeFileSync(`${out}/storage-keys.txt`, JSON.stringify(await page.evaluate(() => Object.keys(localStorage).map((k) => [k, (localStorage.getItem(k) || "").length, (localStorage.getItem(k) || "").slice(0, 120)])), null, 1));
writeFileSync(`${out}/mouse-project.json`, JSON.stringify(project, null, 1));
const total = steps.reduce((a, s) => ({ seconds: a.seconds + s.seconds, clicks: a.clicks + s.clicks, keys: a.keys + s.keys }), { seconds: 0, clicks: 0, keys: 0 });
writeFileSync(`${out}/steps.json`, JSON.stringify({ steps, total, pageErrors }, null, 1));
console.log(`шагов ${steps.length}, ${Math.round(total.seconds)} с, кликов ${total.clicks}, клавиш ${total.keys}, модулей ${project?.modules?.length ?? 0}, ошибок страницы ${pageErrors.length}`);
await browser.close();
