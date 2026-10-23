// Слияние w-lwing + w-formerrors (claude/release-2410, 23.10): «Кухня угловая (Г)» и «Кухня П-образная» в форме «Добавить мебель» —
// ошибки длин рядов списком у полей, «Исправить автоматически» / кнопка исправления, «Добавить в комнату» ставит кухню в угол.
// npx tsx scripts/corner-kitchen-errors-scenario.ts <url studio/?fresh=1> <outDir>
// Только мышь и клавиатура; состояние проекта читается из localStorage только для проверки. Код 1, если проверка не прошла.
import { chromium, type Locator, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const results: [string, boolean, string][] = [], pageErrors: string[] = [];
const stats = { clicks: 0, inputs: 0, keys: 0 };
const check = (name: string, ok: boolean, info = "") => { results.push([name, ok, info]); console.log((ok ? "OK   " : "FAIL ") + name + (info ? " — " + info : "")); };
type Mod = { name: string; rot: number; worktop: boolean; corner: boolean; plank: string | null };
const state = (page: Page) => page.evaluate(() => { const s = JSON.parse(localStorage.getItem("garderyob-rooms-v1") || "null"); if (!s) return null; const r = s.rooms.find((x: { id: string }) => x.id === s.activeRoomId);
  return { room: r.project.room, modules: r.project.modules.map((m: { rotation?: number; module: { name: string; worktop?: unknown; cornerKind?: string; kitchen?: { faceFiller?: { facadeMat?: unknown } } } }) => ({ name: m.module.name, rot: m.rotation || 0, worktop: !!m.module.worktop, corner: !!m.module.kitchen?.faceFiller?.facadeMat, plank: m.module.cornerKind ?? null })) as Mod[] }; });

async function open() {
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  page.on("pageerror", (e) => pageErrors.push(e.message)); page.on("dialog", (d) => void d.accept());
  await page.goto(url); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("studio-tip-rmb", "1"); });
  await page.goto(url); await page.waitForSelector("canvas", { state: "attached", timeout: 90000 }); await page.waitForTimeout(2000);
  return page;
}
const click = async (l: Locator) => { await l.scrollIntoViewIfNeeded(); await l.click(); stats.clicks++; await l.page().waitForTimeout(300); };
async function field(page: Page, aria: string, value: string) {
  const l = page.getByLabel(aria, { exact: true });
  await l.scrollIntoViewIfNeeded(); await l.click({ clickCount: 3 }); stats.clicks++;
  await page.keyboard.type(value); stats.inputs++; await page.keyboard.press("Tab"); stats.keys++; await page.waitForTimeout(300);
}
const issues = (page: Page) => page.locator('.module-palette .palette-issues[aria-label="Ошибки формы"] li').evaluateAll((li) => li.map((x) => ({ field: x.getAttribute("data-field"), text: (x as HTMLElement).innerText.replace(/\s+/g, " ").trim() })));
const value = (page: Page, aria: string) => page.getByLabel(aria, { exact: true }).inputValue();
const shot = (page: Page, n: string) => page.screenshot({ path: `${out}/${n}.png` });

// 1. Г: по задней 4500 в комнате 4000, по боковой 600 — две ошибки у своих полей, «Исправить автоматически», «Добавить в комнату»
{
  const page = await open();
  await click(page.getByRole("tab", { name: "Кухонные модули" }));
  await click(page.getByRole("button", { name: "Кухня угловая (Г)" }));
  await field(page, "По задней стене новой мебели", "4500");
  await field(page, "По боковой стене новой мебели", "600");
  const list = await issues(page);
  check("Г: две ошибки списком до «Добавить»", list.length === 2, list.map((x) => x.text).join(" / "));
  check("Г: ошибки у полей «По задней стене» и «По боковой стене»", list.map((x) => x.field).join(",") === "width,side", list.map((x) => x.field).join(","));
  check("Г: поля подсвечены", (await page.locator('.module-sizes input[aria-invalid="true"]').count()) === 2);
  await page.locator(".palette-issues").scrollIntoViewIfNeeded(); await shot(page, "g-01-issues");
  await click(page.getByRole("button", { name: "Исправить автоматически", exact: true }));
  const back = await value(page, "По задней стене новой мебели"), side = await value(page, "По боковой стене новой мебели");
  check("Г: исправлено — по задней 4000 (ширина комнаты), по боковой 800 (мин.)", back === "4000" && side === "800", `${back} / ${side}`);
  check("Г: после исправления ошибок нет", (await issues(page)).length === 0);
  await shot(page, "g-02-fixed");
  await click(page.getByRole("button", { name: "Добавить в комнату", exact: true })); await page.waitForTimeout(1500);
  const st = await state(page), mods = st?.modules ?? [];
  check("Г: кухня в углу — нижний угловой, 2 куска столешницы, планки у крыла", mods.filter((m) => m.corner).length === 1 && mods.filter((m) => m.worktop).length === 2 && mods.filter((m) => m.plank === "plank").length === 2, `модулей ${mods.length}, столешниц ${mods.filter((m) => m.worktop).length}, планок ${mods.filter((m) => m.plank === "plank").length}`);
  check("Г: крыло у правой стены (повёрнуто 270)", mods.some((m) => m.rot === 270));
  const toast = await page.locator("text=Изменение не применено").count();
  check("Г: без сообщения «Изменение не применено»", toast === 0);
  await shot(page, "g-03-added");
  await page.context().close();
}
// 2. П: по задней 3600 в комнате шириной 4000 — ошибка у поля с кнопкой «По задней стене 4000»; затем «Добавить в комнату»
{
  const page = await open();
  await click(page.getByRole("tab", { name: "Кухонные модули" }));
  await click(page.getByRole("button", { name: "Кухня П-образная" }));
  check("П: по задней стене — ширина комнаты", (await value(page, "По задней стене новой мебели")) === "4000", await value(page, "По задней стене новой мебели"));
  await field(page, "По задней стене новой мебели", "3600");
  await field(page, "По правой стене новой мебели", "3200");
  const list = await issues(page);
  check("П: две ошибки — по задней ≠ ширины комнаты, по правой длиннее стены", list.map((x) => x.field).join(",") === "width,side", list.map((x) => x.text).join(" / "));
  await page.locator(".palette-issues").scrollIntoViewIfNeeded(); await shot(page, "u-01-issues");
  await click(page.getByRole("button", { name: "По задней стене 4000", exact: true }));
  await click(page.getByRole("button", { name: "По правой стене 2979", exact: true }));
  check("П: исправлено кнопками — 4000 и 2979 (21 мм под фальш-планку у стены напротив)", (await value(page, "По задней стене новой мебели")) === "4000" && (await value(page, "По правой стене новой мебели")) === "2979");
  check("П: после исправления ошибок нет", (await issues(page)).length === 0);
  await click(page.getByRole("button", { name: "Добавить в комнату", exact: true })); await page.waitForTimeout(1500);
  const mods = (await state(page))?.modules ?? [];
  check("П: два нижних угловых, 3 куска столешницы, 4 планки", mods.filter((m) => m.corner).length === 2 && mods.filter((m) => m.worktop).length === 3 && mods.filter((m) => m.plank === "plank").length === 4, `модулей ${mods.length}`);
  await shot(page, "u-02-added");
  await page.context().close();
}
check("ошибок страницы нет", pageErrors.length === 0, pageErrors.join(" | "));
const ok = results.filter((r) => r[1]).length;
console.log(`\nИтог: ${ok}/${results.length} проверок; клики ${stats.clicks}, вводы ${stats.inputs}, клавиши ${stats.keys}`);
writeFileSync(`${out}/scenario.json`, JSON.stringify({ results, stats, pageErrors }, null, 1));
await browser.close();
process.exit(ok === results.length ? 0 : 1);
