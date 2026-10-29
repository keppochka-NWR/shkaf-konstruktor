// Фасады по списку Макса 29.10.2026 — проверка мышью, как менеджер (своя сборка; проект для проверки читается из хранилища браузера):
//  A. Шкаф 450×2450×600 из палитры → «Тип распашных фасадов» = «Алюминиевая рамка»: пункт доступен (было «по СТП не выше 2000»),
//     дверь ~2350 в зеркале; подсказка «Высота фасада до 3000 мм». «Вставка рамки» = «Кризет б/ц» (лист 2100×1600) → отказ с причиной.
//  B. Тип «МДФ Вернисаж», «Все настройки»: серия Престиж, №83 «Ёлочка» и №88 «Диагональ» — снимки 3D.
//  C. Покрытие «Эмаль матовая»: поиск RAL «антрацит» → образец RAL 7016 → в проекте «RAL 7016», в смете «RAL 7016 Антрацитово-серый».
//  D. Покрытие «Плёнка ПВХ»: в каталоге все плёнки категорий серии образцами; поиск «эвкалипт» → «Шарли эвкалипт» (условный цвет «≈»).
// npx tsx scripts/fix-facades-2910-scenario.ts <url /studio/?fresh=1> <outDir>
import { chromium, type Locator } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { parts, type Module } from "../src/model";
import { parseProject, type Project } from "../src/project";
import { estimate } from "../src/pricing";
import { VERNISSAGE_FILMS, filmCatsOf } from "../src/facadesVernissage";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
page.setDefaultTimeout(8000);
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => void d.accept());
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
let shotN = 0;
const shot = async (name: string) => { await page.waitForTimeout(900); await page.screenshot({ path: `${out}/${String(++shotN).padStart(2, "0")}-${name}.png` }); };
const vis = (l: Locator) => l.filter({ visible: true }).first();
async function openPanels() {
  for (let round = 0; round < 4; round++) {
    const all = page.locator("details:not([open]) > summary"); let opened = 0;
    for (let i = 0, n = await all.count(); i < n && i < 80; i++) {
      const s = all.nth(i); if (!(await s.isVisible().catch(() => false))) continue;
      const txt = (await s.innerText().catch(() => "")).trim();
      if (/^Добавить мебель|^Точки замера|стена$|^Пол$|^Потолок$|^Двери и окна|^Трубы|^Колонны|^Карточка замера|^Мебель в нише|^Сдвинуть всю/.test(txt)) continue;
      await s.scrollIntoViewIfNeeded().catch(() => undefined); await s.click().catch(() => undefined); opened++; await page.waitForTimeout(60);
    }
    if (!opened) break;
  }
}
const click = async (l: Locator) => { if (!(await l.isVisible().catch(() => false))) await openPanels(); await l.scrollIntoViewIfNeeded(); await l.click(); await page.waitForTimeout(250); };
/** Поле по подписи: раскрыть раздел «Фасады и открывание» и вложенные свёрнутые разделы, пока поле не станет видно (как менеджер). */
async function label(aria: string) {
  const any = () => page.getByLabel(aria, { exact: true }).filter({ visible: true }).first();
  if (await any().isVisible().catch(() => false)) return any();
  for (const cat of ["Фасады и открывание", "Корпус и размещение"]) {
    const d = page.locator("details", { has: page.locator(":scope > summary", { hasText: cat }) }).first();
    if (!(await d.count())) continue;
    if ((await d.getAttribute("open")) === null) { await d.locator(":scope > summary").click(); await page.waitForTimeout(200); }
    for (let r = 0; r < 4 && !(await any().isVisible().catch(() => false)); r++) {
      const closed = d.locator("details:not([open]) > summary");
      for (let i = 0, n = await closed.count(); i < n; i++) { const s = closed.nth(i); if (await s.isVisible().catch(() => false)) { await s.click().catch(() => undefined); await page.waitForTimeout(80); if (await any().isVisible().catch(() => false)) break; } }
    }
    if (await any().isVisible().catch(() => false)) return any();
  }
  await openPanels(); return any();
}
async function field(aria: string, value: number | string) { const l = await label(aria); await l.scrollIntoViewIfNeeded(); await l.click({ clickCount: 3 }); await page.keyboard.type(String(value)); await page.keyboard.press("Enter"); await page.waitForTimeout(300); }
async function typeIn(aria: string, value: string) { const l = await label(aria); await l.scrollIntoViewIfNeeded(); await l.click({ clickCount: 3 }); await page.keyboard.press("Control+A"); await page.keyboard.type(value); await page.waitForTimeout(400); }
/** Список: раскрыть (Alt+↓), стрелками до пункта, Enter — как менеджер с клавиатуры. */
async function pick(aria: string, option: RegExp) {
  const sel = await label(aria); await sel.scrollIntoViewIfNeeded();
  const opts = await sel.locator("option").allInnerTexts(), cur = await sel.evaluate((s) => (s as HTMLSelectElement).selectedIndex);
  const want = opts.findIndex((o) => option.test(o)); if (want < 0) throw Error(`нет пункта ${option} в «${aria}»`);
  if (want === cur) return;
  await sel.focus(); await page.keyboard.press("Alt+ArrowDown"); await page.waitForTimeout(150);
  const dis = await sel.evaluate((s) => [...(s as HTMLSelectElement).options].map((o) => o.disabled));
  for (let i = cur; i !== want;) { i += want > cur ? 1 : -1; if (!dis[i] || i === want) await page.keyboard.press(want > cur ? "ArrowDown" : "ArrowUp"); }
  await page.keyboard.press("Enter"); await page.waitForTimeout(700);
}
const banner = async () => (await page.locator(".error-banner").allInnerTexts().catch(() => [] as string[])).join(" ").replace(/\s+/g, " ").trim();
async function doc(): Promise<Project> {
  await page.waitForTimeout(900);
  const raw = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith("garderyob-rooms-v1") && !x.includes(":previous") && !x.includes(":damaged")); return k ? localStorage.getItem(k) : null; });
  if (!raw) throw Error("документ комнат не сохранён");
  const d = JSON.parse(raw), i = d.rooms.findIndex((r: { id: string }) => r.id === d.activeRoomId);
  return parseProject({ ...d.rooms[i].project, ...(d.calculation ? { calculation: d.calculation } : {}) }, true);
}
const last = async (): Promise<Module> => { const p = await doc(); return p.modules[p.modules.length - 1].module; };

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  // A. шкаф 450×2450×600 из палитры
  const pal = page.locator("details.module-palette").first();
  if ((await pal.count()) && (await pal.getAttribute("open")) === null) await click(pal.locator("summary").first());
  await click(pal.getByRole("tab", { name: "Шкафы распашные" }));
  await click(pal.locator(".module-kinds button").nth(3));
  await field("Ширина новой мебели", 450); await field("Высота новой мебели", 2450); await field("Глубина новой мебели", 600);
  await click(vis(pal.getByRole("button", { name: "Добавить в комнату" })));
  await page.waitForTimeout(1200);
  const apart = page.getByRole("button", { name: /^Поставить отдельно/ });
  if (await apart.count() && await apart.first().isVisible()) await click(apart.first());
  const all = await label("Все настройки"); if (!(await all.isChecked())) await click(all);
  const kind = await label("Тип распашных фасадов");
  const aluOpt = kind.locator("option", { hasText: /Алюмин/ });
  check("A1: «Алюминиевая рамка» доступна у шкафа 2450", !(await aluOpt.isDisabled()), (await aluOpt.getAttribute("title")) ?? "");
  await pick("Тип распашных фасадов", /Алюмин/);
  let m = await last();
  const door = parts(m).find((p) => p.role === "door" && p.material === "alu");
  check("A2: двери в рамке выше 2000, без ошибки", !!m.alu && !!door && door.length > 2000 && !(await banner()), `дверь ${door ? Math.round(door.width) + "×" + Math.round(door.length) : "—"}; ${await banner()}`);
  const note = (await vis(page.locator("[data-alu-max-h]")).innerText().catch(() => ""));
  check("A3: подсказка предела по листу стекла", /до 3000 мм/.test(note), note);
  const hinges = parts(m).filter((p) => p.id.includes(":hingecup:")).length;
  check("A4: петли по правилу высоты (выше 2000 — 5)", hinges === 5, `петель ${hinges}`);
  await shot("alu-2450");
  await pick("Вставка рамки", /^Кризет/);
  m = await last();
  const b = await banner();
  check("A5: Кризет б/ц (лист 2100) — отказ с причиной, рамка не сменилась", /Кризет/.test(b) && /2100/.test(b) && !/Кризет/.test(m.alu?.insert ?? ""), b.slice(0, 200));
  await shot("alu-krizet-refused");
  // B. Вернисаж №83 и №88
  await pick("Тип распашных фасадов", /Вернисаж/);
  await pick("Серия Вернисаж", /Престиж/);
  await pick("Фрезеровка Вернисаж", /^№83 /);
  m = await last();
  check("B1: №83 выбрана", m.vernissage?.milling === "83");
  await page.getByRole("button", { name: "Спереди" }).first().click().catch(() => undefined);
  await shot("v83");
  await pick("Фрезеровка Вернисаж", /^№88 /);
  m = await last();
  check("B2: №88 выбрана", m.vernissage?.milling === "88");
  await shot("v88");
  // C. эмаль по RAL
  await pick("Покрытие Вернисаж", /^Эмаль мат/i);
  await typeIn("Поиск цвета RAL", "антрацит");
  await click(vis(page.getByRole("radio", { name: "RAL 7016 Антрацитово-серый" })));
  const pr = await doc(); m = pr.modules[pr.modules.length - 1].module;
  const est = estimate(pr), line = est.lines.find((l) => l.id.startsWith("vernissage:88:enamel-matte"));
  check("C1: в проекте RAL 7016, в смете с названием", m.vernissage?.enamelColor === "RAL 7016" && /RAL 7016 Антрацитово-серый/.test(line?.label ?? ""), `${m.vernissage?.enamelColor}; ${line?.label}`);
  check("C2: в 3D — цвет RAL (образец в выборе)", /Антрацитово-серый/.test(await vis(page.locator('[data-picker="ral"] .facade-colors-head')).innerText()));
  await shot("v88-ral7016");
  // D. плёнка из каталога
  await pick("Покрытие Вернисаж", /^Плёнка ПВХ/);
  const radios = page.getByRole("radiogroup", { name: "Каталог плёнок Вернисаж" }).first().getByRole("radio");
  const want = VERNISSAGE_FILMS.filter((f) => filmCatsOf("88").includes(f.cat)).length;
  check("D1: в выборе — все плёнки категорий серии", (await radios.count()) === want, `${await radios.count()} из ${want}`);
  await typeIn("Поиск плёнки", "эвкалипт");
  await click(vis(page.getByRole("radio", { name: "Шарли эвкалипт" })));
  m = await last();
  check("D2: выбрана «Шарли эвкалипт», условный цвет помечен", m.vernissage?.film === "Шарли эвкалипт" && /условный/.test(await vis(page.locator('[data-picker="film"] .facade-colors-head')).innerText()), m.vernissage?.film ?? "");
  await shot("v88-film-evkalipt");
  await typeIn("Поиск плёнки", "орех кантри");
  const nut = vis(page.getByRole("radio", { name: "Орех Кантри" }));
  if (await nut.count()) { await click(nut); m = await last(); check("D3: плёнка с текстурой сайта — «Орех Кантри»", m.vernissage?.film === "Орех Кантри"); await shot("v88-film-oreh-kantri"); }
} catch (e) {
  check("сценарий", false, (e as Error).message.split("\n")[0]);
  await shot("fail");
}
check("без ошибок страницы", !errors.length, errors.join(" | ").slice(0, 300));
writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 1));
await browser.close();
const bad = results.filter((r) => !r[1]).length;
console.log(bad ? `ПРОВАЛОВ: ${bad}` : "ВСЁ ПРОШЛО");
process.exit(bad ? 1 : 0);
