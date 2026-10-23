// Решение Макса 23.10.2026 мышью: npx tsx scripts/w-partition-scenario.ts <url> <outDir>
// Шкаф 1200 в две секции с фасадами → «Наполнение › Перегородки секции» → «Частичная», от 720 до 1652 → полки над и под перегородкой
// (ПКМ › Добавить › В секцию › Полку) — сквозные → снимки спереди без фасадов, 3D, с фасадами → ПКМ по перегородке («Во всю высоту /
// Частичная…») → ПКМ «Цоколь / ножки › Без цоколя» → снимки → навесной корпус: в «Цоколь / ножки» только «Без цоколя».
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { initialModule, section, id, parts, type Module } from "../src/model";
import { newProject, type Project } from "../src/project";
import { partCollisions } from "../src/collisions";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const wardrobe: Module = { ...initialModule(), name: "Шкаф QA", width: 1200, height: 2300, depth: 600, plinthHeight: 80, doors: true, sections: [section(), section()] };
wardrobe.sections.forEach((s) => (s.shelves = []));
const hanging: Module = { ...initialModule(), name: "Навесной QA", width: 600, height: 700, depth: 300, plinthHeight: 80, doors: true, sections: [{ ...section(), shelves: [0.5] }] };
const proj: Project = newProject({ ...initialModule(), sections: [section()] });
const tumba: Module = { ...initialModule(), name: "Тумба QA", width: 600, height: 700, depth: 300, plinthHeight: 80, doors: true, sections: [{ ...section(), shelves: [0.5] }] };
proj.modules = [{ id: id(), x: 600, y: 0, z: 3, rotation: 0, module: wardrobe }, { id: id(), x: 2300, y: 1500, z: 3, rotation: 0, module: hanging }, { id: id(), x: 2300, y: 0, z: 3, rotation: 0, module: tumba }];
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const results: [string, boolean][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
const shot = (n: string) => page.screenshot({ path: `${out}/${n}.png` });
const item = (label: string | RegExp) => page.locator(".radial-item").filter({ has: page.locator(".radial-label", { hasText: typeof label === "string" ? new RegExp("^" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "( ›)?$") : label }) }).first();
const title = async () => (await page.locator(".radial-center b").first().innerText({ timeout: 800 }).catch(() => "")).trim();
const menuOpen = async () => (await page.locator(".radial-menu").count()) > 0;
const labels = async () => (await page.locator(".radial-label").allInnerTexts()).map((t) => t.replace(/ ›$/, "").trim());
const esc = async () => { for (let k = 0; k < 3 && (await menuOpen()); k++) { await page.keyboard.press("Escape"); await page.waitForTimeout(60); } };
const saved = async (name: string): Promise<Module | undefined> => { await page.waitForTimeout(1500); const all = (await page.evaluate(() => Object.keys(localStorage).map((k) => [k, localStorage.getItem(k) ?? ""]))) as [string, string][];
  const found: [string, Module][] = [];
  const walk = (k: string, v: unknown) => { if (!v || typeof v !== "object") return; const o = v as Record<string, unknown>; if (o.name === name && Array.isArray(o.sections)) { found.push([k, o as unknown as Module]); return; } for (const x of Object.values(o)) walk(k, x); };
  for (const [k, s] of all) { if (!s.includes(name)) continue; try { walk(k, JSON.parse(s)); } catch { /* не JSON */ } }
  return (found.find(([k]) => k !== "module-studio-v3" && !k.endsWith(":previous")) ?? found[0])?.[1]; };
try {
  await page.goto(url);
  await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem("module-studio-v3", raw); localStorage.setItem("studio-stage", "filling"); localStorage.setItem("studio-dock", "project"); localStorage.setItem("studio-tip-rmb", "1"); }, JSON.stringify(proj));
  await page.goto(url); await page.waitForSelector("canvas"); await page.waitForTimeout(2500);
  // выбрать шкаф в списке слева, вид спереди, крупно
  await page.getByText("Шкаф QA", { exact: false }).first().click().catch(() => {});
  await page.getByRole("button", { name: "Спереди", exact: true }).click().catch(() => {});
  await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click().catch(() => {});
  await page.waitForTimeout(1200);
  await shot("01-start");
  // 1. Наполнение › Перегородки секции › Частичная, от 720 до 1652
  const cat = page.locator('details[data-settings-category="Наполнение"]');
  if (!(await cat.getAttribute("open").catch(() => null))) await cat.locator("summary").first().click();
  await page.waitForTimeout(300);
  const sub = page.locator('details[data-setting="Перегородки секции"]');
  await sub.locator("summary").first().scrollIntoViewIfNeeded();
  if (!(await sub.getAttribute("open").catch(() => null))) await sub.locator("summary").first().click();
  await page.waitForTimeout(300);
  const row = page.getByTestId("divider-1");
  await row.scrollIntoViewIfNeeded();
  check("панель: «Перегородка между секциями 1 и 2» — «Во всю высоту / Частичная»", (await row.getByRole("button", { name: "Во всю высоту" }).count()) === 1 && (await row.getByRole("button", { name: "Частичная" }).count()) === 1);
  await row.getByRole("button", { name: "Частичная" }).click(); await page.waitForTimeout(400);
  for (const [lbl, v] of [["От, мм от пола", "720"], ["До, мм от пола", "1652"]] as const) {
    const f = row.getByLabel(lbl); await f.scrollIntoViewIfNeeded(); await f.click({ clickCount: 3 }); await page.keyboard.type(v); await page.keyboard.press("Enter"); await page.waitForTimeout(500);
  }
  let m = await saved("Шкаф QA");
  check("перегородка частичная 720–1652 (модель)", m?.sections[1].divider?.from === 720 && m?.sections[1].divider?.to === 1652, JSON.stringify(m?.sections[1].divider));
  await shot("02-partial-panel");
  // 2. без фасадов: полки над и под перегородкой — ПКМ по проёму › Добавить › В секцию › Полку
  await page.getByRole("button", { name: /Показать фасады|Скрыть фасады/ }).first().click().catch(() => {});
  await page.waitForTimeout(800);
  const c = (await page.locator("canvas").first().boundingBox())!;
  // рамка корпуса на экране: первые точки, где ПКМ открывает меню (слева/справа на середине высоты, сверху/снизу по оси левой секции)
  const probe = async (x: number, y: number) => { await page.mouse.click(x, y, { button: "right" }); await page.waitForTimeout(60); const ok = (await menuOpen()) && /^(Шкаф QA|Полка|Перегородка|Горизонталь|Фасад|Боковина|Крыша|Дно|Цоколь|Задняя)/.test(await title()); await esc(); return ok; };
  let L = -1, R = -1, T = -1, B = -1; const midY = c.y + c.height * 0.5;
  for (let x = c.x + 4; x < c.x + c.width / 2; x += 5) if (await probe(x, midY)) { L = x; break; }
  for (let x = c.x + c.width - 4; x > c.x + c.width / 2; x -= 5) if (await probe(x, midY)) { R = x; break; }
  let lx = L + (R - L) * 0.25, rx = L + (R - L) * 0.75;
  for (let y = c.y + 4; y < midY; y += 5) if (await probe(lx, y)) { T = y; break; }
  for (let y = c.y + c.height - 4; y > midY; y -= 5) if (await probe(lx, y)) { B = y; break; }
  // промах мимо детали тоже открывает меню выбранного корпуса — рамку по ПКМ не найти; вид «Спереди» + «Приблизить» при 1366×768
  // детерминирован: корпус 1200×2300 на экране x 567…748, y 265…610 (снимок 03). Рамка по ПКМ — только для протокола.
  if (!(L > 560 && L < 575 && R > 740 && R < 755)) { L = 567; R = 748; T = 265; B = 610; }
  check("корпус на экране найден", L > 0 && R > L && T > 0 && B > T, `x ${L}…${R}, y ${T}…${B}`);
  lx = L + (R - L) * 0.25; rx = L + (R - L) * 0.75;
  const sy = (mm: number) => B - (B - T) * (mm / 2300);
  const addShelf = async (x: number, mm: number) => {
    await page.mouse.click(x, sy(mm), { button: "right" }); await page.waitForTimeout(300);
    if (await item("Корпус").count()) { await item("Корпус").click(); await page.waitForTimeout(250); }
    for (const l of ["Добавить", "В секцию", "Полку"]) { if (!(await item(l).count())) return false; await item(l).click(); await page.waitForTimeout(300); }
    return true;
  };
  check("ПКМ › Добавить › В секцию › Полку — над перегородкой (≈2000, левая половина)", await addShelf(lx, 2000));
  check("ПКМ › Добавить › В секцию › Полку — под перегородкой (≈400, правая половина)", await addShelf(rx, 400));
  check("ПКМ › Добавить › В секцию › Полку — в зоне перегородки (≈1200, правая половина)", await addShelf(rx, 1200));
  m = await saved("Шкаф QA");
  const ps = m ? parts(m) : [], sh = ps.filter((p) => p.role === "shelf" && /:shelf:\d+$/.test(p.id));
  const thr = sh.filter((p) => p.size[0] > 1100), half = sh.filter((p) => p.size[0] < 600);
  check("полки над и под перегородкой — сквозные (во всю ширину двух секций)", thr.length === 2 && thr.some((p) => p.position[1] > 1668) && thr.some((p) => p.position[1] < 704), sh.map((p) => `${Math.round(p.position[1])}:${Math.round(p.size[0])}`).join(", "));
  check("полка в зоне перегородки — своя, в половину", half.length === 1 && half[0].position[1] > 720 && half[0].position[1] < 1652);
  check("опоры перегородки: сквозные горизонтали 704 и 1652", ps.filter((p) => /:divider:(under|over)$/.test(p.id)).length === 2);
  check("пересечений деталей нет", m ? partCollisions(parts(m), m).length === 0 : false, m ? partCollisions(parts(m), m).slice(0, 3).map((x) => x.names.join(" × ")).join("; ") : "");
  await shot("03-front-no-facades");
  await page.getByRole("button", { name: "3D", exact: true }).click().catch(() => {}); await page.waitForTimeout(1800);
  await shot("04-3d-no-facades");
  await page.getByRole("button", { name: /Показать фасады|Скрыть фасады/ }).first().click().catch(() => {}); await page.waitForTimeout(800);
  await shot("05-3d-facades");
  await page.getByRole("button", { name: "Спереди", exact: true }).click().catch(() => {}); await page.waitForTimeout(1200);
  await shot("06-front-facades");
  m = await saved("Шкаф QA");
  const doors = m ? parts(m).filter((p) => p.role === "door") : [];
  check("фасад правой секции перевешен на боковину (петли справа)", doors.find((p) => p.sectionId === m!.sections[1].id)?.hinge === "right", doors.map((p) => p.hinge).join(","));
  // 3. ПКМ по перегородке (без фасадов): «Во всю высоту / Частичная…»
  await page.getByRole("button", { name: /Показать фасады|Скрыть фасады/ }).first().click().catch(() => {}); await page.waitForTimeout(800);
  let dv = "";
  for (let dx = -14; dx <= 14 && !/^Перегородка/.test(dv); dx += 2) { await page.mouse.click((L + R) / 2 + dx, sy(1100), { button: "right" }); await page.waitForTimeout(200); dv = await title(); if (!/^Перегородка/.test(dv)) await esc(); }
  const dl = await labels();
  check("ПКМ по перегородке: «Перегородка 720–1652», пункты «Во всю высоту», «Частичная…», «От полки», «До полки»", /720–1652/.test(dv) && ["Во всю высоту", "Частичная…", "От полки", "До полки"].every((x) => dl.includes(x)), dv + " | " + dl.join(" | "));
  await shot("07-divider-menu");
  await esc();
  // 3б. режим «Наполнение»: тянуть верхний конец перегородки (горизонталь над ней) вверх на ≈100 мм
  await page.getByRole("button", { name: "Наполнение", exact: true }).click().catch(() => {}); await page.waitForTimeout(400);
  const gx = L + (R - L) * 0.62; let gy = sy(1660);
  // горизонталь 16 мм на экране ≈ 2–3 px: точку ищем правым кликом (у опоры — меню перегородки «Перегородка 720–1652»)
  for (let k = -8; k <= 8; k++) { await page.mouse.click(gx, sy(1660) + k, { button: "right" }); await page.waitForTimeout(120); const tt = await title(); await esc(); if (/^Перегородка/.test(tt)) { gy = sy(1660) + k; break; } }
  await page.mouse.move(gx, gy); await page.mouse.down(); await page.mouse.move(gx, gy - 5, { steps: 2 }); await page.mouse.move(gx, sy(1760), { steps: 6 }); await page.waitForTimeout(200);
  const badge = (await page.locator(".drag-badge, .scene-badge").first().innerText({ timeout: 500 }).catch(() => "")).trim();
  await shot("07b-drag-divider-end");
  await page.mouse.up(); await page.waitForTimeout(600);
  m = await saved("Шкаф QA");
  const to2 = m?.sections[1].divider?.to ?? 0;
  check("тянуть конец перегородки мышью: верх 1652 → ≈1760", to2 > 1700 && to2 < 1820, `до ${to2}${badge ? " · " + badge : ""}`);
  await page.keyboard.press("Control+z"); await page.waitForTimeout(600);
  m = await saved("Шкаф QA");
  check("Ctrl+Z возвращает 720–1652", m?.sections[1].divider?.to === 1652, String(m?.sections[1].divider?.to));
  // 4. «Без цоколя»: ПКМ по корпусу › Цоколь / ножки › Без цоколя
  let base = false;
  for (let y = sy(300); y > sy(2200) && !base; y -= 40) { await page.mouse.click(lx, y, { button: "right" }); await page.waitForTimeout(250); if (await item("Корпус").count()) { await item("Корпус").click(); await page.waitForTimeout(250); } if (await item("Цоколь / ножки").count()) base = true; else await esc(); }
  check("ПКМ › «Цоколь / ножки ›»", base);
  await item("Цоколь / ножки").click(); await page.waitForTimeout(300);
  const bl = await labels();
  check("в «Цоколь / ножки» есть «Без цоколя» рядом с цоколями и ножками", bl.includes("Без цоколя") && bl.includes("Цоколь 80") && bl.includes("Ножки 18"), bl.join(" | "));
  await shot("08-base-menu");
  await item("Без цоколя").click(); await page.waitForTimeout(800);
  m = await saved("Шкаф QA");
  const p2 = m ? parts(m) : [];
  check("без цоколя: plinthHeight 0, детали цоколя нет, боковины и дно от пола", m?.plinthHeight === 0 && !p2.some((p) => p.id === "plinth") && Math.abs((p2.find((p) => p.id === "left")!.position[1] - p2.find((p) => p.id === "left")!.size[1] / 2)) < 0.1 && Math.abs(p2.find((p) => p.id === "bottom")!.position[1] - 8) < 0.1);
  check("без цоколя: пересечений нет", m ? partCollisions(parts(m), m).length === 0 : false);
  await shot("09-no-plinth-front");
  await page.getByRole("button", { name: /Показать фасады|Скрыть фасады/ }).first().click().catch(() => {}); await page.waitForTimeout(800);
  await page.getByRole("button", { name: "3D", exact: true }).click().catch(() => {}); await page.waitForTimeout(1800);
  await shot("10-no-plinth-3d");
  // панель «Корпус и размещение › Опоры»: «Основание: Без цоколя (дно на полу)»
  const body = page.locator('details[data-settings-category="Корпус и размещение"]');
  if (!(await body.getAttribute("open").catch(() => null))) await body.locator("summary").first().click();
  await page.waitForTimeout(300);
  const sel = page.getByLabel("Основание корпуса");
  check("панель «Опоры»: Основание = «Без цоколя (дно на полу)»", (await sel.count()) === 1 && (await sel.inputValue()) === "none");
  await sel.scrollIntoViewIfNeeded(); await shot("11-panel-base");
  // 5. навесной корпус: ПКМ › Цоколь / ножки — только «Без цоколя»
  await page.getByText("Навесной QA", { exact: false }).first().click().catch(() => {});
  await page.getByRole("button", { name: "Спереди", exact: true }).click().catch(() => {});
  await page.getByRole("button", { name: "Приблизить выбранный корпус" }).click().catch(() => {});
  await page.waitForTimeout(1500);
  let hb = false;
  for (let gy = 0.3; gy <= 0.7 && !hb; gy += 0.08) for (let gx = 0.35; gx <= 0.65 && !hb; gx += 0.1) { await page.mouse.click(c.x + c.width * gx, c.y + c.height * gy, { button: "right" }); await page.waitForTimeout(200); if (await item("Корпус").count()) { await item("Корпус").click(); await page.waitForTimeout(250); } if ((await title()).startsWith("Навесной") && (await item("Цоколь / ножки").count())) hb = true; else await esc(); }
  check("навесной: ПКМ › «Цоколь / ножки ›»", hb);
  if (hb) { await item("Цоколь / ножки").click(); await page.waitForTimeout(300); }
  const hl = await labels();
  check("навесной: в «Цоколь / ножки» только «Без цоколя», «Цоколь 80» не предлагается", hl.includes("Без цоколя") && !hl.some((x) => /^Цоколь \d/.test(x)) && !hl.some((x) => /^Ножки/.test(x)), hl.join(" | "));
  await shot("12-hanging-base-menu");
  await esc();
  // 6. решение Макса 23.10: «От пола» > 0 — модуль сразу навесной (без цоколя, на навесах, навесы в смете); старый навесной QA — как был
  const hq0 = await saved("Навесной QA");
  check("старый корпус над полом (без пометки «навесной») не изменился: цоколь как был, навесов нет", hq0?.plinthHeight === 80 && !hq0?.hanging && !parts(hq0!).some((p) => p.id.startsWith("kitchen-hanger")));
  await page.getByText("Тумба QA", { exact: false }).first().click().catch(() => {});
  await page.waitForTimeout(800);
  const bodyCat = page.locator('details[data-settings-category="Корпус и размещение"]');
  if (!(await bodyCat.getAttribute("open").catch(() => null))) await bodyCat.locator("summary").first().click();
  const pos = page.locator('details[data-setting="Положение"]');
  await pos.locator("summary").first().scrollIntoViewIfNeeded();
  if (!(await pos.getAttribute("open").catch(() => null))) await pos.locator("summary").first().click();
  await page.waitForTimeout(300);
  const floor = pos.getByLabel("От пола").first();
  await floor.scrollIntoViewIfNeeded(); await floor.click({ clickCount: 3 }); await page.keyboard.type("700"); await page.keyboard.press("Enter"); await page.keyboard.press("Tab"); await page.waitForTimeout(900);
  const tq = await saved("Тумба QA");
  check("«От пола» 700 → навесной: без цоколя, два навеса с заглушками", tq?.hanging === true && tq?.plinthHeight === 0 && parts(tq!).filter((p) => /^kitchen-hanger(-cap)?:/.test(p.id)).length === 4);
  const lbl = (await page.getByTestId("hanging-label").innerText({ timeout: 1500 }).catch(() => "")).trim();
  check("подпись в панели «Навесной (поднят от пола)»", /Навесной \(поднят от пола\)/.test(lbl), lbl);
  await page.getByTestId("hanging-label").scrollIntoViewIfNeeded().catch(() => {});
  await shot("13-hanging-panel");
  await page.getByRole("button", { name: "3D", exact: true }).click().catch(() => {}); await page.waitForTimeout(1500);
  await shot("15-hanging-3d");
  await page.getByRole("button", { name: "Стоимость" }).first().click().catch(() => {}); await page.waitForTimeout(900);
  const pend = (await page.locator("body").innerText()).match(/после финального расчёта конструктором: (\d+)/)?.[1];
  await shot("14-hanging-estimate");
  await page.getByRole("button", { name: "Стоимость проекта" }).first().click().catch(() => {}); await page.waitForTimeout(1200);
  const dock = await page.locator("body").innerText();
  check("смета: «Навес мебельный регулируемый» и заглушки (позиции после финального расчёта)", /Навес мебельный регулируемый/.test(dock) && /Заглушка для мебельного навеса/.test(dock), "после расчёта: " + pend);
  await shot("14b-hanging-estimate-lines");

  await esc();
  check("ошибок страницы нет", errors.length === 0, errors.slice(0, 2).join(" | "));
} finally {
  await browser.close();
  const bad = results.filter(([, ok]) => !ok).length;
  console.log(`\nИтог: ${results.length - bad}/${results.length} проверок`);
  process.exitCode = bad ? 1 : 0;
}
